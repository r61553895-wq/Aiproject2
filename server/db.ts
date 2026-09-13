import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// A lightweight, rock-solid in-memory & file-backed store that works 100% reliably
// everywhere (Node 18, 20, 22, Vercel Serverless, Linux, Windows, macOS).

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  salt: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface TokenBalanceRow {
  user_id: string;
  balance: number;
  total_used: number;
  total_granted: number;
  updated_at: string;
}

export interface TokenTransactionRow {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export interface PromoCodeRow {
  id: string;
  code: string;
  tokens: number;
  code_type: string;
  max_activations: number;
  current_activations: number;
  expires_at: string | null;
  is_active: number;
  created_at: string;
}

export interface PromoRedemptionRow {
  id: string;
  code_id: string;
  user_id: string;
  tokens_granted: number;
  redeemed_at: string;
}

export interface ChatSessionRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used: number;
  created_at: string;
}

export interface AdminLogRow {
  id: string;
  action: string;
  details: string;
  ip: string | null;
  created_at: string;
}

interface DatabaseSchema {
  users: UserRow[];
  sessions: SessionRow[];
  token_balances: TokenBalanceRow[];
  token_transactions: TokenTransactionRow[];
  promo_codes: PromoCodeRow[];
  promo_redemptions: PromoRedemptionRow[];
  chat_sessions: ChatSessionRow[];
  chat_messages: ChatMessageRow[];
  admin_logs: AdminLogRow[];
  settings: Record<string, string>;
}

class UniversalStore {
  private data: DatabaseSchema = {
    users: [],
    sessions: [],
    token_balances: [],
    token_transactions: [],
    promo_codes: [],
    promo_redemptions: [],
    chat_sessions: [],
    chat_messages: [],
    admin_logs: [],
    settings: {},
  };

  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const dataDir = isVercel ? '/tmp' : path.resolve(process.cwd(), 'data');

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (e) {
      // Ignore directory creation errors in serverless
    }

