# Padrão de erros

Todas as respostas de erro seguem o formato:

```json
{
  "message": "Mensagem do erro",
  "request_id": "uuid"
}
```

## Regras

- `request_id` vem do middleware de logging.
- Mensagens internas não devem vazar para produção.
- Use `err.status` para definir status HTTP quando aplicável.
