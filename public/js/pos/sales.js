(() => {
  const finalizeSale = async ({
    postJson,
    items,
    paymentMethod,
    getAdjustedQuantity,
  }) => {
    for (const item of items) {
      if (!item.productId) {
        throw new Error(`Produto sem cadastro: ${item.name}`);
      }
      const quantity = getAdjustedQuantity(item);
      await postJson("/api/sales", {
        product_id: item.productId,
        quantity,
        payment_method: paymentMethod,
      });
    }
  };

  window.posSales = {
    finalizeSale,
  };
})();
