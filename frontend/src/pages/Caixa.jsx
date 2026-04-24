import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";

export function Caixa() {
  const [summary, setSummary] = useState({
    total_sales: 0,
    total_losses: 0,
    low_stock: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch(`/reports/summary?start=${today}&end=${today}`);
        setSummary(response || {});
      } catch (loadError) {
        setError(loadError.message || "Falha ao carregar resumo do caixa.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalSales = Number(summary.total_sales || 0);
  const totalLosses = Number(summary.total_losses || 0);
  const lowStockCount = summary.low_stock?.length || 0;

  return (
    <PageShell
      title="Caixa inteligente"
      subtitle="Fluxo rápido de vendas com acompanhamento em tempo real"
      actions={<button className="button">Nova venda</button>}
    >
      <div className="card-grid">
        <div className="card">
          <h3>Vendas do dia</h3>
          <strong>R$ {totalSales.toFixed(2)}</strong>
        </div>
        <div className="card">
          <h3>Perdas do dia</h3>
          <strong>R$ {totalLosses.toFixed(2)}</strong>
        </div>
        <div className="card">
          <h3>Itens em baixo estoque</h3>
          <strong>{lowStockCount}</strong>
        </div>
        <div className="card">
          <h3>Status</h3>
          <strong>{loading ? "Atualizando..." : "Online"}</strong>
        </div>
      </div>
      {error ? <p style={{ color: "#c62828" }}>{error}</p> : null}
      <div className="section">
        <div className="card">
          <h3>Produtos com estoque crítico</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {(summary.low_stock || []).slice(0, 8).map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.current_stock}</td>
                  <td>{item.min_stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Resumo operacional</h4>
          <ul className="list">
            <li>
              <span>Total vendido hoje</span>
              <strong>R$ {totalSales.toFixed(2)}</strong>
            </li>
            <li>
              <span>Perdas estimadas hoje</span>
              <strong>R$ {totalLosses.toFixed(2)}</strong>
            </li>
            <li>
              <span>Itens críticos</span>
              <strong>{lowStockCount}</strong>
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
