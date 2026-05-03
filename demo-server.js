const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Dados em memória (Mock)
let mockData = {
  users: [
    {
      id: 1,
      name: "Admin User",
      email: "admin@greenstore.com",
      role: "admin",
    },
    {
      id: 2,
      name: "Gerente João",
      email: "gerente@greenstore.com",
      role: "manager",
    },
    {
      id: 3,
      name: "Operador Maria",
      email: "operador@greenstore.com",
      role: "operator",
    },
  ],
  categories: [
    { id: 1, name: "Frutas" },
    { id: 2, name: "Legumes" },
    { id: 3, name: "Hortaliças" },
    { id: 4, name: "Tubérculos" },
  ],
  products: [
    {
      id: 1,
      name: "Maçã Vermelha",
      category_id: 1,
      category_name: "Frutas",
      price: 5.99,
      current_stock: 150,
      min_stock: 50,
    },
    {
      id: 2,
      name: "Banana Nanica",
      category_id: 1,
      category_name: "Frutas",
      price: 3.49,
      current_stock: 200,
      min_stock: 100,
    },
    {
      id: 3,
      name: "Laranja Pera",
      category_id: 1,
      category_name: "Frutas",
      price: 4.99,
      current_stock: 120,
      min_stock: 60,
    },
    {
      id: 4,
      name: "Tomate Caqui",
      category_id: 2,
      category_name: "Legumes",
      price: 6.99,
      current_stock: 80,
      min_stock: 40,
    },
    {
      id: 5,
      name: "Cenoura",
      category_id: 2,
      category_name: "Legumes",
      price: 2.99,
      current_stock: 200,
      min_stock: 100,
    },
    {
      id: 6,
      name: "Alface Crespa",
      category_id: 3,
      category_name: "Hortaliças",
      price: 3.99,
      current_stock: 45,
      min_stock: 50,
    },
    {
      id: 7,
      name: "Batata Inglesa",
      category_id: 4,
      category_name: "Tubérculos",
      price: 4.49,
      current_stock: 300,
      min_stock: 150,
    },
    {
      id: 8,
      name: "Abacaxi",
      category_id: 1,
      category_name: "Frutas",
      price: 7.99,
      current_stock: 60,
      min_stock: 30,
    },
  ],
  discounts: [
    {
      id: 1,
      name: "Quarta Verde",
      type: "percentage",
      value: 15,
      description: "15% de desconto em frutas e legumes as quartas",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      name: "Combo Feira",
      type: "fixed",
      value: 12,
      description: "3 itens por R$ 12",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      name: "Desconto Sênior",
      type: "percentage",
      value: 10,
      description: "10% para clientes acima de 60 anos",
      active: true,
      created_at: new Date().toISOString(),
    },
  ],
  sales: [],
  suppliers: [
    { id: 1, name: "Fornecedor A" },
    { id: 2, name: "Fornecedor B" },
    { id: 3, name: "Fornecedor C" },
  ],
  logs: [
    {
      id: 1,
      type: "sale",
      level: "info",
      user_name: "Operador Maria",
      action: "Venda realizada",
      details: "Venda #1 - Total: R$ 45,90",
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      type: "stock",
      level: "warning",
      user_name: "Gerente João",
      action: "Ajuste de estoque",
      details: "Alface Crespa: -10 unidades",
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      type: "user",
      level: "info",
      user_name: "Admin User",
      action: "Usuário criado",
      details: "Novo operador: Pedro Silva",
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      type: "auth",
      level: "info",
      user_name: "Operador Maria",
      action: "Login realizado",
      details: "Login bem-sucedido",
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 5,
      type: "system",
      level: "info",
      user_name: "Sistema",
      action: "Backup automático",
      details: "Backup diário concluído com sucesso",
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ],
  settings: {
    store_name: "GreenStore",
    store_cnpj: "00.000.000/0000-00",
    store_address: "Rua Principal, 123",
    store_phone: "(00) 0000-0000",
    store_email: "contato@greenstore.com",
    currency: "BRL",
    tax_rate: 0,
    discount_max_percent: 50,
    low_stock_alert: 20,
    backup_enabled: true,
    backup_frequency: "daily",
    session_timeout: 30,
    language: "pt-BR",
  },
};

// Simular token JWT
const generateToken = (user) => {
  return `mock_token_${user.id}_${Date.now()}`;
};

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  // Para demo, aceitar qualquer token
  req.user = { id: 1, role: "admin" };
  next();
};

// ============ ROTAS DE AUTENTICAÇÃO ============
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email e senha são obrigatórios" });
  }

  const user = mockData.users.find((u) => u.email === email);

  if (!user) {
    return res.status(401).json({ message: "Usuário não encontrado" });
  }

  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

app.post("/api/auth/logout", authenticateToken, (req, res) => {
  res.json({ message: "Logout realizado com sucesso" });
});

