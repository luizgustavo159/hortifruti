import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/caixa", label: "Caixa" },
  { to: "/estoque", label: "Estoque" },
  { to: "/descontos", label: "Descontos" },
  { to: "/admin", label: "Admin" },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div>
        <h1>GreenStore Pro</h1>
        <p>Operação inteligente</p>
      </div>
      <nav>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div>
        <span className="badge">Operador logado</span>
      </div>
    </aside>
  );
}
