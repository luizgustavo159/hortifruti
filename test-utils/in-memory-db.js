const clone = (value) => JSON.parse(JSON.stringify(value));

const initialState = () => ({
  users: [],
  sessions: [],
  categories: [],
  products: [],
  sales: [],
  stock_movements: [],
  stock_losses: [],
  purchase_order_items: [],
  purchase_orders: [],
  pos_devices: [],
  approvals: [],
  password_resets: [],
  login_attempts: [],
  request_metrics: [],
  alerts: [],
  settings: [],
  suppliers: [],
  discounts: [],
  audit_logs: [],
  idempotency_keys: [],
});

const idCounters = {
  users: 1,
  sessions: 1,
  categories: 1,
  products: 1,
  sales: 1,
  stock_movements: 1,
  audit_logs: 1,
  idempotency_keys: 1,
};

let state = initialState();

const nextId = (table) => {
  const value = idCounters[table] || 1;
  idCounters[table] = value + 1;
  return value;
};

const normalize = (sql) => sql.replace(/\s+/g, " ").trim().toLowerCase();

const deleteTable = (name) => {
  if (state[name]) {
    state[name] = [];
  }
};

const execute = (sql, params = []) => {
  const normalized = normalize(sql);

  if (normalized.startsWith("create table") || normalized.startsWith("create index") || normalized.startsWith("alter table")) {
    return { rows: [] };
  }

  if (normalized.startsWith("delete from ")) {
    const table = normalized.split("delete from ")[1].split(";")[0].trim();
    deleteTable(table);
    return { rows: [] };
  }


  if (normalized === "select 1 as ok") {
    return { rows: [{ ok: 1 }] };
  }

  if (normalized.startsWith("insert into request_metrics")) {
    const [method, path, status, durationMs] = params;
    state.request_metrics.push({ method, path, status: Number(status), duration_ms: Number(durationMs) });
    return { rows: [] };
  }

  if (normalized.startsWith("insert into alerts")) {
    const [level, message, context] = params;
    state.alerts.push({ level, message, context });
    return { rows: [] };
  }

  if (normalized.startsWith("insert into users")) {
    const [name, email, passwordHash, role] = params;
    const row = {
      id: nextId("users"),
      name,
      email,
      password_hash: passwordHash,
      role,
      is_active: 1,
      locked_until: null,
    };
    state.users.push(row);
    return { rows: [clone(row)] };
  }

  if (normalized.startsWith("select * from users where email")) {
    const [email] = params;
    const row = state.users.find((user) => user.email === email) || null;
    return { rows: row ? [clone(row)] : [] };
  }

  if (
    normalized.startsWith(
      "select id, name, email, phone, role, is_active, permissions, created_at from users"
    )
  ) {
    return {
      rows: state.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        is_active: user.is_active,
        permissions: user.permissions || "[]",
        created_at: user.created_at || new Date().toISOString(),
      })),
    };
  }

  if (normalized.startsWith("insert into sessions")) {
    const [userId, token] = params;
    const row = { id: nextId("sessions"), user_id: userId, token, revoked_at: null };
    state.sessions.push(row);
    return { rows: [clone(row)] };
  }

  if (normalized.startsWith("insert into categories")) {
    const [name] = params;
    const row = { id: nextId("categories"), name };
    state.categories.push(row);
    return { rows: [clone(row)] };
  }

  if (normalized.startsWith("insert into products")) {
    const [name, sku, unitType, categoryId, minStock, maxStock, currentStock, price] = params;
    const row = {
      id: nextId("products"),
      name,
      sku,
      unit_type: unitType,
      category_id: categoryId,
      min_stock: Number(minStock),
      max_stock: Number(maxStock),
      current_stock: Number(currentStock),
      price: Number(price),
    };
    state.products.push(row);
    return { rows: [clone(row)] };
  }

  if (normalized.startsWith("select * from sessions where token")) {
    const [token] = params;
    const row = state.sessions.find((session) => session.token === token && !session.revoked_at) || null;
    return { rows: row ? [clone(row)] : [] };
  }

  if (normalized.startsWith("select * from products where id")) {
    const [id] = params;
    const row = state.products.find((product) => product.id === Number(id)) || null;
    return { rows: row ? [clone(row)] : [] };
  }

  if (normalized.startsWith("select current_stock from products where id")) {
    const [id] = params;
    const row = state.products.find((product) => product.id === Number(id));
    return { rows: row ? [{ current_stock: row.current_stock }] : [] };
  }

  if (normalized.startsWith("update products set current_stock")) {
    const [stock, id] = params;
    const row = state.products.find((product) => product.id === Number(id));
    if (row) {
      row.current_stock = Number(stock);
    }
    return { rows: [] };
  }

  if (normalized.startsWith("insert into stock_movements")) {
    const [productId, type, delta, reason, performedBy] = params;
    const row = {
      id: nextId("stock_movements"),
      product_id: Number(productId),
      type,
      delta: Number(delta),
      reason,
      performed_by: Number(performedBy),
    };
    state.stock_movements.push(row);
    return { rows: [clone(row)] };
  }

  if (normalized.startsWith("insert into audit_logs")) {
    const [action, details, performedBy, approvedBy] = params;
    const row = {
      id: nextId("audit_logs"),
      action,
      details,
      performed_by: performedBy,
      approved_by: approvedBy,
    };
    state.audit_logs.push(row);
    return { rows: [clone(row)] };
  }

  if (normalized.startsWith("insert into sales")) {
    const [productId, quantity, total, discountId, discountAmount, finalTotal, paymentMethod, soldBy] = params;
    const row = {
      id: nextId("sales"),
      product_id: Number(productId),
      quantity: Number(quantity),
      total: Number(total),
      discount_id: discountId,
      discount_amount: Number(discountAmount),
      final_total: Number(finalTotal),
      payment_method: paymentMethod,
      sold_by: soldBy,
    };
    state.sales.push(row);
    return { rows: [clone(row)] };
  }


  if (normalized.startsWith("select response_status, response_body from idempotency_keys")) {
    const [userId, endpoint, requestKey] = params;
    const row =
      state.idempotency_keys.find(
        (item) =>
          item.user_id === Number(userId) && item.endpoint === endpoint && item.request_key === requestKey
      ) || null;
    return { rows: row ? [clone(row)] : [] };
  }

  if (normalized.startsWith("insert into idempotency_keys")) {
    const [userId, endpoint, requestKey, responseStatus, responseBody] = params;
    const duplicate = state.idempotency_keys.find(
      (item) => item.user_id === Number(userId) && item.endpoint === endpoint && item.request_key === requestKey
    );
    if (duplicate) {
      throw new Error("duplicate key value violates unique constraint");
    }
    const row = {
      id: nextId("idempotency_keys"),
      user_id: Number(userId),
      endpoint,
      request_key: requestKey,
      response_status: Number(responseStatus),
      response_body: responseBody,
    };
    state.idempotency_keys.push(row);
    return { rows: [clone(row)] };
  }

  if (normalized.startsWith("select * from discounts where id")) {
    const [id] = params;
    const row = state.discounts.find((discount) => discount.id === Number(id) && discount.active === 1);
    return { rows: row ? [clone(row)] : [] };
  }

  throw new Error(`SQL não suportado no mock de testes: ${sql}`);
};

