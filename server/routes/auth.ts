import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db';
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  requireAuth,
  extractToken,
  getUserFromToken,
  AuthenticatedRequest,
} from '../auth';

const router = Router();

// Register new user
router.post('/register', (req, res): void => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      res.status(400).json({ error: 'Имя пользователя должно содержать не менее 3 символов' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email && typeof email === 'string' ? email.trim().toLowerCase() : null;

    // Check existing
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)').get(cleanUsername, cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'Пользователь с таким именем или email уже зарегистрирован' });
      return;
    }

    const userId = 'usr_' + crypto.randomUUID();
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    // Insert user
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, salt, role, created_at)
      VALUES (?, ?, ?, ?, ?, 'user', ?)
    `).run(userId, cleanUsername, cleanEmail, hash, salt, now);

    // Initial 20,000 free tokens
    const INITIAL_TOKENS = 20000;
    db.prepare(`
      INSERT INTO token_balances (user_id, balance, total_used, total_granted, updated_at)
      VALUES (?, ?, 0, ?, ?)
    `).run(userId, INITIAL_TOKENS, INITIAL_TOKENS, now);

    // Log transaction
    db.prepare(`
      INSERT INTO token_transactions (id, user_id, amount, type, description, created_at)
      VALUES (?, ?, ?, 'INITIAL_FREE', 'Бесплатные токены при регистрации', ?)
    `).run(crypto.randomUUID(), userId, INITIAL_TOKENS, now);

    // Create session
    const token = createSession(userId);

    res.status(201).json({
      user: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        role: 'user',
        balance: INITIAL_TOKENS,
      },
      token,
      message: 'Регистрация успешна. Вам начислено 20 000 бесплатных токенов!',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка при регистрации' });
  }
});

// Login
router.post('/login', (req, res): void => {
  try {
    const { username, login, password } = req.body || {};
    const userIdentifier = username || login;

    if (!userIdentifier || !password) {
      res.status(400).json({ error: 'Укажите имя пользователя и пароль' });
      return;
    }

    const cleanInput = String(userIdentifier).trim().toLowerCase();

    const user = db.prepare(`
      SELECT u.id, u.username, u.email, u.password_hash, u.salt, u.role, b.balance
      FROM users u
      LEFT JOIN token_balances b ON u.id = b.user_id
      WHERE u.username = ? OR u.email = ?
    `).get(cleanInput, cleanInput) as any;

    if (!user) {
      res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      return;
    }

    const isValid = verifyPassword(password, user.salt, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      return;
    }

    const token = createSession(user.id);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance ?? 0,
      },
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Logout
router.post('/logout', (req, res): void => {
  const token = extractToken(req);
  if (token) {
    deleteSession(token);
  }
  res.json({ success: true });
});

// Get Current User
router.get('/user', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }

  // Refresh balance from DB
  const balanceRow = db.prepare('SELECT balance FROM token_balances WHERE user_id = ?').get(req.user.id) as any;
  const currentBalance = balanceRow?.balance ?? 0;

  res.json({
    user: {
      ...req.user,
      balance: currentBalance,
    },
  });
});

export default router;
