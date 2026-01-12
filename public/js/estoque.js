const stockMoveForm = document.getElementById("stock-move-form");
const lossReasonInput = document.getElementById("loss-reason");
const stockSearchInput = document.getElementById("stock-search");
const stockCategoryFilter = document.getElementById("stock-category");
const stockStatusFilter = document.getElementById("stock-status");
const stockSortSelect = document.getElementById("stock-sort");
const stockPageSizeSelect = document.getElementById("stock-page-size");
const stockPrevButton = document.getElementById("stock-prev");
const stockNextButton = document.getElementById("stock-next");
const stockPaginationSummary = document.getElementById("stock-pagination-summary");
const stockTableBody = document.getElementById("stock-table-body");
const stockProductsDatalist = document.getElementById("stock-products");
const stockDetailModalElement = document.getElementById("stockDetailModal");
const stockDetailTitle = document.getElementById("stock-detail-title");
const stockDetailCategory = document.getElementById("stock-detail-category");
const stockDetailStatus = document.getElementById("stock-detail-status");
const stockDetailValidity = document.getElementById("stock-detail-validity");
const stockDetailSupplier = document.getElementById("stock-detail-supplier");
const stockDetailMovements = document.getElementById("stock-detail-movements");
const stockAdjustModalElement = document.getElementById("stockAdjustModal");
const stockAdjustForm = document.getElementById("stock-adjust-form");
const stockAdjustProduct = document.getElementById("stock-adjust-product");
const stockAdjustId = document.getElementById("stock-adjust-id");
const stockAdjustValue = document.getElementById("stock-adjust-value");
const stockAdjustReason = document.getElementById("stock-adjust-reason");
const stockMoveProduct = document.getElementById("stock-move-product");
const stockMoveQuantity = document.getElementById("stock-move-quantity");
const stockMoveDate = document.getElementById("stock-move-date");
const stockMoveType = document.getElementById("stock-move-type");
const exportCsvButton = document.getElementById("export-csv");
const exportPdfButton = document.getElementById("export-pdf");
const productForm = document.getElementById("product-form");
const productNameInput = document.getElementById("product-name");
const productSkuInput = document.getElementById("product-sku");
const productCategoryInput = document.getElementById("product-category");
const productSupplierSelect = document.getElementById("product-supplier");
const productUnitInput = document.getElementById("product-unit");
const productPriceInput = document.getElementById("product-price");
const productExpiryInput = document.getElementById("product-expiry");
const productStockInput = document.getElementById("product-stock");
const productMinInput = document.getElementById("product-min");
const productMaxInput = document.getElementById("product-max");
const productFormError = document.getElementById("product-form-error");
const criticalCount = document.getElementById("critical-count");
const expiryCount = document.getElementById("expiry-count");
const restockCount = document.getElementById("restock-count");
const expiryList = document.getElementById("expiry-list");
const expiry7 = document.getElementById("expiry-7");
const expiry15 = document.getElementById("expiry-15");
const expiry30 = document.getElementById("expiry-30");
const stockHistory = document.getElementById("stock-history");
const restockList = document.getElementById("restock-list");
const purchaseOrdersBody = document.getElementById("purchase-orders-body");
const supplierForm = document.getElementById("supplier-form");
const supplierNameInput = document.getElementById("supplier-name");
const supplierContactInput = document.getElementById("supplier-contact");
const supplierPhoneInput = document.getElementById("supplier-phone");
const supplierEmailInput = document.getElementById("supplier-email");

let currentPage = 1;
let stockRows = [];
let stockProducts = [];
let productLookup = new Map();
let suppliersCache = [];

const { getJson, postJson, requestJson } = window.apiClient || {};
const { stockUtils, stockCatalog, stockExports, stockForms } = window;

const resolveProductByName = async (name) =>
  stockCatalog.resolveProductByName({ name, productLookup });

