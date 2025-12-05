/**
 * ========================================
 * SERVIDOR BACKEND - SISTEMA DE INSCRIÇÕES
 * Wagner Borges - KOI Editora
 * ========================================
 * 
 * Funcionalidades:
 * - API REST para inscrições
 * - Integração com Google Sheets
 * - Envio de e-mails automáticos
 * - Dashboard administrativo
 * - Controle de vagas em tempo real
 */

const express = require('express');
const cors = require('cors');
// Usar fetch nativo do Node (Node 18+)
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Carregar variáveis do arquivo .env

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========================================
// CONFIGURAÇÕES
// ========================================

const CONFIG = {
  MAX_VAGAS: 120,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || 'SEU_SHEET_ID_AQUI',
  EMAIL_FROM: process.env.EMAIL_FROM || 'contato@koieditora.com.br',
  WHATSAPP_NUMBER: '554191530106',
};

// Armazenamento em arquivo JSON (persistência)
const DATA_FILE = path.join(__dirname, 'inscricoes.json');

let inscricoes = [];
let listaEspera = [];

// Carregar inscrições salvas ao iniciar
function loadInscricoes() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      inscricoes = data.inscricoes || [];
      listaEspera = data.listaEspera || [];
      console.log(`✅ ${inscricoes.length} inscrições confirmadas carregadas`);
      console.log(`✅ ${listaEspera.length} pessoas na lista de espera carregadas`);
    } else {
      console.log('ℹ️  Nenhuma inscrição anterior encontrada. Iniciando do zero.');
    }
  } catch (error) {
    console.error('❌ Erro ao carregar inscrições:', error.message);
  }
}

// Salvar inscrições no arquivo
function saveInscricoes() {
  try {
    const data = {
      inscricoes,
      listaEspera,
      ultimaAtualizacao: new Date().toISOString(),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Inscrições salvas no arquivo');
  } catch (error) {
    console.error('❌ Erro ao salvar inscrições:', error.message);
  }
}

// Carregar ao iniciar
loadInscricoes();

// ========================================
// CONFIGURAÇÃO GOOGLE SHEETS
// ========================================

let SHEETS_ENABLED = false;
let SHEETS_MODE = 'disabled';
let sheets = null;
const SHEET_TABS = ['Inscrições Confirmadas', 'Lista de Espera'];
const SHEET_HEADERS = ['Numero','Nome','Email','WhatsApp','Cidade','Newsletter','Data/Hora','Status'];

try {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const credPath = path.join(__dirname, 'credentials.json');
  const hasFile = fs.existsSync(credPath);
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;

  if (b64) {
    // Credenciais via variável de ambiente (base64 do JSON da conta de serviço)
    try {
      const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
      const credentials = JSON.parse(jsonStr);
      const auth = new google.auth.GoogleAuth({ credentials, scopes });
      sheets = google.sheets({ version: 'v4', auth });
      SHEETS_ENABLED = true;
      SHEETS_MODE = 'env';
      console.log('✅ Google Sheets habilitado (credenciais via variável)');
    } catch (e) {
      console.warn('⚠️  GOOGLE_CREDENTIALS_BASE64 inválido (não é JSON válido). Sheets desabilitado.');
      SHEETS_ENABLED = false;
      SHEETS_MODE = 'disabled';
    }
  } else if (hasFile) {
    // Credenciais via arquivo local credentials.json
    const auth = new google.auth.GoogleAuth({ keyFile: credPath, scopes });
    sheets = google.sheets({ version: 'v4', auth });
    SHEETS_ENABLED = true;
    SHEETS_MODE = 'file';
    console.log('✅ Google Sheets habilitado (credentials.json encontrado)');
  } else {
    console.log('ℹ️  Google Sheets desabilitado: sem credentials.json e sem GOOGLE_CREDENTIALS_BASE64');
  }
} catch (err) {
  console.error('❌ Erro ao configurar Google Sheets:', err.message);
  SHEETS_ENABLED = false;
  SHEETS_MODE = 'disabled';
}

async function ensureSheetSetup() {
  try {
    if (!SHEETS_ENABLED) return;
    if (!CONFIG.GOOGLE_SHEET_ID) {
      console.warn('⚠️  GOOGLE_SHEET_ID não definido; não é possível preparar a planilha');
      return;
    }

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
    });
    const existing = (meta.data.sheets || []).map(s => s.properties.title);

    const requests = [];
    for (const title of SHEET_TABS) {
      if (!existing.includes(title)) {
        requests.push({ addSheet: { properties: { title } } });
      }
    }
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
        requestBody: { requests },
      });
      console.log('✅ Abas criadas no Google Sheets:', SHEET_TABS.filter(t => !existing.includes(t)).join(', '));
    }

    // Garantir cabeçalhos nas duas abas
    for (const title of SHEET_TABS) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
        range: `${title}!A1:H1`,
        valueInputOption: 'RAW',
        resource: { values: [SHEET_HEADERS] },
      });
    }
    console.log('✅ Cabeçalhos aplicados nas abas do Google Sheets');
  } catch (err) {
    console.error('❌ Erro ao preparar a planilha do Google Sheets:', err.message);
  }
}