// ============ ROTAS DE PRODUTOS ============
app.get("/api/products", (req, res) => {
  res.json(mockData.products);
});

app.post("/api/products", authenticateToken, (req, res) => {
  const { name, category_id, price, current_stock, min_stock } = req.body;

  const newProduct = {
    id: mockData.products.length + 1,
    name,
    category_id,
    category_name:
      mockData.categories.find((c) => c.id === category_id)?.name || "",
    price,
    current_stock,
    min_stock,
  };

  mockData.products.push(newProduct);
  res.status(201).json(newProduct);
});

// ============ ROTAS DE CATEGORIAS ============
app.get("/api/categories", (req, res) => {
  res.json(mockData.categories);
});

// ============ ROTAS DE FORNECEDORES ============
app.get("/api/suppliers", (req, res) => {
  res.json(mockData.suppliers);
});

// ============ ROTAS DE DESCONTOS ============
app.get("/api/discounts", (req, res) => {
  res.json(mockData.discounts);
});

// ============ ROTAS DE VENDAS ============
app.post("/api/sales", authenticateToken, (req, res) => {
  const { items, payment_method } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: "Nenhum item na venda" });
  }

  let total = 0;
  const saleItems = [];

  for (const item of items) {
    const product = mockData.products.find((p) => p.id === item.product_id);

    if (!product) {
      return res.status(404).json({ message: `Produto ${item.product_id} não encontrado` });
    }

    if (product.current_stock < item.quantity) {
      return res
        .status(400)
        .json({ message: `Estoque insuficiente para ${product.name}` });
    }

    const itemTotal = product.price * item.quantity;
    total += itemTotal;

    saleItems.push({
      product_id: item.product_id,
      product_name: product.name,
      quantity: item.quantity,
      price: product.price,
      total: itemTotal,
    });

    // Decrementar estoque
    product.current_stock -= item.quantity;
  }

  const sale = {
    id: mockData.sales.length + 1,
    document_number: `VND-${Date.now()}`,
    items: saleItems,
    total,
    payment_method,
    operator_id: req.user.id,
    created_at: new Date().toISOString(),
  };

  mockData.sales.push(sale);

  res.status(201).json({
    id: sale.id,
    document_number: sale.document_number,
    total: sale.total,
    message: "Venda registrada com sucesso",
  });
});

// ============ ROTAS DE ESTOQUE ============
app.get("/api/stock/restock-suggestions", (req, res) => {
  const suggestions = mockData.products.filter(
    (p) => p.current_stock <= p.min_stock
  );
  res.json(suggestions);
});

app.post("/api/stock/adjust", authenticateToken, (req, res) => {
  const { product_id, quantity, reason } = req.body;

  const product = mockData.products.find((p) => p.id === product_id);

  if (!product) {
    return res.status(404).json({ message: "Produto não encontrado" });
  }

  product.current_stock += quantity;

  res.json({
    message: "Ajuste registrado com sucesso",
    product,
  });
});

app.post("/api/stock/loss", authenticateToken, (req, res) => {
  const { product_id, quantity, reason } = req.body;

  const product = mockData.products.find((p) => p.id === product_id);

  if (!product) {
    return res.status(404).json({ message: "Produto não encontrado" });
  }

  if (product.current_stock < quantity) {
    return res.status(400).json({ message: "Quantidade insuficiente" });
  }

  product.current_stock -= quantity;

  res.json({
    message: "Perda registrada com sucesso",
    product,
  });
});

// ============ ROTAS DE RELATÓRIOS ============
app.get("/api/reports/summary", (req, res) => {
  const totalSales = mockData.sales.reduce((sum, s) => sum + s.total, 0);
  const lowStock = mockData.products.filter(
    (p) => p.current_stock <= p.min_stock
  );

  res.json({
    total_sales: totalSales,
    total_losses: 0,
    low_stock: lowStock,
  });
});

app.get("/api/reports/by-operator", (req, res) => {
  const byOperator = {};

  mockData.sales.forEach((sale) => {
    const opId = sale.operator_id;
    if (!byOperator[opId]) {
      byOperator[opId] = {
        operator_name: mockData.users.find((u) => u.id === opId)?.name || "Desconhecido",
        total: 0,
        quantity: 0,
      };
    }
    byOperator[opId].total += sale.total;
    byOperator[opId].quantity += sale.items.length;
  });

  res.json(Object.values(byOperator));
});

app.get("/api/reports/by-category", (req, res) => {
  const byCategory = {};

  mockData.sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = mockData.products.find((p) => p.id === item.product_id);
      const catName = product?.category_name || "Sem categoria";

      if (!byCategory[catName]) {
        byCategory[catName] = {
          category_name: catName,
          total: 0,
          quantity: 0,
        };
      }

      byCategory[catName].total += item.total;
      byCategory[catName].quantity += item.quantity;
    });
  });

  res.json(Object.values(byCategory));
});

