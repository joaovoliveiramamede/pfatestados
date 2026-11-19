import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { api } from "../api";
import { Layout } from "../components/Layout";
import { formatBytes, formatDate } from "../format";
import type { Entrega } from "../types";

const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;

export function AdminPage() {
  const [phase, setPhase] = useState<"checking" | "login" | "app">("checking");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [busca, setBusca] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [patientError, setPatientError] = useState("");
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [qr, setQr] = useState<Entrega | null>(null);
  const [toast, setToast] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    document.title = "Atesta · Área da clínica";
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadEntregas() {
    const data = await api<{ entregas: Entrega[] }>("/api/admin/entregas");
    setEntregas(data.entregas);
  }

  useEffect(() => {
    let active = true;
    async function boot() {
      const response = await fetch("/api/admin/me", { credentials: "same-origin" });
      if (!active) return;
      if (!response.ok) {
        setPhase("login");
        return;
      }
      try {
        await loadEntregas();
        if (active) setPhase("app");
      } catch (error) {
        if (!active) return;
        setPhase("app");
        setToast(error instanceof Error ? error.message : "Não foi possível carregar as entregas.");
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, []);

  function openQr(entrega: Entrega) {
    setQr(entrega);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    let error = "";
    for (const file of Array.from(list)) {
      const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!pdf) {
        error = "Envie apenas arquivos PDF.";
        continue;
      }
      if (file.size > MAX_BYTES) {
        error = "Cada PDF pode ter no máximo 8 MB.";
        continue;
      }
      if (next.length >= MAX_FILES) {
        error = "Envie no máximo 5 PDFs por vez.";
        break;
      }
      const already = next.some((item) => item.name === file.name && item.size === file.size);
      if (!already) next.push(file);
    }
    setFiles(next);
    setFileError(error);
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          usuario: String(data.get("usuario") || ""),
          senha: String(data.get("senha") || ""),
        }),
      });
      await loadEntregas();
      setPhase("app");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Usuário ou senha incorretos.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function onLogout() {
    await api("/api/admin/logout", { method: "POST" });
    setEntregas([]);
    setPhase("login");
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPatientError("");
    setFileError("");
    const data = new FormData(event.currentTarget);
    const paciente = String(data.get("paciente") || "").trim().replace(/\s+/g, " ");
    const observacao = String(data.get("observacao") || "").trim();
    if (paciente.length < 2) {
      setPatientError("Informe o nome do paciente.");
      return;
    }
    if (!files.length) {
      setFileError("Anexe pelo menos um PDF.");
      return;
    }

    const form = event.currentTarget;
    const body = new FormData();
    body.set("paciente", paciente);
    body.set("observacao", observacao);
    files.forEach((file) => body.append("arquivos", file, file.name));
    setSending(true);
    try {
      const result = await api<{ entrega: Entrega }>("/api/admin/entregas", { method: "POST", body });
      form.reset();
      setFiles([]);
      await loadEntregas();
      openQr(result.entrega);
      setToast("Link e QR Code prontos.");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setToast("Link copiado.");
    } catch {
      setToast("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  async function removeEntrega(entrega: Entrega) {
    const confirmed = window.confirm(`Excluir os atestados de ${entrega.paciente}? Os PDFs saem da pasta uploads.`);
    if (!confirmed) return;
    try {
      await api(`/api/admin/entregas/${entrega.id}`, { method: "DELETE" });
      setToast("Entrega excluída.");
      await loadEntregas();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  function onDrag(event: DragEvent<HTMLDivElement>, active: boolean) {
    event.preventDefault();
    setDragOver(active);
  }

  const term = busca.trim().toLocaleLowerCase("pt-BR");
  const visible = entregas.filter((item) => item.paciente.toLocaleLowerCase("pt-BR").includes(term));
  const countLabel = entregas.length === 1 ? "1 entrega" : `${entregas.length} entregas`;

  return (
    <Layout
      brandHref="/admin"
      actions={
        <>
          <a className="text-link" href="/">
            Página do paciente
          </a>
          {phase === "app" ? (
            <button type="button" className="text-link button-reset" onClick={() => void onLogout()}>
              Sair
            </button>
          ) : null}
        </>
      }
    >
      <div className="wrap admin-main">
        {phase === "checking" ? <p className="status">Carregando…</p> : null}

        {phase === "login" ? (
          <section className="login-layout">
            <div className="login-copy">
              <p className="eyebrow">Área da clínica</p>
              <h1>Envie o atestado e entregue o QR Code.</h1>
              <p className="lede">
                Login de demonstração, sem banco de dados. Os PDFs ficam na pasta <code>uploads</code> deste projeto.
              </p>
            </div>
            <form className="panel" onSubmit={(event) => void onLogin(event)} noValidate>
              <h2>Entrar</h2>
              <label>
                Usuário
                <input name="usuario" autoComplete="username" required defaultValue="admin" />
              </label>
              <label>
                Senha
                <input name="senha" type="password" autoComplete="current-password" required defaultValue="atesta123" />
              </label>
              {loginError ? <p className="field-error">{loginError}</p> : null}
              <button type="submit" className="button" disabled={loggingIn}>
                {loggingIn ? "Entrando…" : "Entrar"}
              </button>
              <p className="demo-note">
                Use <strong>admin</strong> e <strong>atesta123</strong>. A sessão vale só até reiniciar o servidor.
              </p>
            </form>
          </section>
        ) : null}

        {phase === "app" ? (
          <section>
            <div className="admin-head">
              <div>
                <p className="eyebrow">Painel</p>
                <h1>Entregas</h1>
              </div>
              <p className="stats">{entregas.length ? countLabel : "Nenhuma entrega"}</p>
            </div>
            <div className="admin-grid">
              <form className="panel" onSubmit={(event) => void onUpload(event)} noValidate>
                <h2>Novo envio</h2>
                <label>
                  Nome do paciente
                  <input name="paciente" maxLength={80} placeholder="Maria Souza" />
                </label>
                {patientError ? <p className="field-error">{patientError}</p> : null}
                <label>
                  Observação <span className="optional">opcional</span>
                  <input name="observacao" maxLength={240} placeholder="Consulta de 19/11 · clínica geral" />
                </label>
                <div
                  className={dragOver ? "dropzone is-dragover" : "dropzone"}
                  onDragEnter={(event) => onDrag(event, true)}
                  onDragOver={(event) => onDrag(event, true)}
                  onDragLeave={(event) => onDrag(event, false)}
                  onDrop={(event) => {
                    onDrag(event, false);
                    addFiles(event.dataTransfer.files);
                  }}
                >
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    aria-label="PDFs do atestado"
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <p>
                    <strong>Solte os PDFs aqui</strong> ou clique para escolher.
                  </p>
                  <p className="hint">Até 5 arquivos, 8 MB cada. Só PDF.</p>
                </div>
                {files.length ? (
                  <ul className="file-list">
                    {files.map((file) => (
                      <li key={`${file.name}-${file.size}`}>
                        <span>
                          {file.name} · {formatBytes(file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {fileError ? <p className="field-error">{fileError}</p> : null}
                <button type="submit" className="button" disabled={sending}>
                  {sending ? "Enviando…" : "Gerar link e QR Code"}
                </button>
              </form>

              <section className="panel list-panel" aria-labelledby="lista-titulo">
                <div className="list-head">
                  <h2 id="lista-titulo">Enviados</h2>
                  <label className="search">
                    <span className="vh">Buscar paciente</span>
                    <input
                      type="search"
                      placeholder="Buscar paciente"
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                    />
                  </label>
                </div>
                {!visible.length ? (
                  <p className="empty-list">
                    {entregas.length
                      ? "Nenhum paciente com esse nome."
                      : "Nenhuma entrega ainda. Envie o primeiro PDF para gerar um QR Code."}
                  </p>
                ) : (
                  <ul className="delivery-list">
                    {visible.map((entrega) => (
                      <li className="delivery" key={entrega.id}>
                        <div>
                          <h3>{entrega.paciente}</h3>
                          <p>
                            {entrega.codigoFormatado} · {entrega.arquivos.length === 1 ? "1 PDF" : `${entrega.arquivos.length} PDFs`} ·{" "}
                            {formatDate(entrega.criadoEm, "short")}
                          </p>
                          <p>{entrega.arquivos.map((arquivo) => arquivo.nome).join(", ")}</p>
                        </div>
                        <div className="delivery-actions">
                          <button type="button" className="chip" onClick={() => openQr(entrega)}>
                            QR Code
                          </button>
                          <button type="button" className="chip" onClick={() => void copyLink(entrega.link)}>
                            Copiar link
                          </button>
                          <button type="button" className="danger" onClick={() => void removeEntrega(entrega)}>
                            Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </section>
        ) : null}
      </div>

      <dialog
        className="qr-dialog"
        ref={dialogRef}
        aria-labelledby="qr-heading"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        onClose={() => setQr(null)}
      >
        {qr ? (
          <>
            <p className="eyebrow">Pronto para enviar</p>
            <h2 id="qr-heading">{qr.paciente}</h2>
            <p className="hint">{qr.observacao || "Mostre o QR Code ou envie o link para o paciente."}</p>
            <img src={`/api/admin/entregas/${qr.id}/qr.png`} alt={`QR Code do link de ${qr.paciente}`} width={280} height={280} />
            <p className="code-pill">{qr.codigoFormatado}</p>
            <input className="link-field" readOnly value={qr.link} onFocus={(event) => event.target.select()} />
            <div className="dialog-actions">
              <button type="button" className="button" onClick={() => void copyLink(qr.link)}>
                Copiar link
              </button>
              <a className="button ghost" href={`/api/admin/entregas/${qr.id}/qr.png`} download={`qr-${qr.codigoFormatado}.png`}>
                Baixar QR
              </a>
              <a
                className="button ghost"
                href={`https://wa.me/?text=${encodeURIComponent(`Olá, ${qr.paciente}. Seus atestados já podem ser baixados neste link: ${qr.link}`)}`}
                target="_blank"
                rel="noopener"
              >
                WhatsApp
              </a>
            </div>
            <button type="button" className="text-link button-reset close-dialog" onClick={() => dialogRef.current?.close()}>
              Fechar
            </button>
          </>
        ) : null}
      </dialog>
      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </Layout>
  );
}
