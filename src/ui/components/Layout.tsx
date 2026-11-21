import type { ReactNode } from "react";

type LayoutProps = {
  clinica: string;
  children: ReactNode;
  actions?: ReactNode;
  brandHref?: string;
};

export function Layout({ clinica, children, actions, brandHref = "#/" }: LayoutProps) {
  return (
    <>
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand" href={brandHref}>
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <rect x="4" y="3" width="18" height="24" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M9 10h8M9 14h8M9 18h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <rect x="18" y="16" width="10" height="10" rx="2" fill="currentColor" />
                <rect x="20.1" y="18.1" width="2.2" height="2.2" fill="#fff" />
                <rect x="23.7" y="18.1" width="2.2" height="2.2" fill="#fff" />
                <rect x="20.1" y="21.7" width="2.2" height="2.2" fill="#fff" />
              </svg>
            </span>
            {clinica}
          </a>
          <nav className="header-actions">{actions}</nav>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="site-footer">
        <div className="wrap">
          <p>{clinica} · entrega de atestados</p>
        </div>
      </footer>
    </>
  );
}
