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
const paymentMethodSelect = document.getElementById("payment-method");
const finishSaleButton = document.getElementById("finish-sale");
const cancelSaleButton = document.getElementById("cancel-sale");
const posItemsContainer = document.querySelector(".pos-items");
const productSearchList = document.getElementById("product-search-list");
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
const deviceStatusList = document.getElementById("pos-device-status");

const approvalModal = approvalModalElement
  ? new bootstrap.Modal(approvalModalElement)
  : null;
const noteModal = noteModalElement ? new bootstrap.Modal(noteModalElement) : null;

const { getJson, postJson, requestJson } = window.apiClient || {};
const {
  posApprovals,
  posCatalog,
  posDevices,
  posFormat,
  posItems,
  posNotes,
  posSales,
  posShortcuts,
  posSummary,
  posSuspendedSales,
} = window;

const state = {
  items: [],
  suspendedSales: [],
  discountTotal: 0,
  saleNote: "",
  products: [],
  productLookup: new Map(),
};

const setFeedback = (message, type = "secondary") => {
  if (!feedback) {
    return;
  }
  feedback.className = `alert alert-${type} mt-3`;
  feedback.textContent = message;
};

const { formatCurrency, parseCurrency, parseNumber, getItemTotal, normalizeSaleQuantity } = posFormat;

const updateSummary = () =>
  posSummary.updateSummary({
    items: state.items,
    discountTotal: state.discountTotal,
    summaryItems,
    summarySubtotal,
    summaryDiscount,
    summaryTotal,
    amountPaidInput,
    changeDueLabel,
    formatCurrency,
    getItemTotal,
    parseCurrency,
  });

const updateChangeDue = () =>
  posSummary.updateChangeDue({
    amountPaidInput,
    changeDueLabel,
    totalLabel: summaryTotal,
    parseCurrency,
    formatCurrency,
  });

const focusBarcode = () => {
  barcodeInput?.focus();
};

const renderItems = () => {
  posItems.renderItems({
    container: posItemsContainer,
    items: state.items,
    formatCurrency,
    getItemTotal,
    onRemove: (itemName) => openApprovalModal("remove_item", { item: itemName }),
  });
  updateSummary();
};

const syncItemsFromDom = () => {
  state.items = posItems.syncItemsFromDom({ container: posItemsContainer });
  updateSummary();
};

const requestApproval = async ({ action, reason, metadata }) =>
  posApprovals.requestApproval({
    postJson,
    email: managerEmailInput.value,
    password: managerPasswordInput.value,
    action,
    reason,
    metadata,
  });

const postWithApproval = async ({ url, payload, token }) =>
  posApprovals.postWithApproval({
    requestJson,
    url,
    payload,
    token,
  });

const openApprovalModal = (action, metadata) =>
  posApprovals.openApprovalModal({
    modal: approvalModal,
    form: approvalForm,
    actionInput: approvalActionInput,
    action,
    metadata,
  });

