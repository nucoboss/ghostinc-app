#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Levantando ghostinc en local (up -d --build)"
docker compose up -d --build --remove-orphans

echo "==> Estado de servicios"
docker compose ps

echo "==> Esperando /health/ready del backend"
until curl -fsS http://localhost:4000/health/ready >/dev/null 2>&1; do
  sleep 2
done
echo "    backend OK (http://localhost:4000/health/ready)"

echo "==> Esperando frontend"
until curl -fsS -o /dev/null http://localhost:3002 2>/dev/null; do
  sleep 2
done
curl -fsS -o /dev/null -w "    http://localhost:3002 -> %{http_code}\n" http://localhost:3002

echo "==> Limpieza: imagenes sin tag (dangling) y cache de build"
docker image prune -f
docker builder prune -f

echo "==> Resumen de espacio"
docker system df