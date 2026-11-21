import { useEffect, useState } from "react";
import { configuracao } from "../composition";
import { HomePage } from "./pages/HomePage";
import { MedicoPage } from "./pages/MedicoPage";
import { PortalPage } from "./pages/PortalPage";
import { Layout } from "./components/Layout";

function lerRota() {
  const bruto = window.location.hash.replace(/^#/, "");
  const caminho = bruto.replace(/\/+$/, "") || "/";
  return caminho.startsWith("/") ? caminho : `/${caminho}`;
}

export function App() {
  const [rota, setRota] = useState(lerRota);

  useEffect(() => {
    document.title = configuracao.clinica;
    const aoMudar = () => setRota(lerRota());
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);

  if (rota === "/medico") return <MedicoPage />;

  const acesso = rota.match(/^\/acesso\/([^/]+)$/);
  if (acesso) return <PortalPage code={decodeURIComponent(acesso[1])} />;

  if (rota !== "/") {
    return (
      <Layout clinica={configuracao.clinica}>
        <section className="page">
          <h1>Página não encontrada</h1>
          <a className="button" href="#/">
            Voltar
          </a>
        </section>
      </Layout>
    );
  }

  return <HomePage />;
}