const addItem = ({ name, price, quantity, weight, status, unitType, sku, productId }) => {
  const item = {
    name,
    price,
    quantity,
    weight,
    status,
    unitType,
    sku,
    productId,
  };
  state.items.push(item);
  const element = posItems.createItemElement({
    item,
    formatCurrency,
    getItemTotal,
    onRemove: (itemName) => openApprovalModal("remove_item", { item: itemName }),
  });
  posItemsContainer?.appendChild(element);
  posItems.setLatestItem(element);
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

const renderSuspendedSales = () =>
  posSuspendedSales.renderSuspendedSales({
    container: suspendedSalesContainer,
    sales: state.suspendedSales,
    onResume: (index) => restoreSuspendedSale(index),
  });

const suspendCurrentSale = () =>
  posSuspendedSales.suspendCurrentSale({
    state,
    setFeedback,
    clearSale,
    renderSuspendedSales,
  });

const restoreSuspendedSale = (index = 0) =>
  posSuspendedSales.restoreSuspendedSale({
    state,
    index,
    noteInput,
    renderItems,
    renderSuspendedSales,
    setFeedback,
    focusBarcode,
  });

const handleCancelSale = async () => {
  if (state.items.length === 0) {
    setFeedback("Nenhum item para cancelar.", "warning");
    return;
  }
  openApprovalModal("cancel_sale", { items: state.items.length });
};

const getAdjustedQuantity = (item) => {
  if (item.weight > 0) {
    const rounded = Math.round(item.weight);
    if (Number(item.weight).toFixed(2) !== Number(rounded).toFixed(2)) {
      setFeedback(
        `Peso ${item.weight.toFixed(2).replace(".", ",")} ${item.unitType || "kg"} ajustado para ${rounded}.`,
        "warning"
      );
    }
  }
  return normalizeSaleQuantity(item);
};

const loadDevices = async () => {
  if (!getJson || !posDevices) {
    return;
  }
  try {
    await posDevices.loadDevices({ getJson, list: deviceStatusList });
  } catch (error) {
    if (deviceStatusList) {
      deviceStatusList.innerHTML =
        '<div class="list-group-item text-danger">Erro ao carregar dispositivos.</div>';
    }
  }
};

const loadProducts = async () => {
  if (!getJson || !posCatalog) {
    return;
  }
  try {
    const { products, lookup } = await posCatalog.loadProducts({
      getJson,
      datalist: productSearchList,
    });
    state.products = products;
    state.productLookup = lookup;
    setFeedback("Catálogo sincronizado com o estoque.", "info");
  } catch (error) {
    setFeedback(error.message || "Não foi possível carregar o catálogo.", "danger");
  }
};

const resolveProduct = (inputValue) => posCatalog?.resolveProduct(inputValue, state.productLookup);

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
  const inputValue = barcodeInput.value.trim();
  if (!inputValue) {
    setFeedback("Informe o código, PLU ou nome do produto.", "warning");
    return;
  }
  const product = resolveProduct(inputValue);
  if (!product) {
    setFeedback("Produto não encontrado no catálogo rápido.", "warning");
    return;
  }
  const quantity = Math.max(parseNumber(quantityInput?.value || "1", 1), 1);
  const weight = Math.max(parseNumber(weightInput?.value || "0"), 0);
  const usesWeight = posCatalog?.isWeightUnit(product.unit_type) ?? false;
  const selectedWeight = usesWeight
    ? scaleModeToggle?.checked
      ? weight || 1
      : weight > 0
        ? weight
        : 0
    : 0;
  const status = product.current_stock <= product.min_stock ? "low" : "ok";
  addItem({
    name: product.name,
    price: Number(product.price || 0),
    quantity: usesWeight ? 1 : quantity,
    weight: selectedWeight,
    status,
    unitType: product.unit_type,
    sku: product.sku,
    productId: product.id,
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
    const product = resolveProduct(name);
    if (!product) {
      setFeedback("Produto não encontrado no catálogo sincronizado.", "warning");
      return;
    }
    const weight = Math.max(parseNumber(weightInput?.value || "0"), 0);
    const usesWeight = posCatalog?.isWeightUnit(product.unit_type) ?? false;
    const selectedWeight = usesWeight
      ? scaleModeToggle?.checked
        ? weight || 1
        : weight > 0
          ? weight
          : 0
      : 0;
    const status = product.current_stock <= product.min_stock ? "low" : "ok";
    addItem({
      name: product.name,
      price: Number(product.price || 0),
      quantity: usesWeight ? 1 : 1,
      weight: selectedWeight,
      status,
      unitType: product.unit_type,
      sku: product.sku,
      productId: product.id,
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

posNotes.initNotes({
  addNoteButton,
  noteModal,
  noteInput,
  noteForm,
  state,
  setFeedback,
});

posShortcuts.registerShortcuts({
  onFinish: () => finishSaleButton?.click(),
  onManagerDiscount: () => applyManagerDiscountButton?.click(),
  onRemoveFirst: () => document.querySelector(".js-remove-item")?.click(),
  onSuspend: () => suspendSaleButton?.click(),
  onResume: () => resumeSaleButton?.click(),
});

finishSaleButton?.addEventListener("click", async () => {
  if (!postJson) {
    setFeedback("API indisponível para registrar a venda.", "danger");
    return;
  }
  if (state.items.length === 0) {
    setFeedback("Nenhum item na venda.", "warning");
    return;
  }
  const paymentMethod = paymentMethodSelect?.value || "Dinheiro";
  try {
    setFeedback("Registrando venda...", "info");
    await posSales.finalizeSale({
      postJson,
      items: state.items,
      paymentMethod,
      getAdjustedQuantity,
    });
    setFeedback("Venda finalizada e registrada no estoque.", "success");
    clearSale();
    loadProducts();
  } catch (error) {
    setFeedback(error.message || "Erro ao registrar venda.", "danger");
  }
});

focusBarcode();
syncItemsFromDom();
renderSuspendedSales();
loadProducts();
loadDevices();