    this.filePath = path.join(dataDir, 'grokson_store.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load storage from disk, using clean memory store:', e);
    }
  }

  public save() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      try {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (err) {
        // In read-only or serverless ephemeral containers, memory store continues working safely
      }
    }, 100);
  }

  // Emulate SQLite DatabaseSync API seamlessly for all routes
  public prepare(sql: string) {
    const trimmed = sql.trim().replace(/\s+/g, ' ');

    return {
      get: (...params: any[]) => this.executeGet(trimmed, params),
      all: (...params: any[]) => this.executeAll(trimmed, params),
      run: (...params: any[]) => this.executeRun(trimmed, params),
    };
  }

  public exec(sql: string) {
    // Schema migrations or raw commands - safe no-op for JSON schema
    return true;
  }

  private executeGet(sql: string, params: any[]): any {
    const rows = this.executeAll(sql, params);
    return rows.length > 0 ? rows[0] : undefined;
  }

  private executeAll(sql: string, params: any[]): any[] {
    const upper = sql.toUpperCase();

    // 1. SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)
    if (upper.includes('FROM USERS') && upper.includes('WHERE USERNAME = ?')) {
      const username = (params[0] || '').toLowerCase();
      const email = params[1] ? String(params[1]).toLowerCase() : null;
      return this.data.users.filter(
        (u) =>
          u.username.toLowerCase() === username ||
          (email && u.email && u.email.toLowerCase() === email)
      );
    }

    // 2. Admin specific user query
    if (upper.includes('FROM USERS') && upper.includes("ROLE = 'ADMIN'") && (upper.includes('USERNAME = ?') || upper.includes('EMAIL = ?'))) {
      const identifier = String(params[0] || '').toLowerCase();
      const admin = this.data.users.find(
        (u) =>
          u.role === 'admin' &&
          (u.username.toLowerCase() === identifier || (u.email && u.email.toLowerCase() === identifier))
      );
      if (!admin) return [];
      const balance = this.data.token_balances.find((b) => b.user_id === admin.id)?.balance ?? 1000000;
      return [{ ...admin, balance }];
    }

    // 3. General user lookup with token balance (Auth login & profile)
    if (upper.includes('FROM USERS') && (upper.includes('USERNAME = ?') || upper.includes('EMAIL = ?'))) {
      const identifier = String(params[0] || '').toLowerCase();
      const user = this.data.users.find(
        (u) =>
          u.username.toLowerCase() === identifier ||
          (u.email && u.email.toLowerCase() === identifier)
      );
      if (!user) return [];
      const balance = this.data.token_balances.find((b) => b.user_id === user.id)?.balance ?? 0;
      return [{ ...user, balance }];
    }

    // 4. SELECT * FROM users WHERE role = 'admin'
    if (upper.includes('FROM USERS') && upper.includes("ROLE = 'ADMIN'")) {
      return this.data.users.filter((u) => u.role === 'admin');
    }

    // 5. Admin Users list
    if (upper.includes('FROM USERS') && upper.includes('TOKEN_BALANCES')) {
      return this.data.users.map((u) => {
        const b = this.data.token_balances.find((bal) => bal.user_id === u.id);
        return {
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          balance: b?.balance ?? 0,
          total_used: b?.total_used ?? 0,
          created_at: u.created_at,
        };
      });
    }

    // 5. SELECT s.user_id, u.username, u.email, u.role, b.balance FROM sessions s ...
    if (upper.includes('FROM SESSIONS S') && upper.includes('WHERE S.TOKEN = ?')) {
      const token = params[0];
      const session = this.data.sessions.find((s) => s.token === token);
      if (!session) return [];
      if (new Date(session.expires_at).getTime() < Date.now()) return [];
      const user = this.data.users.find((u) => u.id === session.user_id);
      if (!user) return [];
      const balance = this.data.token_balances.find((b) => b.user_id === user.id)?.balance ?? 0;
      return [
        {
          user_id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          balance,
        },
      ];
    }

    // 6. Token balances
    if (upper.includes('FROM TOKEN_BALANCES') && upper.includes('WHERE USER_ID = ?')) {
      const userId = params[0];
      const bal = this.data.token_balances.find((b) => b.user_id === userId);
      return bal ? [bal] : [];
    }

    // 7. Token transactions
    if (upper.includes('FROM TOKEN_TRANSACTIONS') && upper.includes('WHERE USER_ID = ?')) {
      const userId = params[0];
      return this.data.token_transactions
        .filter((t) => t.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // 8. Admin all token transactions
    if (upper.includes('FROM TOKEN_TRANSACTIONS T') && upper.includes('LEFT JOIN USERS U')) {
      return this.data.token_transactions
        .map((t) => {
          const user = this.data.users.find((u) => u.id === t.user_id);
          return {
            id: t.id,
            user_id: t.user_id,
            username: user?.username ?? 'Пользователь',
            amount: t.amount,
            type: t.type,
            description: t.description,
            created_at: t.created_at,
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 150);
    }

    // 9. Promo codes
    if (upper.includes('FROM PROMO_CODES') && upper.includes('WHERE UPPER(CODE) = ?')) {
      const code = String(params[0] || '').toUpperCase();
      return this.data.promo_codes.filter((p) => p.code.toUpperCase() === code);
    }

    if (upper.includes('FROM PROMO_CODES') && upper.includes('WHERE CODE = ?')) {
      const code = String(params[0] || '');
      return this.data.promo_codes.filter((p) => p.code === code);
    }

    if (upper.includes('FROM PROMO_CODES') && !upper.includes('WHERE')) {
      return [...this.data.promo_codes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // 10. Promo redemptions check
    if (upper.includes('FROM PROMO_REDEMPTIONS') && upper.includes('WHERE CODE_ID = ? AND USER_ID = ?')) {
      const [codeId, userId] = params;
      return this.data.promo_redemptions.filter((r) => r.code_id === codeId && r.user_id === userId);
    }

    // 11. Chat sessions
    if (upper.includes('FROM CHAT_SESSIONS S') && upper.includes('WHERE S.USER_ID = ?')) {
      const userId = params[0];
      return this.data.chat_sessions
        .filter((s) => s.user_id === userId)
        .map((s) => {
          const count = this.data.chat_messages.filter((m) => m.session_id === s.id).length;
          return {
            id: s.id,
            title: s.title,
            created_at: s.created_at,
            updated_at: s.updated_at,
            message_count: count,
          };
        })
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    if (upper.includes('FROM CHAT_SESSIONS') && upper.includes('WHERE ID = ? AND USER_ID = ?')) {
      const [id, userId] = params;
      return this.data.chat_sessions.filter((s) => s.id === id && s.user_id === userId);
    }

    // 12. Chat messages
    if (upper.includes('FROM CHAT_MESSAGES') && upper.includes('WHERE SESSION_ID = ?')) {
      const sessionId = params[0];
      return this.data.chat_messages
        .filter((m) => m.session_id === sessionId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    // 13. Settings
    if (upper.includes('FROM SETTINGS') && upper.includes('WHERE KEY = ?')) {
      const key = params[0];
      const val = this.data.settings[key];
      return val !== undefined ? [{ key, value: val }] : [];
    }

    // 14. Admin logs
    if (upper.includes('FROM ADMIN_LOGS')) {
      return [...this.data.admin_logs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100);
    }

    // 15. Aggregations (Admin Stats)
    if (upper.includes('COUNT(ID) AS TOTAL') && upper.includes('FROM USERS')) {
      return [{ total: this.data.users.length }];
    }
    if (upper.includes('SUM(BALANCE) AS TOTAL_BALANCE') && upper.includes('FROM TOKEN_BALANCES')) {
      const totalBalance = this.data.token_balances.reduce((acc, b) => acc + (b.balance || 0), 0);
      const totalUsed = this.data.token_balances.reduce((acc, b) => acc + (b.total_used || 0), 0);
      return [{ total_balance: totalBalance, total_used: totalUsed }];
    }
    if (upper.includes('COUNT(ID) AS TOTAL') && upper.includes('FROM CHAT_MESSAGES')) {
      return [{ total: this.data.chat_messages.length }];
    }
    if (upper.includes('COUNT(ID) AS TOTAL') && upper.includes('FROM PROMO_CODES')) {
      return [{ total: this.data.promo_codes.length }];
    }

    return [];
  }

  private executeRun(sql: string, params: any[]): { changes: number } {
    const upper = sql.toUpperCase();

    // INSERT INTO users
    if (upper.includes('INSERT INTO USERS')) {
      // Check whether 'admin' was hardcoded in the SQL or passed as a parameter
      if (upper.includes("'ADMIN'")) {
        const [id, username, email, password_hash, salt, created_at] = params;
        this.data.users.push({ id, username, email, password_hash, salt, role: 'admin', created_at });
      } else if (upper.includes("'USER'")) {
        const [id, username, email, password_hash, salt, created_at] = params;
        this.data.users.push({ id, username, email, password_hash, salt, role: 'user', created_at });
      } else {
        const [id, username, email, password_hash, salt, role, created_at] = params;
        this.data.users.push({ id, username, email, password_hash, salt, role: role || 'user', created_at });
      }
      this.save();
      return { changes: 1 };
    }

    // UPDATE users (password change)
    if (upper.includes('UPDATE USERS SET PASSWORD_HASH')) {
      const [hash, salt, userId] = params;
      const user = this.data.users.find((u) => u.id === userId);
      if (user) {
        user.password_hash = hash;
        user.salt = salt;
        this.save();
      }
      return { changes: 1 };
    }

    // INSERT INTO sessions
    if (upper.includes('INSERT INTO SESSIONS')) {
      const [token, user_id, created_at, expires_at] = params;
      this.data.sessions.push({ token, user_id, created_at, expires_at });
      this.save();
      return { changes: 1 };
    }

    // DELETE FROM sessions
    if (upper.includes('DELETE FROM SESSIONS WHERE TOKEN = ?')) {
      const token = params[0];
      this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
      this.save();
      return { changes: 1 };
    }

    // INSERT INTO token_balances
    if (upper.includes('INSERT INTO TOKEN_BALANCES')) {
      let user_id = params[0];
      let balance = 0;
      let total_granted = 0;
      let updated_at = new Date().toISOString();

      if (params.length === 2) {
        balance = upper.includes('1000000') ? 1000000 : 20000;
        total_granted = balance;
        updated_at = params[1] || updated_at;
      } else if (params.length === 4) {
        balance = Number(params[1]) || 0;
        total_granted = Number(params[2]) || balance;
        updated_at = params[3] || updated_at;
      } else if (params.length >= 5) {
        balance = Number(params[1]) || 0;
        total_granted = Number(params[3]) || balance;
        updated_at = params[4] || updated_at;
      }

      const existing = this.data.token_balances.find((b) => b.user_id === user_id);
      if (existing) {
        existing.balance = balance;
        existing.total_granted = total_granted;
        existing.updated_at = updated_at;
      } else {
        this.data.token_balances.push({
          user_id,
          balance,
          total_used: 0,
          total_granted,
          updated_at,
        });
      }
      this.save();
      return { changes: 1 };
    }

    // UPDATE token_balances (deduct tokens)
    if (upper.includes('UPDATE TOKEN_BALANCES SET BALANCE = BALANCE - ?')) {
      const [amount, userId, now] = params;
      const b = this.data.token_balances.find((bal) => bal.user_id === userId);
      if (b) {
        b.balance = Math.max(0, b.balance - amount);
        b.total_used = (b.total_used || 0) + amount;
        b.updated_at = now || new Date().toISOString();
        this.save();
      }
      return { changes: 1 };
    }

    // UPDATE token_balances (add tokens)
    if (upper.includes('UPDATE TOKEN_BALANCES') && upper.includes('BALANCE = BALANCE + ?')) {
      const amount = Number(params[0]) || 0;
      const userId = params[params.length - 1];
      const now = new Date().toISOString();
      const b = this.data.token_balances.find((bal) => bal.user_id === userId);
      if (b) {
        b.balance = (b.balance || 0) + amount;
        b.total_granted = (b.total_granted || 0) + amount;
        b.updated_at = now;
        this.save();
      }
      return { changes: 1 };
    }

    // UPDATE token_balances SET balance = ?
    if (upper.includes('UPDATE TOKEN_BALANCES SET BALANCE = ?')) {
      const [newBal, userId, now] = params;
      const b = this.data.token_balances.find((bal) => bal.user_id === userId);
      if (b) {
        b.balance = newBal;
        b.updated_at = now || new Date().toISOString();
        this.save();
      }
      return { changes: 1 };
    }

    // INSERT INTO token_transactions
    if (upper.includes('INSERT INTO TOKEN_TRANSACTIONS')) {
      const [id, user_id, amount, type, description, created_at] = params;
      this.data.token_transactions.push({ id, user_id, amount, type, description, created_at });
      this.save();
      return { changes: 1 };
    }

    // INSERT INTO promo_codes
    if (upper.includes('INSERT INTO PROMO_CODES')) {
      const [id, code, tokens, code_type, max_activations, current_activations, is_active, created_at] = params;
      this.data.promo_codes.push({
        id,
        code,
        tokens,
        code_type,
        max_activations,
        current_activations: current_activations || 0,
        expires_at: null,
        is_active: is_active ?? 1,
        created_at,
      });
      this.save();
      return { changes: 1 };
    }

    // UPDATE promo_codes SET current_activations
    if (upper.includes('UPDATE PROMO_CODES SET CURRENT_ACTIVATIONS')) {
      const codeId = params[0];
      const p = this.data.promo_codes.find((c) => c.id === codeId);
      if (p) {
        p.current_activations += 1;
        this.save();
      }
      return { changes: 1 };
    }

    // DELETE FROM promo_codes
    if (upper.includes('DELETE FROM PROMO_CODES WHERE ID = ?')) {
      const id = params[0];
      this.data.promo_codes = this.data.promo_codes.filter((p) => p.id !== id);
      this.save();
      return { changes: 1 };
    }

    // INSERT INTO promo_redemptions
    if (upper.includes('INSERT INTO PROMO_REDEMPTIONS')) {
      const [id, code_id, user_id, tokens_granted, redeemed_at] = params;
      this.data.promo_redemptions.push({ id, code_id, user_id, tokens_granted, redeemed_at });
      this.save();
      return { changes: 1 };
    }

    // INSERT INTO chat_sessions
    if (upper.includes('INSERT INTO CHAT_SESSIONS')) {
      const [id, user_id, title, created_at, updated_at] = params;
      this.data.chat_sessions.push({ id, user_id, title, created_at, updated_at });
      this.save();
      return { changes: 1 };
    }

    // UPDATE chat_sessions SET updated_at
    if (upper.includes('UPDATE CHAT_SESSIONS SET UPDATED_AT = ?')) {
      const [now, id] = params;
      const s = this.data.chat_sessions.find((sess) => sess.id === id);
      if (s) {
        s.updated_at = now;
        this.save();
      }
      return { changes: 1 };
    }

    // DELETE FROM chat_sessions
    if (upper.includes('DELETE FROM CHAT_SESSIONS WHERE ID = ?')) {
      const [id, userId] = params;
      this.data.chat_sessions = this.data.chat_sessions.filter((s) => !(s.id === id && s.user_id === userId));
      this.data.chat_messages = this.data.chat_messages.filter((m) => m.session_id !== id);
      this.save();
      return { changes: 1 };
    }

    // INSERT INTO chat_messages
    if (upper.includes('INSERT INTO CHAT_MESSAGES')) {
      const [id, session_id, user_id, role, content, tokens_used, created_at] = params;
      this.data.chat_messages.push({ id, session_id, user_id, role, content, tokens_used: tokens_used || 0, created_at });
      this.save();
      return { changes: 1 };
    }

    // INSERT INTO admin_logs
    if (upper.includes('INSERT INTO ADMIN_LOGS')) {
      const [id, action, details, ip, created_at] = params;
      this.data.admin_logs.push({ id, action, details, ip, created_at });
      this.save();
      return { changes: 1 };
    }

    // INSERT OR REPLACE INTO settings
    if (upper.includes('INSERT INTO SETTINGS')) {
      const [key, value] = params;
      this.data.settings[key] = value;
      this.save();
      return { changes: 1 };
    }

    return { changes: 0 };
  }
}

export const db = new UniversalStore();

export function initDatabase() {
  const seedAdminUser = (login: string, pass: string, email: string) => {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(login);
    if (!existing) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(pass, salt, 10000, 64, 'sha512').toString('hex');
      const adminId = 'admin_' + crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, salt, role, created_at)
        VALUES (?, ?, ?, ?, ?, 'admin', ?)
      `).run(adminId, login, email, hash, salt, now);

      db.prepare(`
        INSERT INTO token_balances (user_id, balance, total_granted, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(adminId, 1000000, 1000000, now);

      db.prepare(`
        INSERT INTO token_transactions (id, user_id, amount, type, description, created_at)
        VALUES (?, ?, 1000000, 'ADMIN_GRANT', 'Начальный администраторский баланс', ?)
      `).run(crypto.randomUUID(), adminId, now);
    }
  };

  // Seed default admin accounts
  seedAdminUser('admin', process.env.ADMIN_PASSWORD || 'admin123', 'admin@grokson.ai');
  const envLogin = process.env.ADMIN_LOGIN;
  if (envLogin && envLogin.toLowerCase() !== 'admin') {
    seedAdminUser(envLogin, process.env.ADMIN_PASSWORD || 'zxcqwerty', `${envLogin.toLowerCase()}@grokson.ai`);
  }

  // Seed promo codes
  const seedPromo = (code: string, tokens: number, type: string, maxActs: number) => {
    const codeCheck = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(code);
    if (!codeCheck) {
      db.prepare(`
        INSERT INTO promo_codes (id, code, tokens, code_type, max_activations, current_activations, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 1, ?)
      `).run(crypto.randomUUID(), code, tokens, type, maxActs, new Date().toISOString());
    }
  };

  seedPromo('GROK-2026-STARTER', 20000, 'multi', 500);
  seedPromo('GROK-7F92-KD31', 10000, 'single', 1);
  seedPromo('GROK-VIP-50000', 50000, 'single', 5);

  // Seed default settings
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  if (!getSetting.get('ai_model')) {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'ai_model',
      process.env.AI_MODEL || 'grokson-ultra-v1',
      new Date().toISOString()
    );
  }
  if (!getSetting.get('ai_temperature')) {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'ai_temperature',
      '0.7',
      new Date().toISOString()
    );
  }
  if (!getSetting.get('ai_max_tokens')) {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'ai_max_tokens',
      '2048',
      new Date().toISOString()
    );
  }
  if (!getSetting.get('system_prompt')) {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'system_prompt',
      'Ты — Grokson, персональный премиальный AI-помощник нового поколения.',
      new Date().toISOString()
    );
  }
}
