# Status atual do sistema (back-end e front-end)

## Estimativa de prontidão

> **Escala usada:** 0% (protótipo inicial) até 100% (produto pronto para operação com testes, monitoração e governança maduras).

- **Back-end: ~80% pronto**
  - Já possui base robusta de API REST, autenticação/autorização por perfil, regras de negócio de estoque/vendas, observabilidade e trilha de auditoria.
  - Pendências para 100%: ampliar cobertura de testes de ponta a ponta em PostgreSQL real, endurecer ainda mais políticas operacionais (SLO/SLA, backup/restore validado, runbooks) e fortalecer automações de deploy.

- **Front-end: ~68% pronto**
  - Existe interface funcional para login, caixa, estoque, descontos e painel administrativo (perfil, relatórios, logs e políticas), com guarda de acesso por papel.
  - Pendências para 100%: UX mais refinada para cenários de erro/carregamento, maior padronização visual, validações de formulário mais completas e testes automatizados de interface.

- **Sistema (geral): ~74% pronto**
  - O produto já atende bem um **MVP operacional forte** para hortifruti, com módulos principais implementados.

## Funcionalidades implementadas

### 1) Plataforma e segurança
- API Express servindo frontend estático e endpoints em `/api`.
- `helmet`, `cors`, `express-rate-limit` e validações de ambiente para execução mais segura.
- Correlação de requisição (`x-request-id`) e logs estruturados com `pino`/`pino-http`.
- Healthcheck e endpoint de métricas (protegido por autenticação e perfil admin).

### 2) Autenticação, sessão e autorização
- Login com JWT e sessão persistida.
- Logout invalidando sessão atual.
- Refresh/renovação de sessão via endpoint específico.
- Recuperação de senha por token (fluxo de reset).
- RBAC com perfis (ex.: admin, manager e operador) e guards por rota.
- Gestão administrativa de sessões (listar e encerrar sessões).

### 3) Administração de usuários e configurações
- Cadastro de usuários por administrador.
- Listagem e atualização de usuários (incluindo perfil/função).
- Leitura e atualização de configurações da aplicação.
- Bootstrap/admin setup controlado por token administrativo.

### 4) Catálogo e suprimentos
- Cadastro e listagem de categorias.
- Cadastro e listagem de fornecedores.
- Cadastro e listagem de produtos.

### 5) Estoque e perdas
- Ajuste de estoque com registro de movimentação.
- Consulta de histórico de movimentações.
- Registro de perdas/quebras com motivo.
- Consulta de perdas registradas.
- Sugestões de reposição de estoque.

### 6) Compras
- Criação de pedidos de compra com itens.
- Listagem de pedidos de compra.
- Consulta de itens por pedido.

### 7) Caixa e vendas
- Registro de venda no PDV com itens e pagamento.
- Cálculo de totais/descontos no fluxo de venda.
- Controle de dispositivos de PDV e registro de eventos associados.

### 8) Descontos e promoções
- Listagem de campanhas/regras de desconto.
- Criação de descontos.
- Atualização de descontos existentes.
- Aplicação de desconto em pedidos elegíveis.

### 9) Relatórios, métricas e auditoria
- Relatório resumido (visão geral operacional/financeira).
- Relatórios por operador e por categoria.
- Registro e consulta de logs de auditoria.
- Coleta de métricas de requisição e geração de alertas (incluindo webhook).

### 10) Front-end disponível hoje
- Página principal com login e navegação para módulos.
- Tela de **Caixa**.
- Tela de **Estoque**.
- Tela de **Descontos**.
- Área **Admin** com dashboard, relatórios, perfil, logs e políticas.
- Guardas de acesso no cliente por papel/permissão.

## Observações de maturidade
- O produto já está além de prova de conceito e atende operação diária básica.
- Para fechar o ciclo de “pronto para escala”, recomenda-se foco em: observabilidade com dashboards externos, testes E2E front, testes de carga e hardening de processos de release.

## O que falta para chegar em 100%

