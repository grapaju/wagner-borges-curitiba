# Script de Teste - Persistência de Dados
# Execute este script para verificar se o sistema está salvando dados corretamente

Write-Host "🔍 TESTE DE PERSISTÊNCIA DE DADOS" -ForegroundColor Cyan
Write-Host "=" -NoNewline; Write-Host ("=" * 50) -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se o arquivo existe
Write-Host "1️⃣  Verificando existência dos arquivos..." -ForegroundColor Yellow
$arquivoPrincipal = "backend/inscricoes.json"
$arquivoBackup = "backend/inscricoes.backup.json"

if (Test-Path $arquivoPrincipal) {
    Write-Host "   ✅ Arquivo principal encontrado" -ForegroundColor Green
    $tamanho = (Get-Item $arquivoPrincipal).Length
    Write-Host "   📊 Tamanho: $tamanho bytes" -ForegroundColor Gray
} else {