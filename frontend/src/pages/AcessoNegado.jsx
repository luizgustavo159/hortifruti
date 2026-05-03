import { Link } from "react-router-dom";

export function AcessoNegado() {
  return (
    <main style={{ padding: "32px", maxWidth: "640px", margin: "0 auto" }}>
      <h1>Acesso negado</h1>
      <p>Seu usuário não tem permissão para acessar esta área.</p>
      <p>
        Se você acredita que isso é um erro, solicite ajuste de perfil para um administrador.
      </p>
      <Link to="/caixa">Voltar para o caixa</Link>
    </main>
  );
}
