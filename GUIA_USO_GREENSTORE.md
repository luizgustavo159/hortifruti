# Guia de Uso - Sistema GreenStore (Hortifruti)

## 📋 Visão Geral

O **GreenStore** é um sistema completo de gestão para hortifrutis, desenvolvido em **React** (frontend) e **Node.js/Express** (backend), com banco de dados **PostgreSQL**. O sistema foi finalizado e está pronto para uso em produção.

## ✅ Funcionalidades Implementadas

### 1. **Frente de Caixa (PDV)**
A tela de Caixa oferece uma interface moderna e intuitiva para o registro de vendas em tempo real:

- **Busca de Produtos:** Campo de busca rápida para localizar produtos por nome
- **Carrinho Interativo:** Adicione produtos, ajuste quantidades e remova itens facilmente
- **Aplicação de Descontos:** Suporte a múltiplos tipos de descontos (percentual, fixo, compre X leve Y, pacote fixo)
- **Cálculo Automático:** Subtotal, desconto e total são calculados em tempo real
- **Formas de Pagamento:** Dinheiro, Cartão de Crédito, Cartão de Débito, PIX
- **Finalização de Venda:** Registra a venda no banco de dados com auditoria completa

**Acesso:** Menu → Caixa

---

### 2. **Gestão de Estoque**
Controle completo do inventário com múltiplas funcionalidades:

#### **Aba: Inventário**
- Visualize todos os produtos com estoque atual e mínimo
- Identifique itens em nível crítico (com status visual)
- Busque produtos por nome
- Registre movimentações de estoque (ajustes, perdas, transferências)

#### **Aba: Reposições Sugeridas**
- Sistema automático que sugere produtos para reposição
- Baseado no nível mínimo definido para cada produto

#### **Aba: Movimentações**
- Histórico de movimentações de estoque
- Rastreamento de perdas e ajustes

#### **Criar Novo Produto**
Clique em "Novo Produto" para adicionar um novo item ao estoque:
- Nome do produto *
- Categoria *
- Fornecedor (opcional)
- Preço (R$) *
- Estoque Atual *
- Estoque Mínimo *

**Acesso:** Menu → Estoque

---

### 3. **Dashboard Administrativo**
Visão consolidada do desempenho do negócio:

- **Resumo de Vendas:** Total de vendas no período selecionado
- **Perdas Estimadas:** Descartes e devoluções
- **Margem Líquida:** Percentual de lucro sobre vendas
- **Itens Críticos:** Quantidade de produtos em baixo estoque
- **Desempenho por Operador:** Tabela com vendas, quantidade e ticket médio de cada operador
- **Vendas por Categoria:** Distribuição de vendas por categoria de produtos
- **Produtos em Baixo Estoque:** Lista de produtos que precisam reposição

**Filtros Disponíveis:**
- Data Inicial e Final (padrão: últimos 30 dias)

**Acesso:** Menu → Administração → Dashboard

---

### 4. **Relatórios Financeiros**
Análise detalhada com múltiplos tipos de relatórios:

#### **Tipos de Relatório:**
1. **Vendas:** Detalhamento de todas as vendas realizadas
2. **Fluxo de Caixa:** Entradas e saídas de caixa
3. **Contas a Pagar:** Obrigações financeiras
4. **Contas a Receber:** Valores a receber de clientes
5. **Inventário:** Status completo do estoque

#### **Filtros:**
- Tipo de Relatório
- Data Inicial e Final
- Operador (para relatório de vendas)
- Categoria (para relatório de vendas)

#### **Exportação:**
- Clique em "Exportar CSV" para baixar os dados em formato CSV
- Compatível com Excel e outras ferramentas de análise

**Acesso:** Menu → Administração → Relatórios

---

## 🚀 Como Iniciar o Sistema

### **Pré-requisitos**
- Node.js 18+ instalado
- PostgreSQL 12+ instalado e rodando
- npm ou yarn

### **Passo 1: Clonar o Repositório**
```bash
git clone https://github.com/luizgustavo159/hortifruti.git
cd hortifruti
```

