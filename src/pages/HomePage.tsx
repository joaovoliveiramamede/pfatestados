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
                setCode(formatCode(event.target.value));
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
