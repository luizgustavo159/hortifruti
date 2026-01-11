export function Login() {
  return (
    <div className="login-page">
      <section className="login-hero">
        <h1>GreenStore Pro</h1>
        <p>Centralize vendas, estoque e performance em um painel moderno e seguro.</p>
        <div className="panel-grid">
          <div className="panel">
            <h4>Visão 360°</h4>
            <p>Indicadores diários, alertas e prioridades organizadas.</p>
          </div>
          <div className="panel">
            <h4>Operação ágil</h4>
            <p>Fluxo de caixa rápido com histórico de decisões.</p>
          </div>
        </div>
      </section>
      <section className="login-card">
        <form className="form">
          <h2>Entrar</h2>
          <label>
            Email
            <input type="email" placeholder="nome@empresa.com" />
          </label>
          <label>
            Senha
            <input type="password" placeholder="••••••••" />
          </label>
          <button className="button" type="button">
            Acessar painel
          </button>
          <span className="badge">Suporte 24/7</span>
        </form>
      </section>
    </div>
  );
}
