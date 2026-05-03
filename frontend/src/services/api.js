import { apiFetch } from "../lib/api";

export const api = {
  getProducts: () => apiFetch("/products"),
  getDiscounts: () => apiFetch("/discounts"),
  createSale: (payload) =>
    apiFetch("/sales", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
