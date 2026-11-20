import { useEffect, useState } from "react";
import { api } from "../api";
import { Layout } from "../components/Layout";
import { formatBytes, formatDate, normalizeCode } from "../format";
import type { Arquivo, Entrega } from "../types";

type PortalPageProps = { code: string };

export function PortalPage({ code }: PortalPageProps) {
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const normalized = normalizeCode(code);

  useEffect(() => {
    let active = true;
    async function load() {
      if (normalized.length !== 8) {
        setError("Não encontramos atestados para esse código.");
        setLoading(false);
        return;
      }
      try {
        const data = await api<{ entrega: Entrega }>(`/api/acesso/${normalized}`);
        if (!active) return;
        setEntrega(data.entrega);
        setSelectedId(data.entrega.arquivos.length === 1 ? data.entrega.arquivos[0].id : null);
        document.title = `Atestados de ${data.entrega.paciente} · Atesta`;
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Código não encontrado.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [normalized]);

  const selected = entrega?.arquivos.find((arquivo) => arquivo.id === selectedId) ?? null;
  const onlyOne = entrega?.arquivos.length === 1;

  function download(arquivo: Arquivo) {
    if (!entrega) return;
    const anchor = document.createElement("a");
    anchor.href = `/api/acesso/${entrega.codigo}/arquivos/${arquivo.id}`;
    anchor.download = arquivo.nome;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <Layout actions={<a className="text-link" href="/">Início</a>}>
      <section className="wrap portal">
        {loading ? <p className="status">Carregando atestados…</p> : null}
        {!loading && error ? (
          <div className="empty">
            <h1>Código não encontrado</h1>
            <p>{error}</p>
            <a className="button" href="/">
              Tentar outro código
            </a>
          </div>
        ) : null}
        {entrega && selected && onlyOne ? (
          <div className="portal-layout">
            <div className="portal-copy">
              <p className="eyebrow">Código {entrega.codigoFormatado}</p>
              <h1>{entrega.paciente}</h1>
              <p className="lede">
                {entrega.observacao ? `${entrega.observacao}. ` : ""}
                Enviado em {formatDate(entrega.criadoEm)}.
              </p>
              <article className="single-file">
                <h2>{selected.nome}</h2>
                <p>{formatBytes(selected.tamanho)}</p>
                <button type="button" className="button" onClick={() => download(selected)}>
                  Baixar PDF
                </button>
                <a
                  className="text-link"
                  href={`/api/acesso/${entrega.codigo}/arquivos/${selected.id}?ver=1`}
                  target="_blank"
                  rel="noopener"
                >
                  Abrir no navegador
                </a>
              </article>
            </div>
            <aside className="preview">
              <p>Pré-visualização</p>
              <iframe title="Pré-visualização do atestado" src={`/api/acesso/${entrega.codigo}/arquivos/${selected.id}?ver=1`} />
            </aside>
          </div>
        ) : null}
        {entrega && !onlyOne ? (
          <>
            <p className="eyebrow">Código {entrega.codigoFormatado}</p>
            <div className="portal-head">
              <h1>{entrega.paciente}</h1>
              <p>
                {entrega.observacao ? `${entrega.observacao}. ` : ""}
                Escolha o atestado e baixe o PDF. Enviado em {formatDate(entrega.criadoEm)}.
              </p>
            </div>
            <div className="portal-layout">
              <div>
                <div className="cert-list" role="radiogroup" aria-label="Atestados disponíveis">
                  {entrega.arquivos.map((arquivo) => (
                    <label className="cert" key={arquivo.id}>
                      <input
                        type="radio"
                        name="atestado"
                        value={arquivo.id}
                        checked={selectedId === arquivo.id}
                        onChange={() => setSelectedId(arquivo.id)}
                      />
                      <span>
                        <span className="cert-name">{arquivo.nome}</span>
                        <span className="cert-meta">{formatBytes(arquivo.tamanho)}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="download-bar">
                  <div>
                    <strong>{selected ? selected.nome : "Selecione um atestado"}</strong>
                    <span>{selected ? formatBytes(selected.tamanho) : "Toque no documento para escolher"}</span>
                  </div>
                  <button type="button" className="button" disabled={!selected} onClick={() => selected && download(selected)}>
                    Baixar PDF
                  </button>
                </div>
              </div>
              <aside className="preview">
                <p>Pré-visualização</p>
                {selected ? (
                  <iframe
                    title="Pré-visualização do atestado"
                    src={`/api/acesso/${entrega.codigo}/arquivos/${selected.id}?ver=1`}
                  />
                ) : (
                  <p className="hint">Selecione um atestado para visualizar.</p>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </section>
    </Layout>
  );
}
