import { PageShell } from "../components/PageShell";

export function AdminPoliticas() {
  return (
    <PageShell
      title="Políticas operacionais"
      subtitle="Defina limites e regras de aprovação"
      actions={<button className="button">Salvar alterações</button>}
    >
      <div className="panel-grid">
        <div className="panel">
          <h4>Desconto máximo</h4>
          <p>Limite automático de descontos aplicados.</p>
          <strong>18%</strong>
        </div>
        <div className="panel">
          <h4>Perdas autorizadas</h4>
          <p>Quantidade máxima antes de solicitar aprovação.</p>
          <strong>10 itens</strong>
        </div>
        <div className="panel">
          <h4>Tentativas de login</h4>
          <p>Bloqueio automático após tentativas.</p>
          <strong>5 tentativas</strong>
        </div>
      </div>
    </PageShell>
  );
}
