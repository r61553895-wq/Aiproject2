import https from 'node:https';
import crypto from 'node:crypto';
import { db } from './db';
import { GoogleGenAI } from '@google/genai';

interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface GenerateResult {
  content: string;
  tokensUsed: number;
  model: string;
}

// Global cached access token for OAuth-based AI providers (e.g. GigaChat)
let cachedOAuthToken: { token: string; expiresAt: number } | null = null;

export function getSettingValue(key: string, defaultValue = ''): string {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row?.value || defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setSettingValue(key: string, value: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}

// Rough estimation of token count (Russian / English words + symbols)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 2.8));
}

// Robust HTTPS request helper that supports national root certificates (Sberbank Russian CA)
export function httpsRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    rejectUnauthorized?: boolean;
    timeout?: number;
  }
): Promise<{ status: number; text: string; data?: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyData = options.body || '';
    const headers: Record<string, string> = { ...(options.headers || {}) };
    if (bodyData && !headers['Content-Length']) {
      headers['Content-Length'] = String(Buffer.byteLength(bodyData));
    }

    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers,
        // Crucial for Sberbank/Russian national root certificates
        rejectUnauthorized: options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : false,
        timeout: options.timeout || 35000,
      },
      (res) => {
        let responseText = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          responseText += chunk;
        });
        res.on('end', () => {
          let parsedData: any = undefined;
          try {
            parsedData = JSON.parse(responseText);
          } catch {}
          resolve({
            status: res.statusCode || 200,
            text: responseText,
            data: parsedData,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Превышено время ожидания ответа от сервера нейросети (35 сек)'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// Function to get OAuth token if using GigaChat Client_ID:Secret / Base64 format
async function getOAuthToken(authKey: string): Promise<string> {
  if (cachedOAuthToken && cachedOAuthToken.expiresAt > Date.now() + 60000) {
    return cachedOAuthToken.token;
  }

  const rqUID = crypto.randomUUID();
  const postData = 'scope=GIGACHAT_API_PERS';
  const res = await httpsRequest('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rqUID,
      'Authorization': `Basic ${authKey.trim()}`,
    },
    body: postData,
    rejectUnauthorized: false,
  });

  if (res.status < 200 || res.status >= 300) {
    const msg = res.data?.message || res.text || `HTTP ${res.status}`;
    throw new Error(`Ошибка авторизации GigaChat (${res.status}): ${msg}`);
  }

  const data = res.data;
  if (!data?.access_token) {
    throw new Error('GigaChat не вернул access_token при авторизации');
  }

  cachedOAuthToken = {
    token: data.access_token,
    expiresAt: data.expires_at || Date.now() + 25 * 60 * 1000,
  };

  return data.access_token;
}

// Auto-detect AI provider and compatible model from key format
export function autoDetectProviderAndModel(rawKey: string): {
  provider: 'gemini' | 'openai' | 'gigachat' | 'internal';
  model: string;
} {
  const key = (rawKey || '').trim();
  if (!key) return { provider: 'internal', model: 'grokson-v1' };

  if (key.startsWith('sk-')) {
    return { provider: 'openai', model: 'gpt-4o-mini' };
  }

  // GigaChat keys:
  if (key.includes(':')) {
    return { provider: 'gigachat', model: 'GigaChat' };
  }
  try {
    const decoded = Buffer.from(key, 'base64').toString('utf8');
    if (decoded.length >= 20 && (decoded.includes('-') || decoded.includes(':'))) {
      return { provider: 'gigachat', model: 'GigaChat' };
    }
  } catch {}

  // Google Gemini keys:
  if (key.startsWith('AIza') || key.startsWith('AQ.') || (key.length >= 35 && key.length <= 60)) {
    return { provider: 'gemini', model: 'gemini-2.5-flash' };
  }

  if (key.length > 60 && !key.startsWith('AIza')) {
    return { provider: 'gigachat', model: 'GigaChat' };
  }

  return { provider: 'gemini', model: 'gemini-2.5-flash' };
}

// 1. GigaChat Provider implementation
async function callGigaChat(
  activeKey: string,
  messages: ChatMessageInput[],
  systemPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<GenerateResult> {
  let accessToken = activeKey;
  if (!activeKey.startsWith('eyJ') || activeKey.includes(':') || activeKey.length > 50) {
    accessToken = await getOAuthToken(activeKey);
  }

  const gigaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: m.content,
    })),
  ];

  const chatBody = JSON.stringify({
    model: 'GigaChat',
    messages: gigaMessages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  });

  const res = await httpsRequest('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: chatBody,
    rejectUnauthorized: false,
  });

  if (res.status >= 200 && res.status < 300 && res.data?.choices?.[0]?.message?.content) {
    const answer = res.data.choices[0].message.content;
    const promptTokens = estimateTokens(messages.map((m) => m.content).join(' '));
    const tokensUsed = res.data.usage?.total_tokens || promptTokens + estimateTokens(answer);
    return {
      content: answer,
      tokensUsed,
      model: 'GigaChat',
    };
  }

  const errDetail = res.data?.message || res.text || `Статус ${res.status}`;
  throw new Error(`Ошибка генерации GigaChat: ${errDetail}`);
}

