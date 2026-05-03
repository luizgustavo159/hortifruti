#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Backend tests"
npm test

echo "[2/4] Frontend unit tests"
npm --prefix frontend test

echo "[3/4] Ensure Playwright test runner dependency"
if ! npm --prefix frontend ls @playwright/test --depth=0 >/dev/null 2>&1; then
  echo "@playwright/test is missing in frontend node_modules. Installing frontend dependencies..."
  npm --prefix frontend install --no-audit --no-fund
fi

echo "[4/4] Frontend E2E smoke (list only)"
npm --prefix frontend run test:e2e -- --list

echo "Release verification checks completed."
