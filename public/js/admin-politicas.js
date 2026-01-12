const settingsForm = document.getElementById("settings-form");
const settingsFeedback = document.getElementById("settings-feedback");
const settingMaxDiscount = document.getElementById("setting-max-discount");
const settingMaxLosses = document.getElementById("setting-max-losses");
const settingLoginAttempts = document.getElementById("setting-login-attempts");
const settingLockMinutes = document.getElementById("setting-lock-minutes");
const settingApprovalThreshold = document.getElementById("setting-approval-threshold");

const { requestJson } = window.apiClient || {};
const { sharedFeedback } = window;

const setFeedback = (message, type) =>
  sharedFeedback.setFeedback(settingsFeedback, message, type);

const clearFeedback = () => sharedFeedback.clearFeedback(settingsFeedback);

const loadSettings = async () => {
  try {
    const settings = await requestJson("/api/settings");
    if (settingMaxDiscount) {
      settingMaxDiscount.value = settings.max_discount || "";
    }
    if (settingMaxLosses) {
      settingMaxLosses.value = settings.max_losses || "";
    }
    if (settingLoginAttempts) {
      settingLoginAttempts.value = settings.login_attempts || "";
    }
    if (settingLockMinutes) {
      settingLockMinutes.value = settings.lock_minutes || "";
    }
    if (settingApprovalThreshold) {
      settingApprovalThreshold.value = settings.approval_threshold || "";
    }
  } catch (error) {
    setFeedback("Erro ao carregar políticas.", "danger");
  }
};

settingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback();
  const payload = {
    max_discount: settingMaxDiscount?.value || "",
    max_losses: settingMaxLosses?.value || "",
    login_attempts: settingLoginAttempts?.value || "",
    lock_minutes: settingLockMinutes?.value || "",
    approval_threshold: settingApprovalThreshold?.value || "",
  };
  try {
    await requestJson("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
    setFeedback("Políticas atualizadas.", "success");
  } catch (error) {
    setFeedback(error.message || "Erro ao salvar políticas.", "danger");
  }
});

loadSettings();
