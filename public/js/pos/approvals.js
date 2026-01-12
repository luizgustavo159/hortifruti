(() => {
  const requestApproval = ({ postJson, email, password, action, reason, metadata }) =>
    postJson("/api/approvals", {
      email,
      password,
      action,
      reason,
      metadata,
    });

  const postWithApproval = ({ requestJson, url, payload, token }) =>
    requestJson(url, {
      method: "POST",
      headers: { "x-approval-token": token },
      body: JSON.stringify(payload),
    });

  const openApprovalModal = ({ modal, form, actionInput, action, metadata }) => {
    if (!modal || !form || !actionInput) {
      return;
    }
    actionInput.value = action;
    form.dataset.metadata = JSON.stringify(metadata || {});
    form.reset();
    modal.show();
  };

  window.posApprovals = {
    requestApproval,
    postWithApproval,
    openApprovalModal,
  };
})();
