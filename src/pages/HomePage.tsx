import { useState, type FormEvent } from "react";
import { Layout } from "../components/Layout";
import { formatCode, normalizeCode } from "../format";

export function HomePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeCode(code);
    if (normalized.length !== 8) {
      setError("Digite os 8 caracteres do código.");
      return;
    }
    window.location.href = `/acesso/${normalized}`;
  }

  return (
    <Layout actions={<a className="text-link" href="/admin">Área da clínica</a>}>
      <section className="wrap landing">
        <div className="hero">
          <p className="eyebrow">Entrega de atestados</p>
          <h1>O PDF chega no celular, pronto para baixar.</h1>
          <p className="lede">
            A clínica anexa o atestado, gera um QR Code e envia o link. Quem recebe abre no celular, escolhe o documento e faz o download.
          </p>
          <form className="code-form" onSubmit={onSubmit} noValidate>
            <label htmlFor="code">Código do atestado</label>
            <div className="code-row">
              <input
                id="code"
                className="code-input"
                name="codigo"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={9}
                placeholder="AB3K-7PQM"
                aria-describedby="code-hint"
                value={code}
                onChange={(event) => {
                  setCode(formatCode(event.target.value));
                  setError("");
                }}
              />
              <button type="submit">Acessar</button>
            </div>
            <p id="code-hint" className="hint">
              Está no link ou logo abaixo do QR Code que a clínica enviou.
            </p>
            {error ? <p className="field-error">{error}</p> : null}
          </form>
        </div>

        <aside className="hero-card" aria-hidden="true">
          <div className="ticket">
            <div className="ticket-top">
              <span className="stamp">PDF</span>
              <div>
                <p className="ticket-kicker">Atestado</p>
                <p className="ticket-title">Consulta de retorno</p>
              </div>
            </div>
            <div className="ticket-meta">
              <span>Maria Souza</span>
              <span>AB3K-7PQM</span>
            </div>
            <div className="ticket-qr">
              <span /><span /><span /><span />
              <span /><span /><span /><span />
              <span /><span /><span /><span />
            </div>
            <p className="ticket-foot">Aponte a câmera para abrir</p>
          </div>
        </aside>
      </section>

      <section className="wrap steps" aria-label="Como funciona">
        <article>
          <span>01</span>
          <h2>A clínica anexa os PDFs</h2>
          <p>Um ou mais atestados entram na pasta do projeto. Não há banco de dados.</p>
        </article>
        <article>
          <span>02</span>
          <h2>O QR Code sai na hora</h2>
          <p>O link pode ser copiado ou encaminhado no WhatsApp junto com a imagem do código.</p>
        </article>
        <article>
          <span>03</span>
          <h2>O paciente escolhe e baixa</h2>
          <p>Na página do link, a pessoa seleciona o atestado certo e salva o PDF.</p>
        </article>
      </section>
    </Layout>
  );
}
