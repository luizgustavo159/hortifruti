(() => {
  const getDaysMap = () => ({
    "0": "Dom",
    "1": "Seg",
    "2": "Ter",
    "3": "Qua",
    "4": "Qui",
    "5": "Sex",
    "6": "Sáb",
  });

  const formatDiscountType = (discount) => {
    if (discount.type === "percent") {
      return `${Number(discount.value)}%`;
    }
    if (discount.type === "fixed") {
      return `R$ ${Number(discount.value).toFixed(2)} de abatimento`;
    }
    if (discount.type === "buy_x_get_y") {
      return `Compre ${discount.buy_quantity} leve ${discount.get_quantity}`;
    }
    if (discount.type === "fixed_bundle") {
      return `${discount.buy_quantity} itens por R$ ${Number(discount.value).toFixed(2)}`;
    }
    return "Promoção";
  };

  const formatTarget = (discount, parseProductIds) => {
    if (discount.target_type === "category") {
      return `Categoria: ${discount.target_value || "não definida"}`;
    }
    if (discount.target_type === "product") {
      const ids = parseProductIds(discount.target_value);
      return ids.length ? `Produtos: ${ids.length} selecionados` : "Produtos: não definidos";
    }
    if (discount.target_type === "combo") {
      return `Combo: ${discount.target_value || "não definido"}`;
    }
    return "Todos os produtos";
  };

  const parseDays = (value) => {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  };

  const formatDays = (days) => {
    const labels = getDaysMap();
    return days.map((day) => labels[String(day)] || day);
  };

  const parseProductIds = (value) => {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch (error) {
      return String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  window.discountUtils = {
    formatDiscountType,
    formatTarget,
    parseDays,
    formatDays,
    parseProductIds,
  };
})();
