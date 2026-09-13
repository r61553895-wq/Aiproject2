import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db';
import {
  requireAdmin,
  createSession,
  verifyPassword,
  hashPassword,
  AuthenticatedRequest,
} from '../auth';
import {
  testAiConnection,
  getSettingValue,
  setSettingValue,
  autoDetectProviderAndModel,
} from '../ai-provider';

const router = Router();

// Admin Login
router.post('/login', (req, res): void => {
  try {
    const { login, password } = req.body || {};

    if (!login || !password) {
      res.status(400).json({ error: 'Укажите логин и пароль администратора' });
      return;
    }

    const cleanLogin = String(login).trim().toLowerCase();

    // Check in users table with role 'admin'
    const adminUser = db.prepare(`
      SELECT u.id, u.username, u.email, u.password_hash, u.salt, u.role
      FROM users u
      WHERE (u.username = ? OR u.email = ?) AND u.role = 'admin'
    `).get(cleanLogin, cleanLogin) as any;

    if (!adminUser) {
      // Also check against process.env ADMIN_LOGIN and ADMIN_PASSWORD
      const envLogin = (process.env.ADMIN_LOGIN || 'admin').toLowerCase();
      const envPass = process.env.ADMIN_PASSWORD || 'admin123';
      if (cleanLogin === envLogin && password === envPass) {
        // Create an ephemeral admin user in db if needed
        const existingEnvAdmin = db.prepare("SELECT id FROM users WHERE username = ? AND role = 'admin'").get(envLogin) as any;
        let adminId = existingEnvAdmin?.id;
        if (!adminId) {
          adminId = 'admin_' + crypto.randomUUID();
          const { hash, salt } = { hash: 'env_admin', salt: 'env_salt' };
          db.prepare(`
            INSERT INTO users (id, username, email, password_hash, salt, role, created_at)
            VALUES (?, ?, 'admin@grokson.ai', ?, ?, 'admin', ?)
          `).run(adminId, envLogin, hash, salt, new Date().toISOString());
        }
        const token = createSession(adminId);
        res.json({ token, role: 'admin', username: envLogin });
        return;
      }

      res.status(401).json({ error: 'Неверные учетные данные администратора' });
      return;
    }

    const isValid = verifyPassword(password, adminUser.salt, adminUser.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Неверные учетные данные администратора' });
      return;
    }

    const token = createSession(adminUser.id);

    // Log admin access
    db.prepare(`
      INSERT INTO admin_logs (id, action, details, ip, created_at)
      VALUES (?, 'ADMIN_LOGIN', 'Вход в панель управления', ?, ?)
    `).run(crypto.randomUUID(), req.ip || '127.0.0.1', new Date().toISOString());

    res.json({
      token,
      role: 'admin',
      username: adminUser.username,
      id: adminUser.id,
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

// Dashboard Statistics
router.get('/stats', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const totalUsersRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin'").get() as any;
    const totalAdminsRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any;

    const totalTokensRow = db.prepare(`
      SELECT SUM(balance) as total_balance,
             SUM(total_used) as total_used,
             SUM(total_granted) as total_granted
      FROM token_balances
    `).get() as any;

    const totalRequestsRow = db.prepare("SELECT COUNT(*) as count FROM chat_messages WHERE role = 'assistant'").get() as any;
    const totalSessionsRow = db.prepare('SELECT COUNT(*) as count FROM chat_sessions').get() as any;
    const totalPromoRow = db.prepare('SELECT COUNT(*) as count, SUM(current_activations) as acts FROM promo_codes').get() as any;

    // Active users in last 7 days
    const activeUsersRow = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM chat_messages
      WHERE created_at >= datetime('now', '-7 days')
    `).get() as any;

    // Recent 7 days chart data
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const usageRow = db.prepare(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as used
        FROM token_transactions
        WHERE type = 'AI_USAGE' AND date(created_at) = date(?)
      `).get(dateStr) as any;

      const requestsRow = db.prepare(`
        SELECT COUNT(*) as requests
        FROM chat_messages
        WHERE role = 'user' AND date(created_at) = date(?)
      `).get(dateStr) as any;

      chartData.push({
        date: dateStr.slice(5),
        tokensUsed: usageRow?.used ?? 0,
        requests: requestsRow?.requests ?? 0,
      });
    }

    res.json({
      totalUsers: totalUsersRow?.count ?? 0,
      activeUsers: Math.max(1, activeUsersRow?.count ?? 0),
      tokensUsed: totalTokensRow?.total_used ?? 0,
      tokensGranted: totalTokensRow?.total_granted ?? 0,
      currentOutstandingBalance: totalTokensRow?.total_balance ?? 0,
      totalRequests: totalRequestsRow?.count ?? 0,
      totalSessions: totalSessionsRow?.count ?? 0,
      promoCount: totalPromoRow?.count ?? 0,
      promoRedemptions: totalPromoRow?.acts ?? 0,
      apiErrors: 0,
      chartData,
    });
  } catch (err: any) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Не удалось загрузить статистику' });
  }
});

