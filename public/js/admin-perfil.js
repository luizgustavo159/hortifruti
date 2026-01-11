const userForm = document.getElementById("user-form");
const userFormFeedback = document.getElementById("user-form-feedback");
const userSearch = document.getElementById("user-search");
const userRoleFilter = document.getElementById("user-role-filter");
const usersTableBody = document.getElementById("users-table-body");

const userEditForm = document.getElementById("user-edit-form");
const editUserId = document.getElementById("edit-user-id");
const editName = document.getElementById("edit-name");
const editEmail = document.getElementById("edit-email");
const editPassword = document.getElementById("edit-password");
const editRole = document.getElementById("edit-role");
const editActive = document.getElementById("edit-active");
const userEditFeedback = document.getElementById("user-edit-feedback");
const userAuditList = document.getElementById("user-audit-list");
const userSessionList = document.getElementById("user-session-list");
const revokeSessionsButton = document.getElementById("revoke-sessions");
const userApprovalForm = document.getElementById("user-approval-form");
const approvalEmail = document.getElementById("approval-email");
const approvalPassword = document.getElementById("approval-password");
const approvalReason = document.getElementById("approval-reason");
const userApprovalFeedback = document.getElementById("user-approval-feedback");

let usersCache = [];
let pendingUpdatePayload = null;
let pendingApprovalUserId = null;
let activeSessionIds = [];

const { requestJson } = window.apiClient || {};

const setFeedback = (element, message, type) => {
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

const renderUsers = (items) => {
  if (!usersTableBody) {
    return;
  }
  if (!items.length) {
    usersTableBody.innerHTML = "<tr><td colspan=\"5\" class=\"text-muted\">Nenhum usuário encontrado.</td></tr>";
    return;
  }
  usersTableBody.innerHTML = items
    .map(
      (user) => `
        <tr>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.role}</td>
          <td>
            <span class="badge ${user.is_active ? "text-bg-success" : "text-bg-secondary"}">
              ${user.is_active ? "Ativo" : "Inativo"}
            </span>
          </td>
          <td>
            <button class="btn btn-outline-success btn-sm" data-action="edit" data-id="${user.id}">
              Editar
            </button>
          </td>
        </tr>
      `
    )
    .join("");
};

const renderUserAudit = async (userId) => {
  if (!userAuditList) {
    return;
  }
  userAuditList.innerHTML = "<li class=\"text-muted\">Carregando logs...</li>";
  try {
    const logs = await requestJson("/api/audit-logs");
    const userLogs = logs.filter((log) => Number(log.performed_by) === Number(userId)).slice(0, 5);
    if (!userLogs.length) {
      userAuditList.innerHTML = "<li class=\"text-muted\">Nenhuma ação recente.</li>";
      return;
    }
    userAuditList.innerHTML = userLogs
      .map((log) => `<li>${log.created_at} — ${log.action}</li>`)
      .join("");
  } catch (error) {
    userAuditList.innerHTML = "<li class=\"text-danger\">Erro ao carregar logs.</li>";
  }
};

const renderUserSessions = async (userId) => {
  if (!userSessionList) {
    return;
  }
  userSessionList.innerHTML = "<li class=\"text-muted\">Carregando sessões...</li>";
  try {
    const sessions = await requestJson(`/api/sessions?user_id=${userId}`);
    activeSessionIds = sessions.map((session) => session.id);
    if (!sessions.length) {
      userSessionList.innerHTML = "<li class=\"text-muted\">Nenhuma sessão ativa.</li>";
      return;
    }
    userSessionList.innerHTML = sessions
      .map((session) => `<li>${session.created_at}</li>`)
      .join("");
  } catch (error) {
    userSessionList.innerHTML = "<li class=\"text-danger\">Erro ao carregar sessões.</li>";
  }
};

const getPermissionsFromForm = (name) =>
  Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);

const setPermissionsOnForm = (name, permissions = []) => {
  const current = new Set(permissions);
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = current.has(input.value);
  });
};

const applyFilters = () => {
  const search = (userSearch?.value || "").toLowerCase();
  const role = userRoleFilter?.value || "all";
  const filtered = usersCache.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search);
    const matchesRole = role === "all" || user.role === role;
    return matchesSearch && matchesRole;
  });
  renderUsers(filtered);
};

