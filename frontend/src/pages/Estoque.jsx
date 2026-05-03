import { useEffect, useState, useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";
import "./Estoque.css";

export function Estoque() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [restockSuggestions, setRestockSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("inventory");
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Formulário para novo produto
  const [newProduct, setNewProduct] = useState({
    name: "",
    category_id: "",
    supplier_id: "",
    price: "",
    current_stock: "",
    min_stock: "",
  });

  // Formulário para movimentação de estoque
  const [movement, setMovement] = useState({
    type: "adjust",
    quantity: "",
    reason: "",
  });

  // Carregar dados ao montar
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [productsData, categoriesData, suppliersData, suggestionsData] =
          await Promise.all([
            apiFetch("/products"),
            apiFetch("/categories"),
            apiFetch("/suppliers"),
            apiFetch("/stock/restock-suggestions"),
          ]);
        setProducts(productsData || []);
        setCategories(categoriesData || []);
        setSuppliers(suppliersData || []);
        setRestockSuggestions(suggestionsData || []);
      } catch (loadError) {
        setError(loadError.message || "Falha ao carregar dados de estoque.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filtrar produtos
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Criar novo produto
  const handleCreateProduct = async () => {
    if (
      !newProduct.name ||
      !newProduct.category_id ||
      !newProduct.price ||
      !newProduct.current_stock ||
      !newProduct.min_stock
    ) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      const productData = {
        name: newProduct.name,
        category_id: parseInt(newProduct.category_id),
        supplier_id: newProduct.supplier_id
          ? parseInt(newProduct.supplier_id)
          : null,
        price: parseFloat(newProduct.price),
        current_stock: parseInt(newProduct.current_stock),
        min_stock: parseInt(newProduct.min_stock),
      };

      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify(productData),
      });

      setSuccessMessage("Produto criado com sucesso!");
      setNewProduct({
        name: "",
        category_id: "",
        supplier_id: "",
        price: "",
        current_stock: "",
        min_stock: "",
      });
      setShowNewProductModal(false);

      // Recarregar produtos
      const productsData = await apiFetch("/products");
      setProducts(productsData || []);

      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (createError) {
      setError(createError.message || "Erro ao criar produto.");
    }
  };

  // Registrar movimentação de estoque
  const handleStockMovement = async () => {
    if (!selectedProduct || !movement.quantity || !movement.reason) {
      setError("Preencha todos os campos da movimentação.");
      return;
    }

    try {
      const endpoint =
        movement.type === "loss"
          ? "/stock/loss"
          : movement.type === "adjust"
            ? "/stock/adjust"
            : "/stock/move";

      const movementData = {
        product_id: selectedProduct.id,
        quantity: parseInt(movement.quantity),
        reason: movement.reason,
      };

      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(movementData),
      });

      setSuccessMessage("Movimentação registrada com sucesso!");
      setMovement({ type: "adjust", quantity: "", reason: "" });
      setSelectedProduct(null);
      setShowMovementModal(false);

      // Recarregar produtos
      const productsData = await apiFetch("/products");
      setProducts(productsData || []);

      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (movementError) {
      setError(movementError.message || "Erro ao registrar movimentação.");
    }
  };

  // Calcular itens críticos
  const criticalItems = products.filter(
    (item) => Number(item.current_stock) <= Number(item.min_stock)
  ).length;

  return (
    <PageShell
      title="Controle de Estoque"
      subtitle="Monitoramento, reposição e movimentações de estoque"
      actions={
        <button
          className="button"
          onClick={() => setShowNewProductModal(true)}
        >
          Novo Produto
        </button>
      }
    >
      <div className="stock-container">
        {/* Cards de resumo */}
        <div className="card-grid">
          <div className="card">
            <h3>Itens Críticos</h3>
            <strong>{criticalItems}</strong>
          </div>
          <div className="card">
            <h3>Reposições Sugeridas</h3>
            <strong>{restockSuggestions.length}</strong>
          </div>
          <div className="card">
            <h3>Total de Produtos</h3>
            <strong>{products.length}</strong>
          </div>
          <div className="card">
            <h3>Fornecedores</h3>
            <strong>{suppliers.length}</strong>
          </div>
        </div>

        {/* Mensagens */}
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {/* Abas */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            Inventário
          </button>
          <button
            className={`tab ${activeTab === "restock" ? "active" : ""}`}
            onClick={() => setActiveTab("restock")}
          >
            Reposições Sugeridas
          </button>
          <button
            className={`tab ${activeTab === "movements" ? "active" : ""}`}
            onClick={() => setActiveTab("movements")}
          >
            Movimentações
          </button>
        </div>

        {/* Conteúdo das abas */}
        {activeTab === "inventory" && (
          <div className="tab-content">
            <div className="search-section">
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            {loading ? (
              <p className="loading">Carregando inventário...</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Preço</th>
                      <th>Estoque Atual</th>
                      <th>Mínimo</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => {
                        const isCritical =
                          Number(product.current_stock) <=
                          Number(product.min_stock);
                        return (
                          <tr key={product.id}>
                            <td>{product.name}</td>
                            <td>{product.category_name || "-"}</td>
                            <td>R$ {Number(product.price).toFixed(2)}</td>
                            <td>{product.current_stock}</td>
                            <td>{product.min_stock}</td>
                            <td>
                              <span
                                className={`status ${isCritical ? "critical" : "ok"}`}
                              >
                                {isCritical ? "Crítico" : "Em dia"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn-action"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setShowMovementModal(true);
                                }}
                              >
                                Movimentar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="no-data">
                          Nenhum produto encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "restock" && (
          <div className="tab-content">
            {restockSuggestions.length > 0 ? (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Estoque Atual</th>
                      <th>Mínimo</th>
                      <th>Sugestão de Reposição</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restockSuggestions.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.current_stock}</td>
                        <td>{item.min_stock}</td>
                        <td>{item.restock_quantity || "Consultar"}</td>
                        <td>
                          <button
                            className="btn-action"
                            onClick={() => {
                              setSelectedProduct(item);
                              setShowMovementModal(true);
                            }}
                          >
                            Repor
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data">Nenhuma reposição sugerida no momento.</p>
            )}
          </div>
        )}

        {activeTab === "movements" && (
          <div className="tab-content">
            <p className="info-message">
              Use o botão "Movimentar" na aba Inventário para registrar
              movimentações de estoque.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Novo Produto */}
      {showNewProductModal && (
        <div className="modal-overlay" onClick={() => setShowNewProductModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Novo Produto</h2>
            <div className="form-group">
              <label>Nome do Produto *</label>
              <input
                type="text"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
                placeholder="Digite o nome do produto"
              />
            </div>

            <div className="form-group">
              <label>Categoria *</label>
              <select
                value={newProduct.category_id}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, category_id: e.target.value })
                }
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Fornecedor</label>
              <select
                value={newProduct.supplier_id}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    supplier_id: e.target.value,
                  })
                }
              >
                <option value="">Selecione um fornecedor</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Preço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Estoque Atual *</label>
                <input
                  type="number"
                  value={newProduct.current_stock}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      current_stock: e.target.value,
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Estoque Mínimo *</label>
                <input
                  type="number"
                  value={newProduct.min_stock}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, min_stock: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={handleCreateProduct}
              >
                Criar Produto
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowNewProductModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Movimentação de Estoque */}
      {showMovementModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowMovementModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Movimentar Estoque</h2>
            <p className="modal-subtitle">Produto: {selectedProduct.name}</p>

            <div className="form-group">
              <label>Tipo de Movimentação *</label>
              <select
                value={movement.type}
                onChange={(e) =>
                  setMovement({ ...movement, type: e.target.value })
                }
              >
                <option value="adjust">Ajuste de Estoque</option>
                <option value="loss">Perda/Descarte</option>
                <option value="move">Transferência</option>
              </select>
            </div>

            <div className="form-group">
              <label>Quantidade *</label>
              <input
                type="number"
                value={movement.quantity}
                onChange={(e) =>
                  setMovement({ ...movement, quantity: e.target.value })
                }
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label>Motivo/Observação *</label>
              <textarea
                value={movement.reason}
                onChange={(e) =>
                  setMovement({ ...movement, reason: e.target.value })
                }
                placeholder="Descreva o motivo da movimentação"
                rows="3"
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={handleStockMovement}
              >
                Registrar Movimentação
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowMovementModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