const ensureCategory = async (name) => {
  const categories = await getJson("/api/categories");
  const existing = categories.find(
    (category) => category.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (existing) {
    return existing.id;
  }
  const created = await postJson("/api/categories", { name: name.trim() });
  return created.id;
};

const requestApproval = async ({ action, reason, metadata }) => {
  const email = window.prompt("Email do gerente para aprovação:");
  const password = window.prompt("Senha do gerente:");
  if (!email || !password) {
    throw new Error("Aprovação necessária.");
  }
  return postJson("/api/approvals", {
    email,
    password,
    action,
    reason,
    metadata,
  });
};

const stockDetailModal = stockDetailModalElement
  ? new bootstrap.Modal(stockDetailModalElement)
  : null;
const stockAdjustModal = stockAdjustModalElement
  ? new bootstrap.Modal(stockAdjustModalElement)
  : null;

const updateLossReasonVisibility = () => {
  if (!stockMoveForm || !lossReasonInput) {
    return;
  }
  const select = stockMoveForm.querySelector("select");
  if (!select) {
    return;
  }
  if (select.value === "Perda/estrago") {
    lossReasonInput.classList.remove("d-none");
    lossReasonInput.required = true;
  } else {
    lossReasonInput.classList.add("d-none");
    lossReasonInput.required = false;
  }
};

const { normalizeValue, formatDateValue, getDaysUntil, getStockStatus, getStatusBadgeClass } = stockUtils;

const buildProductLookup = (products) => {
  productLookup = stockCatalog.buildProductLookup(products);
};

const renderExpiryPanels = () => {
  if (!expiryList) {
    return;
  }
  const expiringProducts = stockProducts
    .map((product) => ({
      ...product,
      days: getDaysUntil(product.expires_at),
    }))
    .filter((product) => product.days !== null)
    .sort((a, b) => a.days - b.days);

  const expiringSoon = expiringProducts.filter((product) => product.days <= 7);
  const expiring15 = expiringProducts.filter((product) => product.days <= 15);
  const expiring30 = expiringProducts.filter((product) => product.days <= 30);

  if (expiryCount) {
    expiryCount.textContent = `${expiringSoon.length} itens`;
  }
  if (expiry7) {
    expiry7.textContent = expiringSoon.length;
  }
  if (expiry15) {
    expiry15.textContent = expiring15.length;
  }
  if (expiry30) {
    expiry30.textContent = expiring30.length;
  }

  expiryList.innerHTML = "";
  const upcoming = expiringProducts.slice(0, 5);
  if (upcoming.length === 0) {
    expiryList.innerHTML =
      '<div class="list-group-item text-muted">Nenhum produto com validade registrada.</div>';
    return;
  }
  upcoming.forEach((product) => {
    const item = document.createElement("div");
    item.className = "list-group-item d-flex justify-content-between";
    const badgeClass = product.days <= 3 ? "text-bg-danger" : "text-bg-warning";
    item.innerHTML = `
      <div>
        <strong>${product.name}</strong>
        <div class="text-muted small">Vence em ${product.days} dia(s)</div>
      </div>
      <span class="badge ${badgeClass}">${formatDateValue(product.expires_at)}</span>
    `;
    expiryList.appendChild(item);
  });
};

const renderStockTable = () => {
  if (!stockTableBody) {
    return;
  }
  stockTableBody.innerHTML = "";
  if (!stockProducts.length) {
    renderEmptyState("Nenhum produto cadastrado.");
    return;
  }
  stockRows = stockProducts.map((product) => {
    const status = getStockStatus(product);
    const row = document.createElement("tr");
    row.dataset.productId = product.id;
    row.dataset.category = product.category_name || "Sem categoria";
    row.dataset.status = status;
    row.dataset.product = product.name;
    row.dataset.validity = product.expires_at || "";
    row.dataset.supplier = product.supplier_name || "";

    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.category_name || "-"}</td>
      <td>${product.current_stock} ${product.unit_type || ""}</td>
      <td>${product.min_stock || 0} / ${product.max_stock || 0}</td>
      <td>${formatDateValue(product.expires_at)}</td>
      <td><span class="${getStatusBadgeClass(status)}">${status}</span></td>
      <td>
        <button class="btn btn-outline-secondary btn-sm js-stock-detail">Detalhes</button>
        <button class="btn btn-outline-success btn-sm js-stock-adjust">Ajustar</button>
      </td>
    `;
    stockTableBody.appendChild(row);
    return row;
  });

  stockRows.forEach((row) => {
    row.querySelector(".js-stock-detail")?.addEventListener("click", () => {
      openStockDetail(row);
    });
    row.querySelector(".js-stock-adjust")?.addEventListener("click", () => {
      openStockAdjust(row);
    });
  });
};

const renderCategoryFilter = () => {
  if (!stockCategoryFilter) {
    return;
  }
  const categories = Array.from(
    new Set(stockProducts.map((product) => product.category_name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  stockCategoryFilter.innerHTML = '<option>Todas as categorias</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.textContent = category;
    stockCategoryFilter.appendChild(option);
  });
};

const renderProductDatalist = () => {
  if (!stockProductsDatalist) {
    return;
  }
  stockProductsDatalist.innerHTML = "";
  stockProducts.forEach((product) => {
    const option = document.createElement("option");
    const label = product.sku ? `${product.name} (${product.sku})` : product.name;
    option.value = label;
    stockProductsDatalist.appendChild(option);
  });
};

const updateSummaryCards = () => {
  const criticalItems = stockProducts.filter(
    (product) => Number(product.current_stock || 0) <= Number(product.min_stock || 0)
  );
  if (criticalCount) {
    criticalCount.textContent = `${criticalItems.length} itens`;
  }
  if (restockCount) {
    restockCount.textContent = `${criticalItems.length} itens`;
  }
};

const renderMovementItem = (movement) => {
  const item = document.createElement("div");
  item.className = "list-group-item d-flex justify-content-between";
  const badgeClass =
    movement.type === "loss"
      ? "text-bg-danger"
      : movement.type === "sale"
      ? "text-bg-secondary"
      : movement.delta >= 0
      ? "text-bg-success"
      : "text-bg-warning";
  const deltaLabel =
    typeof movement.delta === "number"
      ? `${movement.delta > 0 ? "+" : ""}${movement.delta} ${movement.unit_type || ""}`
      : movement.quantity_label || "";
  const details = movement.reason ? `<div class="text-muted small">${movement.reason}</div>` : "";
  item.innerHTML = `
    <div>
      <strong>${movement.label}</strong>
      ${details}
    </div>
    <span class="badge ${badgeClass}">${deltaLabel}</span>
  `;
  return item;
};

const renderHistory = (movements) => {
  if (!stockHistory) {
    return;
  }
  stockHistory.innerHTML = "";
  if (!movements.length) {
    stockHistory.innerHTML =
      '<div class="list-group-item text-muted">Nenhuma movimentação registrada.</div>';
    return;
  }
  movements.slice(0, 6).forEach((movement) => {
    stockHistory.appendChild(renderMovementItem(movement));
  });
};

const renderRestock = (suggestions) => {
  if (!restockList) {
    return;
  }
  restockList.innerHTML = "";
  if (!suggestions.length) {
    restockList.innerHTML =
      '<div class="list-group-item text-muted">Nenhuma reposição pendente.</div>';
    return;
  }
  suggestions.forEach((item) => {
    const suggestedQty = Math.max(
      Number(item.max_stock || 0) - Number(item.current_stock || 0),
      0
    );
    const listItem = document.createElement("div");
    listItem.className = "list-group-item d-flex justify-content-between";
    listItem.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="text-muted small">Estoque atual: ${item.current_stock} ${item.unit_type || ""}</div>
        <div class="text-muted small">Sugestão: ${suggestedQty} ${item.unit_type || ""}</div>
      </div>
      <button
        class="btn btn-outline-success btn-sm js-create-order"
        type="button"
        data-product-id="${item.id}"
        data-quantity="${suggestedQty}"
      >
        Gerar pedido
      </button>
    `;
    restockList.appendChild(listItem);
  });
};

