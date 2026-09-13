export interface User {
  id: string;
  username: string;
  email: string | null;
  role: 'user' | 'admin';
  balance: number;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  created_at: string;
  isStreaming?: boolean;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  username?: string;
  amount: number;
  type: 'INITIAL_FREE' | 'ADMIN_GRANT' | 'PROMO_CODE' | 'AI_USAGE' | 'REFUND';
  description: string;
  created_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  tokens: number;
  code_type: 'single' | 'multi';
  max_activations: number;
  current_activations: number;
  expires_at: string | null;
  is_active: number;
  created_at: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  tokensUsed: number;
  tokensGranted: number;
  currentOutstandingBalance: number;
  totalRequests: number;
  totalSessions: number;
  promoCount: number;
  promoRedemptions: number;
  apiErrors: number;
  chartData: {
    date: string;
    tokensUsed: number;
    requests: number;
  }[];
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string | null;
  role: 'user' | 'admin';
  created_at: string;
  balance: number;
  total_used: number;
  total_granted: number;
  sessions_count: number;
}

export interface AdminSettings {
  provider: string;
  model: string;
  maskedApiKey: string;
  hasApiKey: boolean;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  rateLimitMax: number;
  sessionLifetimeDays: number;
}

export interface AdminLog {
  id: string;
  action: string;
  details: string;
  ip: string | null;
  created_at: string;
}
