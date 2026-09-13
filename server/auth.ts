import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string | null;
  role: 'user' | 'admin';
  balance: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'session_secret'").get() as any;
    if (row?.value) {
      return row.value;
    }
    const autoSecret = crypto.randomBytes(32).toString('hex');
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('session_secret', ?, ?)").run(
      autoSecret,
      new Date().toISOString()
    );
    return autoSecret;
  } catch {
    return 'grokson_fallback_secret_32_bytes_random';
  }
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const bufA = Buffer.from(hash, 'hex');
    const bufB = Buffer.from(expectedHash, 'hex');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function createSession(userId: string): string {
  const secret = getSessionSecret();
  const signature = crypto.createHmac('sha256', secret).update(userId + ':' + Date.now() + ':' + crypto.randomBytes(16).toString('hex')).digest('hex');
  const token = 'grk_' + signature;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, now.toISOString(), expiresAt.toISOString());

  return token;
}

export function deleteSession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getUserFromToken(token: string): AuthenticatedUser | null {
  if (!token) return null;

  const session = db.prepare(`
    SELECT s.user_id, s.expires_at, u.username, u.email, u.role, b.balance
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN token_balances b ON u.id = b.user_id
    WHERE s.token = ?
  `).get(token) as any;

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }

  return {
    id: session.user_id,
    username: session.username,
    email: session.email,
    role: session.role || 'user',
    balance: session.balance ?? 0,
  };
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-grokson-token']) {
    return String(req.headers['x-grokson-token']).trim();
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Необходима авторизация', code: 'UNAUTHORIZED' });
    return;
  }

  const user = getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Сессия истекла или недействительна', code: 'INVALID_SESSION' });
    return;
  }

  req.user = user;
  req.token = token;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Доступ запрещён: отсутствует токен администратора', code: 'UNAUTHORIZED' });
    return;
  }

  const user = getUserFromToken(token);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Доступ запрещён: требуются права администратора', code: 'FORBIDDEN' });
    return;
  }

  req.user = user;
  req.token = token;
  next();
}
