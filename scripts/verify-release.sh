#!/usr/bin/env bash
set -euo pipefail

echo "[1/3] Backend tests"
npm test

echo "[2/3] Frontend unit tests"
npm --prefix frontend test

echo "[3/3] Frontend E2E smoke (list only)"
npm --prefix frontend run test:e2e -- --list

echo "Release verification checks completed."
