# Deploy e Rollback

## Deploy seguro
1. Executar migrações (`npm run migrate`).
2. Executar testes (`npm test` e `npm run test:pg`).
3. Publicar nova versão.
4. Rodar smoke test em produção (`/api/health`, login, venda simples).

## Rollback
1. Reverter aplicação para versão anterior estável.
2. Se necessário, restaurar banco a partir do backup validado.
3. Reexecutar smoke tests.
4. Abrir incidente com causa raiz.
