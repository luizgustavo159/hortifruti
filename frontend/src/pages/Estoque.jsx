import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";

export function Estoque() {
  const [products, setProducts] = useState([]);
  const [restockSuggestions, setRestockSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [productRows, suggestionRows] = await Promise.all([
          apiFetch("/products"),
          apiFetch("/stock/restock-suggestions"),
        ]);
        setProducts(productRows || []);
        setRestockSuggestions(suggestionRows || []);
      } catch (loadError) {
        setError(loadError.message || "Falha ao carregar estoque.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const criticalItems = useMemo(
    () => products.filter((item) => Number(item.current_stock) <= Number(item.min_stock)).length,
    [products]
  );

  return (
    <PageShell
      title="Controle de estoque"
      subtitle="Monitoramento de validade, mínimos e reposições"
      actions={<button className="button">Novo produto</button>}
    >
      <div className="card-grid">
        <div className="card">
          <h3>Itens críticos</h3>
          <strong>{criticalItems}</strong>
        </div>
        <div className="card">
          <h3>Reposições sugeridas</h3>
          <strong>{restockSuggestions.length}</strong>
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
      {loading ? <p>Carregando estoque...</p> : null}
      {error ? <p style={{ color: "#c62828" }}>{error}</p> : null}
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
              {products.slice(0, 8).map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.category_name || "-"}</td>
                  <td>
                    <span className="tag">
                      {Number(item.current_stock) <= Number(item.min_stock) ? "Baixo" : "Em dia"}
                    </span>
                  </td>
                  <td>{item.current_stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4>Reposições sugeridas</h4>
          <ul className="list">
            {restockSuggestions.slice(0, 5).map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span>
                  {item.current_stock}/{item.min_stock}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
