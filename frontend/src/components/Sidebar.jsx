import { NavLink, useNavigate } from "react-router-dom";
import { clearToken, getAuthUser, hasRequiredRole } from "../lib/auth";

const navItems = [
  { to: "/caixa", label: "Caixa" },
  { to: "/estoque", label: "Estoque" },
  { to: "/descontos", label: "Descontos", minRole: "manager" },
  { to: "/admin", label: "Admin", minRole: "admin" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = getAuthUser();
  const items = navItems.filter((item) => !item.minRole || hasRequiredRole(item.minRole));

  const logout = () => {
    clearToken();
    navigate("/", { replace: true });
  };

  return (
    <aside className="sidebar">
      <div>
        <h1>GreenStore Pro</h1>
        <p>Operação inteligente</p>
      </div>
      <nav>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div>
        <span className="badge">{user?.role || "sem sessão"}</span>
        <button className="button" onClick={logout} style={{ marginTop: "12px", width: "100%" }} type="button">
          Sair
        </button>
      </div>
    </aside>
  );
}
