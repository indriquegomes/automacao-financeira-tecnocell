import axios from 'axios';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export async function generateResponse(prompt: string): Promise<string> {
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
    });
    return response.data.response || '';
  } catch (error) {
    console.error('Erro ao chamar Ollama:', error);
    return 'Desculpe, erro ao processar.';
  }
}

export async function categorizeExpense(description: string): Promise<string> {
  const prompt = `Categorize este gasto em UMA palavra: "${description}"\nCategorias: Alimentacao, Transporte, Servicos, Saude, Educacao, Outros.\nResponda APENAS a categoria, nada mais.`;
  return generateResponse(prompt);
}
