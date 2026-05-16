import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";

export function AdminPoliticas() {
  const [settings, setSettings] = useState({
    max_discount: 18,
    max_losses: 10,
    login_attempts: 5,
    lock_minutes: 30,
    session_timeout: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/settings");
      setSettings((prev) => ({
        ...prev,
        ...data,
      }));
      setError(null);
    } catch (err) {
      setError("Erro ao carregar configurações: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: isNaN(value) ? value : Number(value),
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccess(null);
      setError(null);

      const settingsToSave = {
        max_discount: settings.max_discount,
        max_losses: settings.max_losses,
        login_attempts: settings.login_attempts,
        lock_minutes: settings.lock_minutes,
        session_timeout: settings.session_timeout,
      };

      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(settingsToSave),
      });

      setSuccess("Configurações salvas com sucesso!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Erro ao salvar configurações: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell
        title="Políticas operacionais"
        subtitle="Defina limites e regras de aprovação"
      >
        <div className="card">
          <p>Carregando configurações...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Políticas operacionais"
      subtitle="Defina limites e regras de aprovação"
      actions={
        <button
          className="button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      }
    >
      <div className="section">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="panel-grid">
          <div className="panel">
            <h4>Desconto máximo (%)</h4>
            <p>Limite automático de descontos aplicados.</p>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.max_discount}
              onChange={(e) => handleChange("max_discount", e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "8px" }}
            />
          </div>

          <div className="panel">
            <h4>Perdas autorizadas (itens)</h4>
            <p>Quantidade máxima antes de solicitar aprovação.</p>
            <input
              type="number"
              min="0"
              value={settings.max_losses}
              onChange={(e) => handleChange("max_losses", e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "8px" }}
            />
          </div>

          <div className="panel">
            <h4>Tentativas de login</h4>
            <p>Bloqueio automático após tentativas.</p>
            <input
              type="number"
              min="1"
              value={settings.login_attempts}
              onChange={(e) => handleChange("login_attempts", e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "8px" }}
            />
          </div>

          <div className="panel">
            <h4>Tempo de bloqueio (minutos)</h4>
            <p>Duração do bloqueio após limite de tentativas.</p>
            <input
              type="number"
              min="1"
              value={settings.lock_minutes}
              onChange={(e) => handleChange("lock_minutes", e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "8px" }}
            />
          </div>

          <div className="panel">
            <h4>Tempo de sessão (minutos)</h4>
            <p>Duração máxima da sessão antes de logout automático.</p>
            <input
              type="number"
              min="1"
              value={settings.session_timeout}
              onChange={(e) => handleChange("session_timeout", e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "8px" }}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
