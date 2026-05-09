# 🚀 Guia de Deployment - GreenStore

## Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Deployment Local](#deployment-local)
3. [Deployment em Produção](#deployment-em-produção)
4. [Monitoramento](#monitoramento)
5. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

### Sistema Operacional
- **Linux** (Ubuntu 20.04+ recomendado)
- **macOS** (Intel ou Apple Silicon)
- **Windows** (com WSL2)

### Ferramentas Necessárias
```bash
# Docker & Docker Compose
docker --version  # v20.10+
docker-compose --version  # v2.0+

# Node.js (para desenvolvimento)
node --version  # v22+
npm --version  # v10+

# PostgreSQL Client (opcional, para debug)
psql --version
```

---

## Deployment Local

### 1. Clonar Repositório
```bash
git clone https://github.com/luizgustavo159/hortifruti.git
cd hortifruti
```

### 2. Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com suas configurações
nano .env
```

**Variáveis Críticas:**
```env
DB_PASSWORD=sua_senha_segura_aqui
JWT_SECRET=sua_chave_jwt_super_secreta_min_32_chars
JWT_REFRESH_SECRET=sua_chave_refresh_super_secreta_min_32_chars
REDIS_PASSWORD=sua_senha_redis_aqui
CORS_ORIGIN=http://localhost:3000
```

### 3. Iniciar com Docker Compose (Desenvolvimento)
```bash
# Iniciar todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f app

# Parar serviços
docker-compose down
```

### 4. Acessar Aplicação
- **Frontend:** http://localhost:3000
- **API:** http://localhost:3000/api
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

---

## Deployment em Produção

### 1. Preparar Servidor

#### AWS EC2
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

#### DigitalOcean / Linode
- Usar App Platform (gerenciado)
- Ou seguir passos similares ao AWS

### 2. Clonar e Configurar
```bash
# Clonar repositório
git clone https://github.com/luizgustavo159/hortifruti.git
cd hortifruti

# Criar arquivo .env com valores de produção
nano .env

# Gerar senhas fortes
openssl rand -base64 32  # Para JWT_SECRET
openssl rand -base64 32  # Para JWT_REFRESH_SECRET
```

### 3. Iniciar com Docker Compose (Produção)
```bash
# Usar arquivo de composição de produção
docker-compose -f docker-compose.prod.yml up -d

# Verificar status
docker-compose -f docker-compose.prod.yml ps

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f app
```

### 4. Configurar SSL/TLS (HTTPS)

#### Usando Let's Encrypt + Certbot
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Gerar certificado
sudo certbot certonly --standalone -d seu-dominio.com

# Certificado estará em: /etc/letsencrypt/live/seu-dominio.com/
```

#### Configurar Nginx
```bash
# Criar arquivo de configuração
sudo nano /etc/nginx/sites-available/greenstore

# Conteúdo básico:
server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name seu-dominio.com;
    return 301 https://$server_name$request_uri;
}
```

### 5. Backup Automático

#### Script de Backup
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/greenstore"
DATE=$(date +%Y%m%d_%H%M%S)
DB_BACKUP="$BACKUP_DIR/db_$DATE.sql"

mkdir -p $BACKUP_DIR

# Backup do banco de dados
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U greenstore greenstore > $DB_BACKUP

# Comprimir
gzip $DB_BACKUP

# Manter apenas últimos 30 dias
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup realizado: $DB_BACKUP.gz"
```

#### Agendar com Cron
```bash
# Editar crontab
crontab -e

# Adicionar linha para backup diário às 2 AM
0 2 * * * /home/ubuntu/backup.sh >> /var/log/greenstore-backup.log 2>&1
```

---

## Monitoramento

### 1. Logs

```bash
# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f app

# Ver logs de um serviço específico
docker-compose -f docker-compose.prod.yml logs -f postgres

# Salvar logs em arquivo
docker-compose -f docker-compose.prod.yml logs app > logs.txt
```

### 2. Health Check

```bash
# Verificar saúde da aplicação
curl http://localhost:3000/health

# Resposta esperada:
# {"status":"ok","timestamp":"2026-05-04T10:30:00Z"}
```

### 3. Monitoramento com Prometheus (Opcional)

```bash
# Instalar Prometheus
docker run -d \
  -p 9090:9090 \
  -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Acessar em: http://localhost:9090
```

### 4. Alertas com Sentry (Opcional)

```bash
# Adicionar ao .env
SENTRY_DSN=https://seu-sentry-dsn@sentry.io/project-id

# Erros serão automaticamente reportados ao Sentry
```

---

## Troubleshooting

### Problema: Container não inicia
```bash
# Verificar logs
docker-compose logs app

# Verificar se porta 3000 está em uso
lsof -i :3000

# Matar processo
kill -9 <PID>
```

### Problema: Banco de dados não conecta
```bash
# Verificar se PostgreSQL está rodando
docker-compose ps postgres

# Verificar logs do banco
docker-compose logs postgres

# Reconectar ao banco
docker-compose exec postgres psql -U greenstore -d greenstore
```

### Problema: Sem espaço em disco
```bash
# Limpar containers inativos
docker container prune -f

# Limpar imagens não usadas
docker image prune -f

# Limpar volumes não usados
docker volume prune -f

# Ver uso de disco
docker system df
```

### Problema: Aplicação lenta
```bash
# Verificar recursos
docker stats

# Aumentar limite de memória em docker-compose.prod.yml:
# services:
#   app:
#     mem_limit: 2g
#     memswap_limit: 2g
```

---

## Checklist de Produção

- [ ] Senhas e tokens gerados com `openssl rand -base64 32`
- [ ] SSL/TLS configurado com certificado válido
- [ ] Backups automáticos configurados
- [ ] Monitoramento e alertas ativados
- [ ] Logs centralizados
- [ ] Firewall configurado (apenas portas 80, 443)
- [ ] Fail2ban ou similar para proteção contra brute force
- [ ] Rate limiting ativado
- [ ] CORS restrito a domínios conhecidos
- [ ] Variáveis de ambiente não commitadas
- [ ] Testes automatizados passando
- [ ] Documentação atualizada

---

## Suporte

Para dúvidas ou problemas:
1. Verificar logs: `docker-compose logs -f`
2. Consultar documentação: `/docs`
3. Abrir issue no GitHub: https://github.com/luizgustavo159/hortifruti/issues

---

**Última atualização:** 04 de Maio de 2026
