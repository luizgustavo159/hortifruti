# Padrão de erros

Todas as respostas de erro seguem o formato:

```json
{
  "error": {
    "code": "CODIGO_DO_ERRO",
    "message": "Mensagem do erro",
    "details": []
  },
  "request_id": "uuid"
}
```

## Regras

- `request_id` vem do middleware de logging.
- `error.code` identifica o tipo de falha para o cliente.
- `error.details` contém detalhes de validação quando aplicável.
