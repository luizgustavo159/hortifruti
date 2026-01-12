(() => {
  const updateChangeDue = ({ amountPaidInput, changeDueLabel, totalLabel, parseCurrency, formatCurrency }) => {
    if (!amountPaidInput || !changeDueLabel) {
      return;
    }
    const total = parseCurrency(totalLabel?.textContent || "0");
    const paid = parseCurrency(amountPaidInput.value);
    const change = Math.max(paid - total, 0);
    changeDueLabel.textContent = formatCurrency(change);
  };

  const updateSummary = ({
    items,
    discountTotal,
    summaryItems,
    summarySubtotal,
    summaryDiscount,
    summaryTotal,
    amountPaidInput,
    changeDueLabel,
    formatCurrency,
    getItemTotal,
    parseCurrency,
  }) => {
    if (!summaryItems || !summarySubtotal || !summaryDiscount || !summaryTotal) {
      return;
    }
    const subtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
    const total = Math.max(subtotal - discountTotal, 0);
    summaryItems.textContent = String(items.length);
    summarySubtotal.textContent = formatCurrency(subtotal);
    summaryDiscount.textContent = formatCurrency(discountTotal);
    summaryTotal.textContent = formatCurrency(total);
    updateChangeDue({
      amountPaidInput,
      changeDueLabel,
      totalLabel: summaryTotal,
      parseCurrency,
      formatCurrency,
    });
  };

  window.posSummary = {
    updateSummary,
    updateChangeDue,
  };
})();
