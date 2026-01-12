(() => {
  const normalizeKey = (value) => String(value || "").trim().toLowerCase();

  const isWeightUnit = (unitType) => {
    const normalized = normalizeKey(unitType);
    return normalized.includes("kg") || normalized.includes("quilo") || normalized.includes("grama");
  };

  const buildProductLookup = (products) => {
    const map = new Map();
    (products || []).forEach((product) => {
      if (!product) {
        return;
      }
      if (product.name) {
        map.set(normalizeKey(product.name), product);
      }
      if (product.sku) {
        map.set(normalizeKey(product.sku), product);
      }
    });
    return map;
  };

  const renderProductSearchList = (datalist, products) => {
    if (!datalist) {
      return;
    }
    datalist.innerHTML = "";
    (products || []).forEach((product) => {
      const option = document.createElement("option");
      const sku = product.sku ? `(${product.sku})` : "";
      option.value = `${product.name} ${sku}`.trim();
      datalist.appendChild(option);
    });
  };

  const resolveProduct = (inputValue, lookup) => {
    const normalized = normalizeKey(inputValue);
    if (!normalized) {
      return null;
    }
    if (lookup?.has(normalized)) {
      return lookup.get(normalized);
    }
    const match = normalized.match(/\(([^)]+)\)$/);
    if (match) {
      const sku = normalizeKey(match[1]);
      if (lookup?.has(sku)) {
        return lookup.get(sku);
      }
    }
    return null;
  };

  const loadProducts = async ({ getJson, datalist } = {}) => {
    if (!getJson) {
      throw new Error("API indisponível.");
    }
    const products = await getJson("/api/products");
    const lookup = buildProductLookup(products);
    renderProductSearchList(datalist, products);
    return { products, lookup };
  };

  window.posCatalog = {
    loadProducts,
    resolveProduct,
    isWeightUnit,
  };
})();