// Preparar planilha em background (não bloqueia o servidor)
ensureSheetSetup();

/**
 * Salvar inscrição no Google Sheets
 */
async function saveToSheets(inscricao, tipo = 'confirmada') {
  try {
    if (!SHEETS_ENABLED) {
      return; // Silencioso: não bloqueia fluxo caso Sheets não esteja habilitado
    }
    if (!CONFIG.GOOGLE_SHEET_ID) {
      console.warn('⚠️  GOOGLE_SHEET_ID não definido; pulando salvamento no Sheets');
      return;
    }

    const sheetName = tipo === 'confirmada' ? 'Inscrições Confirmadas' : 'Lista de Espera';

    const values = [[
      inscricao.numero || '',
      inscricao.nome,
      inscricao.email,
      inscricao.telefone,
      inscricao.cidade || '',
      inscricao.newsletter ? 'Sim' : 'Não',
      new Date(inscricao.dataInscricao).toLocaleString('pt-BR'),
      tipo,
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
      range: `${sheetName}!A:H`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    console.log(`✅ Inscrição salva no Google Sheets: ${inscricao.email}`);
  } catch (error) {
    console.error('❌ Erro ao salvar no Google Sheets:', error.message);
  }
}

// ========================================
// CONFIGURAÇÃO DE E-MAIL (BREVO API HTTP)
// ========================================

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'Wagner Borges - Eventos';

async function brevoSendEmail({ toEmail, toName, subject, html }) {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY ausente nas variáveis de ambiente');
  }
  const body = {
    sender: { email: CONFIG.EMAIL_FROM, name: EMAIL_SENDER_NAME },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent: html,
  };
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.message) || res.statusText;
    const details = (data && JSON.stringify(data)) || '';
    throw new Error(`Brevo erro ${res.status}: ${msg} ${details}`);
  }
  return data;
}

/**
 * Enviar e-mail de confirmação
 */
