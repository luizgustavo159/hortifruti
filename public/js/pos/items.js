(() => {
  const setLatestItem = (element) => {
    if (!element) {
      return;
    }
    document.querySelectorAll(".pos-item").forEach((item) => {
      item.classList.remove("pos-item--latest");
    });
    element.classList.add("pos-item--latest");
  };

  const createItemElement = ({ item, formatCurrency, getItemTotal, onRemove }) => {
    const element = document.createElement("div");
    element.className = "pos-item";
    element.dataset.unitPrice = String(item.price);
    element.dataset.quantity = String(item.quantity);
    element.dataset.weight = String(item.weight);
    element.dataset.productId = String(item.productId || "");
    const description = item.weight > 0
      ? `${item.weight.toFixed(3).replace(".", ",")} ${item.unitType || "kg"} × ${formatCurrency(item.price)}`
      : `${item.quantity} ${item.unitType || "un"} × ${formatCurrency(item.price)}`;
    const statusLabel = item.status === "low" ? "Estoque baixo" : "Disponível";
    const statusClass = item.status === "low" ? "text-bg-warning" : "text-bg-secondary";
    element.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <span class="d-block text-muted">${description}</span>
        <span class="d-block text-muted small">SKU ${item.sku || "-"}</span>
        <span class="badge ${statusClass} mt-1">${statusLabel}</span>
      </div>
      <div class="text-end">
        <strong>${formatCurrency(getItemTotal(item))}</strong>
        <button class="btn btn-link text-danger btn-sm js-remove-item" data-item="${item.name}">
          Remover
        </button>
      </div>
    `;
    element.querySelector(".js-remove-item")?.addEventListener("click", () => {
      onRemove?.(item.name);
    });
    return element;
  };

  const renderItems = ({ container, items, formatCurrency, getItemTotal, onRemove }) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    items.forEach((item, index) => {
      const element = createItemElement({
        item,
        formatCurrency,
        getItemTotal,
        onRemove,
      });
      if (index === items.length - 1) {
        element.classList.add("pos-item--latest");
      }
      container.appendChild(element);
    });
  };

  const syncItemsFromDom = ({ container }) => {
    const items = [];
    if (!container) {
      return items;
    }
    container.querySelectorAll(".pos-item").forEach((element) => {
      const name = element.querySelector("strong")?.textContent?.trim() || "Item";
      const price = Number(element.dataset.unitPrice || 0);
      const quantity = Number(element.dataset.quantity || 1);
      const weight = Number(element.dataset.weight || 0);
      const statusBadge = element.querySelector(".badge");
      const status = statusBadge?.textContent?.includes("baixo") ? "low" : "ok";
      const sku = element.querySelector(".text-muted.small")?.textContent?.replace("SKU", "").trim() || "";
      items.push({ name, price, quantity, weight, status, sku });
    });
    return items;
  };

  window.posItems = {
    setLatestItem,
    createItemElement,
    renderItems,
    syncItemsFromDom,
  };
})();
