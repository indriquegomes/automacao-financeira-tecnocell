import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import axios from 'axios';

export const maxDuration = 60;

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sheetsAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

async function sendMessage(chatId: number, text: string) {
  await axios.post(`${BASE_URL}/sendMessage`, { chat_id: chatId, text });
}

async function askClaude(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return (response.content[0] as { text: string }).text;
}

async function appendToSheet(chatId: number, userMessage: string, botResponse: string) {
  try {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[now, String(chatId), userMessage, botResponse]] },
    });
  } catch (err: unknown) {
    console.error('Sheets erro:', (err as Error).message);
  }
}

async function saveMessage(chatId: number, userMessage: string, botResponse: string) {
  const { error } = await supabase.from('bot_messages').insert({
    chat_id: String(chatId),
    user_message: userMessage,
    bot_response: botResponse,
  });
  if (error) console.error('Supabase erro:', error.message);
  await appendToSheet(chatId, userMessage, botResponse);
}

async function saveNFToSupabase(chatId: number, empresa: string, valor: string, dataNF: string, descricao: string) {
  const { error } = await supabase.from('notas_fiscais').insert({
    chat_id: String(chatId),
    empresa,
    valor,
    data_nf: dataNF,
    descricao,
  });
  if (error) console.error('Supabase NF erro:', error.message);
}

async function saveNFToSheet(chatId: number, empresa: string, valor: string, dataNF: string, descricao: string) {
  try {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'notas_fiscais!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[now, String(chatId), empresa, valor, dataNF, descricao]] },
    });
  } catch (err: unknown) {
    console.error('Sheets NF erro:', (err as Error).message);
  }
}

async function handlePhoto(message: {
  chat: { id: number };
  photo: { file_id: string }[];
}) {
  const chatId = message.chat.id;
  await sendMessage(chatId, '🔍 Processando nota fiscal...');

  const photo = message.photo[message.photo.length - 1];
  const fileRes = await axios.post(`${BASE_URL}/getFile`, { file_id: photo.file_id });
  const filePath: string = fileRes.data.result.file_path;

  const imageRes = await axios.get(
    `https://api.telegram.org/file/bot${TOKEN}/${filePath}`,
    { responseType: 'arraybuffer' }
  );
  const base64Image = Buffer.from(imageRes.data as ArrayBuffer).toString('base64');
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mediaType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png', data: base64Image },
        },
        {
          type: 'text',
          text: 'Analise esta nota fiscal brasileira e extraia os dados em JSON com os campos: empresa (string), valor (string com o valor total), data_nf (string no formato DD/MM/AAAA), descricao (string resumindo os itens ou serviço). Responda APENAS com o JSON, sem texto adicional.',
        },
      ],
    }],
  });

  const rawText = (response.content[0] as { text: string }).text.trim();
  let nfData: { empresa: string; valor: string; data_nf: string; descricao: string };
  try {
    const jsonText = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    nfData = JSON.parse(jsonText);
  } catch {
    await sendMessage(chatId, '⚠️ Não foi possível extrair dados estruturados. Tente uma foto mais nítida.');
    return;
  }

  const { empresa, valor, data_nf, descricao } = nfData;

  await Promise.all([
    saveNFToSupabase(chatId, empresa, String(valor), data_nf, descricao),
    saveNFToSheet(chatId, empresa, String(valor), data_nf, descricao),
  ]);

  await sendMessage(chatId, [
    '✅ Nota fiscal registrada!',
    '',
    `🏢 Empresa: ${empresa}`,
    `💰 Valor: R$ ${valor}`,
    `📅 Data: ${data_nf}`,
    `📝 Descrição: ${descricao}`,
  ].join('\n'));
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const message = update.message;

    if (!message) return NextResponse.json({ ok: true });

    if (message.text) {
      const reply = await askClaude(message.text);
      await sendMessage(message.chat.id, reply);
      await saveMessage(message.chat.id, message.text, reply);
    } else if (message.photo) {
      await handlePhoto(message);
    }
  } catch (err: unknown) {
    console.error('Webhook erro:', (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
