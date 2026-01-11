import { PageShell } from "../components/PageShell";

export function Descontos() {
  return (
    <PageShell
      title="Gestão de descontos"
      subtitle="Campanhas ativas e programação de ofertas"
      actions={<button className="button">Nova campanha</button>}
    >
      <div className="card-grid">
        <div className="card">
          <h3>Campanhas ativas</h3>
          <strong>5</strong>
        </div>
        <div className="card">
          <h3>Programadas</h3>
          <strong>2</strong>
        </div>
        <div className="card">
          <h3>Encerradas</h3>
          <strong>12</strong>
        </div>
        <div className="card">
          <h3>Desconto máximo</h3>
          <strong>18%</strong>
        </div>
      </div>
      <div className="section">
        <div className="card">
          <h3>Campanhas em execução</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Tipo</th>
                <th>Impacto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Quarta Verde</td>
                <td>15% categoria</td>
                <td>+18% giro</td>
              </tr>
              <tr>
                <td>Combo Feira</td>
                <td>3 itens por R$ 12</td>
                <td>+9% ticket</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Simulador rápido</h4>
          <ul className="list">
            <li>
              <span>Preço base</span>
              <strong>R$ 24,90</strong>
            </li>
            <li>
              <span>Desconto médio</span>
              <strong>R$ 4,10</strong>
            </li>
            <li>
              <span>Margem final</span>
              <strong>32%</strong>
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