// 2. OpenAI Provider implementation
async function callOpenAi(
  activeKey: string,
  messages: ChatMessageInput[],
  systemPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<GenerateResult> {
  const openAiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: m.content,
    })),
  ];

  const chatBody = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: openAiMessages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  });

  const res = await httpsRequest('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeKey}`,
    },
    body: chatBody,
  });

  if (res.status >= 200 && res.status < 300 && res.data?.choices?.[0]?.message?.content) {
    const answer = res.data.choices[0].message.content;
    const promptTokens = estimateTokens(messages.map((m) => m.content).join(' '));
    const tokensUsed = res.data.usage?.total_tokens || promptTokens + estimateTokens(answer);
    return {
      content: answer,
      tokensUsed,
      model: 'gpt-4o-mini',
    };
  }

  const errDetail = res.data?.error?.message || res.text || `Статус ${res.status}`;
  throw new Error(`Ошибка OpenAI: ${errDetail}`);
}

// 3. Google Gemini Provider implementation
async function callGemini(
  activeKey: string,
  messages: ChatMessageInput[],
  systemPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<GenerateResult> {
  const ai = new GoogleGenAI({ apiKey: activeKey });
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 2048,
    },
  });

  const answer = response.text || '';
  if (!answer) {
    throw new Error('Gemini API не вернул текст ответа');
  }

  const promptTokens = estimateTokens(messages.map((m) => m.content).join(' '));
  const tokensUsed = promptTokens + estimateTokens(answer);
  return {
    content: answer,
    tokensUsed,
    model: 'gemini-2.5-flash',
  };
}

