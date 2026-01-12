(() => {
  const showFormError = ({ element, message }) => {
    if (!element) {
      return;
    }
    if (!message) {
      element.classList.add("d-none");
      element.textContent = "";
      return;
    }
    element.textContent = message;
    element.classList.remove("d-none");
  };

  const validateProductForm = ({ minValue, maxValue, priceValue, stockValue, element }) => {
    if (Number.isNaN(minValue) || Number.isNaN(maxValue)) {
      showFormError({ element, message: "Informe valores numéricos para estoque mínimo e máximo." });
      return false;
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      showFormError({ element, message: "Informe um preço válido." });
      return false;
    }
    if (Number.isNaN(stockValue) || stockValue < 0) {
      showFormError({ element, message: "Informe um estoque inicial válido." });
      return false;
    }
    if (minValue <= 0 || maxValue <= 0) {
      showFormError({ element, message: "Os valores de estoque devem ser maiores que zero." });
      return false;
    }
    if (minValue > maxValue) {
      showFormError({ element, message: "O estoque mínimo não pode ser maior que o máximo." });
      return false;
    }
    showFormError({ element, message: "" });
    return true;
  };

  window.stockForms = {
    showFormError,
    validateProductForm,
  };
})();