const queryWithCallback = (sql, params, callback) => {
  try {
    const result = execute(sql, params);
    callback(null, result);
  } catch (error) {
    callback(error);
  }
};

const normalizeArgs = (params, callback) => {
  if (typeof params === "function") {
    return { params: [], callback: params };
  }
  return { params: params || [], callback };
};

const run = (sql, params, callback) => {
  const normalized = normalizeArgs(params, callback);
  queryWithCallback(sql, normalized.params, (err) => normalized.callback?.(err || null));
};

const get = (sql, params, callback) => {
  const normalized = normalizeArgs(params, callback);
  queryWithCallback(sql, normalized.params, (err, result) => normalized.callback?.(err || null, result?.rows?.[0]));
};

const all = (sql, params, callback) => {
  const normalized = normalizeArgs(params, callback);
  queryWithCallback(sql, normalized.params, (err, result) => normalized.callback?.(err || null, result?.rows || []));
};

const exec = (sql, callback) => {
  try {
    sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .forEach((statement) => {
        execute(statement);
      });
    callback?.(null);
  } catch (error) {
    callback?.(error);
  }
};

const close = (callback) => callback?.(null);

const withTransaction = (work, callback) => {
  const snapshot = clone(state);
  const tx = { run, get, all, exec };

  work(tx, (error) => {
    if (error) {
      state = snapshot;
      callback(error);
      return;
    }
    callback(null);
  });
};

module.exports = {
  run,
  get,
  all,
  exec,
  close,
  withTransaction,
  pool: {
    query: () => {
      throw new Error("pool.query não suportado no mock de testes");
    },
  },
};
