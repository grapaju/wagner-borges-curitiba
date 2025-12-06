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
// Por padrão, salva na raiz do backend para compatibilidade
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Garantir criação do diretório de dados
try { 
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Diretório de dados criado: ${DATA_DIR}`);
  }
} catch(err) {
  console.error(`❌ Erro ao criar diretório ${DATA_DIR}:`, err.message);
  console.error('⚠️  Usando diretório raiz como fallback');
}

const DATA_FILE = path.join(DATA_DIR, 'inscricoes.json');
const DATA_FILE_BACKUP = path.join(DATA_DIR, 'inscricoes.backup.json');

console.log(`📂 Arquivo de dados: ${DATA_FILE}`);

let inscricoes = [];
let listaEspera = [];

// Carregar inscrições salvas ao iniciar
function loadInscricoes() {
  console.log('🔄 Carregando inscrições do arquivo...');
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      inscricoes = Array.isArray(data.inscricoes) ? data.inscricoes : [];
      listaEspera = Array.isArray(data.listaEspera) ? data.listaEspera : [];
      console.log(`✅ ${inscricoes.length} inscrições confirmadas carregadas`);
      console.log(`✅ ${listaEspera.length} pessoas na lista de espera carregadas`);
      if (data.ultimaAtualizacao) {
        console.log(`📅 Última atualização: ${data.ultimaAtualizacao}`);
      }
      return true;
    } else if (fs.existsSync(DATA_FILE_BACKUP)) {
      console.log('⚠️  Arquivo principal não encontrado. Tentando backup...');
      const raw = fs.readFileSync(DATA_FILE_BACKUP, 'utf8');
      const data = JSON.parse(raw);
      inscricoes = Array.isArray(data.inscricoes) ? data.inscricoes : [];
      listaEspera = Array.isArray(data.listaEspera) ? data.listaEspera : [];
      console.log('🛟 Recuperado do backup com sucesso!');
      console.log(`   ${inscricoes.length} confirmadas, ${listaEspera.length} em espera`);
      // Recriar arquivo principal a partir do backup
      saveInscricoes();
      return true;
    } else {
      console.log('ℹ️  Nenhum arquivo de dados encontrado. Iniciando do zero.');
      inscricoes = [];
      listaEspera = [];
      // Criar arquivo inicial vazio
      saveInscricoes();
      return true;
    }
  } catch (error) {
    console.error('❌ ERRO ao carregar inscrições:', error.message);
    console.error('Stack:', error.stack);
    // Tentar recuperar do backup
    try {
      if (fs.existsSync(DATA_FILE_BACKUP)) {
        console.log('🔄 Tentando recuperar do backup...');
        const raw = fs.readFileSync(DATA_FILE_BACKUP, 'utf8');
        const data = JSON.parse(raw);
        inscricoes = Array.isArray(data.inscricoes) ? data.inscricoes : [];
        listaEspera = Array.isArray(data.listaEspera) ? data.listaEspera : [];
        console.log('✅ Dados recuperados do backup!');
        console.log(`   ${inscricoes.length} confirmadas, ${listaEspera.length} em espera`);
        return true;
      }
    } catch (backupError) {
      console.error('❌ Falha ao recuperar backup:', backupError.message);
    }
    // Em último caso, iniciar vazio
    console.log('⚠️  Iniciando com dados vazios por segurança');
    inscricoes = [];
    listaEspera = [];
    return false;
  }
}

// Salvar inscrições no arquivo
function saveInscricoes() {
  try {
    // Verificação de integridade dos dados
    if (!Array.isArray(inscricoes)) {
      console.error('❌ ERRO: inscricoes não é um array! Tentando recuperar...');
      inscricoes = [];
    }
    if (!Array.isArray(listaEspera)) {
      console.error('❌ ERRO: listaEspera não é um array! Tentando recuperar...');
      listaEspera = [];
    }

    const timestamp = new Date().toISOString();
    const data = {
      inscricoes,
      listaEspera,
      ultimaAtualizacao: timestamp,
      totalInscricoes: inscricoes.length,
      totalListaEspera: listaEspera.length,
      versao: '1.0',
    };
    
    const json = JSON.stringify(data, null, 2);
    
    // Verificar se o diretório existe antes de salvar
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Diretório recriado: ${dir}`);
    }
    
    // Tentar salvar arquivo principal
    fs.writeFileSync(DATA_FILE, json, 'utf8');
    console.log(`💾 Inscrições salvas em ${DATA_FILE}`);
    console.log(`   ✅ ${inscricoes.length} confirmadas, ${listaEspera.length} em espera`);
    console.log(`   📅 ${timestamp}`);
    
    // Criar backup de segurança
    try { 
      fs.writeFileSync(DATA_FILE_BACKUP, json, 'utf8');
      console.log('   ✅ Backup criado com sucesso');
    } catch(backupError) {
      console.error('   ⚠️  Aviso: Não foi possível criar backup:', backupError.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ ERRO CRÍTICO ao salvar inscrições:', error.message);
    console.error('   Arquivo:', DATA_FILE);
    console.error('   Stack:', error.stack);
    console.error('   Dados: inscricoes.length =', inscricoes?.length, ', listaEspera.length =', listaEspera?.length);
    return false;
  }
}

