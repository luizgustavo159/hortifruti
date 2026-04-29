# Runbook de Incidentes e Rollback (Backend)

## 1) Detecção inicial
- Verificar saúde básica: `GET /api/health`.
- Verificar saúde operacional (admin): `GET /api/admin/ops/health`.
- Se `status = degraded`, identificar tabelas ausentes em `missing_tables`.

## 2) Triage rápido (5-10 min)
1. Classificar severidade:
   - **P0**: indisponibilidade total de venda/caixa.
   - **P1**: venda funciona com impacto parcial (financeiro/relatórios).
   - **P2**: degradação não bloqueante.
2. Confirmar escopo:
   - autenticação/sessão
   - vendas/cancelamento
   - caixa
   - financeiro
3. Congelar deploys enquanto o incidente estiver ativo.

## 3) Comandos operacionais úteis
- Conferir rotas de saúde:
  - `curl -sS http://<host>/api/health`
  - `curl -sS -H "Authorization: Bearer <ADMIN_TOKEN>" http://<host>/api/admin/ops/health`
- Rodar testes críticos local/staging:
  - `npm run test:backend -- --runInBand`

## 4) Mitigações imediatas
- Se erro em fluxo financeiro/export:
  - desabilitar chamadas de export no cliente temporariamente.
- Se erro em criação/cancelamento de venda:
  - bloquear operações administrativas de cancelamento até estabilização.
- Se falha em caixa:
  - operar em contingência manual e registrar pendências para reconciliação.

## 5) Rollback de aplicação
1. Selecionar commit estável anterior.
2. Executar rollback de deploy (estratégia da plataforma: tag/commit anterior).
3. Validar:
   - `/api/health`
   - `/api/admin/ops/health`
   - venda simples (`POST /api/sales`)
   - fechamento de caixa (`POST /api/pos/cash-session/close`)

## 6) Rollback de banco (se necessário)
> Preferir **forward fix**. Rollback de schema só em último caso.

- Fazer backup antes de qualquer alteração.
- Se a migração nova não for compatível com produção:
  - restaurar backup da base;
  - redeploy da versão compatível;
  - reprocessar eventos pendentes.

## 7) Pós-incidente
- Registrar timeline (início, mitigação, normalização).
- Documentar causa raiz e ações preventivas.
- Criar testes para evitar regressão.
- Atualizar este runbook com aprendizados.