async function sendConfirmationEmail(inscricao, tipo = 'confirmada') {
  const isConfirmed = tipo === 'confirmada';
  
  const subject = isConfirmed 
    ? '✅ Inscrição Confirmada - Palestra Wagner Borges' 
    : '📋 Lista de Espera - Palestra Wagner Borges';
  
  const htmlContent = isConfirmed ? `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4B0082, #2D0052); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .badge { background: #DAA520; color: #4B0082; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
        .info-box { background: white; padding: 20px; border-left: 4px solid #DAA520; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #25D366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Inscrição Confirmada!</h1>
          <p>Wagner Borges em Curitiba</p>
        </div>
        <div class="content">
          <div class="badge">INSCRIÇÃO #${String(inscricao.numero).padStart(3, '0')}</div>
          
          <p>Olá, <strong>${inscricao.nome}</strong>!</p>
          
          <p>Sua vaga para a palestra <strong>"Aura e Conexões Energéticas"</strong> está confirmada! 🌟</p>
          
          <div class="info-box">
            <h3 style="color: #4B0082; margin-top: 0;">📅 Informações do Evento</h3>
            <p><strong>Data:</strong> 06 de Março de 2026<br>
            <strong>Horário:</strong> 19h30<br>
            <strong>Local:</strong> Casa Universalista Sol do Oriente<br>
            <strong>Endereço:</strong> R. Francisco Nunes, 437 - Rebouças, Curitiba/PR</p>
          </div>
          
          <div class="info-box" style="border-left-color: #9370DB;">
            <h3 style="color: #4B0082; margin-top: 0;">🎁 Entrada Solidária</h3>
            <p>Lembre-se de levar ração <strong>Golden</strong> ou <strong>Grand Premium</strong> para doar na entrada!</p>
          </div>
          
          <p><strong>Seus dados:</strong></p>
          <ul>
            <li>Nome: ${inscricao.nome}</li>
            <li>E-mail: ${inscricao.email}</li>
            <li>WhatsApp: ${inscricao.telefone}</li>
            ${inscricao.cidade ? `<li>Cidade: ${inscricao.cidade}</li>` : ''}
          </ul>
          
          <center>
            <a href="https://api.whatsapp.com/send?phone=${CONFIG.WHATSAPP_NUMBER}&text=Olá!%20Tenho%20uma%20dúvida%20sobre%20a%20palestra%20de%2006/03" class="button">
              💬 Tirar Dúvidas no WhatsApp
            </a>
          </center>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <strong>Interessado no Curso Intensivo?</strong><br>
            Nos dias 07 e 08 de Março, Wagner Borges ministrará um curso intensivo sobre Leis de Maat e Práticas Espirituais.<br>
            <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=Quero%20saber%20sobre%20o%20curso%20intensivo!" style="color: #4B0082;">Clique aqui para saber mais →</a>
          </p>
        </div>
        <div class="footer">
          <p>© 2025 KOI Editora - Todos os direitos reservados<br>
          Instagram: @koi.editora | WhatsApp: (41) 99153-0106</p>
        </div>
      </div>
    </body>
    </html>
  ` : `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #9370DB, #4B0082); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .badge { background: #9370DB; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
        .info-box { background: white; padding: 20px; border-left: 4px solid #9370DB; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #25D366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Você está na Lista de Espera</h1>
          <p>Wagner Borges em Curitiba</p>
        </div>
        <div class="content">
          <div class="badge">POSIÇÃO #${listaEspera.length}</div>
          
          <p>Olá, <strong>${inscricao.nome}</strong>!</p>
          
          <p>Obrigado pelo seu interesse! Você foi adicionado à <strong>Lista de Espera</strong> da palestra "Aura e Conexões Energéticas".</p>
          
          <div class="info-box">
            <h3 style="color: #4B0082; margin-top: 0;">🔔 Como funciona?</h3>
            <p>Se houver desistências ou cancelamentos, entraremos em contato com você por:</p>
            <ul>
              <li>WhatsApp: ${inscricao.telefone}</li>
              <li>E-mail: ${inscricao.email}</li>
            </ul>
            <p><strong>Fique atento às notificações!</strong></p>
          </div>
          
          <div class="info-box" style="border-left-color: #DAA520;">
            <h3 style="color: #4B0082; margin-top: 0;">💡 Garanta sua vaga no Curso!</h3>
            <p>Enquanto isso, você pode garantir sua vaga no <strong>Curso Intensivo</strong> de 07 e 08 de Março!</p>
            <p>Leis de Maat, Visualização Criativa e Fenômenos Parapsíquicos com Wagner Borges.</p>
          </div>
          
          <center>
            <a href="https://api.whatsapp.com/send?phone=${CONFIG.WHATSAPP_NUMBER}&text=Olá!%20Estou%20na%20lista%20de%20espera%20e%20quero%20saber%20sobre%20o%20curso%20intensivo!" class="button">
              🎓 Ver Informações do Curso
            </a>
          </center>
        </div>
        <div class="footer">
          <p>© 2025 KOI Editora - Todos os direitos reservados<br>
          Instagram: @koi.editora | WhatsApp: (41) 99153-0106</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await brevoSendEmail({
      toEmail: inscricao.email,
      toName: inscricao.nome,
      subject,
      html: htmlContent,
    });
    console.log(`✅ E-mail enviado (Brevo) para: ${inscricao.email}`);
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail via Brevo:', error.message);
  }
}

// ========================================
// ROTAS DA API
// ========================================

/**
 * GET /api/status - Status do sistema
 */
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      vagasDisponiveis: CONFIG.MAX_VAGAS - inscricoes.length,
      totalInscricoes: inscricoes.length,
      listaEspera: listaEspera.length,
      maxVagas: CONFIG.MAX_VAGAS,
    },
  });
});

/**
 * POST /api/inscricao - Nova inscrição
 */
app.post('/api/inscricao', async (req, res) => {
  try {
    const { nome, email, telefone, cidade, newsletter } = req.body;

    // Validações
    if (!nome || !email || !telefone) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, email, telefone',
      });
    }

    // Verificar e-mail duplicado
    const emailExists = [...inscricoes, ...listaEspera].some(i => i.email === email);
    if (emailExists) {
      return res.status(400).json({
        success: false,
        error: 'Este e-mail já está cadastrado',
      });
    }

    const inscricao = {
      nome,
      email,
      telefone,
      cidade,
      newsletter: !!newsletter,
      dataInscricao: new Date().toISOString(),
      timestamp: Date.now(),
    };

    const vagasDisponiveis = CONFIG.MAX_VAGAS - inscricoes.length;

    if (vagasDisponiveis > 0) {
      // Adicionar à lista confirmada
      inscricao.numero = inscricoes.length + 1;
      inscricoes.push(inscricao);

      // Salvar no arquivo JSON
      saveInscricoes();

      // Salvar no Google Sheets
      await saveToSheets(inscricao, 'confirmada');

      // Enviar e-mail
      await sendConfirmationEmail(inscricao, 'confirmada');

      res.json({
        success: true,
        tipo: 'confirmada',
        data: {
          numero: inscricao.numero,
          vagasRestantes: CONFIG.MAX_VAGAS - inscricoes.length,
        },
      });
    } else {
      // Adicionar à lista de espera
      listaEspera.push(inscricao);

      // Salvar no arquivo JSON
      saveInscricoes();

      // Salvar no Google Sheets
      await saveToSheets(inscricao, 'lista_espera');

      // Enviar e-mail
      await sendConfirmationEmail(inscricao, 'lista_espera');

      res.json({
        success: true,
        tipo: 'lista_espera',
        data: {
          posicao: listaEspera.length,
        },
      });
    }
  } catch (error) {
    console.error('Erro ao processar inscrição:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar inscrição',
    });
  }
});

/**
 * GET /api/inscricoes - Listar inscrições (protegido)
 */
app.get('/api/inscricoes', (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;
  
  console.log('🔐 Token recebido:', token);
  console.log('🔑 Token esperado:', expectedToken);
  
  // Verificação simples de token (melhorar em produção)
  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }

  res.json({
    success: true,
    data: {
      confirmadas: inscricoes,
      listaEspera: listaEspera,
    },
  });
});

/**
 * POST /api/cancelar - Cancelar inscrição
 */
app.post('/api/cancelar', async (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;
  
  // Verificar token
  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }

  const { email } = req.body;

  const index = inscricoes.findIndex(i => i.email === email);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Inscrição não encontrada',
    });
  }

  inscricoes.splice(index, 1);

  // Se houver lista de espera, promover o primeiro
  if (listaEspera.length > 0) {
    const promovido = listaEspera.shift();
    promovido.numero = inscricoes.length + 1;
    inscricoes.push(promovido);

    // Enviar e-mail de promoção
    await sendConfirmationEmail(promovido, 'confirmada');
  }

  // Salvar alterações no arquivo
  saveInscricoes();

  res.json({
    success: true,
    message: 'Inscrição cancelada com sucesso',
  });
});

/**
 * POST /api/test-email - Enviar e-mail de teste (protegido)
 * Body: { to: "email@destino.com", subject?: string }
 */
app.post('/api/test-email', async (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;

  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }

  const { to, subject } = req.body || {};
  if (!to) {
    return res.status(400).json({ success: false, error: 'Campo obrigatório: to' });
  }

  try {
    await brevoSendEmail({
      toEmail: to,
      toName: to,
      subject: subject || 'Teste de E-mail - KOI Editora',
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#4B0082;margin:0 0 10px">✅ E-mail de Teste</h2>
          <p>Envio de teste via Brevo API (HTTP).</p>
          <p><strong>Remetente:</strong> ${CONFIG.EMAIL_FROM}</p>
        </div>
      `,
    });
    return res.json({ success: true, provider: 'Brevo' });
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail de teste (Brevo):', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * GET /api/test-smtp - Verificar configuração SMTP (protegido)
 */
