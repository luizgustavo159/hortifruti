# Testes do projeto

## Instalação de dependências

Antes de executar qualquer suíte, instale as dependências dos dois pacotes:

```bash
npm ci
npm --prefix frontend ci
```

## Backend (Jest)

```bash
npm run test:backend -- --runInBand
```

## Frontend (Vitest)

```bash
npm run test:frontend
```

## Suite completa (backend + frontend)

```bash
npm run test:all
```

## Build frontend

```bash
npm run build:frontend
```

## CI

O repositório possui workflow em `.github/workflows/ci.yml` que executa:

1. `npm ci`
2. `npm --prefix frontend ci`
3. `npm run test:backend -- --runInBand`
4. `npm run test:frontend`
5. `npm run build:frontend`
