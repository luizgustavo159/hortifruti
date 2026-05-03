import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";
import "./AdminConfiguracao.css";

export function AdminConfiguracao() {
  const [settings, setSettings] = useState({
    store_name: "GreenStore",
    store_cnpj: "00.000.000/0000-00",
    store_address: "Rua Principal, 123",
    store_phone: "(00) 0000-0000",
    store_email: "contato@greenstore.com",
    currency: "BRL",
    tax_rate: 0,
    discount_max_percent: 50,
    low_stock_alert: 20,
    backup_enabled: true,
    backup_frequency: "daily",
    session_timeout: 30,
    language: "pt-BR",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Carregar configurações
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/settings");
        if (data) {
          setSettings({ ...settings, ...data });
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Salvar configurações
  const handleSaveSettings = async () => {
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });

      setSuccessMessage("Configurações salvas com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (saveError) {
      setError(saveError.message || "Erro ao salvar configurações.");
    } finally {
      setLoading(false);
    }
  };

  // Resetar para padrão
  const handleResetToDefault = () => {
    if (window.confirm("Tem certeza que deseja resetar todas as configurações para o padrão?")) {
      setSettings({
        store_name: "GreenStore",
        store_cnpj: "00.000.000/0000-00",
        store_address: "Rua Principal, 123",
        store_phone: "(00) 0000-0000",
        store_email: "contato@greenstore.com",
        currency: "BRL",
        tax_rate: 0,
        discount_max_percent: 50,
        low_stock_alert: 20,
        backup_enabled: true,
        backup_frequency: "daily",
        session_timeout: 30,
        language: "pt-BR",
      });
      setSuccessMessage("Configurações resetadas para o padrão!");
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  return (
    <PageShell
      title="Configurações do Sistema"
      subtitle="Personalize os parâmetros e preferências do GreenStore"
      actions={
        <div className="action-buttons">
          <button className="button" onClick={handleSaveSettings} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Configurações"}
          </button>
          <button className="button-secondary" onClick={handleResetToDefault}>
            Resetar Padrão
          </button>
        </div>
      }
    >
      <div className="settings-container">
        {/* Mensagens */}
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {/* Seção: Informações da Loja */}
        <div className="settings-section">
          <h2>Informações da Loja</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label>Nome da Loja</label>
              <input
                type="text"
                value={settings.store_name}
                onChange={(e) =>
                  setSettings({ ...settings, store_name: e.target.value })
                }
                placeholder="Digite o nome da loja"
              />
            </div>

            <div className="form-group">
              <label>CNPJ</label>
              <input
                type="text"
                value={settings.store_cnpj}
                onChange={(e) =>
                  setSettings({ ...settings, store_cnpj: e.target.value })
                }
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="form-group">
              <label>Endereço</label>
              <input
                type="text"
                value={settings.store_address}
                onChange={(e) =>
                  setSettings({ ...settings, store_address: e.target.value })
                }
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input
                type="tel"
                value={settings.store_phone}
                onChange={(e) =>
                  setSettings({ ...settings, store_phone: e.target.value })
                }
                placeholder="(00) 0000-0000"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={settings.store_email}
                onChange={(e) =>
                  setSettings({ ...settings, store_email: e.target.value })
                }
                placeholder="contato@loja.com"
              />
            </div>
          </div>
        </div>

        {/* Seção: Configurações Financeiras */}
        <div className="settings-section">
          <h2>Configurações Financeiras</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label>Moeda</label>
              <select
                value={settings.currency}
                onChange={(e) =>
                  setSettings({ ...settings, currency: e.target.value })
                }
              >
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Taxa de Imposto (%)</label>
              <input
                type="number"
                value={settings.tax_rate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    tax_rate: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0"
                min="0"
                max="100"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label>Desconto Máximo Permitido (%)</label>
              <input
                type="number"
                value={settings.discount_max_percent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discount_max_percent: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="50"
                min="0"
                max="100"
                step="1"
              />
            </div>
          </div>
        </div>

        {/* Seção: Configurações de Estoque */}
        <div className="settings-section">
          <h2>Configurações de Estoque</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label>Alerta de Estoque Baixo (%)</label>
              <input
                type="number"
                value={settings.low_stock_alert}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    low_stock_alert: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="20"
                min="0"
                max="100"
                step="1"
              />
              <small>Percentual do estoque mínimo para gerar alerta</small>
            </div>
          </div>
        </div>

        {/* Seção: Backup e Segurança */}
        <div className="settings-section">
          <h2>Backup e Segurança</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.backup_enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      backup_enabled: e.target.checked,
                    })
                  }
                />
                Ativar Backup Automático
              </label>
            </div>

            {settings.backup_enabled && (
              <div className="form-group">
                <label>Frequência de Backup</label>
                <select
                  value={settings.backup_frequency}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      backup_frequency: e.target.value,
                    })
                  }
                >
                  <option value="hourly">A cada hora</option>
                  <option value="daily">Diariamente</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="monthly">Mensalmente</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Tempo de Sessão (minutos)</label>
              <input
                type="number"
                value={settings.session_timeout}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    session_timeout: parseInt(e.target.value) || 30,
                  })
                }
                placeholder="30"
                min="5"
                max="480"
                step="5"
              />
              <small>Tempo de inatividade antes de desconectar</small>
            </div>
          </div>
        </div>

        {/* Seção: Preferências */}
        <div className="settings-section">
          <h2>Preferências</h2>
          <div className="settings-grid">
            <div className="form-group">
              <label>Idioma</label>
              <select
                value={settings.language}
                onChange={(e) =>
                  setSettings({ ...settings, language: e.target.value })
                }
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (USA)</option>
                <option value="es-ES">Español (España)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção: Informações do Sistema */}
        <div className="settings-section info-section">
          <h2>Informações do Sistema</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Versão:</span>
              <span className="info-value">1.0.0</span>
            </div>
            <div className="info-item">
              <span className="info-label">Última Atualização:</span>
              <span className="info-value">
                {new Date().toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className="info-value status-ok">Operacional</span>
            </div>
            <div className="info-item">
              <span className="info-label">Banco de Dados:</span>
              <span className="info-value">PostgreSQL 12+</span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