const loadUsers = async () => {
  try {
    const data = await requestJson("/api/users");
    usersCache = data.map((user) => ({
      ...user,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    }));
    applyFilters();
  } catch (error) {
    renderUsers([]);
  }
};

userForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback(userFormFeedback);
  const payload = Object.fromEntries(new FormData(userForm).entries());
  payload.permissions = getPermissionsFromForm("permissions");
  try {
    await requestJson("/api/users", { method: "POST", body: JSON.stringify(payload) });
    setFeedback(userFormFeedback, "Usuário criado com sucesso.", "success");
    userForm.reset();
    setPermissionsOnForm("permissions", []);
    await loadUsers();
  } catch (error) {
    setFeedback(userFormFeedback, error.message || "Erro ao criar usuário.", "danger");
  }
});

usersTableBody?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action=\"edit\"]");
  if (!button) {
    return;
  }
  const user = usersCache.find((item) => String(item.id) === button.dataset.id);
  if (!user) {
    return;
  }
  editUserId.value = user.id;
  editName.value = user.name;
  editEmail.value = user.email;
  editPassword.value = "";
  editRole.value = user.role;
  editActive.checked = Boolean(user.is_active);
  setPermissionsOnForm("edit-permissions", user.permissions || []);
  clearFeedback(userEditFeedback);
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("userEditModal"));
  modal.show();
  renderUserAudit(user.id);
  renderUserSessions(user.id);
});

userEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback(userEditFeedback);
  const payload = {
    name: editName.value,
    email: editEmail.value,
    role: editRole.value,
    is_active: editActive.checked ? 1 : 0,
    permissions: getPermissionsFromForm("edit-permissions"),
  };
  if (editPassword.value) {
    payload.password = editPassword.value;
  }
  const userBefore = usersCache.find((item) => String(item.id) === String(editUserId.value));
  const criticalChange =
    (userBefore && userBefore.role !== "admin" && payload.role === "admin") ||
    (userBefore && userBefore.is_active && !payload.is_active);
  if (criticalChange) {
    pendingUpdatePayload = payload;
    pendingApprovalUserId = editUserId.value;
    clearFeedback(userApprovalFeedback);
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("userApprovalModal"));
    modal.show();
    return;
  }
  try {
    await requestJson(`/api/users/${editUserId.value}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setFeedback(userEditFeedback, "Usuário atualizado.", "success");
    await loadUsers();
  } catch (error) {
    setFeedback(userEditFeedback, error.message || "Erro ao atualizar usuário.", "danger");
  }
});

userApprovalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback(userApprovalFeedback);
  if (!pendingUpdatePayload || !pendingApprovalUserId) {
    return;
  }
  try {
    const approval = await requestJson("/api/approvals", {
      method: "POST",
      body: JSON.stringify({
        email: approvalEmail.value,
        password: approvalPassword.value,
        action: "user_update",
        reason: approvalReason.value,
        metadata: { user_id: pendingApprovalUserId },
      }),
    });
    await requestJson(`/api/users/${pendingApprovalUserId}`, {
      method: "PUT",
      body: JSON.stringify(pendingUpdatePayload),
      headers: { "x-approval-token": approval.token },
    });
    setFeedback(userEditFeedback, "Usuário atualizado com aprovação.", "success");
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("userApprovalModal"));
    modal.hide();
    pendingUpdatePayload = null;
    pendingApprovalUserId = null;
    userApprovalForm.reset();
    await loadUsers();
  } catch (error) {
    setFeedback(userApprovalFeedback, error.message || "Erro na aprovação.", "danger");
  }
});

revokeSessionsButton?.addEventListener("click", async () => {
  if (!activeSessionIds.length) {
    return;
  }
  try {
    await Promise.all(
      activeSessionIds.map((sessionId) =>
        requestJson(`/api/sessions/${sessionId}`, { method: "DELETE" })
      )
    );
    await renderUserSessions(editUserId.value);
  } catch (error) {
    setFeedback(userEditFeedback, error.message || "Erro ao encerrar sessões.", "danger");
  }
});

userSearch?.addEventListener("input", applyFilters);
userRoleFilter?.addEventListener("change", applyFilters);

loadUsers();
