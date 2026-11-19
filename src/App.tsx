import { Layout } from "./components/Layout";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { PortalPage } from "./pages/PortalPage";

function currentPath() {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path || "/";
}

export function App() {
  const path = currentPath();
  if (path === "/admin") return <AdminPage />;

  const access = path.match(/^\/acesso\/([^/]+)$/);
  if (access) return <PortalPage code={decodeURIComponent(access[1])} />;

  if (path !== "/") {
    return (
      <Layout>
        <section className="wrap portal">
          <h1>Página não encontrada</h1>
          <p className="lede">Esse endereço não faz parte da entrega de atestados.</p>
          <a className="button" href="/">
            Voltar ao início
          </a>
        </section>
      </Layout>
    );
  }

  return <HomePage />;
}
