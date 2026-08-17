const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Modelos idênticos aos já usados no fluxo client-side do protótipo
// (tbka_prototype.html), para preservar o comportamento já validado.
export const VISION_MODEL = 'qwen/qwen3.6-27b';
export const RANK_MODEL = 'openai/gpt-oss-120b';

const REQUEST_TIMEOUT_MS = 25_000;

interface ChatMessageContentText {
  type: 'text';
  text: string;
}
interface ChatMessageContentImage {
  type: 'image_url';
  image_url: { url: string };
}
type ChatMessageContent = ChatMessageContentText | ChatMessageContentImage;

interface GroqChatOptions {
  model: string;
  content: string | ChatMessageContent[];
  maxTokens: number;
  temperature: number;
}

export class GroqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroqError';
  }
}

export async function groqChat({ model, content, maxTokens, temperature }: GroqChatOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqError('GROQ_API_KEY não configurada no servidor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    const json: any = await res.json();
    if (json.error) {
      throw new GroqError(json.error.message || 'Erro ao consultar o modelo de IA.');
    }
    return json.choices?.[0]?.message?.content || '';
  } catch (err) {
    if (err instanceof GroqError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GroqError('Tempo limite excedido ao consultar o modelo de IA.');
    }
    throw new GroqError('Falha ao consultar o modelo de IA.');
  } finally {
    clearTimeout(timeout);
  }
}
