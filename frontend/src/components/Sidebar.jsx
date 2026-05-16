import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { clearToken, clearUser, getAuthUser, hasRequiredRole } from "../lib/auth";

const navItems = [
  { to: "/caixa", label: "Caixa", minRole: "operator" },
  { to: "/estoque", label: "Estoque", minRole: "operator" },
  { to: "/descontos", label: "Descontos", minRole: "manager" },
  { to: "/admin", label: "Dashboard Admin", minRole: "manager" },
  { to: "/admin/advanced", label: "Dashboard Avançado", minRole: "manager" },
  { to: "/admin/funcionarios", label: "Funcionários", minRole: "admin" },
  { to: "/admin/logs", label: "Logs", minRole: "manager" },
  { to: "/admin/configuracao", label: "Configurações", minRole: "admin" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = getAuthUser();
  const items = navItems.filter(item => hasRequiredRole(item.minRole));

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (_error) {
      // Mesmo se a sessão já estiver inválida no backend, limpamos o estado local.
    } finally {
      clearToken();
      clearUser();
      navigate("/", { replace: true });
    }
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
