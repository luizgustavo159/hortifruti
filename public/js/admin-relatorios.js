const reportTotalSales = document.getElementById("report-total-sales");
const reportTotalLosses = document.getElementById("report-total-losses");
const reportLowStock = document.getElementById("report-low-stock");
const reportCriticalList = document.getElementById("report-critical-list");
const reportExpiringList = document.getElementById("report-expiring-list");
const reportChart = document.getElementById("report-chart");
const reportFilterForm = document.getElementById("report-filter-form");
const reportStart = document.getElementById("report-start");
const reportEnd = document.getElementById("report-end");
const reportExportButton = document.getElementById("report-export");
const reportSalesChange = document.getElementById("report-sales-change");
const reportLossesChange = document.getElementById("report-losses-change");
const reportStockChange = document.getElementById("report-stock-change");
const reportOperatorTable = document.getElementById("report-operator-table");
const reportCategoryTable = document.getElementById("report-category-table");

let chartInstance = null;

const { getJson } = window.apiClient || {};
const { sharedFormat, adminReportsUtils } = window;
const { buildReportQuery, renderList, renderTable } = adminReportsUtils;
const formatCurrency = (value) => sharedFormat.formatCurrency(value);

const renderChart = (sales, losses) => {
  if (!reportChart) {
    return;
  }
  const data = {
    labels: ["Vendas", "Perdas"],
    datasets: [
      {
        data: [sales, losses],
        backgroundColor: ["#1fbf75", "#e05757"],
      },
    ],
  };
  if (chartInstance) {
    chartInstance.data = data;
    chartInstance.update();
    return;
  }
  chartInstance = new Chart(reportChart, {
    type: "bar",
    data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
};

const refreshReports = async () => {
  try {
    const query = buildReportQuery({ start: reportStart?.value, end: reportEnd?.value });
    const [summary, byOperator, byCategory] = await Promise.all([
      getJson(`/api/reports/summary${query}`),
      getJson(`/api/reports/by-operator${query}`),
      getJson(`/api/reports/by-category${query}`),
    ]);
    if (reportTotalSales) {
      reportTotalSales.textContent = formatCurrency(summary.total_sales || 0);
    }
    if (reportTotalLosses) {
      reportTotalLosses.textContent = formatCurrency(summary.total_losses || 0);
    }
    if (reportLowStock) {
      reportLowStock.textContent = summary.low_stock?.length || 0;
    }
    renderList(
      reportCriticalList,
      (summary.low_stock || []).map((item) => `${item.name} (${item.current_stock})`),
      "Nenhum item crítico."
    );
    renderList(
      reportExpiringList,
      (summary.expiring_products || []).map((item) => `${item.name} (${item.expires_at})`),
      "Nenhum item vencendo."
    );
    renderTable(
      reportOperatorTable,
      (byOperator || []).map((row) => ({
        label: row.name || "Sem operador",
        items: row.total_items || 0,
        total: formatCurrency(row.total_sales || 0),
      })),
      "Nenhum operador registrado."
    );
    renderTable(
      reportCategoryTable,
      (byCategory || []).map((row) => ({
        label: row.category || "Sem categoria",
        items: row.total_items || 0,
        total: formatCurrency(row.total_sales || 0),
      })),
      "Nenhuma categoria registrada."
    );
    renderChart(summary.total_sales || 0, summary.total_losses || 0);
    if (reportSalesChange) {
      reportSalesChange.textContent = "0%";
    }
    if (reportLossesChange) {
      reportLossesChange.textContent = "0%";
    }
    if (reportStockChange) {
      reportStockChange.textContent = "0%";
    }
  } catch (error) {
    renderList(reportCriticalList, [], "Erro ao carregar relatório.");
    renderList(reportExpiringList, [], "Erro ao carregar relatório.");
    renderTable(reportOperatorTable, [], "Erro ao carregar operadores.");
    renderTable(reportCategoryTable, [], "Erro ao carregar categorias.");
  }
};

reportFilterForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshReports();
});

reportExportButton?.addEventListener("click", () => {
  const rows = [
    ["Total de vendas", reportTotalSales?.textContent || ""],
    ["Total de perdas", reportTotalLosses?.textContent || ""],
    ["Itens críticos", reportLowStock?.textContent || ""],
  ];
  sharedFormat.downloadCsv({ filename: "relatorio.csv", rows });
});

refreshReports();