## Checklist objetivo (resumo rápido)

### Back-end
- [x] Rodar integrações em PostgreSQL real no CI.
- [x] Definir SLO/SLA e runbooks de incidente.
- [x] Validar backup/restore com rotina recorrente.
- [x] Executar teste de carga para pico de vendas.
- [x] Endurecer gestão de segredos e auditoria de permissões.
- [x] Automatizar deploy/rollback com gates de qualidade.

### Front-end
- [ ] Melhorar estados de loading/erro/sucesso em todos os fluxos.
- [ ] Padronizar componentes de formulário e tabelas.
- [x] Reforçar validações e prevenção de envio duplicado.
- [ ] Implementar testes de interface e E2E (login, caixa, estoque, admin) — smoke inicial já adicionado.
- [ ] Evoluir acessibilidade (teclado, contraste, labels) e responsividade — aria-live aplicado em feedbacks principais.
- [ ] Refinar dashboard e fluxo operacional para reduzir cliques.

### Back-end (prioridade alta)
1. **Cobertura de testes completa em ambiente real**
   - Executar suíte de integração contra PostgreSQL real em CI (além do mock em memória).
   - Adicionar testes de contrato para endpoints críticos (auth, vendas, estoque).
2. **Confiabilidade operacional**
   - Definir SLO/SLA, alertas com limiares claros e runbooks de incidente.
   - Validar rotinas de backup e restore com testes periódicos.
3. **Resiliência e performance**
   - Implementar testes de carga (picos de vendas no caixa).
   - Revisar índices e planos de consulta para relatórios e listagens pesadas.
4. **Segurança de produção**
   - Hardening de segredos (rotação/gestão centralizada).
   - Auditoria de permissões por rota + revisão de políticas de sessão.
5. **Entrega e governança**
   - Pipeline com gates de qualidade (testes, lint, migração, smoke test).
   - Estratégia de deploy/rollback documentada e automatizada.

### Front-end (prioridade alta)
1. **UX e estados de interface**
   - Melhorar feedback de carregamento, erro e sucesso em todos os fluxos.
   - Padronizar componentes de formulário, tabelas e mensagens.
2. **Validação e regras no cliente**
   - Reforçar validações de entrada (máscaras, limites, mensagens amigáveis).
   - Prevenir envios duplicados e inconsistências de estado.
3. **Qualidade automatizada**
   - Adicionar testes de interface (unitários + E2E para login, caixa, estoque e admin).
   - Cobrir cenários de permissão por perfil no frontend.
4. **Acessibilidade e responsividade**
   - Ajustes de contraste, foco de teclado, labels e navegação por leitor de tela.
   - Refinar layout mobile/tablet para telas operacionais.
5. **Experiência de produto**
   - Melhorar dashboards com filtros, paginação e exportação de dados.
   - Evoluir fluxo operacional para reduzir cliques no PDV e no estoque.

### Meta de fechamento (definição de 100%)
- **Back-end 100%**: confiável em produção, com testes fortes em CI real, segurança endurecida e operação previsível.
- **Front-end 100%**: experiência consistente, acessível, validada por testes E2E e pronta para uso intensivo da equipe.


## Atualizações recentes
- Pipeline CI com PostgreSQL real e execução de testes de integração.
- Documentação operacional adicionada: SLO/SLA, runbook de incidentes e guia de deploy/rollback.
- Script de validação de backup/restore e script de teste de carga adicionados.
- Hardening de `ADMIN_BOOTSTRAP_TOKEN` em produção e teste automatizado de ambiente.
- Melhorias de UX em telas administrativas (loading e prevenção de envio duplicado).
- Smoke test de páginas frontend adicionado (home, caixa, estoque, descontos e admin/perfil).
- Acessibilidade inicial: `aria-live`/`role` em feedbacks críticos do front.
- Testes de contrato iniciais adicionados para autenticação e validações da API de vendas.
- Cobertura de contrato ampliada com cenários RBAC (acesso negado para operador e permitido para admin em rotas administrativas).
