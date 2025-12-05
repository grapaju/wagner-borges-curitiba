# Backend – Wagner Borges Curitiba

API de inscrições com fila de espera e envio de e-mail (Brevo). Google Sheets foi removido.

## Requisitos
- Node.js >= 18
- Variáveis de ambiente configuradas

## Variáveis de Ambiente
- `PORT`: Porta do servidor (Render injeta automaticamente)
- `ADMIN_TOKEN`: Token para acessar endpoints protegidos (ex.: `wagner2026koi`)
- `EMAIL_FROM`: Remetente dos e-mails (ex.: `contato@koieditora.com.br`)
- `BREVO_API_KEY`: Chave da Brevo (formato `xkeysib-...`)
Observação: Integração com Google Sheets removida por decisão do projeto.

## Instalação e Execução
```powershell
# Na pasta backend
npm install
npm start  # roda node server.js
```

## Deploy (Render)
- Start Command: `node server.js`
- Health Check Path: `/api/status` (ou `/`)
- Runtime: Node 18 ou 20
- Environment:
  - Defina `BREVO_API_KEY`, `EMAIL_FROM`, `ADMIN_TOKEN`
  - Opcional: `GOOGLE_SHEET_ID` e `GOOGLE_CREDENTIALS_BASE64`

### Acesso rápido
- Admin dashboard: `https://wagner-borges-curitiba.onrender.com/admin`
- API status: `https://wagner-borges-curitiba.onrender.com/api/status`

## E-mail (Brevo)
Use `BREVO_API_KEY` (chave transacional `xkeysib-...`), `EMAIL_FROM` e opcionalmente `EMAIL_SENDER_NAME`.

## Endpoints
- Públicos:
  - `GET /api/status`: status de vagas
  - `POST /api/inscricao`: cria inscrição (confirma ou lista de espera)
- Protegidos (Header `Authorization: Bearer {ADMIN_TOKEN}`):
  - `GET /api/inscricoes`: lista confirmadas e espera
  - `POST /api/cancelar`: cancela e promove da espera
  - `GET /api/email-config`: status do e-mail
  - `POST /api/test-email`: envia e-mail de teste via Brevo
  - (Endpoints de Google Sheets removidos)

## Testes rápidos (PowerShell)
```powershell
# Status público
Invoke-RestMethod -Method GET -Uri "https://wagner-borges-curitiba.onrender.com/api/status"

# Admin
$headers = @{ Authorization = "Bearer wagner2026koi" }
Invoke-RestMethod -Method GET -Uri "https://wagner-borges-curitiba.onrender.com/api/email-config" -Headers $headers
Invoke-RestMethod -Method GET -Uri "https://wagner-borges-curitiba.onrender.com/api/sheets-status" -Headers $headers

# E-mail de teste
$body = @{ to = "seu-email@dominio.com" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "https://wagner-borges-curitiba.onrender.com/api/test-email" -Headers $headers -Body $body -ContentType "application/json"
```

## Notas de Segurança
- Não exponha o token admin publicamente.
- Verifique SPF/DKIM/DMARC do domínio para melhor entrega de e-mails.
- Em produção, mantenha diagnósticos sensíveis desativados (já removidos).

## Troubleshooting

**Application exited early (Render)**
- Ajuste o Health Check Path para `/api/status`.
- Aumente o Health Check timeout (ex.: 90s) se necessário.
- Confirme Start Command = `node server.js` e Runtime Node 18/20.
- Verifique logs completos: se houver stack/erro, corrija a causa (porta em uso, falta de env var, etc.).

**Sheets removido**
- A integração com planilha do Google foi desativada para simplificar o deploy.

**Brevo 401 (Key not found)**
- Use a chave de API transacional (formato `xkeysib-...`) no `BREVO_API_KEY`.
- Remetente `EMAIL_FROM` deve ser do domínio autenticado na Brevo (DKIM/SPF/DMARC).

**Token admin inválido**
- Endpoints protegidos exigem `Authorization: Bearer {ADMIN_TOKEN}`. Confira o valor da env `ADMIN_TOKEN`.