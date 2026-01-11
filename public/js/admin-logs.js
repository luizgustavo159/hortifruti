const logsTableBody = document.getElementById("logs-table-body");
const logSearch = document.getElementById("log-search");
const logStatus = document.getElementById("log-status");
const logModule = document.getElementById("log-module");
const logPageSize = document.getElementById("log-page-size");
const logPagination = document.getElementById("logs-pagination");
const logDetailContent = document.getElementById("log-detail-content");
const logExport = document.getElementById("log-export");

let logsCache = [];
let logCurrentPage = 1;
let logPageLimit = 10;

const getToken = () => localStorage.getItem("greenstore_token");

const fetchJson = async (url) => {
  const token = getToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Erro na requisição.");
  }
  return data;
};

const formatStatus = (action) => {
  if (["remove_item", "discount_override", "cancel_sale"].includes(action)) {
    return { label: "Crítico", badge: "text-bg-danger", key: "critical" };
  }
  if (["approval_granted", "stock_loss"].includes(action)) {
    return { label: "Atenção", badge: "text-bg-warning", key: "warning" };
  }
  return { label: "Ok", badge: "text-bg-success", key: "ok" };
};

const getModuleFromAction = (action) => {
  if (["remove_item", "discount_override", "cancel_sale"].includes(action)) {
    return { label: "Caixa", key: "caixa" };
  }
  if (["stock_loss", "stock_adjust"].includes(action)) {
    return { label: "Estoque", key: "estoque" };
  }
  if (["discount_created", "discount_updated"].includes(action)) {
    return { label: "Descontos", key: "descontos" };
  }
  if (["user_update"].includes(action)) {
    return { label: "Usuários", key: "usuarios" };
  }
  if (["approval_granted"].includes(action)) {
    return { label: "Aprovações", key: "aprovacoes" };
  }
  return { label: "Geral", key: "geral" };
};

const renderPagination = (totalItems) => {
  if (!logPagination) {
    return;
  }
  const totalPages = Math.max(Math.ceil(totalItems / logPageLimit), 1);
  logCurrentPage = Math.min(logCurrentPage, totalPages);
  logPagination.innerHTML = Array.from({ length: totalPages }, (_, index) => index + 1)
    .map(
      (page) => `
        <li class="page-item ${page === logCurrentPage ? "active" : ""}">
          <button class="page-link" data-page="${page}" type="button">${page}</button>
        </li>
      `
    )
    .join("");
};

const renderLogs = (items) => {
  if (!logsTableBody) {
    return;
  }
  if (!items.length) {
    logsTableBody.innerHTML = "<tr><td colspan=\"6\" class=\"text-muted\">Nenhum log encontrado.</td></tr>";
    return;
  }
  logsTableBody.innerHTML = items
    .map((log) => {
      const status = formatStatus(log.action);
      const module = getModuleFromAction(log.action);
      return `
        <tr>
          <td>${log.created_at}</td>
          <td>${log.performed_by_name || "Sistema"}</td>
          <td>${log.action}</td>
          <td>${module.label}</td>
          <td><span class="badge ${status.badge}">${status.label}</span></td>
          <td>
            <button class="btn btn-outline-success btn-sm" data-action="detail" data-id="${log.id}">
              Ver
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
};

const applyPagination = (items) => {
  const start = (logCurrentPage - 1) * logPageLimit;
  renderLogs(items.slice(start, start + logPageLimit));
  renderPagination(items.length);
};

const applyFilters = () => {
  const search = (logSearch?.value || "").toLowerCase();
  const statusFilter = logStatus?.value || "all";
  const moduleFilter = logModule?.value || "all";
  const filtered = logsCache.filter((log) => {
    const status = formatStatus(log.action);
    const module = getModuleFromAction(log.action);
    const matchesStatus = statusFilter === "all" || status.key === statusFilter;
    const matchesModule = moduleFilter === "all" || module.key === moduleFilter;
    const matchesSearch =
      log.action.toLowerCase().includes(search) ||
      (log.performed_by_name || "").toLowerCase().includes(search);
    return matchesStatus && matchesModule && matchesSearch;
  });
  applyPagination(filtered);
};

const getFilteredLogs = () => {
  const search = (logSearch?.value || "").toLowerCase();
  const statusFilter = logStatus?.value || "all";
  const moduleFilter = logModule?.value || "all";
  return logsCache.filter((log) => {
    const status = formatStatus(log.action);
    const module = getModuleFromAction(log.action);
    const matchesStatus = statusFilter === "all" || status.key === statusFilter;
    const matchesModule = moduleFilter === "all" || module.key === moduleFilter;
    const matchesSearch =
      log.action.toLowerCase().includes(search) ||
      (log.performed_by_name || "").toLowerCase().includes(search);
    return matchesStatus && matchesModule && matchesSearch;
  });
};

const loadLogs = async () => {
  try {
    logsCache = await fetchJson("/api/audit-logs");
    applyFilters();
  } catch (error) {
    renderLogs([]);
  }
};

logsTableBody?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action=\"detail\"]");
  if (!button) {
    return;
  }
  const log = logsCache.find((item) => String(item.id) === button.dataset.id);
  if (!log || !logDetailContent) {
    return;
  }
  logDetailContent.textContent = JSON.stringify(log, null, 2);
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("logDetailModal"));
  modal.show();
});

logPagination?.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-page]");
  if (!target) {
    return;
  }
  logCurrentPage = Number(target.dataset.page || 1);
  applyFilters();
});

logPageSize?.addEventListener("change", (event) => {
  logPageLimit = Number(event.target.value || 10);
  logCurrentPage = 1;
  applyFilters();
});

logSearch?.addEventListener("input", () => {
  logCurrentPage = 1;
  applyFilters();
});

logStatus?.addEventListener("change", () => {
  logCurrentPage = 1;
  applyFilters();
});

logModule?.addEventListener("change", () => {
  logCurrentPage = 1;
  applyFilters();
});

logExport?.addEventListener("click", () => {
  const rows = getFilteredLogs().map((log) => [
    log.created_at,
    log.performed_by_name || "Sistema",
    log.action,
    getModuleFromAction(log.action).label,
    formatStatus(log.action).label,
    JSON.stringify(log.details || {}),
  ]);
  if (!rows.length) {
    return;
  }
  const header = ["Data", "Usuário", "Ação", "Módulo", "Status", "Detalhes"];
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "logs.csv";
  link.click();
  URL.revokeObjectURL(url);
});

if (logPageSize) {
  logPageLimit = Number(logPageSize.value || 10);
}

loadLogs();
