const feedback = document.getElementById("pos-feedback");
const approvalModalElement = document.getElementById("approvalModal");
const approvalForm = document.getElementById("approval-form");
const approvalActionInput = document.getElementById("approval-action");
const managerEmailInput = document.getElementById("manager-email");
const managerPasswordInput = document.getElementById("manager-password");
const approvalReasonInput = document.getElementById("approval-reason");
const managerDiscountInput = document.getElementById("manager-discount");
const applyManagerDiscountButton = document.getElementById("apply-manager-discount");
const barcodeInput = document.getElementById("barcode-input");
const quantityInput = document.getElementById("quantity-input");
const weightInput = document.getElementById("weight-input");
const scaleModeToggle = document.getElementById("scale-mode");
const amountPaidInput = document.getElementById("amount-paid");
const changeDueLabel = document.getElementById("change-due");
const finishSaleButton = document.getElementById("finish-sale");
const cancelSaleButton = document.getElementById("cancel-sale");
const posItemsContainer = document.querySelector(".pos-items");
const summaryItems = document.getElementById("summary-items");
const summarySubtotal = document.getElementById("summary-subtotal");
const summaryDiscount = document.getElementById("summary-discount");
const summaryTotal = document.getElementById("summary-total");
const suspendSaleButton = document.getElementById("suspend-sale");
const resumeSaleButton = document.getElementById("resume-sale");
const suspendedSalesContainer = document.getElementById("suspended-sales");
const quickItemButtons = document.querySelectorAll("[data-quick-item]");
const noteModalElement = document.getElementById("noteModal");
const noteForm = document.getElementById("note-form");
const noteInput = document.getElementById("sale-note");
const addNoteButton = document.getElementById("add-note");

const approvalModal = approvalModalElement
  ? new bootstrap.Modal(approvalModalElement)
  : null;
const noteModal = noteModalElement ? new bootstrap.Modal(noteModalElement) : null;

const getToken = () => localStorage.getItem("greenstore_token");

const state = {
  items: [],
  suspendedSales: [],
  discountTotal: 0,
  saleNote: "",
};

const setFeedback = (message, type = "secondary") => {
  if (!feedback) {
    return;
  }
  feedback.className = `alert alert-${type} mt-3`;
  feedback.textContent = message;
};

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

const updateSummary = () => {
  if (!summaryItems || !summarySubtotal || !summaryDiscount || !summaryTotal) {
    return;
  }
  const subtotal = state.items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const total = Math.max(subtotal - state.discountTotal, 0);
  summaryItems.textContent = String(state.items.length);
  summarySubtotal.textContent = formatCurrency(subtotal);
  summaryDiscount.textContent = formatCurrency(state.discountTotal);
  summaryTotal.textContent = formatCurrency(total);
  updateChangeDue();
};

const updateChangeDue = () => {
  if (!amountPaidInput || !changeDueLabel) {
    return;
  }
  const total = parseCurrency(summaryTotal?.textContent || "0");
  const paid = parseCurrency(amountPaidInput.value);
  const change = Math.max(paid - total, 0);
  changeDueLabel.textContent = formatCurrency(change);
};

const focusBarcode = () => {
  barcodeInput?.focus();
};

const setLatestItem = (element) => {
  document.querySelectorAll(".pos-item").forEach((item) => {
    item.classList.remove("pos-item--latest");
  });
  element.classList.add("pos-item--latest");
};

