import { PageShell } from "../components/PageShell";

export function AdminDashboard() {
  return (
    <PageShell
      title="Administração"
      subtitle="Indicadores estratégicos e decisões críticas"
      actions={<button className="button">Gerar relatório</button>}
    >
      <div className="card-grid">
        <div className="card">
          <h3>Usuários ativos</h3>
          <strong>24</strong>
        </div>
        <div className="card">
          <h3>Gerentes ativos</h3>
          <strong>5</strong>
        </div>
        <div className="card">
          <h3>Ocorrências críticas</h3>
          <strong>3</strong>
        </div>
        <div className="card">
          <h3>Pendências</h3>
          <strong>7</strong>
        </div>
      </div>
      <div className="section">
        <div className="card">
          <h3>Visão consolidada</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Área</th>
                <th>Status</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Caixa</td>
                <td>Eficiência alta</td>
                <td>95%</td>
              </tr>
              <tr>
                <td>Estoque</td>
                <td>Reabastecer</td>
                <td>+12 itens</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Alertas do dia</h4>
          <ul className="list">
            <li>
              <span>Usuário bloqueado</span>
              <span>há 2 min</span>
            </li>
            <li>
              <span>Perda registrada</span>
              <span>há 15 min</span>
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
