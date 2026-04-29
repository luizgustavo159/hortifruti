process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost";
process.env.METRICS_ENABLED = "false";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { app, db } = require("../server");

const loadSql = (file) => fs.readFileSync(path.join(__dirname, "..", "migrations", file), "utf-8");
const migrationFiles = fs
  .readdirSync(path.join(__dirname, "..", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row?.id);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const resetDatabase = () =>
  new Promise((resolve, reject) => {
    db.exec(
      `
      DELETE FROM stock_movements;
      DELETE FROM cash_movements;
      DELETE FROM cash_sessions;
      DELETE FROM finance_transactions;
      DELETE FROM finance_accounts;
      DELETE FROM stock_losses;
      DELETE FROM sales;
      DELETE FROM purchase_order_items;
      DELETE FROM purchase_orders;
      DELETE FROM pos_devices;
      DELETE FROM approvals;
      DELETE FROM password_resets;
      DELETE FROM sessions;
      DELETE FROM login_attempts;
      DELETE FROM request_metrics;
      DELETE FROM alerts;
      DELETE FROM audit_logs;
      DELETE FROM settings;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM suppliers;
      DELETE FROM users;
      `,
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });

const createUserWithSession = async ({ role }) => {
  const passwordHash = bcrypt.hashSync("senha1234", 10);
  const userId = await run(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
    [`User ${role}`, `${role}@example.com`, passwordHash, role]
  );
  const token = jwt.sign(
    { id: userId, name: `User ${role}`, email: `${role}@example.com`, role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
  await run("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [userId, token]);
  return { userId, token };
};

const createProduct = async ({ stock, price }) => {
  const categoryId = await run("INSERT INTO categories (name) VALUES (?) RETURNING id", ["Legumes"]);
  const productId = await run(
    `INSERT INTO products (name, sku, unit_type, category_id, min_stock, max_stock, current_stock, price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ["Tomate", "SKU-001", "kg", categoryId, 0, 100, stock, price]
  );
  return { productId, categoryId };
};

beforeAll((done) => {
  const sql = migrationFiles.map((file) => loadSql(file)).join("\n");
  db.exec(sql, done);
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll((done) => {
  db.close(done);
});

describe("stock and sales flows", () => {
  it("adjusts stock with supervisor role", async () => {
    const { token } = await createUserWithSession({ role: "supervisor" });
    const { productId } = await createProduct({ stock: 10, price: 5 });

    const response = await request(app)
      .post("/api/stock/adjust")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, delta: 5, reason: "Inventário" });

    expect(response.status).toBe(201);
    expect(response.body.current_stock).toBe(15);

    const product = await get("SELECT current_stock FROM products WHERE id = ?", [productId]);
    expect(product.current_stock).toBe(15);
  });

  it("records a sale and reduces stock", async () => {
    const { token } = await createUserWithSession({ role: "operator" });
    const { productId } = await createProduct({ stock: 8, price: 4 });

    const response = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, quantity: 3, payment_method: "dinheiro" });

    expect(response.status).toBe(201);
    expect(response.body.document_number).toMatch(/^PDV-\d{8}-\d{6}$/);
    expect(response.body.total).toBe(12);
    expect(response.body.final_total).toBe(12);

    const product = await get("SELECT current_stock FROM products WHERE id = ?", [productId]);
    expect(product.current_stock).toBe(5);
  });

  it("records a multi-item sale and reduces stock for all items", async () => {
    const { token } = await createUserWithSession({ role: "operator" });
    const categoryId = await run("INSERT INTO categories (name) VALUES (?) RETURNING id", ["Frutas"]);
    const bananaId = await run(
      `INSERT INTO products (name, sku, unit_type, category_id, min_stock, max_stock, current_stock, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ["Banana", "SKU-002", "kg", categoryId, 0, 100, 20, 6]
    );
    const macaId = await run(
      `INSERT INTO products (name, sku, unit_type, category_id, min_stock, max_stock, current_stock, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ["Maçã", "SKU-003", "kg", categoryId, 0, 100, 15, 8]
    );

    const response = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        payment_method: "pix",
        items: [
          { product_id: bananaId, quantity: 2 },
          { product_id: macaId, quantity: 3 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].document_number).toMatch(/^PDV-\d{8}-\d{6}$/);
    expect(response.body.items[1].document_number).toMatch(/^PDV-\d{8}-\d{6}$/);
    expect(response.body.total).toBe(36);
    expect(response.body.final_total).toBe(36);

    const banana = await get("SELECT current_stock FROM products WHERE id = ?", [bananaId]);
    const maca = await get("SELECT current_stock FROM products WHERE id = ?", [macaId]);
    expect(banana.current_stock).toBe(18);
    expect(maca.current_stock).toBe(12);

    const salesRows = await all(
      "SELECT product_id, quantity, payment_method FROM sales ORDER BY id ASC"
    );
    expect(salesRows).toHaveLength(2);
    expect(salesRows[0]).toMatchObject({ product_id: bananaId, quantity: 2, payment_method: "pix" });
    expect(salesRows[1]).toMatchObject({ product_id: macaId, quantity: 3, payment_method: "pix" });
  });

  it("opens, moves and closes a cash session", async () => {
    const { token } = await createUserWithSession({ role: "supervisor" });

    const openResponse = await request(app)
      .post("/api/pos/cash-session/open")
      .set("Authorization", `Bearer ${token}`)
      .send({ opening_amount: 100, notes: "Abertura turno manhã" });

    expect(openResponse.status).toBe(201);
    expect(openResponse.body.opening_amount).toBe(100);

    const movementResponse = await request(app)
      .post("/api/pos/cash-session/movement")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "supply", amount: 20, reason: "Troco inicial" });

    expect(movementResponse.status).toBe(201);
    expect(movementResponse.body.type).toBe("supply");

    const closeResponse = await request(app)
      .post("/api/pos/cash-session/close")
      .set("Authorization", `Bearer ${token}`)
      .send({ closing_amount: 120, notes: "Fechamento ok" });

    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.expected_amount).toBe(120);
    expect(closeResponse.body.difference_amount).toBe(0);
  });

  it("records finance cashflow and returns daily close summary", async () => {
    const { token } = await createUserWithSession({ role: "supervisor" });

    const cashflowResponse = await request(app)
      .post("/api/finance/cashflow")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "out",
        category: "fornecedor",
        amount: 75,
        notes: "Pagamento de fornecedor",
      });

    expect(cashflowResponse.status).toBe(201);
    expect(cashflowResponse.body.type).toBe("out");
    expect(Number(cashflowResponse.body.amount)).toBe(75);

    const listResponse = await request(app)
      .get("/api/finance/cashflow")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].category).toBe("fornecedor");

    const summaryResponse = await request(app)
      .get("/api/finance/daily-close")
      .set("Authorization", `Bearer ${token}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.finance_net).toBe(-75);
    expect(summaryResponse.body.sales_total).toBe(0);
  });

  it("exports finance cashflow as csv", async () => {
    const { token } = await createUserWithSession({ role: "supervisor" });

    await request(app)
      .post("/api/finance/cashflow")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "in",
        category: "aporte",
        amount: 200,
        notes: "Aporte inicial",
      });

    const csvResponse = await request(app)
      .get("/api/finance/cashflow/export.csv")
      .set("Authorization", `Bearer ${token}`);

    expect(csvResponse.status).toBe(200);
    expect(csvResponse.headers["content-type"]).toContain("text/csv");
    expect(csvResponse.text).toContain("id,type,category,amount");
    expect(csvResponse.text).toContain("aporte");
  });

  it("exports daily close summary as csv", async () => {
    const { token } = await createUserWithSession({ role: "supervisor" });

    await request(app)
      .post("/api/finance/cashflow")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "in",
        category: "aporte",
        amount: 300,
        notes: "Aporte para caixa",
      });

    const exportResponse = await request(app)
      .get("/api/finance/daily-close/export.csv")
      .set("Authorization", `Bearer ${token}`);

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(exportResponse.text).toContain("date,sales_total,losses_total,finance_net,cash_adjustments_net");
    expect(exportResponse.text).toContain("300");
  });

  it("creates and settles payable account with mirrored cashflow entry", async () => {
    const { token } = await createUserWithSession({ role: "supervisor" });

    const createResponse = await request(app)
      .post("/api/finance/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "payable",
        partner_name: "Fornecedor XPTO",
        description: "Compra de hortifruti",
        amount: 150,
        due_date: "2026-04-30",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe("pending");

    const settleResponse = await request(app)
      .post(`/api/finance/accounts/${createResponse.body.id}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(settleResponse.status).toBe(200);
    expect(settleResponse.body.status).toBe("ok");

    const accountRow = await get("SELECT status FROM finance_accounts WHERE id = ?", [createResponse.body.id]);
    expect(accountRow.status).toBe("settled");

    const flowRow = await get("SELECT type, amount, reference FROM finance_transactions WHERE reference = ?", [
      `ACC-${createResponse.body.id}`,
    ]);
    expect(flowRow.type).toBe("out");
    expect(Number(flowRow.amount)).toBe(150);
  });
});