const createItemElement = (item) => {
  const element = document.createElement("div");
  element.className = "pos-item";
  element.dataset.unitPrice = String(item.price);
  element.dataset.quantity = String(item.quantity);
  element.dataset.weight = String(item.weight);
  const description = item.weight > 0
    ? `${item.weight.toFixed(3).replace(".", ",")} kg × ${formatCurrency(item.price)}`
    : `${item.quantity} un × ${formatCurrency(item.price)}`;
  const statusLabel = item.status === "low" ? "Estoque baixo" : "Disponível";
  const statusClass = item.status === "low" ? "text-bg-warning" : "text-bg-secondary";
  element.innerHTML = `
    <div>
      <strong>${item.name}</strong>
      <span class="d-block text-muted">${description}</span>
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
    openApprovalModal("remove_item", { item: item.name });
  });
  return element;
};

const renderItems = () => {
  if (!posItemsContainer) {
    return;
  }
  posItemsContainer.innerHTML = "";
  state.items.forEach((item, index) => {
    const element = createItemElement(item);
    if (index === state.items.length - 1) {
      element.classList.add("pos-item--latest");
    }
    posItemsContainer.appendChild(element);
  });
  updateSummary();
};

const syncItemsFromDom = () => {
  const items = [];
  document.querySelectorAll(".pos-item").forEach((element) => {
    const name = element.querySelector("strong")?.textContent?.trim() || "Item";
    const price = Number(element.dataset.unitPrice || 0);
    const quantity = Number(element.dataset.quantity || 1);
    const weight = Number(element.dataset.weight || 0);
    const statusBadge = element.querySelector(".badge");
    const status = statusBadge?.textContent?.includes("baixo") ? "low" : "ok";
    items.push({ name, price, quantity, weight, status });
  });
  state.items = items;
  updateSummary();
};

const requestApproval = async ({ action, reason, metadata }) => {
  const response = await fetch("/api/approvals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: managerEmailInput.value,
      password: managerPasswordInput.value,
      action,
      reason,
      metadata,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Falha ao aprovar.");
  }
  return data;
};

const postWithApproval = async ({ url, payload, token }) => {
  const authToken = getToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-approval-token": token,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Ação não autorizada.");
  }
  return data;
};

const openApprovalModal = (action, metadata) => {
  if (!approvalModal) {
    return;
  }
  approvalActionInput.value = action;
  approvalForm.dataset.metadata = JSON.stringify(metadata || {});
  approvalForm.reset();
  approvalModal.show();
};

const quickItemCatalog = {
  "Banana Prata": { price: 6.5, weight: 1.25, status: "low" },
  "Tomate Italiano": { price: 8.9, weight: 1, status: "ok" },
  "Cebola Roxa": { price: 7.4, weight: 0.8, status: "ok" },
};

const barcodeCatalog = {
  BAN001: { name: "Banana Prata", price: 6.5, status: "low" },
  TOM001: { name: "Tomate Italiano", price: 8.9, status: "ok" },
  CEB001: { name: "Cebola Roxa", price: 7.4, status: "ok" },
};

const searchCatalog = {
  "BANANA PRATA (PLU 4011)": { name: "Banana Prata", price: 6.5, status: "low" },
  "TOMATE ITALIANO (PLU 3151)": { name: "Tomate Italiano", price: 8.9, status: "ok" },
  "CEBOLA ROXA (PLU 4166)": { name: "Cebola Roxa", price: 7.4, status: "ok" },
  "4011": { name: "Banana Prata", price: 6.5, status: "low" },
  "3151": { name: "Tomate Italiano", price: 8.9, status: "ok" },
  "4166": { name: "Cebola Roxa", price: 7.4, status: "ok" },
  "BANANA PRATA": { name: "Banana Prata", price: 6.5, status: "low" },
  "TOMATE ITALIANO": { name: "Tomate Italiano", price: 8.9, status: "ok" },
  "CEBOLA ROXA": { name: "Cebola Roxa", price: 7.4, status: "ok" },
};

const addItem = ({ name, price, quantity, weight, status }) => {
  const item = {
    name,
    price,
    quantity,
    weight,
    status,
  };
  state.items.push(item);
  const element = createItemElement(item);
  posItemsContainer?.appendChild(element);
  setLatestItem(element);
  updateSummary();
  setFeedback(`Item adicionado: ${name}`, "success");
  focusBarcode();
};

const clearSale = () => {
  state.items = [];
  state.discountTotal = 0;
  state.saleNote = "";
  renderItems();
  amountPaidInput.value = "";
  updateChangeDue();
  focusBarcode();
};

const renderSuspendedSales = () => {
  if (!suspendedSalesContainer) {
    return;
  }
  if (state.suspendedSales.length === 0) {
    suspendedSalesContainer.innerHTML = "Nenhuma venda suspensa.";
    return;
  }
  suspendedSalesContainer.innerHTML = "";
  state.suspendedSales.forEach((sale, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "d-flex justify-content-between align-items-center mb-2";
    wrapper.innerHTML = `
      <span class="text-muted">Venda ${index + 1} • ${sale.items.length} item(s)</span>
      <button class="btn btn-outline-success btn-sm" data-resume="${index}">Retomar</button>
    `;
    wrapper.querySelector("[data-resume]")?.addEventListener("click", () => {
      restoreSuspendedSale(index);
    });
    suspendedSalesContainer.appendChild(wrapper);
  });
};

const suspendCurrentSale = () => {
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
  renderSuspendedSales();
};

const restoreSuspendedSale = (index = 0) => {
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
  renderSuspendedSales();
  setFeedback("Venda retomada.", "success");
  focusBarcode();
};

const handleCancelSale = async () => {
  if (state.items.length === 0) {
    setFeedback("Nenhum item para cancelar.", "warning");
    return;
  }
  openApprovalModal("cancel_sale", { items: state.items.length });
};

document.querySelectorAll(".js-remove-item").forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.dataset.item || "Item";
    openApprovalModal("remove_item", { item });
  });
});

applyManagerDiscountButton?.addEventListener("click", () => {
  const subtotal = state.items.reduce((sum, item) => sum + getItemTotal(item), 0);
  openApprovalModal("discount_override", {
    amount: managerDiscountInput.value || "0",
    subtotal,
  });
});

approvalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = approvalActionInput.value;
  const reason = approvalReasonInput.value;
  const metadata = JSON.parse(approvalForm.dataset.metadata || "{}");

  try {
    setFeedback("Solicitando aprovação...", "info");
    const approval = await requestApproval({ action, reason, metadata });

    if (action === "remove_item") {
      await postWithApproval({
        url: "/api/pos/remove-item",
        payload: { item: metadata.item, reason },
        token: approval.token,
      });
      const index = state.items.findIndex((item) => item.name === metadata.item);
      if (index >= 0) {
        state.items.splice(index, 1);
        renderItems();
      }
      setFeedback("Item removido com aprovação do gerente.", "success");
    }

    if (action === "discount_override") {
      const amountValue = parseNumber(metadata.amount || 0);
      const subtotalValue = Number(metadata.subtotal || 0);
      await postWithApproval({
        url: "/api/pos/discount-override",
        payload: { amount: amountValue, subtotal: subtotalValue, reason },
        token: approval.token,
      });
      state.discountTotal = amountValue;
      updateSummary();
      setFeedback("Desconto do gerente aplicado.", "success");
    }

    if (action === "cancel_sale") {
      await postWithApproval({
        url: "/api/pos/cancel-sale",
        payload: { reason, items: state.items.length },
        token: approval.token,
      });
      clearSale();
      setFeedback("Venda cancelada com aprovação do gerente.", "warning");
    }

    approvalModal.hide();
    focusBarcode();
  } catch (error) {
    setFeedback(error.message || "Não foi possível aprovar.", "danger");
  }
});

amountPaidInput?.addEventListener("input", updateChangeDue);

barcodeInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  const inputValue = barcodeInput.value.trim().toUpperCase();
  if (!inputValue) {
    setFeedback("Informe o código, PLU ou nome do produto.", "warning");
    return;
  }
  const product = barcodeCatalog[inputValue] || searchCatalog[inputValue];
  if (!product) {
    setFeedback("Produto não encontrado no catálogo rápido.", "warning");
    return;
  }
  const quantity = Math.max(parseNumber(quantityInput?.value || "1", 1), 1);
  const weight = Math.max(parseNumber(weightInput?.value || "0"), 0);
  const selectedWeight = scaleModeToggle?.checked ? weight || product.weight || 1 : weight;
  addItem({
    name: product.name,
    price: product.price,
    quantity,
    weight: selectedWeight,
    status: product.status,
  });
  barcodeInput.value = "";
  if (quantityInput) {
    quantityInput.value = "1";
  }
  if (weightInput) {
    weightInput.value = "";
  }
});

quickItemButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.quickItem;
    const product = quickItemCatalog[name];
    if (!product) {
      return;
    }
    const weight = Math.max(parseNumber(weightInput?.value || product.weight), 0);
    const selectedWeight = scaleModeToggle?.checked ? weight : product.weight;
    addItem({
      name,
      price: product.price,
      quantity: 1,
      weight: selectedWeight,
      status: product.status,
    });
  });
});

scaleModeToggle?.addEventListener("change", () => {
  if (scaleModeToggle.checked) {
    setFeedback("Modo balança ativado para itens por peso.", "info");
  } else {
    setFeedback("Modo balança desativado.", "secondary");
  }
});

suspendSaleButton?.addEventListener("click", suspendCurrentSale);
resumeSaleButton?.addEventListener("click", () => restoreSuspendedSale(0));
cancelSaleButton?.addEventListener("click", handleCancelSale);

addNoteButton?.addEventListener("click", () => {
  if (!noteModal) {
    return;
  }
  noteInput.value = state.saleNote || "";
  noteModal.show();
});

noteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  state.saleNote = noteInput.value.trim();
  noteModal.hide();
  if (state.saleNote) {
    setFeedback("Observação salva na venda atual.", "info");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "F2") {
    event.preventDefault();
    finishSaleButton?.click();
  }
  if (event.key === "F4") {
    event.preventDefault();
    applyManagerDiscountButton?.click();
  }
  if (event.key === "F8") {
    event.preventDefault();
    const firstRemove = document.querySelector(".js-remove-item");
    firstRemove?.click();
  }
  if (event.key === "F6") {
    event.preventDefault();
    suspendSaleButton?.click();
  }
  if (event.key === "F9") {
    event.preventDefault();
    resumeSaleButton?.click();
  }
});

finishSaleButton?.addEventListener("click", () => {
  setFeedback("Venda finalizada. Pronto para próxima leitura.", "success");
  clearSale();
});

focusBarcode();
syncItemsFromDom();
renderSuspendedSales();
