# Production Release Checklist (GreenStore)

## 1) Segurança e configuração
- [ ] `JWT_SECRET` forte e diferente por ambiente.
- [ ] `ADMIN_BOOTSTRAP_TOKEN` removido/desativado após bootstrap inicial.
- [ ] Variáveis sensíveis somente via secret manager (não commitar `.env`).
- [ ] HTTPS obrigatório no balanceador/reverse proxy.
- [ ] CORS restrito ao(s) domínio(s) oficiais.

## 2) Banco e dados
- [ ] Backup automático diário validado.
- [ ] Teste de restore executado com sucesso (RTO/RPO conhecidos).
- [ ] Migrations aplicadas e versionadas.
- [ ] Usuário de aplicação com menor privilégio possível.

## 3) Backend
- [ ] Endpoint `/api/health` respondendo 200 no ambiente alvo.
- [ ] Rate limit e headers de segurança ativos.
- [ ] Logs estruturados habilitados (com request-id).
- [ ] Alertas para 5xx, latência e erro de banco.

## 4) Frontend
- [ ] Fluxo de login testado em produção/staging.
- [ ] Rotas protegidas por role validadas (`/descontos`, `/admin/*`).
- [ ] Expiração de sessão (401) redireciona para login.
- [ ] Sincronização multi-aba validada (logout/reflexo de token removido).
- [ ] Rota inexistente redireciona corretamente (`*`).

## 5) Observabilidade e operação
- [ ] Dashboard com taxa de erro, p95/p99 e throughput.
- [ ] Canal de alerta (Slack/Email/Pager) configurado.
- [ ] Runbook com procedimentos de incidente.
- [ ] Janela de deploy definida com plano de rollback.

## 6) Testes mínimos antes de release
- [ ] Backend: `npm test`
- [ ] Frontend: `npm --prefix frontend test`
- [ ] Smoke manual: login, venda, estoque, desconto, admin.

## 7) Critério de Go/No-Go
**GO** apenas se todos os itens obrigatórios acima estiverem concluídos.
