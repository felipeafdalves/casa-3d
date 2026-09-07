# Instala e sobe o StitchForge nesta maquina (Windows / PowerShell).
#   .\instalar.ps1           -> instala e abre a interface web
#   .\instalar.ps1 -Testes   -> instala e roda os testes
param([switch]$Testes)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) {
  Write-Error "Python nao encontrado. Instale o Python 3.10+ (marque 'Add to PATH') e rode de novo."
}

if (-not (Test-Path .venv)) {
  Write-Host "==> criando ambiente virtual em .venv"
  & $python.Source -m venv .venv
}

Write-Host "==> instalando dependencias (pode demorar na primeira vez)"
& .\.venv\Scripts\pip.exe install --quiet --upgrade pip
& .\.venv\Scripts\pip.exe install --quiet -e ".[formats,dev]"

if ($Testes) { & .\.venv\Scripts\pytest.exe -q; exit $LASTEXITCODE }

Write-Host ""
Write-Host "==> pronto. Abra no navegador:  http://127.0.0.1:8000"
Write-Host "    (para parar, tecle Ctrl+C)"
Write-Host ""
& .\.venv\Scripts\uvicorn.exe stitchforge.api:app --host 127.0.0.1 --port 8000
