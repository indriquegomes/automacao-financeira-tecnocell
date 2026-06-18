import { getUpdates, sendMessage } from '@/lib/telegram/client';
import { processarNF } from '@/lib/claude-ocr/processNF';
import { categorizeExpense, generateResponse } from '@/lib/ollama/client';
import axios from 'axios';

let lastUpdateId = 0;
let detectedChatId: number | null = null;

async function downloadFile(fileId: string): Promise<string> {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile`,
      { file_id: fileId }
    );
    const filePath = response.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

    const imageResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imageResponse.data).toString('base64');
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
    throw error;
  }
}

async function procesarMensagem(chatId: number, messageText?: string, photoId?: string) {
  try {
    if (!detectedChatId) {
      detectedChatId = chatId;
      console.log(`✅ Chat ID detectado: ${detectedChatId}`);
      await sendMessage(chatId, '✅ Bot iniciado! Envie fotos de NF para processar.');
      return;
    }

    if (photoId) {
      await sendMessage(chatId, '⏳ Processando NF...');
      const imageBase64 = await downloadFile(photoId);
      const dadosNF = await processarNF(imageBase64);
      const categoria = await categorizeExpense(dadosNF.descricao);
      await sendMessage(
        chatId,
        `✅ NF processada!\n\nEmpresa: ${dadosNF.empresa}\nValor: R$ ${dadosNF.valor}\nData: ${dadosNF.data}\nCategoria: ${categoria}`
      );
    }

    if (messageText) {
      const resposta = await generateResponse(messageText);
      await sendMessage(chatId, resposta);
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    await sendMessage(chatId, '❌ Erro ao processar. Tente novamente.');
  }
}

async function startBot() {
  console.log('🚀 Bot Telegram iniciado (polling)...');
  while (true) {
    try {
      const updates = await getUpdates(lastUpdateId);
      for (const update of updates) {
        lastUpdateId = update.update_id + 1;
        const message = update.message;
        if (!message) continue;

        const chatId = message.chat.id;
        if (message.photo) {
          const photoId = message.photo[message.photo.length - 1].file_id;
          await procesarMensagem(chatId, undefined, photoId);
        } else if (message.text) {
          await procesarMensagem(chatId, message.text);
        }
      }
    } catch (error) {
      console.error('Erro no loop do bot:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

startBot().catch(console.error);
