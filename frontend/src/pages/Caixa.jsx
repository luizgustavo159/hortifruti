import { useEffect, useState, useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { useCart } from "../context/CartContext";
import { normalizeApiError } from "../lib/api";
import { api } from "../services/api";
import "./Caixa.css";

export function Caixa() {
  const [products, setProducts] = useState([]);
  const { state: cartState, dispatch, totalItems } = useCart();
  const cartItems = cartState.items;
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [discounts, setDiscounts] = useState([]);

  // Carregar produtos e descontos ao montar o componente
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [productsData, discountsData] = await Promise.all([
          api.getProducts(),
          api.getDiscounts(),
        ]);
        setProducts(productsData || []);
        setDiscounts(discountsData || []);
      } catch (loadError) {
        setError(normalizeApiError(loadError));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filtrar produtos pela busca
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Adicionar produto ao carrinho
  const addToCart = useCallback((product) => {
    dispatch({ type: "ADD_ITEM", payload: product });
  }, [dispatch]);

  // Remover item do carrinho
  const removeFromCart = useCallback((productId) => {
    dispatch({ type: "REMOVE_ITEM", payload: productId });
  }, [dispatch]);

  // Atualizar quantidade do item
  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    dispatch({ type: "UPDATE_QUANTITY", payload: { productId, quantity } });
  }, [removeFromCart, dispatch]);

  // Aplicar desconto a um item
  const applyDiscountToItem = useCallback((productId, discountId) => {
    dispatch({ type: "UPDATE_DISCOUNT", payload: { productId, discountId } });
  }, [dispatch]);


  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFullScreenMode(true);
      } else {
        await document.exitFullscreen();
        setFullScreenMode(false);
      }
    } catch (_error) {
      setError("Não foi possível alternar para tela cheia neste dispositivo.");
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullScreenMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Calcular total do carrinho
  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      return sum + itemTotal;
    }, 0);
  };

  // Calcular desconto total
  const calculateTotalDiscount = () => {
    return cartItems.reduce((sum, item) => {
      if (!item.discount_id) return sum;
      const discount = discounts.find((d) => d.id === item.discount_id);
      if (!discount) return sum;

      const itemTotal = item.price * item.quantity;
      let discountAmount = 0;

      if (discount.type === "percent") {
        discountAmount = itemTotal * (discount.value / 100);
      } else if (discount.type === "fixed") {
        discountAmount = Math.min(discount.value, itemTotal);
      }

      return sum + discountAmount;
    }, 0);
  };

  const total = calculateTotal();
  const totalDiscount = calculateTotalDiscount();
  const finalTotal = total - totalDiscount;

  // Finalizar venda
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setError("Adicione itens ao carrinho antes de finalizar.");
      return;
    }

    setProcessingPayment(true);
    setError("");
    setSuccessMessage("");

    try {
      const saleItems = cartItems.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        discount_id: item.discount_id,
      }));

      const response = await api.createSale({
        items: saleItems,
        payment_method: paymentMethod,
      });

      setSuccessMessage(
        `Venda finalizada com sucesso! Documento: ${response.document_number || response.id}`
      );
      dispatch({ type: "CLEAR_CART" });
      setPaymentMethod("cash");

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (checkoutError) {
      setError(normalizeApiError(checkoutError));
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <PageShell
      title="Frente de Caixa"
      subtitle="Ponto de Venda - Registre vendas em tempo real"
      actions={
        <button className="button" type="button" onClick={toggleFullScreen}>
          {fullScreenMode ? "Sair da Tela Cheia" : "Tela Cheia"}
        </button>
      }
    >
      <div className="pos-container">
        {/* Seção de Produtos */}
        <div className="pos-products">
          <div className="search-section">
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <div className="numeric-pad">
              {["1","2","3","4","5","6","7","8","9","0"].map((n) => (
                <button key={n} type="button" onClick={() => setSearchTerm((prev) => `${prev}${n}`)}>{n}</button>
              ))}
              <button type="button" onClick={() => setSearchTerm((prev) => prev.slice(0, -1))}>⌫</button>
              <button type="button" onClick={() => setSearchTerm("")}>Limpar</button>
            </div>
          </div>

          {loading && <p className="loading">Carregando produtos...</p>}
          {error && <p className="error-message">{error}</p>}

          <div className="products-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <div key={product.id} className="product-card">
                  <div className="product-info">
                    <h4>{product.name}</h4>
                    <p className="product-category">
                      {product.category_name || "Sem categoria"}
                    </p>
                    <p className="product-stock">
                      Estoque: {product.current_stock}
                    </p>
                    <p className="product-price">
                      R$ {Number(product.price).toFixed(2)}
                    </p>
                  </div>
                  <button
                    className="btn-add-cart"
                    onClick={() => addToCart(product)}
                    disabled={product.current_stock <= 0}
                  >
                    {product.current_stock > 0 ? "Adicionar" : "Sem estoque"}
                  </button>
                </div>
              ))
            ) : (
              <p className="no-products">Nenhum produto encontrado.</p>
            )}
          </div>
        </div>

        {/* Seção de Carrinho */}
        <div className="pos-cart">
          <h3>Carrinho ({totalItems})</h3>

          {successMessage && (
            <div className="success-message">{successMessage}</div>
          )}

          {cartItems.length > 0 ? (
            <>
              <div className="cart-items">
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="item-details">
                      <h5>{item.name}</h5>
                      <p className="item-price">
                        R$ {Number(item.price).toFixed(2)}
                      </p>
                    </div>

                    <div className="item-quantity">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        min="1"
                      />
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>

                        <div className="item-total">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </div>

                    <button
                      className="cart-item-remove"
                      onClick={() => removeFromCart(item.id)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="summary-row discount">
                    <span>Desconto:</span>
                    <span>-R$ {totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Total:</span>
                  <span>R$ {finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="payment-section">
                <label>Forma de Pagamento:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="payment-select"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="credit">Cartão de Crédito</option>
                  <option value="debit">Cartão de Débito</option>
                  <option value="pix">PIX</option>
                </select>
              </div>

              <div className="cart-actions">
                <button
                  className="btn-finalize"
                  onClick={handleCheckout}
                  disabled={processingPayment || cartItems.length === 0}
                >
                  {processingPayment ? "Processando..." : "Finalizar Venda"}
                </button>

                <button
                  className="btn-clear"
                  onClick={() => setCartItems([])}
                >
                  Limpar Carrinho
                </button>
              </div>
            </>
          ) : (
            <p className="empty-cart">Carrinho vazio</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