const renderSuppliers = () => {
  if (!productSupplierSelect) {
    return;
  }
  productSupplierSelect.innerHTML = '<option value="">Sem fornecedor</option>';
  suppliersCache.forEach((supplier) => {
    const option = document.createElement("option");
    option.value = supplier.id;
    option.textContent = supplier.name;
    productSupplierSelect.appendChild(option);
  });
};

const renderPurchaseOrders = (orders) => {
  if (!purchaseOrdersBody) {
    return;
  }
  purchaseOrdersBody.innerHTML = "";
  if (!orders.length) {
    purchaseOrdersBody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-3">Nenhum pedido registrado.</td></tr>';
    return;
  }
  orders.forEach((order) => {
    const row = document.createElement("tr");
    const statusLabel = order.status === "received" ? "Recebido" : "Pendente";
    row.innerHTML = `
      <td>${order.id}</td>
      <td>${order.supplier_name || "Sem fornecedor"}</td>
      <td>${statusLabel}</td>
      <td>${order.created_at ? order.created_at.split(" ")[0] : "-"}</td>
      <td>${order.received_at ? order.received_at.split(" ")[0] : "-"}</td>
      <td>
        <button class="btn btn-outline-success btn-sm js-receive-order" data-order-id="${order.id}" ${
          order.status === "received" ? "disabled" : ""
        }>
          Receber
        </button>
      </td>
    `;
    purchaseOrdersBody.appendChild(row);
  });
};

