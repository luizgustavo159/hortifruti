# Runbook - GreenStore

## Deploy

1. Configurar variáveis de ambiente (`.env`) no servidor.
2. Executar migrações com `npm run migrate`.
3. Iniciar a aplicação com `npm start`.

## Rollback

1. Reverter para o commit anterior.
2. Reaplicar migrações se necessário.
3. Reiniciar o serviço.

## Monitoramento

- Verificar logs via `stdout`/`stderr` (Pino).
- Acompanhar métricas na tabela `request_metrics`.
- Alertas são registrados em `alerts`.
