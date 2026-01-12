(() => {
  const setFeedback = (element, message, type = "info") => {
    if (!element) {
      return;
    }
    element.textContent = message;
    element.className = `alert alert-${type} mt-3`;
  };

  const clearFeedback = (element) => {
    if (!element) {
      return;
    }
    element.textContent = "";
    element.className = "alert d-none";
  };

  window.sharedFeedback = {
    setFeedback,
    clearFeedback,
  };
})();
