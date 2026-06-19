const axios = require('axios');
const TOKEN = '8970196189:AAHAfYAhEpiHtYFFUmh80spvh3ou6zMTurw';
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
let lastUpdateId = 0;

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
          await sendMessage(message.chat.id, `✅ Recebi: ${message.text}`);
        }
      }
    } catch (error) {
      console.error('Erro no loop:', error.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startBot();