### **Passo 2: Configurar Variáveis de Ambiente**
Crie um arquivo `.env` na raiz do projeto:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/greenstore
JWT_SECRET=sua_chave_secreta_muito_forte_aqui_32_caracteres_minimo
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000,http://seu-dominio.com
```

### **Passo 3: Instalar Dependências**
```bash
npm install
cd frontend && npm install && cd ..
```

### **Passo 4: Executar Migrações de Banco de Dados**
```bash
npm run migrate
```

### **Passo 5: Bootstrap do Usuário Admin (Opcional)**
```bash
npm run bootstrap:admin
```

### **Passo 6: Iniciar o Sistema**
```bash
npm start
```

O sistema estará disponível em `http://localhost:3000`

---

## 👥 Controle de Acesso

O sistema possui 4 níveis de acesso:

| Papel | Nível | Permissões |
|---|---|---|
| **Operador** | 1 | Acesso à Frente de Caixa (vendas) |
| **Supervisor** | 2 | Operador + Gestão de Estoque |
| **Gerente** | 3 | Supervisor + Relatórios e Dashboard |
| **Admin** | 4 | Acesso total ao sistema |

---

## 🔐 Segurança

### **Implementações de Segurança**
- ✅ JWT para autenticação
- ✅ Bcrypt para hashing de senhas
- ✅ CORS configurável
- ✅ Rate limiting (120 requisições por 15 minutos)
- ✅ Helmet para proteção de headers HTTP
- ✅ Validação de entrada em todas as rotas
- ✅ Transações de banco de dados para integridade

### **Recomendações para Produção**
1. **Remova o arquivo `.env` do repositório** e configure variáveis de ambiente no servidor
2. **Use HTTPS** em produção
3. **Configure um firewall** adequado
4. **Faça backup regular** do banco de dados
5. **Monitore logs** de erro e acesso
6. **Atualize dependências** regularmente

---

## 📊 Estrutura do Banco de Dados

O sistema utiliza as seguintes tabelas principais:

| Tabela | Descrição |
|---|---|
| `users` | Usuários do sistema (operadores, gerentes, admin) |
| `products` | Catálogo de produtos |
| `categories` | Categorias de produtos |
| `suppliers` | Fornecedores |
| `sales` | Registro de todas as vendas |
| `sale_items` | Itens individuais de cada venda |
| `stock_movements` | Histórico de movimentações de estoque |
| `discounts` | Tipos de descontos disponíveis |
| `cash_sessions` | Sessões de caixa de operadores |
| `accounts_payable` | Contas a pagar |
| `accounts_receivable` | Contas a receber |
| `audit_logs` | Log de auditoria de todas as operações |

---

## 🛠️ Troubleshooting

### **Problema: "Falha ao conectar ao banco de dados"**
- Verifique se PostgreSQL está rodando
- Confirme as credenciais em `.env`
- Verifique se a porta 5432 está acessível

### **Problema: "Erro ao fazer login"**
- Verifique se o usuário existe no banco
- Confirme se a senha está correta
- Verifique se o JWT_SECRET está configurado

### **Problema: "Vendas não estão sendo registradas"**
- Verifique se há estoque suficiente
- Confirme se o operador tem permissão (papel >= 1)
- Verifique os logs do servidor para mensagens de erro

### **Problema: "Relatórios vazios"**
- Verifique o intervalo de datas selecionado
- Confirme se há dados de vendas no período
- Verifique se o operador/categoria selecionado tem vendas

---

## 📞 Suporte e Contribuição

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório GitHub.

---

## 📝 Notas Importantes

1. **Backup Regular:** Faça backup do banco de dados regularmente
2. **Atualização de Estoque:** O estoque é decrementado automaticamente ao registrar uma venda
3. **Auditoria:** Todas as operações são registradas em `audit_logs` para rastreamento
4. **Relatórios:** Os relatórios são gerados em tempo real baseado nos dados do banco

---

## 🎉 Próximas Melhorias Sugeridas

- Integração com impressoras fiscais
- Integração com balanças eletrônicas
- Leitura de código de barras
- App mobile para operadores
- Integração com sistemas contábeis
- Suporte a múltiplas lojas
- Dashboard em tempo real com WebSockets

---

**Versão:** 1.0.0  
**Data:** Maio de 2026  
**Status:** ✅ Pronto para Produção
