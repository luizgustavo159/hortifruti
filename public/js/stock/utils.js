(() => {
  const normalizeValue = (value) => value.trim().toLowerCase();

  const parseDateValue = (value) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  };

  const formatDateValue = (value) => {
    if (!value) {
      return "-";
    }
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
  };

  const getDaysUntil = (value) => {
    const date = parseDateValue(value);
    if (!date) {
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = date.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStockStatus = (product) => {
    const minStock = Number(product.min_stock || 0);
    const currentStock = Number(product.current_stock || 0);
    if (minStock > 0 && currentStock <= minStock) {
      return "Crítico";
    }
    const daysUntil = getDaysUntil(product.expires_at);
    if (daysUntil !== null && daysUntil <= 7) {
      return "Vencendo";
    }
    return "Ok";
  };

  const getStatusBadgeClass = (status) => {
    if (status === "Crítico") {
      return "badge text-bg-warning";
    }
    if (status === "Vencendo") {
      return "badge text-bg-danger";
    }
    return "badge text-bg-success";
  };

  window.stockUtils = {
    normalizeValue,
    parseDateValue,
    formatDateValue,
    getDaysUntil,
    getStockStatus,
    getStatusBadgeClass,
  };
})();