// Carregar ao iniciar
loadInscricoes();

// ========================================
// GOOGLE SHEETS DESABILITADO
// ========================================
// Removido por solicitação: nenhuma integração com planilha.
const SHEETS_ENABLED = false;
const SHEETS_MODE = 'disabled';
async function ensureSheetSetup() { /* no-op */ }
async function saveToSheets() { /* no-op */ }

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
 * GET /api/diagnostico - Diagnóstico do sistema (protegido)
 */
app.get('/api/diagnostico', (req, res) => {
  const token = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;
  
  if (token !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }
  
  const diagnostico = {
    servidor: {
      porta: PORT,
      uptime: process.uptime(),
      versaoNode: process.version,
      plataforma: process.platform,
    },
    arquivos: {
      diretorioDados: DATA_DIR,
      arquivoPrincipal: DATA_FILE,
      arquivoBackup: DATA_FILE_BACKUP,
      principalExiste: fs.existsSync(DATA_FILE),
      backupExiste: fs.existsSync(DATA_FILE_BACKUP),
    },
    dados: {
      totalInscricoes: inscricoes.length,
      totalListaEspera: listaEspera.length,
      vagasDisponiveis: CONFIG.MAX_VAGAS - inscricoes.length,
      ultimaInscricao: inscricoes.length > 0 ? inscricoes[inscricoes.length - 1].dataInscricao : null,
    },
    configuracao: {
      maxVagas: CONFIG.MAX_VAGAS,
      emailFrom: CONFIG.EMAIL_FROM,
      temBrevoApiKey: !!BREVO_API_KEY,
      temAdminToken: !!process.env.ADMIN_TOKEN,
    },
  };
  
  // Tentar ler tamanho dos arquivos
  try {
    if (fs.existsSync(DATA_FILE)) {
      const stats = fs.statSync(DATA_FILE);
      diagnostico.arquivos.tamanhoArquivo = stats.size;
      diagnostico.arquivos.ultimaModificacao = stats.mtime;
    }
  } catch (e) {
    diagnostico.arquivos.erroLeitura = e.message;
  }
  
  res.json({ success: true, diagnostico });
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

      // Google Sheets desabilitado

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

      // Google Sheets desabilitado

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

// Endpoints de Google Sheets removidos

// (Diagnóstico Brevo removido em produção)

// ========================================
// ROTA DE DIAGNÓSTICO DO SISTEMA
// ========================================

app.get('/api/diagnostico', (req, res) => {
  try {
    const diagnostico = {
      timestamp: new Date().toISOString(),
      sistema: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: Math.floor(process.uptime()),
        memoria: {
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          usado: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        }
      },
      arquivos: {
        dataDir: DATA_DIR,
        dataFile: DATA_FILE,
        dataFileBackup: DATA_FILE_BACKUP,
        dataFileExiste: fs.existsSync(DATA_FILE),
        backupExiste: fs.existsSync(DATA_FILE_BACKUP),
      },
      dados: {
        totalInscricoes: inscricoes.length,
        totalListaEspera: listaEspera.length,
        vagasDisponiveis: CONFIG.MAX_VAGAS - inscricoes.length,
        inscricoesArray: Array.isArray(inscricoes),
        listaEsperaArray: Array.isArray(listaEspera),
      }
    };

    // Tentar ler timestamp do arquivo
    if (fs.existsSync(DATA_FILE)) {
      try {
        const stats = fs.statSync(DATA_FILE);
        const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        diagnostico.arquivos.ultimaModificacao = stats.mtime.toISOString();
        diagnostico.arquivos.tamanho = stats.size + ' bytes';
        diagnostico.arquivos.ultimaAtualizacaoNoArquivo = fileData.ultimaAtualizacao;
      } catch (e) {
        diagnostico.arquivos.erroLeitura = e.message;
      }
    }

    res.json({ success: true, diagnostico });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      erro: error.message,
      stack: error.stack 
    });
  }
});

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

// ========================================
// SALVAMENTO AUTOMÁTICO PERIÓDICO
// ========================================

// Salvar automaticamente a cada 5 minutos como medida de segurança
setInterval(() => {
  console.log('🔄 Salvamento automático periódico...');
  saveInscricoes();
}, 5 * 60 * 1000); // 5 minutos

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log(`🚀 Servidor iniciado na porta ${PORT}`);
  console.log(`📂 Diretório de dados: ${DATA_DIR}`);
  console.log(`💾 Arquivo principal: ${DATA_FILE}`);
  console.log(`🔗 Health check: /api/status`);
  console.log(`🎛️  Admin: /admin`);
  console.log('='.repeat(50));
  console.log('');
  
  // Autosave periódico a cada 2 minutos (proteção adicional)
  setInterval(() => {
    try { 
      const resultado = saveInscricoes();
      if (!resultado) {
        console.error('⚠️  Falha no autosave periódico!');
      }
    } catch (err) {
      console.error('❌ Erro no autosave:', err.message);
    }
  }, 120000); // 2 minutos
  
  console.log('⏰ Autosave periódico ativado (a cada 2 minutos)');
  console.log('');
});

