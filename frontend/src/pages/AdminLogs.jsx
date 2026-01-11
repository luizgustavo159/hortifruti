import { PageShell } from "../components/PageShell";

export function AdminLogs() {
  return (
    <PageShell
      title="Logs e auditoria"
      subtitle="Rastreio completo de ações críticas"
      actions={<button className="button">Exportar</button>}
    >
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Módulo</th>
              <th>Usuário</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Desconto aprovado</td>
              <td>Caixa</td>
              <td>Marina</td>
              <td>Hoje 09:12</td>
            </tr>
            <tr>
              <td>Perda registrada</td>
              <td>Estoque</td>
              <td>Pedro</td>
              <td>Hoje 08:40</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
