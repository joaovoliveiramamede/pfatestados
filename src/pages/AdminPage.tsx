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
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = "Atesta · Área da clínica";
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (qr) resultRef.current?.scrollIntoView({ block: "start" });
  }, [qr]);

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
    setQr(null);
    setPhase("login");
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPatientError("");
    setFileError("");
    const form = event.currentTarget;
    const data = new FormData(form);
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
      setQr(result.entrega);
      setToast("QR Code pronto para enviar.");
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
    const confirmed = window.confirm(`Excluir os atestados de ${entrega.paciente}?`);
    if (!confirmed) return;
    try {
      await api(`/api/admin/entregas/${entrega.id}`, { method: "DELETE" });
      if (qr?.id === entrega.id) setQr(null);
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
          <section className="narrow">
            <p className="eyebrow">Área da clínica</p>
            <h1>Entrar</h1>
            <form className="panel" onSubmit={(event) => void onLogin(event)} noValidate>
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
              <p className="demo-note">Demonstração: admin / atesta123</p>
            </form>
          </section>
        ) : null}

        {phase === "app" ? (
          <section>
            {qr ? (
              <article className="result" ref={resultRef} aria-labelledby="qr-heading">
                <div className="result-copy">
                  <p className="eyebrow">Pronto para enviar</p>
                  <h1 id="qr-heading">{qr.paciente}</h1>
                  <p className="lede">Mostre ou envie esta imagem. A legenda já está no QR Code.</p>
                  <input className="link-field" readOnly value={qr.link} aria-label="Link do paciente" onFocus={(event) => event.target.select()} />
                  <div className="result-actions">
                    <button type="button" className="button" onClick={() => void copyLink(qr.link)}>
                      Copiar link
                    </button>
                    <a className="button ghost" href={`/api/admin/entregas/${qr.id}/qr.png`} download={`atesta-${qr.codigoFormatado}.png`}>
                      Baixar imagem
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
                  <button type="button" className="text-link button-reset" onClick={() => setQr(null)}>
                    Nova entrega
                  </button>
                </div>
                <img
                  src={`/api/admin/entregas/${qr.id}/qr.png?v=${qr.criadoEm}`}
                  alt={`QR Code Atesta de ${qr.paciente}, código ${qr.codigoFormatado}. Aponte a câmera para baixar o atestado.`}
                />
              </article>
            ) : (
              <div className="admin-head">
                <div>
                  <p className="eyebrow">Clínica</p>
                  <h1>Nova entrega</h1>
                </div>
                <p className="stats">{entregas.length ? countLabel : "Nenhuma entrega"}</p>
              </div>
            )}

            <div className="admin-grid">
              <form id="nova-entrega" className="panel" onSubmit={(event) => void onUpload(event)} noValidate>
                <h2>Dados do envio</h2>
                <label>
                  Nome do paciente
                  <input name="paciente" maxLength={80} placeholder="Maria Souza" />
                </label>
                {patientError ? <p className="field-error">{patientError}</p> : null}
                <label>
                  Observação <span className="optional">opcional</span>
                  <input name="observacao" maxLength={240} placeholder="Consulta de retorno" />
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
                    <strong>Adicionar PDFs</strong>
                  </p>
                  <p className="hint">Até 5 arquivos, 8 MB cada.</p>
                </div>
                {files.length ? (
                  <ul className="file-list">
                    {files.map((file) => (
                      <li key={`${file.name}-${file.size}`}>
                        <span>
                          {file.name} · {formatBytes(file.size)}
                        </span>
                        <button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))}>
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {fileError ? <p className="field-error">{fileError}</p> : null}
                <button type="submit" className="button" disabled={sending}>
                  {sending ? "Gerando…" : "Gerar QR Code"}
                </button>
              </form>

              <section className="panel list-panel" aria-labelledby="lista-titulo">
                <div className="list-head">
                  <h2 id="lista-titulo">Enviados</h2>
                  <label className="search">
                    <span className="vh">Buscar paciente</span>
                    <input type="search" placeholder="Buscar" value={busca} onChange={(event) => setBusca(event.target.value)} />
                  </label>
                </div>
                {!visible.length ? (
                  <p className="empty-list">{entregas.length ? "Nenhum paciente com esse nome." : "Nenhuma entrega ainda."}</p>
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
                        </div>
                        <div className="delivery-actions">
                          <button type="button" className="chip" onClick={() => setQr(entrega)}>
                            Ver QR
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
      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </Layout>
  );
}
