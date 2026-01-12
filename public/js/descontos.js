const discountForm = document.getElementById("discount-form");
const discountFeedback = document.getElementById("discount-feedback");
const discountsList = document.getElementById("discounts-list");
const summaryActive = document.getElementById("summary-active");
const summaryScheduled = document.getElementById("summary-scheduled");
const summaryEnded = document.getElementById("summary-ended");
const summaryMax = document.getElementById("summary-max");
const filterSearch = document.getElementById("discount-search");
const filterType = document.getElementById("discount-filter-type");
const filterStatus = document.getElementById("discount-filter-status");
const filterClear = document.getElementById("discount-filter-clear");
const discountExport = document.getElementById("discount-export");
const discountImport = document.getElementById("discount-import");
const discountCalendar = document.getElementById("discount-calendar");
const discountPageSize = document.getElementById("discount-page-size");
const discountPagination = document.getElementById("discount-pagination");
const simulatorQty = document.getElementById("sim-qty");
const simulatorPrice = document.getElementById("sim-price");
const simulatorCost = document.getElementById("sim-cost");
const simulatorSubtotal = document.getElementById("sim-subtotal");
const simulatorDiscount = document.getElementById("sim-discount");
const simulatorTotal = document.getElementById("sim-total");
const simulatorWarning = document.getElementById("sim-warning");
const productPickerButton = document.getElementById("discount-product-picker");
const productPickerCount = document.getElementById("discount-product-count");
const productPickerSearch = document.getElementById("product-picker-search");
const productPickerList = document.getElementById("product-picker-list");
const productPickerApply = document.getElementById("product-picker-apply");

let discountsCache = [];
let productsCache = [];
let editingDiscountId = null;
let selectedProductIds = [];
let stagedProductIds = [];
let currentPage = 1;
let pageSize = 10;

const { requestJson } = window.apiClient || {};
const { sharedFeedback, sharedFormat } = window;

const setFeedback = (message, type) =>
  sharedFeedback.setFeedback(discountFeedback, message, type);

const resetFeedback = () => sharedFeedback.clearFeedback(discountFeedback);

const formatDiscountType = (discount) => {
  if (discount.type === "percent") {
    return `${Number(discount.value)}%`;
  }
  if (discount.type === "fixed") {
    return `R$ ${Number(discount.value).toFixed(2)} de abatimento`;
  }
  if (discount.type === "buy_x_get_y") {
    return `Compre ${discount.buy_quantity} leve ${discount.get_quantity}`;
  }
  if (discount.type === "fixed_bundle") {
    return `${discount.buy_quantity} itens por R$ ${Number(discount.value).toFixed(2)}`;
  }
  return "Promoção";
};

const formatCurrency = (value) => sharedFormat.formatCurrency(value);

const getDaysMap = () => ({
  "0": "Dom",
  "1": "Seg",
  "2": "Ter",
  "3": "Qua",
  "4": "Qui",
  "5": "Sex",
  "6": "Sáb",
});

const formatTarget = (discount) => {
  if (discount.target_type === "category") {
    return `Categoria: ${discount.target_value || "não definida"}`;
  }
  if (discount.target_type === "product") {
    const ids = parseProductIds(discount.target_value);
    return ids.length ? `Produtos: ${ids.length} selecionados` : "Produtos: não definidos";
  }
  if (discount.target_type === "combo") {
    return `Combo: ${discount.target_value || "não definido"}`;
  }
  return "Todos os produtos";
};

const parseDays = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const formatDays = (days) => {
  const labels = getDaysMap();
  return days.map((day) => labels[String(day)] || day);
};

