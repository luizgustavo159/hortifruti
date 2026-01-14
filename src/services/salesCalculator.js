const calculateDiscountAmount = ({ discount, quantity, price, total }) => {
  if (!discount) {
    return 0;
  }
  let discountAmount = 0;
  if (discount.type === "percent") {
    discountAmount = total * (Number(discount.value) / 100);
  } else if (discount.type === "fixed") {
    discountAmount = Number(discount.value);
  } else if (discount.type === "buy_x_get_y") {
    const buyQty = Number(discount.buy_quantity);
    const getQty = Number(discount.get_quantity);
    if (buyQty > 0 && quantity >= buyQty) {
      discountAmount = Number(price) * getQty;
    }
  } else if (discount.type === "fixed_bundle") {
    const bundleQty = Number(discount.buy_quantity);
    const bundlePrice = Number(discount.value);
    if (bundleQty > 0 && bundlePrice >= 0) {
      const bundles = Math.floor(quantity / bundleQty);
      const remainder = quantity % bundleQty;
      const bundleTotal = bundles * bundlePrice;
      const remainderTotal = remainder * Number(price);
      discountAmount = total - (bundleTotal + remainderTotal);
    }
  }

  if (discount.min_quantity && quantity < Number(discount.min_quantity)) {
    discountAmount = 0;
  }

  return Math.max(discountAmount, 0);
};

module.exports = {
  calculateDiscountAmount,
};
