import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function processarNF(imageBase64: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Extraia dados da Nota Fiscal:\n- Empresa/Fornecedor\n- CNPJ\n- Data (formato YYYY-MM-DD)\n- Valor total\n- Descrição dos itens\n\nResponda APENAS em JSON:\n{\n  "empresa": "...",\n  "cnpj": "...",\n  "data": "YYYY-MM-DD",\n  "valor": 0.00,\n  "descricao": "..."\n}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return JSON.parse(text);
  } catch (error) {
    console.error('Erro ao processar NF:', error);
    throw error;
  }
}
