import { PageShell } from "../components/PageShell";

export function Caixa() {
  return (
    <PageShell
      title="Caixa inteligente"
      subtitle="Fluxo rápido de vendas com acompanhamento em tempo real"
      actions={<button className="button">Nova venda</button>}
    >
      <div className="card-grid">
        <div className="card">
          <h3>Vendas em andamento</h3>
          <strong>8</strong>
        </div>
        <div className="card">
          <h3>Ticket médio</h3>
          <strong>R$ 78,40</strong>
        </div>
        <div className="card">
          <h3>Tempo médio</h3>
          <strong>2m15s</strong>
        </div>
        <div className="card">
          <h3>Alertas críticos</h3>
          <strong>2</strong>
        </div>
      </div>
      <div className="section">
        <div className="card">
          <h3>Itens no carrinho</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Banana prata</td>
                <td>3</td>
                <td>R$ 19,50</td>
              </tr>
              <tr>
                <td>Tomate italiano</td>
                <td>2</td>
                <td>R$ 17,80</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Resumo da venda</h4>
          <ul className="list">
            <li>
              <span>Subtotal</span>
              <strong>R$ 37,30</strong>
            </li>
            <li>
              <span>Descontos</span>
              <strong>R$ 5,00</strong>
            </li>
            <li>
              <span>Total</span>
              <strong>R$ 32,30</strong>
            </li>
          </ul>
          <button className="button" style={{ marginTop: "16px" }}>
            Finalizar venda
          </button>
        </div>
      </div>
    </PageShell>
  );
}
