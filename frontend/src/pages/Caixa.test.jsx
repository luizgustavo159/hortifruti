import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../context/CartContext";
import { Caixa } from "./Caixa";

vi.mock("../components/PageShell", () => ({
  PageShell: ({ children, actions }) => (
    <div>
      <div>{actions}</div>
      {children}
    </div>
  ),
}));

const mockApi = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getDiscounts: vi.fn(),
  createSale: vi.fn(),
}));

vi.mock("../services/api", () => ({ api: mockApi }));

describe("Caixa page flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    mockApi.getProducts.mockReset();
    mockApi.getDiscounts.mockReset();
    mockApi.createSale.mockReset();
  });

  it("adds product to cart and finalizes sale", async () => {
    mockApi.getProducts.mockResolvedValue([
      { id: 1, name: "Banana", price: 5, current_stock: 10, category_name: "Frutas" },
    ]);
    mockApi.getDiscounts.mockResolvedValue([]);
    mockApi.createSale.mockResolvedValue({ id: 123, document_number: "PDV-123" });

    render(
      <CartProvider>
        <Caixa />
      </CartProvider>
    );

    expect(await screen.findByText("Banana")).toBeTruthy();
    fireEvent.click(screen.getByText("Adicionar"));

    expect(await screen.findByText(/Carrinho \(1\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Finalizar Venda/i }));

    await waitFor(() => {
      expect(mockApi.createSale).toHaveBeenCalledWith({
        items: [{ product_id: 1, quantity: 1, discount_id: null }],
        payment_method: "cash",
      });
    });

    expect(await screen.findByText(/Venda finalizada com sucesso/)).toBeTruthy();
    expect(await screen.findByText(/Carrinho \(0\)/)).toBeTruthy();
  });

  it("shows normalized error when sale finalization fails", async () => {
    mockApi.getProducts.mockResolvedValue([
      { id: 1, name: "Banana", price: 5, current_stock: 10, category_name: "Frutas" },
    ]);
    mockApi.getDiscounts.mockResolvedValue([]);
    mockApi.createSale.mockRejectedValue({ status: 403, message: "x" });

    render(
      <CartProvider>
        <Caixa />
      </CartProvider>
    );

    expect(await screen.findByText("Banana")).toBeTruthy();
    fireEvent.click(screen.getByText("Adicionar"));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar Venda/i }));

    expect(await screen.findByText("Você não tem permissão para esta operação.")).toBeTruthy();
  });

});
