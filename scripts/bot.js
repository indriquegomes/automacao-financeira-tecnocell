require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const TOKEN = '8970196189:AAHAfYAhEpiHtYFFUmh80spvh3ou6zMTurw';
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const OLLAMA_URL = 'http://localhost:11434';
let lastUpdateId = 0;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function askClaude(prompt) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
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
          } catch (err) {
            console.error('Erro Claude:', err.message);
            await sendMessage(message.chat.id, '⚠️ Erro ao gerar resposta. Verifique a ANTHROPIC_API_KEY.');
          }
        }
      }
    } catch (error) {
      console.error('Erro no loop:', error.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startBot();
