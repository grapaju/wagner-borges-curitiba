# 🚀 Backend - Sistema de Inscrições Wagner Borges

Sistema completo de gerenciamento de inscrições com integração Google Sheets, envio automático de e-mails e dashboard administrativo.

---

## 📋 Funcionalidades

✅ **API REST** para gerenciamento de inscrições  
✅ **Controle de vagas** (limite de 120 pessoas)  
✅ **Lista de espera automática**  
✅ **Integração com Google Sheets**  
✅ **Envio de e-mails automáticos** (confirmação e lista de espera)  
✅ **Dashboard administrativo** com estatísticas em tempo real  
✅ **Exportação CSV** das inscrições  
✅ **Validação de e-mail duplicado**  

---

## 🛠️ Instalação

### 1. Instalar Node.js

Baixe e instale o Node.js: https://nodejs.org/

### 2. Instalar Dependências

```powershell
cd backend
npm install
```

### 3. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```powershell
copy .env.example .env
```

Edite o arquivo `.env` com suas configurações.

---

## 🔑 Configuração Google Sheets

### 1. Criar Projeto no Google Cloud

1. Acesse: https://console.cloud.google.com/
2. Crie um novo projeto
3. Ative a **Google Sheets API**

### 2. Criar Credenciais

1. Vá em **APIs & Services > Credentials**
2. Clique em **Create Credentials > Service Account**
3. Dê um nome (ex: "wagner-inscricoes")
4. Clique em **Done**
5. Clique no service account criado
6. Vá em **Keys > Add Key > Create New Key**
7. Escolha **JSON**
8. Salve o arquivo como `credentials.json` na pasta `backend/`

### 3. Criar Planilha

1. Crie uma planilha no Google Sheets
2. Crie duas abas:
   - **Inscrições Confirmadas**
   - **Lista de Espera**
3. Adicione o cabeçalho na primeira linha:
   ```
   Número | Nome | E-mail | WhatsApp | Cidade | Newsletter | Data/Hora | Tipo
   ```
4. Compartilhe a planilha com o e-mail do service account (está no arquivo `credentials.json`)
5. Copie o **ID da planilha** (está na URL) e cole no `.env`

---

## 📧 Configuração de E-mail

### Gmail

1. Acesse: https://myaccount.google.com/apppasswords
2. Crie uma senha de aplicativo
3. Cole no `.env` em `SMTP_PASS`

### Outros Provedores

Configure o SMTP do seu provedor de e-mail no `.env`.

---

## 🚀 Iniciar Servidor

### Desenvolvimento (com auto-reload)

```powershell
npm run dev
```

### Produção

```powershell
npm start
```

O servidor estará disponível em: **http://localhost:3000**

---

## 📡 Endpoints da API

### GET /api/status

Retorna status do sistema

**Resposta:**
```json
{
  "success": true,
  "data": {
    "vagasDisponiveis": 95,
    "totalInscricoes": 25,
    "listaEspera": 0,
    "maxVagas": 120
  }
}
```

### POST /api/inscricao

Criar nova inscrição

**Body:**
```json
{
  "nome": "João Silva",
  "email": "joao@email.com",
  "telefone": "(41) 99999-9999",
  "cidade": "Curitiba",
  "newsletter": true
}
```

**Resposta (confirmada):**
```json
{
  "success": true,
  "tipo": "confirmada",
  "data": {
    "numero": 26,
    "vagasRestantes": 94
  }
}
```

**Resposta (lista de espera):**
```json
{
  "success": true,
  "tipo": "lista_espera",
  "data": {
    "posicao": 5
  }
}
```

### GET /api/inscricoes

Listar todas as inscrições (requer autenticação)

**Headers:**
```
Authorization: Bearer SEU_ADMIN_TOKEN
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "confirmadas": [...],
    "listaEspera": [...]
  }
}
```

### POST /api/cancelar

Cancelar uma inscrição

**Body:**
```json
{
  "email": "joao@email.com"
}
```

---

## 🖥️ Dashboard Administrativo

Acesse: **http://localhost:3000/admin**

**Token padrão:** `admin123` (altere no `.env`)

### Funcionalidades do Dashboard:

- 📊 Estatísticas em tempo real
- 👥 Visualização de todas as inscrições
- 📥 Exportação para CSV
- 🔄 Atualização automática
- 📋 Lista de espera com posições

---

## 🔗 Integração com o Frontend

No arquivo `index-novo.html`, substitua o JavaScript por:

```javascript
const API_URL = 'http://localhost:3000/api';

// Carregar status ao iniciar
async function updateUI() {
  const res = await fetch(`${API_URL}/status`);
  const data = await res.json();
  
  if (data.success) {
    document.getElementById('availableCount').textContent = data.data.vagasDisponiveis;
    // ... resto do código
  }
}

// Submeter formulário
form.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const formData = {
    nome: document.getElementById('nome').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefone: document.getElementById('telefone').value.trim(),
    cidade: document.getElementById('cidade').value.trim(),
    newsletter: document.getElementById('newsletter').checked,
  };
  
  try {
    const res = await fetch(`${API_URL}/inscricao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    
    const data = await res.json();
    
    if (data.success) {
      // Mostrar mensagem de sucesso
      // ... resto do código
    }
  } catch (error) {
    console.error('Erro ao enviar inscrição:', error);
  }
});
```

---

## 📝 Estrutura de Arquivos

```
backend/
├── server.js              # Servidor principal
├── package.json           # Dependências
├── .env                   # Configurações (não commitar!)
├── .env.example           # Exemplo de configurações
├── credentials.json       # Credenciais Google (não commitar!)
├── public/
│   └── admin.html        # Dashboard administrativo
└── README.md             # Esta documentação
```

---

## 🔒 Segurança

### Produção

- ✅ Use HTTPS
- ✅ Altere o `ADMIN_TOKEN` no `.env`
- ✅ Configure CORS adequadamente
- ✅ Use variáveis de ambiente
- ✅ Não commite arquivos sensíveis (`.env`, `credentials.json`)

### .gitignore

Adicione ao `.gitignore`:

```
.env
credentials.json
node_modules/
```

---

## 🐛 Troubleshooting

### Erro ao conectar com Google Sheets

- Verifique se a API está ativada
- Confirme que compartilhou a planilha com o service account
- Verifique o ID da planilha no `.env`

### E-mails não são enviados

- Verifique as credenciais SMTP
- Para Gmail, use senha de aplicativo
- Verifique se a porta 587 está aberta

### Erro "Cannot find module"

```powershell
npm install
```

---

## 📞 Suporte

Dúvidas ou problemas? Entre em contato:

- WhatsApp: (41) 99153-0106
- E-mail: contato@koieditora.com.br

---

## 📄 Licença

MIT © 2025 KOI Editora