const getFilteredRows = () => {
  const searchValue = normalizeValue(stockSearchInput?.value || "");
  const categoryValue = normalizeValue(stockCategoryFilter?.value || "todas as categorias");
  const statusValue = normalizeValue(stockStatusFilter?.value || "status");

  return stockRows.filter((row) => {
    const product = normalizeValue(row.dataset.product || "");
    const category = normalizeValue(row.dataset.category || "");
    const status = normalizeValue(row.dataset.status || "");

    const matchesSearch = !searchValue || product.includes(searchValue);
    const matchesCategory =
      categoryValue === "todas as categorias" || categoryValue === category;
    const matchesStatus = statusValue === "status" || statusValue === status;

    return matchesSearch && matchesCategory && matchesStatus;
  });
};

const sortRows = (rows) => {
  const sortValue = stockSortSelect?.value || "product-asc";
  const [field, direction] = sortValue.split("-");
  const factor = direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    if (field === "validity") {
      const dateA = parseDateValue(a.dataset.validity) || new Date(0);
      const dateB = parseDateValue(b.dataset.validity) || new Date(0);
      return (dateA - dateB) * factor;
    }
    if (field === "status") {
      const statusA = normalizeValue(a.dataset.status || "");
      const statusB = normalizeValue(b.dataset.status || "");
      return statusA.localeCompare(statusB) * factor;
    }
    const productA = normalizeValue(a.dataset.product || "");
    const productB = normalizeValue(b.dataset.product || "");
    return productA.localeCompare(productB) * factor;
  });
};

const updatePaginationSummary = (page, totalPages, totalItems) => {
  if (!stockPaginationSummary) {
    return;
  }
  stockPaginationSummary.textContent = `Página ${page} de ${totalPages} • ${totalItems} itens`;
};

const renderTable = () => {
  const filteredRows = getFilteredRows();
  const sortedRows = sortRows(filteredRows);
  const pageSize = Number(stockPageSizeSelect?.value || 10);
  const totalPages = Math.max(Math.ceil(sortedRows.length / pageSize), 1);
  currentPage = Math.min(currentPage, totalPages);

  stockRows.forEach((row) => row.classList.add("d-none"));

  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = sortedRows.slice(startIndex, startIndex + pageSize);
  pageRows.forEach((row) => row.classList.remove("d-none"));

  updatePaginationSummary(currentPage, totalPages, sortedRows.length);
  if (stockPrevButton) {
    stockPrevButton.disabled = currentPage <= 1;
  }
  if (stockNextButton) {
    stockNextButton.disabled = currentPage >= totalPages;
  }
};