// List Users
router.get('/users', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.created_at,
             b.balance, b.total_used, b.total_granted,
             (SELECT COUNT(*) FROM chat_sessions WHERE user_id = u.id) as sessions_count
      FROM users u
      LEFT JOIN token_balances b ON u.id = b.user_id
      ORDER BY u.created_at DESC
      LIMIT 100
    `).all();

    res.json({ users });
  } catch (err: any) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Не удалось загрузить список пользователей' });
  }
});

// Grant Tokens to User manually
router.post('/users/:id/tokens', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const targetUserId = req.params.id;
    const amount = parseInt(req.body?.amount, 10);
    const reason = req.body?.reason || 'Ручное начисление администратором';

    if (!amount || isNaN(amount) || amount === 0) {
      res.status(400).json({ error: 'Укажите корректное количество токенов' });
      return;
    }

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetUserId) as any;
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE token_balances
      SET balance = balance + ?, total_granted = total_granted + ?, updated_at = ?
      WHERE user_id = ?
    `).run(amount, amount > 0 ? amount : 0, now, targetUserId);

    db.prepare(`
      INSERT INTO token_transactions (id, user_id, amount, type, description, created_at)
      VALUES (?, ?, ?, 'ADMIN_GRANT', ?, ?)
    `).run(crypto.randomUUID(), targetUserId, amount, reason, now);

    db.prepare(`
      INSERT INTO admin_logs (id, action, details, ip, created_at)
      VALUES (?, 'GRANT_TOKENS', ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      `Начислено ${amount} токенов пользователю ${user.username}`,
      req.ip || '127.0.0.1',
      now
    );

    const updated = db.prepare('SELECT balance FROM token_balances WHERE user_id = ?').get(targetUserId) as any;

    res.json({
      success: true,
      newBalance: updated?.balance ?? 0,
      message: `Пользователю ${user.username} успешно начислено ${amount.toLocaleString('ru-RU')} токенов`,
    });
  } catch (err: any) {
    console.error('Grant tokens error:', err);
    res.status(500).json({ error: 'Не удалось начислить токены' });
  }
});

// List Promo Codes
router.get('/codes', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const codes = db.prepare(`
      SELECT id, code, tokens, code_type, max_activations, current_activations,
             expires_at, is_active, created_at
      FROM promo_codes
      ORDER BY created_at DESC
    `).all();

    res.json({ codes });
  } catch (err: any) {
    console.error('Admin codes error:', err);
    res.status(500).json({ error: 'Не удалось загрузить список промокодов' });
  }
});

// Helper to generate promo code format GROK-XXXX-XXXX
function generatePromoCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars[Math.floor(Math.random() * chars.length)];
    p2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GROK-${p1}-${p2}`;
}

// Create Promo Code
router.post('/codes', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const {
      tokens = 20000,
      codeType = 'single',
      maxActivations = 1,
      expiresDays = null,
      customCode = null,
    } = req.body || {};

    const tokenAmount = parseInt(tokens, 10);
    if (!tokenAmount || tokenAmount <= 0) {
      res.status(400).json({ error: 'Укажите положительное количество токенов' });
      return;
    }

    let code = customCode && typeof customCode === 'string' ? customCode.trim().toUpperCase() : generatePromoCodeString();
    if (!code.startsWith('GROK-')) {
      code = 'GROK-' + code;
    }

    // Check duplicate
    const existing = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(code);
    if (existing) {
      code = generatePromoCodeString();
    }

    let expiresAt: string | null = null;
    if (expiresDays && parseInt(expiresDays, 10) > 0) {
      const expDate = new Date(Date.now() + parseInt(expiresDays, 10) * 86400000);
      expiresAt = expDate.toISOString();
    }

    const id = 'promo_' + crypto.randomUUID();
    const now = new Date().toISOString();
    const activationsLimit = codeType === 'single' ? 1 : Math.max(1, parseInt(maxActivations, 10) || 100);

    db.prepare(`
      INSERT INTO promo_codes (id, code, tokens, code_type, max_activations, current_activations, expires_at, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?)
    `).run(id, code, tokenAmount, codeType, activationsLimit, expiresAt, now);

    db.prepare(`
      INSERT INTO admin_logs (id, action, details, ip, created_at)
      VALUES (?, 'CREATE_PROMO', ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      `Создан промокод ${code} на ${tokenAmount} токенов (${codeType})`,
      req.ip || '127.0.0.1',
      now
    );

    res.status(201).json({
      success: true,
      promo: {
        id,
        code,
        tokens: tokenAmount,
        code_type: codeType,
        max_activations: activationsLimit,
        current_activations: 0,
        expires_at: expiresAt,
        is_active: 1,
        created_at: now,
      },
    });
  } catch (err: any) {
    console.error('Create promo error:', err);
    res.status(500).json({ error: 'Не удалось создать промокод' });
  }
});

// Delete or Deactivate Promo Code
router.delete('/codes/:id', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const codeId = req.params.id;
    const promo = db.prepare('SELECT code FROM promo_codes WHERE id = ?').get(codeId) as any;

    if (!promo) {
      res.status(404).json({ error: 'Промокод не найден' });
      return;
    }

    db.prepare('DELETE FROM promo_codes WHERE id = ?').run(codeId);

    db.prepare(`
      INSERT INTO admin_logs (id, action, details, ip, created_at)
      VALUES (?, 'DELETE_PROMO', ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      `Удалён промокод ${promo.code}`,
      req.ip || '127.0.0.1',
      new Date().toISOString()
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete promo error:', err);
    res.status(500).json({ error: 'Не удалось удалить промокод' });
  }
});

