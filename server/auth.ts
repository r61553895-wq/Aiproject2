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

const MASTER_SALT = 'grokson_master_hmac_secret_2026_c36c5af2_europe_west1_v1';

export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  // Stable shared deterministic secret across all serverless containers & worker threads
  return MASTER_SALT;
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
  let username = 'user';
  let email: string | null = null;
  let role: 'user' | 'admin' = 'user';

  try {
    const user = db.prepare('SELECT username, email, role FROM users WHERE id = ?').get(userId) as any;
    if (user) {
      username = user.username || username;
      email = user.email || null;
      role = user.role || role;
    } else if (userId.startsWith('admin')) {
      username = 'admin';
      role = 'admin';
    }
  } catch {
    if (userId.startsWith('admin')) {
      username = 'admin';
      role = 'admin';
    }
  }

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload = {
    uid: userId,
    usr: username,
    eml: email,
    rol: role,
    exp: expiresAt,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  const token = `grk.${payloadStr}.${signature}`;

  try {
    const now = new Date();
    db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, userId, now.toISOString(), new Date(expiresAt).toISOString());
  } catch {
    // ignore
  }

  return token;
}

export function deleteSession(token: string) {
  try {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  } catch {
    // ignore
  }
}

export function getUserFromToken(token: string): AuthenticatedUser | null {
  if (!token) return null;

  // 1. Signed token verification (stateless, resilient across Vercel cold starts)
  if (token.startsWith('grk.') && token.split('.').length === 3) {
    const [, payloadStr, signature] = token.split('.');
    const secret = getSessionSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
      if (!payload || !payload.uid || !payload.exp) {
        return null;
      }
      if (Date.now() > payload.exp) {
        return null;
      }

      // Check if user exists in local container DB; if not, reconstitute seamlessly
      let user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(payload.uid) as any;
      if (!user) {
        try {
          db.prepare(`
            INSERT INTO users (id, username, email, password_hash, salt, role, created_at)
            VALUES (?, ?, ?, '', '', ?, ?)
          `).run(
            payload.uid,
            payload.usr || (payload.uid.startsWith('admin') ? 'admin' : 'user'),
            payload.eml || null,
            payload.rol || 'user',
            new Date().toISOString()
          );
        } catch {
          // ignore
        }
        user = {
          id: payload.uid,
          username: payload.usr || (payload.uid.startsWith('admin') ? 'admin' : 'user'),
          email: payload.eml || null,
          role: payload.rol || 'user',
        };
      }

      // Look up current balance
      let balanceRow = db.prepare('SELECT balance FROM token_balances WHERE user_id = ?').get(payload.uid) as any;
      let balance = balanceRow?.balance;
      if (balance === undefined || balance === null) {
        const defaultBal = payload.rol === 'admin' ? 1000000 : 20000;
        try {
          db.prepare(`
            INSERT INTO token_balances (user_id, balance, total_used, updated_at)
            VALUES (?, ?, 0, ?)
          `).run(payload.uid, defaultBal, new Date().toISOString());
        } catch {
          // ignore
        }
        balance = defaultBal;
      }

      return {
        id: payload.uid,
        username: user.username || payload.usr,
        email: user.email || payload.eml || null,
        role: (user.role || payload.rol || 'user') as 'user' | 'admin',
        balance: balance ?? 20000,
      };
    } catch {
      return null;
    }
  }

  // 2. Legacy fallback for old grk_<hex> session tokens
  try {
    const session = db.prepare(`
      SELECT s.user_id, s.expires_at, u.username, u.email, u.role, b.balance
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN token_balances b ON u.id = b.user_id
      WHERE s.token = ?
    `).get(token) as any;

    if (session) {
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
  } catch {
    // ignore
  }

  return null;
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
