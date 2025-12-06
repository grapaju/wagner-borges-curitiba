# 🚀 Configuração para Render

## ⚠️ IMPORTANTE - Persistência de Dados

Este projeto agora salva as inscrições em arquivos JSON. Para evitar perda de dados no Render, siga uma das opções abaixo:

## Opção 1: Disco Persistente (RECOMENDADO) ⭐

### Passo a Passo:

1. **Acesse o painel do Render**
   - Dashboard → Seu serviço → Storage

2. **Adicione um Persistent Disk**
   - Clique em "Add Disk"
   - Nome: `inscricoes-data`
   - Tamanho: 1 GB (suficiente)
   - Mount Path: `/var/data/inscricoes`

3. **Configure a variável de ambiente**
   - Dashboard → Environment
   - Adicione:
     ```
     DATA_DIR=/var/data/inscricoes
     ```

4. **Redeploy o serviço**
   - Clique em "Manual Deploy" → "Clear build cache & deploy"

### Resultado:
✅ Os dados serão salvos no disco persistente
✅ Inscrições não serão perdidas em redeploys
✅ Backup automático funcionará corretamente

---

## Opção 2: Aceitar Perda de Dados (NÃO RECOMENDADO)

Se você NÃO configurar o disco persistente:
- ⚠️ Dados serão perdidos a cada redeploy
- ⚠️ Reinicializações apagarão as inscrições
- ⚠️ Apenas útil para testes

O sistema continuará funcionando, mas use apenas para desenvolvimento.

---

## Variáveis de Ambiente Obrigatórias

Configure no painel do Render (Environment):

```bash
# Obrigatórias
ADMIN_TOKEN=wagner2026koi
EMAIL_FROM=contato@koieditora.com.br
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxx

# Para persistência (RECOMENDADO)
DATA_DIR=/var/data/inscricoes

# Opcionais
EMAIL_SENDER_NAME=Wagner Borges - Eventos
PORT=3000
```

---

## Configurações do Serviço

### Build Command:
```bash
npm install
```

### Start Command:
```bash
node server.js
```

### Health Check Path:
```
/api/status
```

### Auto-Deploy:
- ✅ Ativado (redeploy automático no push para `main`)

---

## Verificação Pós-Deploy

1. **Acesse o diagnóstico:**
   ```
   https://seu-app.onrender.com/api/diagnostico
   ```
   Header: `Authorization: Bearer wagner2026koi`

2. **Verifique os logs:**
   - Procure por:
     ```
     📂 Arquivo de dados: /var/data/inscricoes/inscricoes.json
     ✅ 0 inscrições confirmadas carregadas
     💾 Inscrições salvas: 0 confirmadas, 0 em espera
     ```

3. **Teste uma inscrição:**
   - Crie uma inscrição no site
   - Acesse `/admin`
   - Reinicie o serviço (Render → Manual Deploy → Restart)
   - Verifique se a inscrição ainda aparece

---

## Monitoramento

### Logs importantes:

✅ **Sistema funcionando:**
```
📁 Diretório de dados criado: /var/data/inscricoes
💾 Inscrições salvas em /var/data/inscricoes/inscricoes.json
✅ Backup criado com sucesso
```

❌ **Problema de persistência:**
```
⚠️ Usando diretório raiz como fallback
❌ ERRO ao criar diretório
```

Se ver erros, verifique se:
1. O disco persistente está montado
2. A variável `DATA_DIR` está correta
3. O caminho tem permissões de escrita

---

## Solução de Problemas

### Dados perdidos após redeploy:

**Causa:** Disco persistente não configurado ou `DATA_DIR` incorreto

**Solução:**
1. Configure o Persistent Disk (ver Opção 1)
2. Adicione `DATA_DIR=/var/data/inscricoes`
3. Faça redeploy

### "ENOENT: no such file or directory":

**Causa:** Diretório não existe ou sem permissões

**Solução:**
1. Verifique logs de criação do diretório
2. Confirme mount path do disco
3. Reinicie o serviço

### Autosave não funciona:

**Causa:** Permissões ou disco cheio

**Solução:**
1. Verifique espaço do disco (Render → Storage)
2. Aumente tamanho do disco se necessário
3. Verifique logs de erro

---

## 💡 Dica: Banco de Dados para Produção

Para aplicações sérias, considere migrar para banco de dados:

### PostgreSQL (Render):
- Gratuito até 1 GB
- Backups automáticos
- Mais confiável

### MongoDB Atlas:
- Gratuito até 512 MB
- Fácil integração
- Escalável

Consulte `PERSISTENCIA-DADOS.md` para mais informações.

---

## 📞 Suporte

Se as inscrições continuarem desaparecendo:
1. Verifique os logs no Render
2. Acesse `/api/diagnostico` (com token)
3. Confirme que `DATA_DIR` está configurado
4. Verifique se o disco persistente está montado

**Documentação completa:** `PERSISTENCIA-DADOS.md`
