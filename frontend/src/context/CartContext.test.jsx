import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart } from "./CartContext";

describe("CartContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds, updates, removes and clears items while keeping totals", () => {
    const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_ITEM", payload: { id: 1, name: "Maçã", price: 3 } });
      result.current.dispatch({ type: "ADD_ITEM", payload: { id: 1, name: "Maçã", price: 3 } });
    });

    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(6);

    act(() => {
      result.current.dispatch({ type: "UPDATE_QUANTITY", payload: { productId: 1, quantity: 5 } });
    });

    expect(result.current.totalItems).toBe(5);
    expect(result.current.totalPrice).toBe(15);

    act(() => {
      result.current.dispatch({ type: "REMOVE_ITEM", payload: 1 });
    });

    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);

    act(() => {
      result.current.dispatch({ type: "ADD_ITEM", payload: { id: 2, name: "Banana", price: 2 } });
      result.current.dispatch({ type: "CLEAR_CART" });
    });

    expect(result.current.state.items).toEqual([]);
  });

  it("persists cart in localStorage", () => {
    const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "ADD_ITEM", payload: { id: 10, name: "Uva", price: 9 } });
    });

    const stored = JSON.parse(localStorage.getItem("greenstore_cart"));
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0]).toMatchObject({ id: 10, name: "Uva", quantity: 1 });
  });
});