app.get("/api/reports/sales", (req, res) => {
  res.json(
    mockData.sales.map((s) => ({
      id: s.id,
      document_number: s.document_number,
      total: s.total,
      payment_method: s.payment_method,
      created_at: s.created_at,
    }))
  );
});

app.get("/api/reports/cash-flow", (req, res) => {
  res.json([
    {
      date: new Date().toISOString().split("T")[0],
      type: "entrada",
      description: "Vendas do dia",
      amount: mockData.sales.reduce((sum, s) => sum + s.total, 0),
    },
  ]);
});

app.get("/api/reports/payables", (req, res) => {
  res.json([]);
});

app.get("/api/reports/receivables", (req, res) => {
  res.json([]);
});

app.get("/api/reports/inventory", (req, res) => {
  res.json(
    mockData.products.map((p) => ({
      name: p.name,
      current_stock: p.current_stock,
      min_stock: p.min_stock,
      price: p.price,
    }))
  );
});

// ============ ROTAS DE USUÁRIOS ============
app.get("/api/users", (req, res) => {
  const role = req.query.role;
  if (role) {
    return res.json(mockData.users.filter((u) => u.role === role));
  }
  res.json(mockData.users);
});

app.post("/api/users", authenticateToken, (req, res) => {
  const { name, email, role, status } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ message: "Campos obrigatórios faltando" });
  }
  const newUser = {
    id: Math.max(...mockData.users.map((u) => u.id), 0) + 1,
    name,
    email,
    role,
    status: status || "active",
  };
  mockData.users.push(newUser);
  res.status(201).json(newUser);
});

app.put("/api/users/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, email, role, status } = req.body;
  const user = mockData.users.find((u) => u.id === parseInt(id));
  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }
  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;
  if (status) user.status = status;
  res.json(user);
});

app.delete("/api/users/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const index = mockData.users.findIndex((u) => u.id === parseInt(id));
  if (index === -1) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }
  mockData.users.splice(index, 1);
  res.json({ message: "Usuário deletado com sucesso" });
});

// ============ ROTAS DE LOGS ============
app.get("/api/logs", authenticateToken, (req, res) => {
  const { start, end, type, level } = req.query;
  let filteredLogs = mockData.logs;
  if (type && type !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.type === type);
  }
  if (level && level !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.level === level);
  }
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    filteredLogs = filteredLogs.filter((l) => {
      const logDate = new Date(l.created_at);
      return logDate >= startDate && logDate <= endDate;
    });
  }
  res.json(filteredLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

// ============ ROTAS DE DESCONTOS ============
app.get("/api/discounts", authenticateToken, (req, res) => {
  res.json(mockData.discounts || []);
});

app.post("/api/discounts", authenticateToken, (req, res) => {
  const { name, type, value, description } = req.body;
  if (!name || !type || value <= 0) {
    return res.status(400).json({ message: "Campos obrigatórios faltando" });
  }
  const newDiscount = {
    id: Math.max(...(mockData.discounts || []).map((d) => d.id || 0), 0) + 1,
    name,
    type,
    value,
    description,
    active: true,
    created_at: new Date().toISOString(),
  };
  if (!mockData.discounts) mockData.discounts = [];
  mockData.discounts.push(newDiscount);
  res.status(201).json(newDiscount);
});

app.delete("/api/discounts/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const index = (mockData.discounts || []).findIndex((d) => d.id === parseInt(id));
  if (index === -1) {
    return res.status(404).json({ message: "Desconto não encontrado" });
  }
  mockData.discounts.splice(index, 1);
  res.json({ message: "Desconto deletado com sucesso" });
});

// ============ ROTAS DE CONFIGURAÇÕES ============
app.get("/api/settings", authenticateToken, (req, res) => {
  res.json(mockData.settings);
});

app.put("/api/settings", authenticateToken, (req, res) => {
  const updates = req.body;
  mockData.settings = {
    ...mockData.settings,
    ...updates,
  };
  res.json(mockData.settings);
});

// ============ SERVIR FRONTEND ============
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ============ INICIAR SERVIDOR ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║         🎉 GREENSTORE - MODO DEMONSTRAÇÃO 🎉              ║
║                                                            ║
║  ✅ Servidor rodando em http://localhost:${PORT}              ║
║                                                            ║
║  📝 Credenciais de Teste:                                  ║
║     Email: admin@greenstore.com                            ║
║     Senha: qualquer coisa (modo demo)                      ║
║                                                            ║
║  🎯 Funcionalidades Disponíveis:                           ║
║     ✓ Frente de Caixa (PDV)                                ║
║     ✓ Gestão de Estoque                                    ║
║     ✓ Dashboard Administrativo                             ║
║     ✓ Relatórios Financeiros                               ║
║                                                            ║
║  💾 Dados: Simulados em memória (não persiste)             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
