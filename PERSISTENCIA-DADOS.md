# 🔒 Guia de Persistência de Dados

## ⚠️ PROBLEMA IDENTIFICADO E CORRIGIDO

**Sintoma:** Inscrições desaparecem após algum tempo e a contagem recomeça do zero.

**Causa:** Em ambientes de hospedagem como Render ou Hostinger, arquivos não persistentes podem ser apagados durante:
- Reinicializações do servidor
- Deployments automáticos
- Limpeza de arquivos temporários
- Mudança de instância/container

## ✅ CORREÇÕES IMPLEMENTADAS

### 1. Sistema de Backup Automático
- Arquivo principal: `inscricoes.json`
- Arquivo de backup: `inscricoes.backup.json`
- Salvamento duplo em cada operação

### 2. Autosave Periódico
- Salvamento automático a cada 2 minutos
- Logs detalhados de cada operação
- Recuperação automática do backup em caso de erro

### 3. Melhor Tratamento de Erros
- Validação de arrays antes de carregar
- Logs detalhados de todas as operações
- Recuperação automática de backups

## 🚀 CONFIGURAÇÃO PARA PRODUÇÃO

### Opção 1: Render com Disco Persistente (RECOMENDADO)

1. No painel do Render, adicione um **Persistent Disk**
2. Configure a variável de ambiente:
   ```
   DATA_DIR=/var/data/inscricoes
   ```
3. Monte o disco no caminho `/var/data/inscricoes`

### Opção 2: Banco de Dados (Melhor para Produção)

Para evitar perda de dados completamente, considere migrar para um banco de dados:
- **MongoDB Atlas** (gratuito até 512MB)
- **PostgreSQL** no Render
- **Firebase Firestore**

### Opção 3: Hostinger com Armazenamento Local

No Hostinger VPS/Cloud, os arquivos normalmente persistem. Certifique-se de que:
- O diretório `backend/` tem permissões de escrita
- O processo Node.js pode criar e modificar arquivos
- Use PM2 para manter o servidor rodando

## 📋 VERIFICAÇÃO DE INTEGRIDADE

### Como verificar se os dados estão sendo salvos:

1. **Verificar arquivo de dados:**
   ```powershell
   Get-Content backend/inscricoes.json
   ```

2. **Verificar logs do servidor:**
   Procure por:
   - `💾 Inscrições salvas: X confirmadas, Y em espera`
   - `✅ Backup criado com sucesso`
   - `📂 Arquivo de dados: [caminho]`

3. **Testar uma inscrição:**
   - Faça uma inscrição de teste
   - Verifique o arquivo `inscricoes.json`
   - Reinicie o servidor
   - Acesse `/admin` e verifique se a inscrição ainda aparece

## 🔧 COMANDOS ÚTEIS

### Verificar conteúdo do arquivo:
```powershell
Get-Content backend/inscricoes.json | ConvertFrom-Json | Format-List
```

### Fazer backup manual:
```powershell
Copy-Item backend/inscricoes.json backend/inscricoes.manual.json
```

### Restaurar backup:
```powershell
Copy-Item backend/inscricoes.backup.json backend/inscricoes.json
```

## 📊 MONITORAMENTO

### Logs importantes a observar:

✅ **Bom:**
```
📂 Arquivo de dados: d:\Wagner\backend\inscricoes.json
✅ 1 inscrições confirmadas carregadas
💾 Inscrições salvas: 1 confirmadas, 0 em espera
✅ Backup criado com sucesso
```

❌ **Problema:**
```
❌ ERRO CRÍTICO ao salvar inscrições: ENOENT
❌ Erro ao carregar inscrições: SyntaxError
⚠️ Falha no autosave periódico!
```

## 🛠️ SOLUÇÃO DE PROBLEMAS

### Dados perdidos após reinicialização:

1. **Verificar se o arquivo existe:**
   ```powershell
   Test-Path backend/inscricoes.json
   ```

2. **Verificar permissões:**
   ```powershell
   Get-Acl backend/inscricoes.json | Format-List
   ```

3. **Tentar recuperar backup:**
   ```powershell
   Copy-Item backend/inscricoes.backup.json backend/inscricoes.json -Force
   ```

### Servidor não salva dados:

1. Verifique os logs no terminal
2. Confirme que `DATA_DIR` está configurado corretamente
3. Teste permissões de escrita no diretório

### Em ambiente de produção (Render/Hostinger):

1. **Adicione variável de ambiente:**
   ```
   DATA_DIR=/opt/render/project/data
   ```

2. **Configure volume persistente** no painel de controle

3. **Use banco de dados** para dados críticos

## 📝 NOTAS IMPORTANTES

- ✅ O código agora salva automaticamente após CADA inscrição
- ✅ Backup automático é criado em paralelo
- ✅ Autosave a cada 2 minutos como proteção adicional
- ✅ Logs detalhados para facilitar diagnóstico
- ⚠️ Em ambientes efêmeros (containers), sempre use volumes persistentes
- 💡 Para produção séria, migre para banco de dados
