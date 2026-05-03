import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { clearToken, clearUser, getAuthUser } from "../lib/auth";

const navItems = [
  { to: "/caixa", label: "Caixa" },
  { to: "/estoque", label: "Estoque" },
  { to: "/descontos", label: "Descontos" },
  { to: "/admin", label: "Dashboard Admin" },
  { to: "/admin/funcionarios", label: "Funcionários" },
  { to: "/admin/logs", label: "Logs" },
  { to: "/admin/configuracao", label: "Configurações" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = getAuthUser() || { name: "Admin Demo", role: "admin" };
  const items = navItems;
  const [theme, setTheme] = useState(() => localStorage.getItem("greenstore_theme") || "light");

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem("greenstore_theme", theme);
  }, [theme]);

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
        <button className="button" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={{ marginTop: "12px", width: "100%" }} type="button">
          {theme === "dark" ? "Tema Claro" : "Tema Escuro"}
        </button>
        <button className="button" onClick={logout} style={{ marginTop: "12px", width: "100%" }} type="button">
          Sair
        </button>
      </div>
    </aside>
  );
}
