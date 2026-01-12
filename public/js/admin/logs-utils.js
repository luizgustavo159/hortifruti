(() => {
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

  const filterLogs = ({ logs, search, statusFilter, moduleFilter }) => {
    const term = (search || "").toLowerCase();
    const statusKey = statusFilter || "all";
    const moduleKey = moduleFilter || "all";
    return logs.filter((log) => {
      const status = formatStatus(log.action);
      const module = getModuleFromAction(log.action);
      const matchesStatus = statusKey === "all" || status.key === statusKey;
      const matchesModule = moduleKey === "all" || module.key === moduleKey;
      const matchesSearch =
        log.action.toLowerCase().includes(term) ||
        (log.performed_by_name || "").toLowerCase().includes(term);
      return matchesStatus && matchesModule && matchesSearch;
    });
  };

  window.adminLogsUtils = {
    formatStatus,
    getModuleFromAction,
    filterLogs,
  };
})();
