import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";

export function AdminPerfil() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/users");
      setUsers(data || []);
      if (data && data.length > 0) {
        setSelectedUser(data[0]);
      }
      setError(null);
    } catch (err) {
      setError("Erro ao carregar usuários: " + err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) {
      return;
    }

    try {
      setDeleting(true);
      await apiFetch(`/users/${userId}`, { method: "DELETE" });
      setUsers(users.filter((u) => u.id !== userId));
      setSelectedUser(null);
      alert("Usuário excluído com sucesso.");
    } catch (err) {
      alert("Erro ao excluir usuário: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: "Administrador",
      manager: "Gerente",
      supervisor: "Supervisor",
      operator: "Operador",
    };
    return labels[role] || role;
  };

  const getStatusLabel = (isActive) => {
    return isActive ? "Ativo" : "Inativo";
  };

  return (
    <PageShell
      title="Gestão de usuários"
      subtitle="Controle de perfis, permissões e sessões"
      actions={<button className="button">Novo usuário</button>}
    >
      <div className="section">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="card">
            <p>Carregando usuários...</p>
          </div>
        ) : (
          <>
            <div className="card">
              <h3>Equipe</h3>
              {users.length === 0 ? (
                <p>Nenhum usuário encontrado.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Perfil</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <button
                            onClick={() => handleSelectUser(user)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: selectedUser?.id === user.id ? "#007bff" : "inherit",
                              textDecoration: selectedUser?.id === user.id ? "underline" : "none",
                            }}
                          >
                            {user.name}
                          </button>
                        </td>
                        <td>{user.email}</td>
                        <td>{getRoleLabel(user.role)}</td>
                        <td>
                          <span className="tag">{getStatusLabel(user.is_active)}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleting}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: deleting ? "not-allowed" : "pointer",
                              color: "#dc3545",
                              textDecoration: "underline",
                            }}
                          >
                            {deleting ? "Excluindo..." : "Excluir"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {selectedUser && (
              <div className="panel">
                <h4>Detalhes do usuário</h4>
                <ul className="list">
                  <li>
                    <span>Nome</span>
                    <strong>{selectedUser.name}</strong>
                  </li>
                  <li>
                    <span>Email</span>
                    <strong>{selectedUser.email}</strong>
                  </li>
                  <li>
                    <span>Telefone</span>
                    <strong>{selectedUser.phone || "Não informado"}</strong>
                  </li>
                  <li>
                    <span>Perfil</span>
                    <strong>{getRoleLabel(selectedUser.role)}</strong>
                  </li>
                  <li>
                    <span>Status</span>
                    <strong>{getStatusLabel(selectedUser.is_active)}</strong>
                  </li>
                  <li>
                    <span>Permissões</span>
                    <strong>
                      {selectedUser.permissions && selectedUser.permissions.length > 0
                        ? selectedUser.permissions.join(", ")
                        : "Nenhuma"}
                    </strong>
                  </li>
                  <li>
                    <span>Cadastrado em</span>
                    <strong>{new Date(selectedUser.created_at).toLocaleDateString("pt-BR")}</strong>
                  </li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
