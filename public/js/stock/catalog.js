(() => {
  const buildProductLookup = (products) => {
    const lookup = new Map();
    products.forEach((product) => {
      if (product.name) {
        lookup.set(product.name.toLowerCase(), product);
      }
      if (product.sku) {
        lookup.set(product.sku.toLowerCase(), product);
      }
    });
    return lookup;
  };

  const resolveProductByName = async ({ name, productLookup }) => {
    const normalized = name.trim().toLowerCase();
    const match = productLookup.get(normalized);
    if (match) {
      return match;
    }
    const skuMatch = normalized.match(/\(([^)]+)\)$/);
    if (skuMatch) {
      const skuKey = skuMatch[1].trim().toLowerCase();
      const skuProduct = productLookup.get(skuKey);
      if (skuProduct) {
        return skuProduct;
      }
    }
    throw new Error("Produto não encontrado.");
  };

  window.stockCatalog = {
    buildProductLookup,
    resolveProductByName,
  };
})();