const parseProductIds = (value) => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch (error) {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const renderProductPicker = (filter = "") => {
  if (!productPickerList) {
    return;
  }
  const term = filter.toLowerCase();
  const filtered = productsCache.filter((product) => {
    const label = `${product.name} ${product.sku || ""}`.toLowerCase();
    return label.includes(term);
  });
  if (!filtered.length) {
    productPickerList.innerHTML = "<p class=\"text-muted\">Nenhum produto encontrado.</p>";
    return;
  }
  productPickerList.innerHTML = filtered
    .map(
      (product) => `
        <label class="product-picker-item">
          <input
            class="form-check-input"
            type="checkbox"
            value="${product.id}"
            ${stagedProductIds.includes(String(product.id)) ? "checked" : ""}
          />
          <div>
            <strong>${product.name}</strong>
            <small class="d-block">SKU: ${product.sku || "—"} • Unidade: ${product.unit_type}</small>
          </div>
        </label>
      `
    )
    .join("");
};

const syncPickerCount = () => {
  if (!productPickerCount) {
    return;
  }
  const count = selectedProductIds.length;
  productPickerCount.textContent =
    count === 0 ? "Nenhum produto selecionado." : `${count} produto(s) selecionado(s).`;
  if (discountForm?.target_type?.value === "product") {
    const selectedNames = productsCache
      .filter((product) => selectedProductIds.includes(String(product.id)))
      .map((product) => product.name);
    if (discountForm.target_value) {
      discountForm.target_value.value = selectedNames.join(", ");
    }
  }
};

const refreshProducts = async () => {
  try {
    const data = await requestJson("/api/products");
    productsCache = data;
    renderProductPicker(productPickerSearch?.value || "");
    syncPickerCount();
  } catch (error) {
    if (productPickerList) {
      productPickerList.innerHTML = "<p class=\"text-danger\">Erro ao carregar produtos.</p>";
    }
  }
};

const getStatus = (discount) => {
  const now = new Date();
  if (discount.ends_at) {
    const ends = new Date(discount.ends_at);
    if (ends < now) {
      return "ended";
    }
  }
  if (discount.starts_at) {
    const starts = new Date(discount.starts_at);
    if (starts > now) {
      return "scheduled";
    }
  }
  return discount.active ? "active" : "ended";
};

const renderSummary = (items) => {
  const counts = items.reduce(
    (acc, discount) => {
      const status = getStatus(discount);
      acc[status] += 1;
      return acc;
    },
    { active: 0, scheduled: 0, ended: 0 }
  );

  summaryActive.textContent = counts.active;
  summaryScheduled.textContent = counts.scheduled;
  summaryEnded.textContent = counts.ended;

  const maxImpact = items
    .filter((discount) => discount.type === "percent" || discount.type === "fixed")
    .sort((a, b) => Number(b.value) - Number(a.value))[0];
  summaryMax.textContent = maxImpact ? formatDiscountType(maxImpact) : "-";
};

const buildCard = (discount) => {
  const status = getStatus(discount);
  const statusLabel =
    status === "active" ? "Ativa" : status === "scheduled" ? "Agendada" : "Encerrada";
  const days = parseDays(discount.days_of_week);
  const daysLabel = days.length ? `Dias: ${formatDays(days).join(", ")}` : "Todos os dias";
  const criteriaLabel = discount.criteria
    ? [discount.criteria.customer_segment, discount.criteria.sales_channel].filter(Boolean).join(" • ")
    : "";

  return `
    <div class="discount-item">
      <div class="discount-item__info">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <h6 class="mb-0">${discount.name}</h6>
          <span class="badge bg-${status === "active" ? "success" : status === "scheduled" ? "warning" : "secondary"}">
            ${statusLabel}
          </span>
          <span class="badge bg-light text-dark">Prioridade ${discount.priority}</span>
        </div>
        <p class="mb-1 text-muted">${formatDiscountType(discount)} • ${formatTarget(discount)}</p>
        <div class="discount-meta">
          <span>${daysLabel}</span>
          <span>${discount.starts_at || "Sem início"} → ${discount.ends_at || "Sem fim"}</span>
          <span>${discount.starts_time || "--:--"} → ${discount.ends_time || "--:--"}</span>
          <span>${discount.stacking_rule === "priority" ? "Empilha por prioridade" : "Não acumula"}</span>
          ${criteriaLabel ? `<span>${criteriaLabel}</span>` : ""}
        </div>
      </div>
      <div class="discount-item__actions">
        <button class="btn btn-outline-success btn-sm" data-action="edit" data-id="${discount.id}">
          Editar
        </button>
        <button class="btn btn-outline-secondary btn-sm" data-action="toggle" data-id="${discount.id}">
          ${discount.active ? "Pausar" : "Ativar"}
        </button>
        <button class="btn btn-outline-danger btn-sm" data-action="expire" data-id="${discount.id}">
          Expirar
        </button>
      </div>
    </div>
  `;
};

const renderDiscounts = (items) => {
  if (!discountsList) {
    return;
  }
  if (!items.length) {
    discountsList.innerHTML = "<p class=\"text-muted\">Nenhuma promoção encontrada.</p>";
    return;
  }
  discountsList.innerHTML = items.map(buildCard).join("");
};

const renderPagination = (totalItems) => {
  if (!discountPagination) {
    return;
  }
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  currentPage = Math.min(currentPage, totalPages);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  discountPagination.innerHTML = pages
    .map(
      (page) => `
        <li class="page-item ${page === currentPage ? "active" : ""}">
          <button class="page-link" data-page="${page}" type="button">${page}</button>
        </li>
      `
    )
    .join("");
};

const applyPagination = (items) => {
  const start = (currentPage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);
  renderDiscounts(paged);
  renderPagination(items.length);
};

const buildCalendar = (items) => {
  if (!discountCalendar) {
    return;
  }
  const dayLabels = getDaysMap();
  const dayCounts = Object.keys(dayLabels).reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  items.forEach((discount) => {
    const days = parseDays(discount.days_of_week);
    if (!days.length) {
      Object.keys(dayCounts).forEach((key) => {
        dayCounts[key] += 1;
      });
      return;
    }
    days.forEach((day) => {
      if (dayCounts[day] !== undefined) {
        dayCounts[day] += 1;
      }
    });
  });

  discountCalendar.innerHTML = Object.entries(dayLabels)
    .map(
      ([key, label]) => `
        <div class="discount-calendar__day">
          <span>${label}</span>
          <span class="badge bg-success">${dayCounts[key]} promoções</span>
        </div>
      `
    )
    .join("");
};

const applyFilters = () => {
  const search = (filterSearch?.value || "").toLowerCase();
  const type = filterType?.value || "all";
  const status = filterStatus?.value || "all";

  const filtered = discountsCache.filter((discount) => {
    const matchesSearch = discount.name.toLowerCase().includes(search);
    const matchesType = type === "all" || discount.type === type;
    const matchesStatus = status === "all" || getStatus(discount) === status;
    return matchesSearch && matchesType && matchesStatus;
  });

  applyPagination(filtered);
};

const hydrateForm = (discount) => {
  discountForm.name.value = discount.name;
  discountForm.type.value = discount.type;
  discountForm.value.value = discount.value;
  discountForm.min_quantity.value = discount.min_quantity || "";
  discountForm.buy_quantity.value = discount.buy_quantity || "";
  discountForm.get_quantity.value = discount.get_quantity || "";
  discountForm.target_type.value = discount.target_type || "all";
  discountForm.target_value.value = discount.target_value || "";
  discountForm.starts_at.value = discount.starts_at || "";
  discountForm.ends_at.value = discount.ends_at || "";
  discountForm.starts_time.value = discount.starts_time || "";
  discountForm.ends_time.value = discount.ends_time || "";
  discountForm.stacking_rule.value = discount.stacking_rule || "exclusive";
  discountForm.customer_segment.value = discount.criteria?.customer_segment || "";
  discountForm.sales_channel.value = discount.criteria?.sales_channel || "";
  discountForm.priority.value = discount.priority || 0;
  discountForm.active.checked = Boolean(discount.active);
  selectedProductIds = parseProductIds(discount.target_value);
  stagedProductIds = [...selectedProductIds];
  syncPickerCount();

  const days = parseDays(discount.days_of_week);
  discountForm.querySelectorAll("input[name=\"days_of_week\"]").forEach((input) => {
    input.checked = days.includes(input.value);
  });
};

const buildPayload = () => {
  const formData = new FormData(discountForm);
  const days = formData.getAll("days_of_week");
  const customerSegment = formData.get("customer_segment") || null;
  const salesChannel = formData.get("sales_channel") || null;
  const criteria =
    customerSegment || salesChannel
      ? {
          customer_segment: customerSegment,
          sales_channel: salesChannel,
        }
      : null;

  return {
    name: formData.get("name"),
    type: formData.get("type"),
    value: Number(formData.get("value") || 0),
    min_quantity: Number(formData.get("min_quantity") || 0),
    buy_quantity: Number(formData.get("buy_quantity") || 0),
    get_quantity: Number(formData.get("get_quantity") || 0),
    target_type: formData.get("target_type"),
    target_value:
      formData.get("target_type") === "product" && selectedProductIds.length
        ? JSON.stringify(selectedProductIds)
        : formData.get("target_value") || null,
    days_of_week: days.length ? days : null,
    starts_at: formData.get("starts_at") || null,
    ends_at: formData.get("ends_at") || null,
    starts_time: formData.get("starts_time") || null,
    ends_time: formData.get("ends_time") || null,
    stacking_rule: formData.get("stacking_rule") || "exclusive",
    criteria,
    priority: Number(formData.get("priority") || 0),
    active: discountForm.active.checked,
  };
};

const refreshDiscounts = async () => {
  try {
    const data = await requestJson("/api/discounts");
    discountsCache = data.map((discount) => {
      let criteria = null;
      if (discount.criteria) {
        try {
          criteria = JSON.parse(discount.criteria);
        } catch (error) {
          criteria = null;
        }
      }
      return {
        ...discount,
        criteria,
      };
    });
    renderSummary(discountsCache);
    buildCalendar(discountsCache);
    applyFilters();
  } catch (error) {
    setFeedback(error.message || "Erro ao carregar promoções.", "danger");
  }
};

const simulateDiscount = (payload, quantity, unitPrice) => {
  const total = unitPrice * quantity;
  let discountAmount = 0;

  if (payload.type === "percent") {
    discountAmount = total * (payload.value / 100);
  } else if (payload.type === "fixed") {
    discountAmount = payload.value;
  } else if (payload.type === "buy_x_get_y") {
    if (payload.buy_quantity > 0 && quantity >= payload.buy_quantity) {
      discountAmount = unitPrice * payload.get_quantity;
    }
  } else if (payload.type === "fixed_bundle") {
    if (payload.buy_quantity > 0) {
      const bundles = Math.floor(quantity / payload.buy_quantity);
      const remainder = quantity % payload.buy_quantity;
      const bundleTotal = bundles * payload.value;
      discountAmount = total - (bundleTotal + remainder * unitPrice);
    }
  }

  if (payload.min_quantity && quantity < payload.min_quantity) {
    discountAmount = 0;
  }

  if (discountAmount < 0) {
    discountAmount = 0;
  }

  return {
    subtotal: total,
    discount: discountAmount,
    total: Math.max(total - discountAmount, 0),
  };
};

const updateSimulator = () => {
  if (!simulatorQty || !simulatorPrice) {
    return;
  }
  const payload = buildPayload();
  const quantity = Number(simulatorQty.value || 0);
  const unitPrice = Number(simulatorPrice.value || 0);
  const unitCost = Number(simulatorCost?.value || 0);
  const result = simulateDiscount(payload, quantity, unitPrice);

  simulatorSubtotal.textContent = formatCurrency(result.subtotal);
  simulatorDiscount.textContent = formatCurrency(result.discount);
  simulatorTotal.textContent = formatCurrency(result.total);

  if (unitCost > 0 && result.total < unitCost * quantity) {
    simulatorWarning?.classList.remove("d-none");
  } else {
    simulatorWarning?.classList.add("d-none");
  }
};

const applyTemplate = (templateKey) => {
  const templates = {
    "bundle-3-10": {
      name: "3 itens por R$ 10",
      type: "fixed_bundle",
      value: 10,
      buy_quantity: 3,
      target_type: "product",
    },
    "buy-3-get-1": {
      name: "Compre 3, leve 4",
      type: "buy_x_get_y",
      buy_quantity: 3,
      get_quantity: 1,
      target_type: "category",
    },
    "percent-15": {
      name: "15% na categoria",
      type: "percent",
      value: 15,
      target_type: "category",
    },
  };

  const template = templates[templateKey];
  if (!template) {
    return;
  }

  discountForm.name.value = template.name || "";
  discountForm.type.value = template.type || "percent";
  discountForm.value.value = template.value ?? "";
  discountForm.buy_quantity.value = template.buy_quantity ?? "";
  discountForm.get_quantity.value = template.get_quantity ?? "";
  discountForm.target_type.value = template.target_type || "all";
  updateSimulator();
};

discountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetFeedback();
  const payload = buildPayload();

  try {
    if (editingDiscountId) {
      await requestJson(`/api/discounts/${editingDiscountId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setFeedback("Promoção atualizada com sucesso.", "success");
    } else {
      await requestJson("/api/discounts", { method: "POST", body: JSON.stringify(payload) });
      setFeedback("Promoção cadastrada com sucesso.", "success");
    }
    discountForm.reset();
    if (discountForm.active) {
      discountForm.active.checked = true;
    }
    if (discountForm.stacking_rule) {
      discountForm.stacking_rule.value = "exclusive";
    }
    selectedProductIds = [];
    stagedProductIds = [];
    syncPickerCount();
    editingDiscountId = null;
    await refreshDiscounts();
  } catch (error) {
    setFeedback(error.message || "Erro ao salvar promoção.", "danger");
  }
});

discountsList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const discount = discountsCache.find((item) => item.id === id);
  if (!discount) {
    return;
  }

  try {
    if (action === "edit") {
      editingDiscountId = id;
      hydrateForm(discount);
      discountForm.scrollIntoView({ behavior: "smooth", block: "start" });
      updateSimulator();
      return;
    }

    if (action === "toggle") {
      await requestJson(`/api/discounts/${id}`, {
        method: "PUT",
        body: JSON.stringify({ active: discount.active ? 0 : 1 }),
      });
    }

    if (action === "expire") {
      await requestJson(`/api/discounts/${id}`, {
        method: "PUT",
        body: JSON.stringify({ active: 0, ends_at: new Date().toISOString().slice(0, 10) }),
      });
    }

    await refreshDiscounts();
  } catch (error) {
    setFeedback(error.message || "Erro ao atualizar promoção.", "danger");
  }
});

discountForm?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-template]");
  if (!button) {
    return;
  }
  applyTemplate(button.dataset.template);
});

discountForm?.addEventListener("change", (event) => {
  if (event.target.id === "discount-target") {
    const isProduct = event.target.value === "product";
    if (productPickerButton) {
      productPickerButton.disabled = !isProduct;
    }
    if (!isProduct) {
      selectedProductIds = [];
      stagedProductIds = [];
      syncPickerCount();
    } else if (discountForm?.target_value) {
      discountForm.target_value.value = "";
    }
  }
});

productPickerSearch?.addEventListener("input", (event) => {
  renderProductPicker(event.target.value);
});

productPickerList?.addEventListener("change", () => {
  if (!productPickerList) {
    return;
  }
  stagedProductIds = Array.from(productPickerList.querySelectorAll("input[type=\"checkbox\"]:checked")).map(
    (input) => input.value
  );
});

productPickerApply?.addEventListener("click", () => {
  selectedProductIds = [...stagedProductIds];
  syncPickerCount();
});

productPickerButton?.addEventListener("click", () => {
  stagedProductIds = [...selectedProductIds];
  renderProductPicker(productPickerSearch?.value || "");
});

discountExport?.addEventListener("click", () => {
  if (!discountsCache.length) {
    return;
  }
  const header = [
    "name",
    "type",
    "value",
    "min_quantity",
    "buy_quantity",
    "get_quantity",
    "target_type",
    "target_value",
    "days_of_week",
    "starts_at",
    "ends_at",
    "starts_time",
    "ends_time",
    "stacking_rule",
    "priority",
  ];
  const rows = discountsCache.map((discount) => [
    discount.name,
    discount.type,
    discount.value,
    discount.min_quantity,
    discount.buy_quantity,
    discount.get_quantity,
    discount.target_type,
    discount.target_value,
    discount.days_of_week,
    discount.starts_at,
    discount.ends_at,
    discount.starts_time,
    discount.ends_time,
    discount.stacking_rule,
    discount.priority,
  ]);
  sharedFormat.downloadCsv({ filename: "promocoes.csv", rows: [header, ...rows] });
});

discountImport?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const text = await file.text();
  const lines = text.split("\n").filter(Boolean);
  if (lines.length < 2) {
    setFeedback("Arquivo CSV inválido.", "danger");
    return;
  }
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",").map((header) => header.replace(/\"/g, "").trim());
  try {
    for (const row of rows) {
      const values = row.split(",").map((value) => value.replace(/\"/g, "").trim());
      const payload = headers.reduce((acc, key, index) => {
        acc[key] = values[index];
        return acc;
      }, {});
      await requestJson("/api/discounts", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          value: Number(payload.value || 0),
          min_quantity: Number(payload.min_quantity || 0),
          buy_quantity: Number(payload.buy_quantity || 0),
          get_quantity: Number(payload.get_quantity || 0),
          priority: Number(payload.priority || 0),
        }),
      });
    }
    setFeedback("CSV importado com sucesso.", "success");
    await refreshDiscounts();
  } catch (error) {
    setFeedback(error.message || "Erro ao importar CSV.", "danger");
  } finally {
    discountImport.value = "";
  }
});

const applyFiltersResetPage = () => {
  currentPage = 1;
  applyFilters();
};

filterSearch?.addEventListener("input", applyFiltersResetPage);
filterType?.addEventListener("change", applyFiltersResetPage);
filterStatus?.addEventListener("change", applyFiltersResetPage);
filterClear?.addEventListener("click", () => {
  if (filterSearch) {
    filterSearch.value = "";
  }
  if (filterType) {
    filterType.value = "all";
  }
  if (filterStatus) {
    filterStatus.value = "all";
  }
  applyFilters();
});

discountPagination?.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-page]");
  if (!target) {
    return;
  }
  currentPage = Number(target.dataset.page || 1);
  applyFilters();
});

discountPageSize?.addEventListener("change", (event) => {
  pageSize = Number(event.target.value || 10);
  currentPage = 1;
  applyFilters();
});

discountForm?.addEventListener("input", updateSimulator);
discountForm?.addEventListener("change", updateSimulator);
simulatorQty?.addEventListener("input", updateSimulator);
simulatorPrice?.addEventListener("input", updateSimulator);
simulatorCost?.addEventListener("input", updateSimulator);

if (productPickerButton) {
  productPickerButton.disabled = discountForm?.target_type?.value !== "product";
}
if (discountPageSize) {
  pageSize = Number(discountPageSize.value || 10);
}
refreshDiscounts();
refreshProducts();
updateSimulator();
