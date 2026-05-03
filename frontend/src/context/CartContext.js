import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const STORAGE_KEY = "greenstore_cart";
const CartContext = createContext(null);

const initialState = { items: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD_ITEM": {
      const product = action.payload;
      const existing = state.items.find((item) => item.id === product.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      }
      return { ...state, items: [...state.items, { ...product, quantity: 1, discount_id: null }] };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((item) => item.id !== action.payload) };
    case "CLEAR_CART":
      return { ...state, items: [] };
    case "UPDATE_QUANTITY": {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) return { ...state, items: state.items.filter((item) => item.id !== productId) };
      return {
        ...state,
        items: state.items.map((item) => (item.id === productId ? { ...item, quantity } : item)),
      };
    }
    case "UPDATE_DISCOUNT": {
      const { productId, discountId } = action.payload;
      return {
        ...state,
        items: state.items.map((item) => (item.id === productId ? { ...item, discount_id: discountId } : item)),
      };
    }
    default:
      return state;
  }
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed : initialState;
  } catch (_error) {
    return initialState;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState, loadInitialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const totalItems = useMemo(() => state.items.reduce((a, i) => a + Number(i.quantity || 0), 0), [state.items]);
  const totalPrice = useMemo(
    () => state.items.reduce((a, i) => a + Number(i.price || 0) * Number(i.quantity || 0), 0),
    [state.items]
  );

  const value = useMemo(() => ({ state, dispatch, totalItems, totalPrice }), [state, totalItems, totalPrice]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
