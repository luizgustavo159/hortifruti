import { PageShell } from "../components/PageShell";

export function Estoque() {
  return (
    <PageShell
      title="Controle de estoque"
      subtitle="Monitoramento de validade, mínimos e reposições"
      actions={<button className="button">Novo produto</button>}
    >
      <div className="card-grid">
        <div className="card">
          <h3>Itens críticos</h3>
          <strong>14</strong>
        </div>
        <div className="card">
          <h3>Reposições sugeridas</h3>
          <strong>6</strong>
        </div>
        <div className="card">
          <h3>Produtos vencendo</h3>
          <strong>3</strong>
        </div>
        <div className="card">
          <h3>Perdas do mês</h3>
          <strong>R$ 1.240</strong>
        </div>
      </div>
      <div className="section">
        <div className="card">
          <h3>Inventário</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Estoque</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Alface crespa</td>
                <td>Hortaliças</td>
                <td>
                  <span className="tag">Baixo</span>
                </td>
                <td>8</td>
              </tr>
              <tr>
                <td>Morango</td>
                <td>Frutas</td>
                <td>
                  <span className="tag">Em dia</span>
                </td>
                <td>32</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Alertas de validade</h4>
          <ul className="list">
            <li>
              <span>Abobrinha</span>
              <span>2 dias</span>
            </li>
            <li>
              <span>Rúcula</span>
              <span>3 dias</span>
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