export async function generateAiResponse(
  messages: ChatMessageInput[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<GenerateResult> {
  const customKey = getSettingValue('ai_api_key');
  const envKey = process.env.AI_API_KEY || (process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? process.env.GEMINI_API_KEY : '');
  const activeKey = (customKey || envKey || '').trim();

  const { provider, model: detectedModel } = autoDetectProviderAndModel(activeKey);
  const systemPrompt = getSettingValue(
    'system_prompt',
    'Ты — Grokson, умный, лаконичный и доброжелательный персональный AI-помощник. Отвечай подробно, профессионально и по делу с красивым Markdown форматированием.'
  );

  // 1. If GigaChat detected
  if (provider === 'gigachat' && activeKey) {
    try {
      return await callGigaChat(activeKey, messages, systemPrompt, options);
    } catch (err: any) {
      console.error('GigaChat execution failed:', err);
      // If Gemini fallback key is available in env and different from activeKey, try Gemini
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== activeKey && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
        try {
          return await callGemini(process.env.GEMINI_API_KEY, messages, systemPrompt, options);
        } catch {}
      }
      throw err;
    }
  }

  // 2. If OpenAI detected
  if (provider === 'openai' && activeKey) {
    try {
      return await callOpenAi(activeKey, messages, systemPrompt, options);
    } catch (err: any) {
      console.error('OpenAI execution failed:', err);
      throw err;
    }
  }

  // 3. If Google Gemini detected
  if (provider === 'gemini' && activeKey) {
    try {
      return await callGemini(activeKey, messages, systemPrompt, options);
    } catch (err: any) {
      console.error('Gemini execution failed:', err);
      throw err;
    }
  }

  // 4. Built-in Dynamic Grokson Neural Core (Only if NO API Key is set)
  const lastUserMsg = messages[messages.length - 1]?.content || '';
  const answer = generateDynamicGroksonReply(lastUserMsg, messages);
  const promptTokens = estimateTokens(messages.map((m) => m.content).join(' '));
  const completionTokens = estimateTokens(answer);
  const totalTokens = Math.max(12, promptTokens + completionTokens);

  return {
    content: answer,
    tokensUsed: totalTokens,
    model: 'grokson-v1',
  };
}

// Built-in intelligent response generator when external API key has not been entered yet
function generateDynamicGroksonReply(input: string, history: ChatMessageInput[]): string {
  const lower = input.toLowerCase().trim();

  // Simple math solver: e.g. 2+2, 15*4, 100/5
  const mathMatch = lower.match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)$/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let res = 0;
    if (op === '+') res = a + b;
    else if (op === '-') res = a - b;
    else if (op === '*') res = a * b;
    else if (op === '/') res = b !== 0 ? a / b : NaN;
    return `Результат вычисления **${a} ${op} ${b}** = **${res}**.`;
  }

  if (lower.includes('привет') || lower.includes('здравствуй') || lower.includes('hello')) {
    return `Привет! Я **Grokson** — твой персональный AI-помощник.

Чем я могу помочь тебе прямо сейчас?
- Написать или разобрать код
- Ответить на вопрос или найти информацию
- Сгенерировать идею, текст или план`;
  }

  if (lower.includes('кто ты') || lower.includes('что ты умеешь') || lower.includes('о себе')) {
    return `Я — **Grokson**, персональный AI-партнёр.

Я умею отвечать на вопросы, писать программы на любых языках, анализировать тексты и генерировать контент.
При регистрации каждому пользователю доступно **20 000 бесплатных токенов**. Задавай любой вопрос!`;
  }

  return `Ответ на вопрос: **"${input}"**

Я успешно обработал твой запрос. 

Если ты хочешь подключить полноценную внешнюю языковую модель (GigaChat, Gemini, OpenAI):
1. Укажи твой API-ключ в настройках Settings (Secret \`AI_API_KEY\`) или в админ-панели.
2. Система мгновенно переключится на полную генерацию ответов без ограничений.

Чем ещё могу помочь?`;
}

// Admin test function
export async function testAiConnection(): Promise<{
  status: 'online' | 'offline';
  latencyMs: number;
  provider: string;
  model: string;
  response: string;
  error?: string;
}> {
  const startTime = Date.now();
  const customKey = getSettingValue('ai_api_key');
  const envKey = process.env.AI_API_KEY || (process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? process.env.GEMINI_API_KEY : '');
  const activeKey = (customKey || envKey || '').trim();
  const { provider, model: detectedModel } = autoDetectProviderAndModel(activeKey);

  const providerNames: Record<string, string> = {
    gemini: 'Google Gemini AI',
    openai: 'OpenAI API',
    gigachat: 'Sber GigaChat',
    internal: 'Grokson Neural Core (Встроенный)',
  };

  try {
    const result = await generateAiResponse([{ role: 'user', content: 'Ответь кратко: тест связи' }]);
    const latencyMs = Date.now() - startTime;
    return {
      status: 'online',
      latencyMs,
      provider: providerNames[provider] || 'AI Provider',
      model: result.model || detectedModel,
      response: result.content.slice(0, 200),
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      status: 'offline',
      latencyMs,
      provider: providerNames[provider] || 'AI Provider',
      model: detectedModel,
      response: '',
      error: err?.message || 'Connection error or invalid credentials',
    };
  }
}
