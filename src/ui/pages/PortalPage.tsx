import { useEffect, useState } from "react";
import { casos, configuracao } from "../../composition";
import { normalizarCodigo } from "../../domain/codigo";
import { formatarBytes, formatarData } from "../../domain/formatacao";
import type { ArquivoEntrega, Entrega } from "../../domain/tipos";
import { baixarPdf } from "../baixar";
import { Layout } from "../components/Layout";

type PortalPageProps = { code: string };

export function PortalPage({ code }: PortalPageProps) {
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState("");
  const normalized = normalizarCodigo(code);

  useEffect(() => {
    let ativo = true;
    casos
      .obter(normalized)
      .then((dados) => {
        if (!ativo) return;
        if (!dados) {
          setError("Não encontramos atestado para esse código.");
          return;
        }
        setEntrega(dados);
        setSelectedId(dados.arquivos[0]?.id ?? null);
        document.title = `${dados.paciente} · ${configuracao.clinica}`;
      })
      .catch((erro: unknown) => {
        if (!ativo) return;
        setError(erro instanceof Error ? erro.message : "Não foi possível abrir o atestado.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [normalized]);

  const selected = entrega?.arquivos.find((arquivo) => arquivo.id === selectedId) ?? null;
  const unico = entrega?.arquivos.length === 1;

  async function baixar(arquivo: ArquivoEntrega) {
    try {
      await baixarPdf(arquivo.url, arquivo.nome);
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não foi possível baixar o PDF.");
    }
  }

  return (
    <Layout clinica={configuracao.clinica} actions={<a className="text-link" href="#/">Início</a>}>
      <section className="wrap portal">
        {loading ? <p className="status">Carregando atestados…</p> : null}
        {!loading && error ? (
          <div className="empty">
            <h1>Código não encontrado</h1>
            <p className="lede">{error}</p>
            <a className="button" href="#/">
              Tentar outro código
            </a>
          </div>
        ) : null}
        {entrega && selected && unico ? (
          <div className="portal-layout">
            <div className="portal-copy">
              <p className="eyebrow">Código {entrega.codigoFormatado}</p>
              <h1>{entrega.paciente}</h1>
              <p className="lede">
                {entrega.observacao ? `${entrega.observacao}. ` : ""}
                Enviado em {formatarData(entrega.criadoEm)}.
              </p>
              <article className="single-file">
                <h2>{selected.nome}</h2>
                <p>{formatarBytes(selected.tamanho)}</p>
                <button type="button" className="button" onClick={() => void baixar(selected)}>
                  Baixar PDF
                </button>
              </article>
            </div>
            <aside className="preview">
              <p>Pré-visualização</p>
              <iframe title="Pré-visualização do atestado" src={selected.url} />
            </aside>
          </div>
        ) : null}
        {entrega && !unico ? (
          <>
            <p className="eyebrow">Código {entrega.codigoFormatado}</p>
            <div className="portal-head">
              <h1>{entrega.paciente}</h1>
              <p>
                {entrega.observacao ? `${entrega.observacao}. ` : ""}
                Escolha o atestado e baixe o PDF. Enviado em {formatarData(entrega.criadoEm)}.
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
                        <span className="cert-meta">{formatarBytes(arquivo.tamanho)}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="download-bar">
                  <div>
                    <strong>{selected ? selected.nome : "Selecione um atestado"}</strong>
                    <span>{selected ? formatarBytes(selected.tamanho) : "Toque no documento para escolher"}</span>
                  </div>
                  <button type="button" className="button" disabled={!selected} onClick={() => selected && void baixar(selected)}>
                    Baixar PDF
                  </button>
                </div>
              </div>
              <aside className="preview">
                <p>Pré-visualização</p>
                {selected ? <iframe title="Pré-visualização do atestado" src={selected.url} /> : <p className="hint">Selecione um atestado para visualizar.</p>}
              </aside>
            </div>
          </>
        ) : null}
      </section>
      <div className={aviso ? "toast show" : "toast"} role="status">
        {aviso}
      </div>
    </Layout>
  );
}