app.get('/api/test-email-provider', async (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;

  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }

  try {
    if (!BREVO_API_KEY) {
      return res.status(400).json({ success: false, error: 'BREVO_API_KEY ausente' });
    }
    return res.json({ success: true, provider: 'Brevo', sender: { email: CONFIG.EMAIL_FROM } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

/**
 * GET /api/smtp-config - Retorna configuração SMTP resolvida (protegido)
 */
app.get('/api/email-config', (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;
  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }

  const cfg = {
    provider: 'Brevo',
    senderEmail: CONFIG.EMAIL_FROM,
    senderName: EMAIL_SENDER_NAME,
    hasApiKey: !!BREVO_API_KEY,
  };
  res.json({ success: true, email: cfg });
});

/**
 * POST /api/sheets-setup - Força criação de abas/cabeçalhos (protegido)
 */
app.post('/api/sheets-setup', async (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;
  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }
  try {
    await ensureSheetSetup();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sheets-status - Retorna status do Google Sheets (protegido)
 */
app.get('/api/sheets-status', async (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;
  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }
  return res.json({
    success: true,
    sheets: {
      enabled: SHEETS_ENABLED,
      mode: SHEETS_MODE,
      sheetId: CONFIG.GOOGLE_SHEET_ID || null,
    }
  });
});

// (Diagnóstico Brevo removido em produção)

// ========================================
// LANDING PAGE & DASHBOARD ADMINISTRATIVO
// ========================================

// Rota raiz - Landing Page
// Em ambientes como Render, o backend serve apenas API/Admin
// Página simples na raiz para evitar erro de arquivo ausente
app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head><title>Wagner Borges API</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>✅ API do Evento Wagner Borges está online</h1>
        <p>Use <code>/api/status</code> para checar vagas e <a href="/admin">/admin</a> para o dashboard.</p>
      </body>
    </html>
  `);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

