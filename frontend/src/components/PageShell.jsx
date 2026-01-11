import { Sidebar } from "./Sidebar";

export function PageShell({ title, subtitle, children, actions }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <div className="topbar">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div>{actions}</div>
        </div>
        {children}
      </main>
    </div>
  );
}