// Get AI Settings
router.get('/settings', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const rawKey = getSettingValue('ai_api_key') || process.env.AI_API_KEY || (process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? process.env.GEMINI_API_KEY : '') || '';
    const maskedKey = rawKey ? '••••••••••••••••' + (rawKey.length > 8 ? rawKey.slice(-4) : '') : '';
    const { provider, model: detectedModel } = autoDetectProviderAndModel(rawKey);

    const providerNames: Record<string, string> = {
      gemini: 'Google Gemini AI',
      openai: 'OpenAI API',
      gigachat: 'Сбер GigaChat',
      internal: 'Grokson Neural Core (Встроенный)',
    };

    const savedModel = getSettingValue('ai_model');
    const displayModel = savedModel && savedModel !== 'auto' ? savedModel : detectedModel;

    res.json({
      provider: providerNames[provider] || provider,
      model: displayModel,
      maskedApiKey: maskedKey,
      hasApiKey: Boolean(rawKey),
      temperature: parseFloat(getSettingValue('ai_temperature', '0.7')),
      maxTokens: parseInt(getSettingValue('ai_max_tokens', '2048'), 10),
      systemPrompt: getSettingValue('system_prompt', 'Ты — Grokson, персональный премиальный AI-помощник.'),
      rateLimitMax: 60,
      sessionLifetimeDays: 30,
    });
  } catch (err: any) {
    console.error('Admin get settings error:', err);
    res.status(500).json({ error: 'Не удалось загрузить настройки' });
  }
});

// Update AI Settings
router.post('/settings', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { apiKey, model, temperature, maxTokens, systemPrompt } = req.body || {};

    if (apiKey !== undefined && typeof apiKey === 'string' && apiKey.trim().length > 0 && !apiKey.includes('••••')) {
      setSettingValue('ai_api_key', apiKey.trim());
    }

    if (model && typeof model === 'string') {
      setSettingValue('ai_model', model.trim());
    }

    if (temperature !== undefined) {
      setSettingValue('ai_temperature', String(temperature));
    }

    if (maxTokens !== undefined) {
      setSettingValue('ai_max_tokens', String(maxTokens));
    }

    if (systemPrompt && typeof systemPrompt === 'string') {
      setSettingValue('system_prompt', systemPrompt.trim());
    }

    db.prepare(`
      INSERT INTO admin_logs (id, action, details, ip, created_at)
      VALUES (?, 'UPDATE_SETTINGS', 'Обновлены настройки AI и генерации', ?, ?)
    `).run(crypto.randomUUID(), req.ip || '127.0.0.1', new Date().toISOString());

    res.json({ success: true, message: 'Настройки успешно сохранены на сервере' });
  } catch (err: any) {
    console.error('Admin update settings error:', err);
    res.status(500).json({ error: 'Не удалось сохранить настройки' });
  }
});

// Test AI Connection
router.post('/api-test', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await testAiConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      status: 'offline',
      latencyMs: 0,
      provider: 'Internal AI Provider',
      model: 'unknown',
      response: '',
      error: err?.message || 'Тест подключения завершился с ошибкой',
    });
  }
});

// Audit Logs
router.get('/logs', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const logs = db.prepare(`
      SELECT id, action, details, ip, created_at
      FROM admin_logs
      ORDER BY created_at DESC
      LIMIT 100
    `).all();

    res.json({ logs });
  } catch (err: any) {
    console.error('Admin logs error:', err);
    res.status(500).json({ error: 'Не удалось загрузить журнал действий' });
  }
});

// Change Admin Password
router.post('/change-password', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
      return;
    }

    const { hash, salt } = hashPassword(String(newPassword));
    db.prepare(`
      UPDATE users SET password_hash = ?, salt = ? WHERE id = ?
    `).run(hash, salt, req.user!.id);

    db.prepare(`
      INSERT INTO admin_logs (id, action, details, ip, created_at)
      VALUES (?, 'CHANGE_PASSWORD', 'Пароль администратора успешно изменен', ?, ?)
    `).run(crypto.randomUUID(), req.ip || '127.0.0.1', new Date().toISOString());

    res.json({ success: true, message: 'Пароль администратора успешно изменен' });
  } catch (err: any) {
    console.error('Admin change password error:', err);
    res.status(500).json({ error: 'Не удалось изменить пароль' });
  }
});

// Token Transactions List (for Tokens tab)
router.get('/transactions', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const transactions = db.prepare(`
      SELECT t.id, t.user_id, u.username, t.amount, t.type, t.description, t.created_at
      FROM token_transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 150
    `).all();

    res.json({ transactions });
  } catch (err: any) {
    console.error('Admin transactions error:', err);
    res.status(500).json({ error: 'Не удалось загрузить историю транзакций' });
  }
});

export default router;
