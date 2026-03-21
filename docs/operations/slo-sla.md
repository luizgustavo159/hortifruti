# SLO / SLA base (GreenStore)

## Objetivo
Definir metas operacionais mínimas para produção e critérios de resposta.

## SLI / SLO
- **Disponibilidade API**: 99.5% mensal.
- **Latência p95 `/api/health`**: < 300 ms.
- **Latência p95 `/api/sales`**: < 800 ms.
- **Taxa de erro 5xx**: < 1% por janela de 15 minutos.

## SLA interno (operação)
- Incidente crítico (caixa indisponível): início de resposta em até **15 min**.
- Incidente alto (degradação de venda): início de resposta em até **30 min**.
- Incidente médio (relatórios, admin): início de resposta em até **4h**.

## Alertas obrigatórios
- Pico de erro 5xx acima de 1% por 10 min.
- p95 acima do limiar por 10 min.
- Falha de migração/deploy.

## Revisão
- Revisar metas trimestralmente com dados de produção.
