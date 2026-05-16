import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAuthUser, hasRequiredRole } from "../lib/auth";
import { ThemeSwitcher } from "./ThemeSwitcher";

const navItems = [
  { to: "/caixa", label: "Caixa PDV", minRole: "operator" },
  { to: "/estoque", label: "Estoque", minRole: "operator" },
  { to: "/descontos", label: "Descontos", minRole: "manager" },
  { to: "/admin", label: "Dashboard", minRole: "admin" },
  { to: "/admin/relatorios", label: "Relatórios", minRole: "manager" },
  { to: "/admin/funcionarios", label: "Funcionários", minRole: "admin" },
  { to: "/admin/logs", label: "Logs de Auditoria", minRole: "manager" },
  { to: "/admin/configuracao", label: "Configurações", minRole: "admin" },
];

export function Sidebar() {
  const { logout } = useAuth();
  const user = getAuthUser();
  
  // Filtrar itens baseado na role do usuário
  const items = navItems.filter(item => hasRequiredRole(item.minRole));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon-small">🌿</div>
        <div>
          <h1>GreenStore</h1>
          <p>Painel de Controle</p>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink 
            key={item.to} 
            to={item.to} 
            className={({ isActive }) => (isActive ? "active" : undefined)}
            end={item.to === "/admin"}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ThemeSwitcher />
        <div className="user-info">
          <span className="user-role-badge">{user?.role || "operador"}</span>
          <p className="user-name">{user?.name || "Usuário"}</p>
        </div>
        <button className="logout-button" onClick={logout} type="button">
          Sair do Sistema
        </button>
      </div>
    </aside>
  );
}
