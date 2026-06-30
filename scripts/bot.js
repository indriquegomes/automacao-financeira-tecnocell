require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const OLLAMA_URL = 'http://localhost:11434';
let lastUpdateId = 0;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const sheetsAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

async function askClaude(prompt) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

async function appendToSheet(chatId, userMessage, botResponse) {
  try {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'A:D',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[now, String(chatId), userMessage, botResponse]],
      },
    });
  } catch (err) {
    console.error('Google Sheets erro:', err.message);
  }
}

async function saveMessage(chatId, userMessage, botResponse) {
  const { error } = await supabase.from('bot_messages').insert({
    chat_id: String(chatId),
    user_message: userMessage,
    bot_response: botResponse,
  });
  if (error) {
    if (error.code === '42P01') {
      console.error('⚠️ Tabela bot_messages não existe. Execute supabase/migrations/create_bot_messages.sql no dashboard do Supabase.');
    } else {
      console.error('Supabase erro:', error.message);
    }
  }
  await appendToSheet(chatId, userMessage, botResponse);
}

async function initSupabase() {
  const { error } = await supabase.from('bot_messages').select('id').limit(1);
  if (error && error.code === '42P01') {
    console.warn('⚠️ Tabela bot_messages não encontrada. Execute o SQL em supabase/migrations/create_bot_messages.sql');
  } else if (!error) {
    console.log('✅ Supabase conectado — tabela bot_messages OK');
  }
}

async function ensureNFSheet() {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const exists = spreadsheet.data.sheets.some(s => s.properties.title === 'notas_fiscais');
    if (exists) {
      console.log('✅ Google Sheets — aba notas_fiscais OK');
      return;
    }
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'notas_fiscais' } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'notas_fiscais!A1:G1',
      valueInputOption: 'RAW',
      requestBody: { values: [['data_registro', 'chat_id', 'empresa', 'valor', 'data_nf', 'descricao', 'categoria']] },
    });
    console.log('✅ Google Sheets — aba notas_fiscais criada');
  } catch (err) {
    console.error('Google Sheets init erro:', err.message);
  }
}

async function saveNFToSupabase(chatId, empresa, valor, dataNF, descricao, categoria) {
  const { error } = await supabase.from('notas_fiscais').insert({
    chat_id: String(chatId),
    empresa,
    valor,
    data_nf: dataNF,
    descricao,
    categoria,
  });
  if (error) {
    if (error.code === '42P01') {
      console.error('⚠️ Tabela notas_fiscais não existe. Execute supabase/migrations/create_notas_fiscais.sql no dashboard do Supabase.');
    } else {
      console.error('Supabase NF erro:', error.message);
    }
  }
}

async function saveNFToSheet(chatId, empresa, valor, dataNF, descricao, categoria) {
  try {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'notas_fiscais!A:G',
      valueInputOption: 'RAW',
      requestBody: { values: [[now, String(chatId), empresa, valor, dataNF, descricao, categoria]] },
    });
  } catch (err) {
    console.error('Google Sheets NF erro:', err.message);
  }
}

async function handlePhoto(message) {
  const chatId = message.chat.id;
  try {
    await sendMessage(chatId, '🔍 Processando nota fiscal...');

    const photo = message.photo[message.photo.length - 1];
    const fileRes = await axios.post(`${BASE_URL}/getFile`, { file_id: photo.file_id });
    const filePath = fileRes.data.result.file_path;

    const imageRes = await axios.get(
      `https://api.telegram.org/file/bot${TOKEN}/${filePath}`,
      { responseType: 'arraybuffer' }
    );
    const base64Image = Buffer.from(imageRes.data).toString('base64');
    const ext = filePath.split('.').pop().toLowerCase();
    const mediaType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          {
            type: 'text',
            text: 'Analise esta nota fiscal brasileira e extraia os dados em JSON com os campos: empresa (string), valor (string com o valor total), data_nf (string no formato DD/MM/AAAA), descricao (string resumindo os itens ou serviço), categoria (string, exatamente UMA de: Alimentacao, Transporte, Servicos, Saude, Educacao, Outros). Responda APENAS com o JSON, sem texto adicional.',
          },
        ],
      }],
    });

    const rawText = response.content[0].text.trim();
    let nfData;
    try {
      const jsonText = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      nfData = JSON.parse(jsonText);
    } catch {
      await sendMessage(chatId, '⚠️ Não foi possível extrair dados estruturados. Tente uma foto mais nítida.');
      return;
    }

    const { empresa, valor, data_nf, descricao, categoria } = nfData;

    await Promise.all([
      saveNFToSupabase(chatId, empresa, String(valor), data_nf, descricao, categoria),
      saveNFToSheet(chatId, empresa, String(valor), data_nf, descricao, categoria),
    ]);

    const reply = [
      '✅ Nota fiscal registrada!',
      '',
      `🏢 Empresa: ${empresa}`,
      `💰 Valor: R$ ${valor}`,
      `📅 Data: ${data_nf}`,
      `🏷️ Categoria: ${categoria}`,
      `📝 Descrição: ${descricao}`,
    ].join('\n');

    await sendMessage(chatId, reply);
    console.log(`📸 NF processada de ${chatId}: ${empresa} R$${valor}`);
  } catch (err) {
    console.error('Erro handlePhoto:', err.message);
    await sendMessage(chatId, '⚠️ Erro ao processar a foto.');
  }
}

// Ollama permanece disponível apenas para categorização de despesas
async function askOllamaExpenseCategory(prompt) {
  const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: 'llama3.2',
    prompt,
    stream: false,
  });
  return response.data.response;
}

async function sendMessage(chatId, text) {
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
    });
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

async function getUpdates() {
  try {
    const response = await axios.post(`${BASE_URL}/getUpdates`, {
      offset: lastUpdateId,
      timeout: 30,
    });
    return response.data.result || [];
  } catch (error) {
    console.error('Erro:', error.message);
    return [];
  }
}

async function startBot() {
  console.log('🚀 Bot Telegram rodando...');
  await initSupabase();
  await ensureNFSheet();

  while (true) {
    try {
      const updates = await getUpdates();
      for (const update of updates) {
        lastUpdateId = update.update_id + 1;
        const message = update.message;

        if (message && message.text) {
          console.log(`📨 Mensagem de ${message.chat.id}: ${message.text}`);
          try {
            const reply = await askClaude(message.text);
            await sendMessage(message.chat.id, reply);
            await saveMessage(message.chat.id, message.text, reply);
          } catch (err) {
            console.error('Erro Claude:', err.message);
            await sendMessage(message.chat.id, '⚠️ Erro ao gerar resposta. Verifique a ANTHROPIC_API_KEY.');
          }
        } else if (message && message.photo) {
          console.log(`📸 Foto recebida de ${message.chat.id}`);
          handlePhoto(message).catch(err => console.error('handlePhoto:', err.message));
        }
      }
    } catch (error) {
      console.error('Erro no loop:', error.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startBot();
