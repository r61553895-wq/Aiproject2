import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';

const router = Router();

// Get token details & transactions
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;

    const balanceRow = db.prepare(`
      SELECT balance, total_used, total_granted, updated_at
      FROM token_balances
      WHERE user_id = ?
    `).get(userId) as any;

    const transactions = db.prepare(`
      SELECT id, amount, type, description, created_at
      FROM token_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    res.json({
      balance: balanceRow?.balance ?? 0,
      totalUsed: balanceRow?.total_used ?? 0,
      totalGranted: balanceRow?.total_granted ?? 0,
      transactions,
    });
  } catch (err: any) {
    console.error('Error fetching tokens:', err);
    res.status(500).json({ error: 'Не удалось загрузить данные о токенах' });
  }
});

// Redeem promo code
router.post('/redeem', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { code } = req.body || {};

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Пожалуйста, введите промокод' });
      return;
    }

    const cleanCode = code.trim().toUpperCase();

    // Check code in database
    const promo = db.prepare(`
      SELECT id, code, tokens, code_type, max_activations, current_activations, expires_at, is_active
      FROM promo_codes
      WHERE UPPER(code) = ?
    `).get(cleanCode) as any;

    if (!promo || promo.is_active === 0) {
      res.status(404).json({ error: 'Код недействителен.' });
      return;
    }

    // Check expiration
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Срок действия промокода истёк.' });
      return;
    }

    // Check activations limit
    if (promo.current_activations >= promo.max_activations) {
      res.status(400).json({ error: 'Лимит активаций для этого кода исчерпан.' });
      return;
    }

    // Check if user already redeemed this code
    const alreadyRedeemed = db.prepare(`
      SELECT id FROM promo_redemptions
      WHERE code_id = ? AND user_id = ?
    `).get(promo.id, userId);

    if (alreadyRedeemed) {
      res.status(400).json({ error: 'Этот код уже использован.' });
      return;
    }

    const now = new Date().toISOString();

    // Update promo activations
    db.prepare(`
      UPDATE promo_codes
      SET current_activations = current_activations + 1
      WHERE id = ?
    `).run(promo.id);

    // Record redemption
    db.prepare(`
      INSERT INTO promo_redemptions (id, code_id, user_id, tokens_granted, redeemed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), promo.id, userId, promo.tokens, now);

    // Update user balance
    db.prepare(`
      UPDATE token_balances
      SET balance = balance + ?, total_granted = total_granted + ?, updated_at = ?
      WHERE user_id = ?
    `).run(promo.tokens, promo.tokens, now, userId);

    // Log transaction
    db.prepare(`
      INSERT INTO token_transactions (id, user_id, amount, type, description, created_at)
      VALUES (?, ?, ?, 'PROMO_CODE', ?, ?)
    `).run(crypto.randomUUID(), userId, promo.tokens, `Активация кода ${promo.code}`, now);

    // Get fresh balance
    const updated = db.prepare('SELECT balance FROM token_balances WHERE user_id = ?').get(userId) as any;

    res.json({
      success: true,
      tokensAdded: promo.tokens,
      newBalance: updated?.balance ?? 0,
      message: `Успешно начислено ${promo.tokens.toLocaleString('ru-RU')} токенов!`,
    });
  } catch (err: any) {
    console.error('Error redeeming promo code:', err);
    res.status(500).json({ error: 'Ошибка при активации кода' });
  }
});

export default router;
