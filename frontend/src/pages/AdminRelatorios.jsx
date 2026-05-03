import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";
import { normalizeApiError } from "../lib/api";
import "./AdminRelatorios.css";

export function AdminRelatorios() {
  const [reportType, setReportType] = useState("sales");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [filterOperator, setFilterOperator] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [operators, setOperators] = useState([]);
  const [categories, setCategories] = useState([]);

  // Carregar operadores e categorias
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [operatorsData, categoriesData] = await Promise.all([
          apiFetch("/users?role=operator"),
          apiFetch("/categories"),
        ]);
        setOperators(operatorsData || []);
        setCategories(categoriesData || []);
      } catch (err) {
        console.error("Erro ao carregar filtros:", err);
      }
    };
    loadFilters();
  }, []);

  // Carregar dados do relatório
  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          start: dateRange.start,
          end: dateRange.end,
        });

        if (filterOperator) params.append("operator_id", filterOperator);
        if (filterCategory) params.append("category_id", filterCategory);

        let endpoint = "";
        switch (reportType) {
          case "sales":
            endpoint = `/reports/sales?${params}`;
            break;
          case "cash_flow":
            endpoint = `/reports/cash-flow?${params}`;
            break;
          case "payables":
            endpoint = `/reports/payables?${params}`;
            break;
          case "receivables":
            endpoint = `/reports/receivables?${params}`;
            break;
          case "inventory":
            endpoint = `/reports/inventory?${params}`;
            break;
          default:
            endpoint = `/reports/sales?${params}`;
        }

        const reportData = await apiFetch(endpoint);
        setData(reportData || []);
      } catch (loadError) {
        setError(normalizeApiError(loadError));
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [reportType, dateRange, filterOperator, filterCategory]);

  // Exportar para CSV
  const handleExportCSV = () => {
    if (data.length === 0) {
      alert("Sem dados para exportar.");
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (typeof value === "string" && value.includes(",")) {
              return `"${value}"`;
            }
            return value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${reportType}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calcular totais
  const calculateTotals = () => {
    const totals = {};
    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (typeof row[key] === "number") {
          totals[key] = (totals[key] || 0) + row[key];
        }
      });
    });
    return totals;
  };

  const totals = calculateTotals();

  return (
    <PageShell
      title="Relatórios Financeiros"
      subtitle="Análise detalhada de vendas, caixa e contas"
      actions={
        <button className="button" onClick={handleExportCSV}>
          Exportar CSV
        </button>
      }
    >
      <div className="reports-container">
        {/* Filtros */}
        <div className="filters-panel">
          <div className="filter-group">
            <label>Tipo de Relatório:</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="filter-select"
            >
              <option value="sales">Vendas</option>
              <option value="cash_flow">Fluxo de Caixa</option>
              <option value="payables">Contas a Pagar</option>
              <option value="receivables">Contas a Receber</option>
              <option value="inventory">Inventário</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Data Inicial:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Data Final:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="filter-input"
            />
          </div>

          {reportType === "sales" && (
            <>
              <div className="filter-group">
                <label>Operador:</label>
                <select
                  value={filterOperator}
                  onChange={(e) => setFilterOperator(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Todos</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Categoria:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Todas</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Mensagens */}
        {error && <div className="error-message">{error}</div>}

        {/* Tabela de Dados */}
        {loading ? (
          <p className="loading">Carregando relatório...</p>
        ) : data.length > 0 ? (
          <div className="report-wrapper">
            <div className="table-responsive">
              <table className="report-table">
                <thead>
                  <tr>
                    {Object.keys(data[0]).map((header) => (
                      <th key={header}>{formatHeader(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx}>
                      {Object.keys(row).map((key) => (
                        <td key={key}>{formatValue(row[key])}</td>
                      ))}
                    </tr>
                  ))}
                  {Object.keys(totals).length > 0 && (
                    <tr className="totals-row">
                      <td colSpan={Object.keys(data[0]).length - 1}>
                        <strong>TOTAL</strong>
                      </td>
                      <td>
                        <strong>{formatValue(totals[Object.keys(totals)[0]])}</strong>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-summary">
              <h4>Resumo do Período</h4>
              <div className="summary-grid">
                {Object.entries(totals).map(([key, value]) => (
                  <div key={key} className="summary-item">
                    <p className="summary-label">{formatHeader(key)}</p>
                    <p className="summary-value">{formatValue(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="no-data">Nenhum dado disponível para o período selecionado.</p>
        )}
      </div>
    </PageShell>
  );
}

// Funções auxiliares
function formatHeader(header) {
  return header
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatValue(value) {
  if (typeof value === "number") {
    if (value % 1 === 0) {
      return value.toLocaleString("pt-BR");
    }
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value;
}
