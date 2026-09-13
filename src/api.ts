import {
  User,
  ChatSession,
  ChatMessage,
  TokenTransaction,
  PromoCode,
  AdminStats,
  AdminUserRecord,
  AdminSettings,
  AdminLog,
} from './types';

// Detect or retrieve API base URL
// Allows GitHub Pages users to connect to their custom deployed backend if hosted externally
const STORAGE_KEY_API_URL = 'grokson_custom_api_url';
const STORAGE_KEY_TOKEN = 'grokson_auth_token';
const STORAGE_KEY_ADMIN_TOKEN = 'grokson_admin_token';

export function getBaseApiUrl(): string {
  if (typeof window === 'undefined') return '';
  const custom = localStorage.getItem(STORAGE_KEY_API_URL);
  if (custom) return custom.replace(/\/$/, '');
  
  // Environment variable if provided in build
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  }

  // Default: relative to current origin (works seamlessly on dev, fullstack, docker, Cloud Run)
  return '';
}

export function setCustomApiUrl(url: string | null): void {
  if (!url) {
    localStorage.removeItem(STORAGE_KEY_API_URL);
  } else {
    localStorage.setItem(STORAGE_KEY_API_URL, url.trim().replace(/\/$/, ''));
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_TOKEN) || sessionStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setAuthToken(token: string | null): void {
  if (!token) {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
  } else {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  }
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_ADMIN_TOKEN) || sessionStorage.getItem(STORAGE_KEY_ADMIN_TOKEN);
}

export function setAdminToken(token: string | null): void {
  if (!token) {
    localStorage.removeItem(STORAGE_KEY_ADMIN_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_ADMIN_TOKEN);
  } else {
    localStorage.setItem(STORAGE_KEY_ADMIN_TOKEN, token);
  }
}

// Universal fetcher with error classification
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  useAdminToken = false
): Promise<T> {
  const baseUrl = getBaseApiUrl();
  const url = `${baseUrl}${endpoint}`;

  const token = useAdminToken ? getAdminToken() : getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error: any = new Error(data.error || data.message || `Ошибка сервера (${res.status})`);
      error.status = res.status;
      error.code = data.code;
      error.data = data;
      throw error;
    }

    return data as T;
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const offlineError: any = new Error('Не удалось подключиться к серверу. Проверьте соединение с интернетом или адрес API.');
      offlineError.code = 'NETWORK_ERROR';
      offlineError.status = 0;
      throw offlineError;
    }
    throw err;
  }
}

export const api = {
  // Health
  checkHealth: async () => {
    return apiRequest<{ status: string; service: string }>('/api/health');
  },

  // Auth
  auth: {
    register: async (username: string, email?: string, password?: string) => {
      const res = await apiRequest<{ user: User; token: string; message: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      setAuthToken(res.token);
      return res;
    },
    login: async (username: string, password?: string) => {
      const res = await apiRequest<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setAuthToken(res.token);
      return res;
    },
    logout: async () => {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      } catch {}
      setAuthToken(null);
    },
    getCurrentUser: async () => {
      const token = getAuthToken();
      if (!token) return null;
      try {
        const res = await apiRequest<{ user: User }>('/api/auth/user');
        return res.user;
      } catch {
        setAuthToken(null);
        return null;
      }
    },
  },

  // Tokens & Promo Codes
  tokens: {
    getDetails: async () => {
      return apiRequest<{
        balance: number;
        totalUsed: number;
        totalGranted: number;
        transactions: TokenTransaction[];
      }>('/api/tokens');
    },
    redeem: async (code: string) => {
      return apiRequest<{
        success: boolean;
        tokensAdded: number;
        newBalance: number;
        message: string;
      }>('/api/tokens/redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
  },

  // Chats
  chats: {
    list: async () => {
      return apiRequest<{ chats: ChatSession[] }>('/api/chats');
    },
    create: async (title?: string) => {
      return apiRequest<{ chat: ChatSession }>('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
    },
    getMessages: async (sessionId: string) => {
      return apiRequest<{ chat: ChatSession; messages: ChatMessage[] }>(`/api/chats/${sessionId}`);
    },
    rename: async (sessionId: string, title: string) => {
      return apiRequest<{ success: boolean; title: string }>(`/api/chats/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ title }),
      });
    },
    delete: async (sessionId: string) => {
      return apiRequest<{ success: boolean }>(`/api/chats/${sessionId}`, {
        method: 'DELETE',
      });
    },
    sendMessage: async (message: string, sessionId?: string) => {
      return apiRequest<{
        reply: string;
        tokensUsed: number;
        balance: number;
        sessionId: string;
        messageId: string;
      }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message, sessionId }),
      });
    },
  },

  // Admin
  admin: {
    login: async (login: string, password?: string) => {
      const res = await apiRequest<{ token: string; role: string; username: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      setAdminToken(res.token);
      return res;
    },
    logout: () => {
      setAdminToken(null);
    },
    getStats: async () => {
      return apiRequest<AdminStats>('/api/admin/stats', {}, true);
    },
    getUsers: async () => {
      return apiRequest<{ users: AdminUserRecord[] }>('/api/admin/users', {}, true);
    },
    grantTokens: async (userId: string, amount: number, reason?: string) => {
      return apiRequest<{ success: boolean; newBalance: number; message: string }>(
        `/api/admin/users/${userId}/tokens`,
        {
          method: 'POST',
          body: JSON.stringify({ amount, reason }),
        },
        true
      );
    },
    getCodes: async () => {
      return apiRequest<{ codes: PromoCode[] }>('/api/admin/codes', {}, true);
    },
    createCode: async (params: {
      tokens: number;
      codeType: 'single' | 'multi';
      maxActivations: number;
      expiresDays?: number | null;
      customCode?: string;
    }) => {
      return apiRequest<{ success: boolean; promo: PromoCode }>('/api/admin/codes', {
        method: 'POST',
        body: JSON.stringify(params),
      }, true);
    },
    deleteCode: async (id: string) => {
      return apiRequest<{ success: boolean }>(`/api/admin/codes/${id}`, {
        method: 'DELETE',
      }, true);
    },
    getSettings: async () => {
      return apiRequest<AdminSettings>('/api/admin/settings', {}, true);
    },
    updateSettings: async (settings: {
      apiKey?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }) => {
      return apiRequest<{ success: boolean; message: string }>('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      }, true);
    },
    testApi: async () => {
      return apiRequest<{
        status: 'online' | 'offline';
        latencyMs: number;
        provider: string;
        model: string;
        response: string;
        error?: string;
      }>('/api/admin/api-test', {
        method: 'POST',
      }, true);
    },
    getLogs: async () => {
      return apiRequest<{ logs: AdminLog[] }>('/api/admin/logs', {}, true);
    },
    getTransactions: async () => {
      return apiRequest<{ transactions: any[] }>('/api/admin/transactions', {}, true);
    },
    changePassword: async (newPassword: string) => {
      return apiRequest<{ success: boolean; message: string }>('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }, true);
    },
  },
};
