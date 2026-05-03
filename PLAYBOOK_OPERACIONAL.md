# Playbook Operacional (Sem periféricos)

## 1) Falha de login
1. Verifique credenciais.
2. Confirme se a API está online (`/api/health`).
3. Se persistir, reset de senha via fluxo admin.

## 2) Sessão expirada / 401
1. Usuário deve ser redirecionado para login automaticamente.
2. Refazer login.
3. Se ocorrer repetidamente, validar relógio do servidor e JWT_SECRET.

## 3) Falha de rede / timeout
1. Confirmar conectividade entre caixa e servidor de escritório.
2. Repetir operação após reconexão.
3. Em caso de instabilidade, registrar horário e endpoint com erro.

## 4) Usuário sem permissão
1. Sistema redireciona para `/acesso-negado`.
2. Solicitar ajuste de perfil (role) para administrador.

## 5) Abertura diária (software)
- Abrir sistema no caixa.
- Realizar login de operador.
- Teste rápido: buscar produto, adicionar carrinho, remover item.

## 6) Encerramento diário (software)
- Verificar vendas do dia em relatórios.
- Fazer logout de todos os usuários.
- Confirmar backup diário concluído.
