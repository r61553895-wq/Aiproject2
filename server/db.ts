import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'data')
  : path.resolve(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}

const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'grokson.db');
export const db = new DatabaseSync(DB_PATH);

// Initialize database tables
export function initDatabase() {
  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL
    );
  `);

  // Sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // Token Balances
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_balances (
      user_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 20000,
      total_used INTEGER NOT NULL DEFAULT 0,
      total_granted INTEGER NOT NULL DEFAULT 20000,
      updated_at TEXT NOT NULL
    );
  `);

  // Token Transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Promo Codes
  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      tokens INTEGER NOT NULL,
      code_type TEXT NOT NULL DEFAULT 'single',
      max_activations INTEGER NOT NULL DEFAULT 1,
      current_activations INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  // Promo Redemptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id TEXT PRIMARY KEY,
      code_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tokens_granted INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL
    );
  `);

  // Chat Sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Chat Messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Admin Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default settings if not exists
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
      'Ты — Grokson, персональный премиальный AI-помощник нового поколения. Ты всегда онлайн, отвечаешь точно, полезно, дружелюбно и технологично. Помогаешь пользователю с кодом, текстами, расчётами, идеями и сложными задачами.',
      new Date().toISOString()
    );
  }

  // Seed default admin if no admin exists
  const adminCheck = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminCheck) {
    const adminLogin = process.env.ADMIN_LOGIN || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(adminPass, salt, 10000, 64, 'sha512').toString('hex');
    const adminId = 'admin_' + crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, salt, role, created_at)
      VALUES (?, ?, ?, ?, ?, 'admin', ?)
    `).run(adminId, adminLogin, 'admin@grokson.ai', hash, salt, now);

    db.prepare(`
      INSERT INTO token_balances (user_id, balance, total_used, total_granted, updated_at)
      VALUES (?, 1000000, 0, 1000000, ?)
    `).run(adminId, now);

    db.prepare(`
      INSERT INTO token_transactions (id, user_id, amount, type, description, created_at)
      VALUES (?, ?, 1000000, 'ADMIN_GRANT', 'Начальный администраторский баланс', ?)
    `).run(crypto.randomUUID(), adminId, now);

    // Also seed a couple of ready-to-use demo promo codes
    const seedPromo = (code: string, tokens: number, type: string, maxActs: number) => {
      const codeCheck = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(code);
      if (!codeCheck) {
        db.prepare(`
          INSERT INTO promo_codes (id, code, tokens, code_type, max_activations, current_activations, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, 0, 1, ?)
        `).run(crypto.randomUUID(), code, tokens, type, maxActs, now);
      }
    };

    seedPromo('GROK-2026-STARTER', 20000, 'multi', 500);
    seedPromo('GROK-7F92-KD31', 10000, 'single', 1);
    seedPromo('GROK-VIP-50000', 50000, 'single', 5);
  }
}
