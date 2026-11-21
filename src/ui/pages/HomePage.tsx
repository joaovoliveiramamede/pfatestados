import { useEffect, useState, type FormEvent } from "react";
import { configuracao } from "../../composition";
import { formatarCodigo, normalizarCodigo } from "../../domain/codigo";
import { Layout } from "../components/Layout";

export function HomePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = configuracao.clinica;
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizarCodigo(code);
    if (normalized.length !== 8) {
      setError("Digite os 8 caracteres do código.");
      return;
    }
    window.location.hash = `/acesso/${normalized}`;
  }

  return (
    <Layout clinica={configuracao.clinica} actions={<a className="text-link" href="#/medico">Área do médico</a>}>
      <section className="wrap narrow">
        <p className="eyebrow">Atestado</p>
        <h1>Baixar o PDF</h1>
        <p className="lede">Use o código que acompanha o QR Code enviado pela clínica.</p>
        <form className="code-form" onSubmit={onSubmit} noValidate>
          <label htmlFor="code">Código de acesso</label>
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
              value={code}
              onChange={(event) => {
                setCode(formatarCodigo(event.target.value));
                setError("");
              }}
            />
            <button type="submit">Acessar</button>
          </div>
          {error ? <p className="field-error">{error}</p> : null}
        </form>
      </section>
    </Layout>
  );
}
