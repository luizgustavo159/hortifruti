const totalUsersEl = document.getElementById("admin-total-users");
const totalManagersEl = document.getElementById("admin-total-managers");
const criticalLogsEl = document.getElementById("admin-critical-logs");
const pendingItemsEl = document.getElementById("admin-pending-items");
const pendingListEl = document.getElementById("admin-pending-list");

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

const renderPendings = ({ lowStock = [], expiringProducts = [] }) => {
  if (!pendingListEl) {
    return;
  }
  const items = [];
  if (lowStock.length) {
    items.push(`Estoque crítico: ${lowStock.length} produtos abaixo do mínimo.`);
  }
  if (expiringProducts.length) {
    items.push(`Validade próxima: ${expiringProducts.length} produtos vencendo.`);
  }
  if (!items.length) {
    pendingListEl.innerHTML = "<li class=\"text-muted\">Nenhuma pendência registrada.</li>";
    return;
  }
  pendingListEl.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
};

const refreshDashboard = async () => {
  try {
    const [users, logs, summary] = await Promise.all([
      fetchJson("/api/users"),
      fetchJson("/api/audit-logs"),
      fetchJson("/api/reports/summary"),
    ]);

    const activeUsers = users.filter((user) => user.is_active);
    const managers = activeUsers.filter((user) => ["manager", "admin"].includes(user.role));
    const criticalLogs = logs.filter((log) =>
      ["remove_item", "discount_override", "approval_granted"].includes(log.action)
    );

    if (totalUsersEl) {
      totalUsersEl.textContent = activeUsers.length;
    }
    if (totalManagersEl) {
      totalManagersEl.textContent = managers.length;
    }
    if (criticalLogsEl) {
      criticalLogsEl.textContent = criticalLogs.length;
    }

    const pendingCount =
      (summary.low_stock?.length || 0) + (summary.expiring_products?.length || 0);
    if (pendingItemsEl) {
      pendingItemsEl.textContent = pendingCount;
    }

    renderPendings({
      lowStock: summary.low_stock || [],
      expiringProducts: summary.expiring_products || [],
    });
  } catch (error) {
    if (pendingListEl) {
      pendingListEl.innerHTML = "<li class=\"text-danger\">Erro ao carregar pendências.</li>";
    }
  }
};

refreshDashboard();
setInterval(refreshDashboard, 120000);
