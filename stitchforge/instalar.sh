#!/usr/bin/env bash
# Instala e sobe o StitchForge nesta maquina.
#   ./instalar.sh          -> instala e abre a interface web
#   ./instalar.sh --testes -> instala e roda os testes
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null; then
  echo "Python 3 nao encontrado. Instale o Python 3.10 ou mais novo e rode de novo." >&2
  exit 1
fi

VERSION=$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')
REQUIRED=$(python3 -c 'print(3.10)')
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'; then
  echo "Python $VERSION e antigo demais; o StitchForge precisa de 3.10 ou mais novo." >&2
  exit 1
fi

if [ ! -d .venv ]; then
  echo "==> criando ambiente virtual em .venv"
  python3 -m venv .venv
fi

echo "==> instalando dependencias (pode demorar na primeira vez)"
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet -e ".[formats,dev]"

if [ "${1:-}" = "--testes" ]; then
  exec ./.venv/bin/pytest -q
fi

echo
echo "==> pronto. Abra no navegador:  http://127.0.0.1:8000"
echo "    (para parar, tecle Ctrl+C)"
echo
exec ./.venv/bin/uvicorn stitchforge.api:app --host 127.0.0.1 --port 8000
