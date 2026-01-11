import { PageShell } from "../components/PageShell";

export function AdminPerfil() {
  return (
    <PageShell
      title="Gestão de usuários"
      subtitle="Controle de perfis, permissões e sessões"
      actions={<button className="button">Novo usuário</button>}
    >
      <div className="section">
        <div className="card">
          <h3>Equipe</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Perfil</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ana Costa</td>
                <td>Gerente</td>
                <td>
                  <span className="tag">Ativo</span>
                </td>
              </tr>
              <tr>
                <td>Lucas Lima</td>
                <td>Operador</td>
                <td>
                  <span className="tag">Ativo</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Detalhes do usuário</h4>
          <ul className="list">
            <li>
              <span>Último acesso</span>
              <strong>Hoje 08:12</strong>
            </li>
            <li>
              <span>Permissões</span>
              <strong>Admin, Relatórios</strong>
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
