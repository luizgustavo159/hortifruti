(() => {
  const registerShortcuts = ({
    onFinish,
    onManagerDiscount,
    onRemoveFirst,
    onSuspend,
    onResume,
  }) => {
    const handler = (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        onFinish?.();
      }
      if (event.key === "F4") {
        event.preventDefault();
        onManagerDiscount?.();
      }
      if (event.key === "F8") {
        event.preventDefault();
        onRemoveFirst?.();
      }
      if (event.key === "F6") {
        event.preventDefault();
        onSuspend?.();
      }
      if (event.key === "F9") {
        event.preventDefault();
        onResume?.();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  };

  window.posShortcuts = {
    registerShortcuts,
  };
})();