const renderEmptyState = (message) => {
  if (stockTableBody) {
    stockTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">${message}</td>
      </tr>
    `;
  }
  stockRows = [];
  updatePaginationSummary(1, 1, 0);
};

const loadProducts = async () => {
  if (!getToken()) {
    renderEmptyState("Faça login para visualizar o estoque.");
    return;
  }
  try {
    stockProducts = await getJson("/api/products");
    buildProductLookup(stockProducts);
    renderCategoryFilter();
    renderProductDatalist();
    renderStockTable();
    renderExpiryPanels();
    updateSummaryCards();
    currentPage = 1;
    renderTable();
    const [movements, restock, suppliers, orders] = await Promise.all([
      getJson("/api/stock/movements?limit=6"),
      getJson("/api/stock/restock-suggestions"),
      getJson("/api/suppliers"),
      getJson("/api/purchase-orders"),
    ]);
    renderHistory(movements);
    renderRestock(restock);
    suppliersCache = suppliers;
    renderSuppliers();
    renderPurchaseOrders(orders);
  } catch (error) {
    renderEmptyState(error.message || "Erro ao carregar o estoque.");
  }
};

const openStockDetail = (row) => {
  if (!stockDetailModal || !row) {
    return;
  }
  const product = row.dataset.product || "Produto";
  const productId = row.dataset.productId || "";
  stockDetailTitle.textContent = `Detalhes do produto - ${product}`;
  if (stockDetailCategory) {
    stockDetailCategory.textContent = row.dataset.category || "-";
  }
  if (stockDetailStatus) {
    stockDetailStatus.textContent = row.dataset.status || "-";
  }
  if (stockDetailValidity) {
    stockDetailValidity.textContent = formatDateValue(row.dataset.validity);
  }
  if (stockDetailSupplier) {
    stockDetailSupplier.textContent = row.dataset.supplier || "-";
  }
  if (stockDetailMovements) {
    stockDetailMovements.innerHTML =
      '<li class="list-group-item text-muted">Carregando movimentações...</li>';
  }
  stockDetailModal.show();
  if (productId) {
    getJson(`/api/stock/movements?product_id=${productId}&limit=5`)
      .then((movements) => {
        if (!stockDetailMovements) {
          return;
        }
        stockDetailMovements.innerHTML = "";
        if (!movements.length) {
          stockDetailMovements.innerHTML =
            '<li class="list-group-item text-muted">Nenhuma movimentação registrada.</li>';
          return;
        }
        movements.forEach((movement) => {
          const item = document.createElement("li");
          item.className = "list-group-item";
          item.textContent = movement.label;
          stockDetailMovements.appendChild(item);
        });
      })
      .catch(() => {
        if (stockDetailMovements) {
          stockDetailMovements.innerHTML =
            '<li class="list-group-item text-muted">Não foi possível carregar.</li>';
        }
      });
  }
};

const openStockAdjust = (row) => {
  if (!stockAdjustModal || !row) {
    return;
  }
  stockAdjustForm?.reset();
  const product = row.dataset.product || "Produto";
  const productId = row.dataset.productId || "";
  if (stockAdjustProduct) {
    stockAdjustProduct.value = product;
  }
  if (stockAdjustId) {
    stockAdjustId.value = productId;
  }
  stockAdjustModal.show();
};

const exportTable = (type) => {
  const headers = [
    "Produto",
    "Categoria",
    "Saldo",
    "Mín/Máx",
    "Validade",
    "Status",
    "Fornecedor",
  ];
  const rows = getFilteredRows().map((row) => [
    row.dataset.product || "",
    row.dataset.category || "",
    row.children[2]?.textContent.trim() || "",
    row.children[3]?.textContent.trim() || "",
    row.children[4]?.textContent.trim() || "",
    row.dataset.status || "",
    row.dataset.supplier || "",
  ]);

  stockExports.exportTable({ type, headers, rows });
};

const showFormError = (message) => stockForms.showFormError({ element: productFormError, message });

const validateProductForm = () =>
  stockForms.validateProductForm({
    minValue: Number(productMinInput?.value || 0),
    maxValue: Number(productMaxInput?.value || 0),
    priceValue: Number((productPriceInput?.value || "0").replace(",", ".")),
    stockValue: Number(productStockInput?.value || 0),
    element: productFormError,
  });

stockMoveForm?.querySelector("select")?.addEventListener("change", updateLossReasonVisibility);
stockSearchInput?.addEventListener("input", () => {
  currentPage = 1;
  renderTable();
});
stockCategoryFilter?.addEventListener("change", () => {
  currentPage = 1;
  renderTable();
});
stockStatusFilter?.addEventListener("change", () => {
  currentPage = 1;
  renderTable();
});
stockSortSelect?.addEventListener("change", () => {
  currentPage = 1;
  renderTable();
});
stockPageSizeSelect?.addEventListener("change", () => {
  currentPage = 1;
  renderTable();
});
productMinInput?.addEventListener("input", validateProductForm);
productMaxInput?.addEventListener("input", validateProductForm);
productPriceInput?.addEventListener("input", validateProductForm);
productStockInput?.addEventListener("input", validateProductForm);

exportCsvButton?.addEventListener("click", () => exportTable("csv"));
exportPdfButton?.addEventListener("click", () => exportTable("pdf"));

stockRows.forEach((row) => {
  row.querySelector(".js-stock-detail")?.addEventListener("click", () => {
    openStockDetail(row);
  });
  row.querySelector(".js-stock-adjust")?.addEventListener("click", () => {
    openStockAdjust(row);
  });
});

stockPrevButton?.addEventListener("click", () => {
  currentPage = Math.max(currentPage - 1, 1);
  renderTable();
});
stockNextButton?.addEventListener("click", () => {
  currentPage += 1;
  renderTable();
});

restockList?.addEventListener("click", (event) => {
  const button = event.target.closest(".js-create-order");
  if (!button) {
    return;
  }
  const productId = Number(button.dataset.productId || 0);
  const quantity = Number(button.dataset.quantity || 0);
  if (!productId || !quantity) {
    window.alert("Quantidade sugerida inválida.");
    return;
  }
  postJson("/api/purchase-orders", {
    items: [{ product_id: productId, quantity }],
  })
    .then(() => {
      window.alert("Pedido gerado com sucesso.");
    })
    .catch((error) => {
      window.alert(error.message || "Erro ao gerar pedido.");
    });
});

purchaseOrdersBody?.addEventListener("click", (event) => {
  const button = event.target.closest(".js-receive-order");
  if (!button) {
    return;
  }
  const orderId = Number(button.dataset.orderId || 0);
  if (!orderId) {
    return;
  }
  postJson(`/api/purchase-orders/${orderId}/receive`, {})
    .then(() => {
      window.alert("Pedido recebido.");
      loadProducts();
    })
    .catch((error) => {
      window.alert(error.message || "Erro ao receber pedido.");
    });
});

stockAdjustForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const adjustValue = stockAdjustValue?.value.trim();
  const adjustReason = stockAdjustReason?.value.trim();
  const productName = stockAdjustProduct?.value.trim();
  const productId = Number(stockAdjustId?.value || 0);
  if (!adjustValue || !adjustReason || !productName) {
    return;
  }
  const delta = Number(adjustValue.replace(",", "."));
  if (Number.isNaN(delta) || delta === 0) {
    window.alert("Informe um ajuste válido.");
    return;
  }
  const adjustPromise = productId
    ? Promise.resolve({ id: productId })
    : resolveProductByName(productName);
  adjustPromise
    .then((product) =>
      postJson("/api/stock/adjust", {
        product_id: product.id,
        delta,
        reason: adjustReason,
      })
    )
    .then(() => {
      const historyList = stockHistory;
      if (historyList) {
        const item = document.createElement("div");
        item.className = "list-group-item d-flex justify-content-between";
        item.innerHTML = `
          <div>
            <strong>Ajuste • ${productName}</strong>
            <div class="text-muted small">Motivo: ${adjustReason}</div>
          </div>
          <span class="badge text-bg-secondary">${adjustValue}</span>
        `;
        historyList.prepend(item);
      }
      stockAdjustValue.value = "";
      stockAdjustReason.value = "";
      stockAdjustModal?.hide();
      loadProducts();
    })
    .catch((error) => {
      window.alert(error.message || "Não foi possível ajustar o estoque.");
    });
});

productForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateProductForm()) {
    return;
  }
  const name = productNameInput?.value.trim();
  const categoryName = productCategoryInput?.value.trim();
  const unitType = productUnitInput?.value.trim();
  const sku = productSkuInput?.value.trim();
  const priceValue = Number((productPriceInput?.value || "0").replace(",", "."));
  const stockValue = Number(productStockInput?.value || 0);
  if (!name || !categoryName || !unitType) {
    showFormError("Preencha nome, categoria e unidade.");
    return;
  }
  if (!sku) {
    showFormError("Preencha o SKU do produto.");
    return;
  }
  if (Number.isNaN(priceValue) || priceValue <= 0) {
    showFormError("Informe um preço válido.");
    return;
  }
  const payload = {
    name,
    sku,
    unit_type: unitType,
    min_stock: Number(productMinInput?.value || 0),
    max_stock: Number(productMaxInput?.value || 0),
    current_stock: stockValue,
    price: priceValue,
    expires_at: productExpiryInput?.value || null,
  };
  if (productSupplierSelect?.value) {
    payload.supplier_id = Number(productSupplierSelect.value);
  }
  ensureCategory(categoryName)
    .then((categoryId) =>
      postJson("/api/products", {
        ...payload,
        category_id: categoryId,
      })
    )
    .then(() => {
      showFormError("");
      productForm?.reset();
      loadProducts();
      window.alert("Produto cadastrado com sucesso.");
    })
    .catch((error) => {
      showFormError(error.message || "Erro ao cadastrar produto.");
    });
});

stockMoveForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const productName = stockMoveProduct?.value.trim();
  const quantityValue = Number(stockMoveQuantity?.value || 0);
  const moveType = stockMoveType?.value || "Entrada";
  if (!productName || !quantityValue || quantityValue <= 0) {
    window.alert("Informe produto e quantidade.");
    return;
  }
  resolveProductByName(productName)
    .then((product) => {
      if (moveType === "Perda/estrago") {
        const reason = lossReasonInput?.value.trim();
        if (!reason) {
          window.alert("Informe o motivo da perda.");
          return Promise.reject(new Error("Motivo é obrigatório."));
        }
        return requestJson("/api/stock/loss", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: product.id,
            quantity: quantityValue,
            reason,
          }),
        }).catch((error) => {
          if (error.message?.includes("Aprovação")) {
            return requestApproval({
              action: "stock_loss",
              reason,
              metadata: { product_id: product.id, quantity: quantityValue },
            }).then((approval) =>
              requestJson("/api/stock/loss", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-approval-token": approval.token,
                },
                body: JSON.stringify({
                  product_id: product.id,
                  quantity: quantityValue,
                  reason,
                }),
              })
            );
          }
          throw error;
        });
      }

      const reason = `${moveType} em ${stockMoveDate?.value || "data não informada"}`;
      const type = moveType === "Entrada" ? "inbound" : "outbound";
      return postJson("/api/stock/move", {
        product_id: product.id,
        quantity: quantityValue,
        type,
        reason,
      });
    })
    .then(() => {
      stockMoveForm?.reset();
      updateLossReasonVisibility();
      window.alert("Movimentação registrada.");
      loadProducts();
    })
    .catch((error) => {
      if (error.message !== "Motivo é obrigatório.") {
        window.alert(error.message || "Erro ao registrar movimentação.");
      }
    });
});

supplierForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = supplierNameInput?.value.trim();
  if (!name) {
    window.alert("Informe o nome do fornecedor.");
    return;
  }
  postJson("/api/suppliers", {
    name,
    contact: supplierContactInput?.value.trim(),
    phone: supplierPhoneInput?.value.trim(),
    email: supplierEmailInput?.value.trim(),
  })
    .then(() => {
      supplierForm.reset();
      return getJson("/api/suppliers");
    })
    .then((suppliers) => {
      suppliersCache = suppliers;
      renderSuppliers();
      window.alert("Fornecedor cadastrado.");
    })
    .catch((error) => {
      window.alert(error.message || "Erro ao cadastrar fornecedor.");
    });
});

updateLossReasonVisibility();
loadProducts();
