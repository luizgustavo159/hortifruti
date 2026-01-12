(() => {
  const formatCurrency = (value) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const parseCurrency = (value) =>
    Number(
      String(value)
        .replace(/[R$\s]/g, "")
        .replace(".", "")
        .replace(",", ".")
    ) || 0;

  const parseNumber = (value, fallback = 0) => {
    const parsed = parseCurrency(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const getItemTotal = (item) => {
    if (item.weight > 0) {
      return item.price * item.weight;
    }
    return item.price * item.quantity;
  };

  const normalizeSaleQuantity = (item) => {
    if (item.weight > 0) {
      const rounded = Math.round(item.weight);
      return Math.max(rounded, 1);
    }
    return Math.max(Number(item.quantity || 1), 1);
  };

  window.posFormat = {
    formatCurrency,
    parseCurrency,
    parseNumber,
    getItemTotal,
    normalizeSaleQuantity,
  };
})();
