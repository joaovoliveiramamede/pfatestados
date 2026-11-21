import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { casos, configuracao, renderizarQr } from "../../composition";
import { formatarBytes, formatarData } from "../../domain/formatacao";
import { temCabecalhoPdf } from "../../domain/pdf";
import type { Entrega } from "../../domain/tipos";
import { LIMITE_ARQUIVOS, LIMITE_BYTES } from "../../domain/validacao";
import { Layout } from "../components/Layout";

export function MedicoPage() {
  const [phase, setPhase] = useState<"login" | "app">(casos.sessaoAtiva() ? "app" : "login");
  const [loginError, setLoginError] = useState("");
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [busca, setBusca] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [patientError, setPatientError] = useState("");
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [qr, setQr] = useState<Entrega | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [toast, setToast] = useState("");
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = `Médico · ${configuracao.clinica}`;
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (phase !== "app") return;
    let ativo = true;
    casos
      .listar()
      .then((items) => {
        if (ativo) setEntregas(items);
      })
      .catch((error: unknown) => {
        if (ativo) setToast(error instanceof Error ? error.message : "Não foi possível carregar as entregas.");
      });
    return () => {
      ativo = false;
    };
  }, [phase]);

  useEffect(() => {
    if (!qr) {
      setQrUrl("");
      setQrBlob(null);
      return;
    }
    let ativo = true;
    let url = "";
    renderizarQr({ clinica: configuracao.clinica, url: qr.link, paciente: qr.paciente, codigo: qr.codigoFormatado })
      .then((blob) => {
        if (!ativo) return;
        url = URL.createObjectURL(blob);
        setQrBlob(blob);
        setQrUrl(url);
      })
      .catch((error: unknown) => {
        if (ativo) setToast(error instanceof Error ? error.message : "Não foi possível gerar o QR Code.");
      });
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [qr]);

  useEffect(() => {
    if (qr) resultRef.current?.scrollIntoView({ block: "start" });
  }, [qr]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    let error = "";
    for (const file of Array.from(list)) {
      const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
      if (!temCabecalhoPdf(bytes)) {
        error = `"${file.name}" não é um PDF válido.`;
        continue;
      }
      if (file.size > LIMITE_BYTES) {
        error = "Cada PDF pode ter no máximo 8 MB.";
        continue;
      }
      if (next.length >= LIMITE_ARQUIVOS) {
        error = "Envie no máximo 5 PDFs por vez.";
        break;
      }
      if (!next.some((item) => item.name === file.name && item.size === file.size)) next.push(file);
    }
    setFiles(next);
    setFileError(error);
  }

  function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!casos.entrar(String(data.get("codigo") || ""))) {
      setLoginError("Código de acesso inválido.");
      return;
    }
    setLoginError("");
    setPhase("app");
  }

  function onLogout() {
    casos.sair();
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
    setSending(true);
    try {
      const entrega = await casos.criar({
        paciente: String(data.get("paciente") || ""),
        observacao: String(data.get("observacao") || ""),
        arquivos: files,
      });
      form.reset();
      setFiles([]);
      setEntregas(await casos.listar());
      setQr(entrega);
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

  function downloadQr() {
    if (!qr || !qrBlob) return;
    const url = URL.createObjectURL(qrBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `qr-${qr.codigoFormatado}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function removeEntrega(entrega: Entrega) {
    if (!window.confirm(`Excluir os atestados de ${entrega.paciente}?`)) return;
    try {
      await casos.excluir(entrega.id);
      if (qr?.id === entrega.id) setQr(null);
      setEntregas(await casos.listar());
      setToast("Entrega excluída.");
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
  const whatsapp = qr
    ? `https://wa.me/?text=${encodeURIComponent(`Olá, ${qr.paciente}. Seus atestados já podem ser baixados neste link: ${qr.link}`)}`
    : "";

  return (
    <Layout
      clinica={configuracao.clinica}
      brandHref="#/medico"
      actions={
        <>
          <a className="text-link" href="#/">
            Página do paciente
          </a>
          {phase === "app" ? (
            <button type="button" className="text-link button-reset" onClick={onLogout}>
              Sair
            </button>
          ) : null}
        </>
      }
    >
      <div className="wrap admin-main">
        {phase === "login" ? (
          <section className="narrow">
            <p className="eyebrow">Área do médico</p>
            <h1>Entrar</h1>
            <form className="panel" onSubmit={onLogin} noValidate>
              <label>
                Código de acesso
                <input name="codigo" autoComplete="off" spellCheck={false} />
              </label>
              {loginError ? <p className="field-error">{loginError}</p> : null}
              <button type="submit" className="button">
                Entrar
              </button>
            </form>
          </section>
        ) : (
          <section>
            {qr ? (
              <article className="result" ref={resultRef} aria-labelledby="qr-heading">
                <div className="result-copy">
                  <p className="eyebrow">Pronto para enviar</p>
                  <h1 id="qr-heading">{qr.paciente}</h1>
                  <p className="lede">Mostre ou envie esta imagem. A legenda já está no QR Code.</p>
                  <input className="link-field" readOnly value={qr.link} aria-label="Link do paciente" onFocus={(event) => event.currentTarget.select()} />
                  <div className="result-actions">
                    <button type="button" className="button" onClick={() => void copyLink(qr.link)}>
                      Copiar link
                    </button>
                    <button type="button" className="button ghost" disabled={!qrBlob} onClick={downloadQr}>
                      Baixar imagem
                    </button>
                    <a className="button ghost" href={whatsapp} target="_blank" rel="noopener">
                      WhatsApp
                    </a>
                  </div>
                  <button type="button" className="text-link button-reset" onClick={() => setQr(null)}>
                    Nova entrega
                  </button>
                </div>
                {qrUrl ? (
                  <img src={qrUrl} alt={`QR Code de ${qr.paciente}, código ${qr.codigoFormatado}. Aponte a câmera para baixar o atestado.`} />
                ) : (
                  <p className="status">Gerando QR Code…</p>
                )}
              </article>
            ) : (
              <div className="admin-head">
                <div>
                  <p className="eyebrow">Médico</p>
                  <h1>Nova entrega</h1>
                </div>
                <p className="stats">{entregas.length ? countLabel : "Nenhuma entrega"}</p>
              </div>
            )}

            <div className="admin-grid">
              <form className="panel" onSubmit={(event) => void onUpload(event)} noValidate>
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
                    void addFiles(event.dataTransfer.files);
                  }}
                >
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    aria-label="PDFs do atestado"
                    onChange={(event) => {
                      void addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <p>
                    <strong>Adicionar PDFs</strong>
                  </p>
                  <p className="hint">De 1 a 5 arquivos, 8 MB cada.</p>
                </div>
                {files.length ? (
                  <ul className="file-list">
                    {files.map((file) => (
                      <li key={`${file.name}-${file.size}`}>
                        <span>
                          {file.name} · {formatarBytes(file.size)}
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
                            {entrega.codigoFormatado} · {entrega.arquivos.length === 1 ? "1 PDF" : `${entrega.arquivos.length} PDFs`} · {formatarData(entrega.criadoEm)}
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
        )}
      </div>
      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">
        {toast}
      </div>
    </Layout>
  );
}
