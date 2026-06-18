import axios from 'axios';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

export async function sendMessage(chatId: number | string, text: string) {
  try {
    const response = await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
}

export async function getUpdates(offset?: number) {
  try {
    const response = await axios.post(`${BASE_URL}/getUpdates`, {
      offset: offset || 0,
      timeout: 30,
    });
    return response.data.result || [];
  } catch (error) {
    console.error('Erro ao pegar updates:', error);
    return [];
  }
}
