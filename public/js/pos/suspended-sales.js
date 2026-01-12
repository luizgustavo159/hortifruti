(() => {
  const renderSuspendedSales = ({ container, sales, onResume }) => {
    if (!container) {
      return;
    }
    if (!sales.length) {
      container.innerHTML = "Nenhuma venda suspensa.";
      return;
    }
    container.innerHTML = "";
    sales.forEach((sale, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "d-flex justify-content-between align-items-center mb-2";
      wrapper.innerHTML = `
        <span class="text-muted">Venda ${index + 1} • ${sale.items.length} item(s)</span>
        <button class="btn btn-outline-success btn-sm" data-resume="${index}">Retomar</button>
      `;
      wrapper.querySelector("[data-resume]")?.addEventListener("click", () => {
        onResume?.(index);
      });
      container.appendChild(wrapper);
    });
  };

  const suspendCurrentSale = ({
    state,
    setFeedback,
    clearSale,
    renderSuspendedSales: renderFn,
  }) => {
    if (state.items.length === 0) {
      setFeedback("Nenhum item para suspender.", "warning");
      return;
    }
    state.suspendedSales.unshift({
      items: [...state.items],
      discount: state.discountTotal,
      note: state.saleNote,
    });
    setFeedback("Venda suspensa. Pronto para nova leitura.", "info");
    clearSale();
    renderFn();
  };

  const restoreSuspendedSale = ({
    state,
    index = 0,
    noteInput,
    renderItems,
    renderSuspendedSales: renderFn,
    setFeedback,
    focusBarcode,
  }) => {
    const sale = state.suspendedSales.splice(index, 1)[0];
    if (!sale) {
      setFeedback("Nenhuma venda suspensa para retomar.", "warning");
      return;
    }
    state.items = sale.items;
    state.discountTotal = sale.discount;
    state.saleNote = sale.note || "";
    if (noteInput) {
      noteInput.value = state.saleNote;
    }
    renderItems();
    renderFn();
    setFeedback("Venda retomada.", "success");
    focusBarcode();
  };

  window.posSuspendedSales = {
    renderSuspendedSales,
    suspendCurrentSale,
    restoreSuspendedSale,
  };
})();
