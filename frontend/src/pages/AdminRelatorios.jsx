import { PageShell } from "../components/PageShell";

export function AdminRelatorios() {
  return (
    <PageShell
      title="Relatórios executivos"
      subtitle="Resultados, perdas e performance por período"
      actions={<button className="button">Exportar PDF</button>}
    >
      <div className="card-grid">
        <div className="card">
          <h3>Vendas no período</h3>
          <strong>R$ 124.800</strong>
        </div>
        <div className="card">
          <h3>Perdas</h3>
          <strong>R$ 3.540</strong>
        </div>
        <div className="card">
          <h3>Margem média</h3>
          <strong>31%</strong>
        </div>
        <div className="card">
          <h3>Operadores top</h3>
          <strong>4</strong>
        </div>
      </div>
      <div className="section">
        <div className="card">
          <h3>Resumo por categoria</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Itens</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Frutas</td>
                <td>1.240</td>
                <td>R$ 52.100</td>
              </tr>
              <tr>
                <td>Legumes</td>
                <td>980</td>
                <td>R$ 31.700</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Destaques</h4>
          <ul className="list">
            <li>
              <span>Operador destaque</span>
              <span>Marina</span>
            </li>
            <li>
              <span>Maior margem</span>
              <span>Hortaliças</span>
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
