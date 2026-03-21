(function registerUiFeedbackHelpers() {
  const setFeedback = (element, { message = "", type = "secondary", hidden = false, prefixClass = "mt-3" } = {}) => {
    if (!element) {
      return;
    }
    if (hidden || !message) {
      element.className = "alert d-none";
      element.textContent = "";
      return;
    }
    element.className = `alert alert-${type} ${prefixClass}`.trim();
    element.textContent = message;
  };

  const setButtonLoading = (button, { isLoading, idleText, loadingText = "Carregando..." }) => {
    if (!button) {
      return;
    }
    if (!button.dataset.idleText) {
      button.dataset.idleText = idleText || button.textContent.trim();
    }
    button.disabled = Boolean(isLoading);
    button.textContent = isLoading ? loadingText : button.dataset.idleText;
  };

  window.GreenStoreUI = {
    setFeedback,
    setButtonLoading,
  };
})();
