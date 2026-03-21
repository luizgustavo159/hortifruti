# Runbook de Incidentes

## 1) Triage inicial (5-10 min)
1. Confirmar impacto (caixa, estoque, login, admin).
2. Verificar dashboard de erros 5xx e latência.
3. Coletar `x-request-id` de exemplos com falha.

## 2) Mitigação
- Se foi release recente: acionar rollback.
- Se banco degradado: limitar carga e priorizar endpoints críticos (`/api/sales`, `/api/auth/login`).
- Se segredo/token inválido: restaurar segredo do cofre e reiniciar aplicação.

## 3) Verificação pós-mitigação
- Validar `/api/health`.
- Validar fluxo de venda básico (`/api/sales`) com usuário operador.
- Verificar queda de alertas críticos por 15 min.

## 4) Pós-incidente
- Registrar linha do tempo.
- Definir ações corretivas com responsável e prazo.
