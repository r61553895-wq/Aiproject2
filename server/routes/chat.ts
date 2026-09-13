import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';
import { generateAiResponse, estimateTokens } from '../ai-provider';

const router = Router();

// List user's chats
router.get('/chats', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const chats = db.prepare(`
      SELECT s.id, s.title, s.created_at, s.updated_at,
             COUNT(m.id) as message_count
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON s.id = m.session_id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.updated_at DESC
      LIMIT 100
    `).all(userId);

    res.json({ chats });
  } catch (err: any) {
    console.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Не удалось загрузить историю бесед' });
  }
});

// Create new chat session
router.post('/chats', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const title = (req.body?.title && String(req.body.title).trim()) || 'Новый диалог';
    const id = 'chat_' + crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, title, now, now);

    res.status(201).json({
      chat: {
        id,
        title,
        created_at: now,
        updated_at: now,
        message_count: 0,
      },
    });
  } catch (err: any) {
    console.error('Error creating chat:', err);
    res.status(500).json({ error: 'Не удалось создать новый диалог' });
  }
});

// Get messages for a chat session
router.get('/chats/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const chatId = req.params.id;

    const chat = db.prepare('SELECT id, title FROM chat_sessions WHERE id = ? AND user_id = ?').get(chatId, userId) as any;
    if (!chat) {
      res.status(404).json({ error: 'Диалог не найден' });
      return;
    }

    const messages = db.prepare(`
      SELECT id, role, content, tokens_used, created_at
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(chatId);

    res.json({ chat, messages });
  } catch (err: any) {
    console.error('Error getting chat messages:', err);
    res.status(500).json({ error: 'Не удалось загрузить сообщения' });
  }
});

// Rename chat session
router.put('/chats/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const chatId = req.params.id;
    const title = req.body?.title && String(req.body.title).trim();

    if (!title) {
      res.status(400).json({ error: 'Укажите новое название диалога' });
      return;
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE chat_sessions
      SET title = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(title, now, chatId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Диалог не найден' });
      return;
    }

    res.json({ success: true, title });
  } catch (err: any) {
    console.error('Error renaming chat:', err);
    res.status(500).json({ error: 'Не удалось переименовать диалог' });
  }
});

// Delete chat session
router.delete('/chats/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const chatId = req.params.id;

    db.prepare('DELETE FROM chat_messages WHERE session_id = ? AND user_id = ?').run(chatId, userId);
    const result = db.prepare('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?').run(chatId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Диалог не найден' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ error: 'Не удалось удалить диалог' });
  }
});

// Post message to AI & get reply
router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { message, sessionId: providedSessionId } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Сообщение не может быть пустым' });
      return;
    }

    if (message.length > 8000) {
      res.status(400).json({ error: 'Сообщение превышает допустимый размер (максимум 8 000 символов)' });
      return;
    }

    // 1. STRICT SERVER-SIDE TOKEN BALANCE CHECK
    const balanceRow = db.prepare('SELECT balance, total_used FROM token_balances WHERE user_id = ?').get(userId) as any;
    const currentBalance = balanceRow?.balance ?? 0;

    if (currentBalance <= 0) {
      res.status(403).json({
        error: 'Лимит закончился',
        code: 'TOKENS_EXHAUSTED',
        balance: 0,
        message: 'Ваш бесплатный лимит 20 000 токенов был использован.',
      });
      return;
    }

    const now = new Date().toISOString();
    let sessionId = providedSessionId;

    // Verify or create session
    if (sessionId) {
      const existingSession = db.prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
      if (!existingSession) {
        sessionId = undefined;
      }
    }

    if (!sessionId) {
      sessionId = 'chat_' + crypto.randomUUID();
      // Generate preview title from first message
      const snippet = message.trim().slice(0, 35);
      const title = snippet.length < message.trim().length ? snippet + '...' : snippet;
      db.prepare(`
        INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, userId, title, now, now);
    }

    // Save user message
    const userMsgId = 'msg_' + crypto.randomUUID();
    const promptTokensEst = estimateTokens(message);
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, user_id, role, content, tokens_used, created_at)
      VALUES (?, ?, ?, 'user', ?, ?, ?)
    `).run(userMsgId, sessionId, userId, message.trim(), promptTokensEst, now);

    // Retrieve conversation history for context (last 12 messages)
    const historyRows = db.prepare(`
      SELECT role, content
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT 12
    `).all(sessionId) as { role: 'user' | 'assistant' | 'system'; content: string }[];

    // 2. CALL AI PROVIDER (Abstraction)
    let aiResult;
    try {
      aiResult = await generateAiResponse(historyRows);
    } catch (aiErr: any) {
      console.error('AI provider error:', aiErr);
      res.status(502).json({
        error: aiErr?.message || 'Не удалось получить ответ от AI сервиса. Попробуйте ещё раз.',
        code: 'AI_ERROR',
      });
      return;
    }

    const actualTokensUsed = Math.max(5, aiResult.tokensUsed);
    const newBalance = Math.max(0, currentBalance - actualTokensUsed);
    const newTotalUsed = (balanceRow?.total_used ?? 0) + actualTokensUsed;

    // 3. ATOMICALLY DEDUCT TOKENS ON SERVER
    db.prepare(`
      UPDATE token_balances
      SET balance = ?, total_used = ?, updated_at = ?
      WHERE user_id = ?
    `).run(newBalance, newTotalUsed, now, userId);

    // 4. RECORD AUDIT TRANSACTION
    db.prepare(`
      INSERT INTO token_transactions (id, user_id, amount, type, description, created_at)
      VALUES (?, ?, ?, 'AI_USAGE', ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      -actualTokensUsed,
      `Запрос к AI (${aiResult.model})`,
      now
    );

    // Save assistant message
    const assistantMsgId = 'msg_' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, user_id, role, content, tokens_used, created_at)
      VALUES (?, ?, ?, 'assistant', ?, ?, ?)
    `).run(assistantMsgId, sessionId, userId, aiResult.content, actualTokensUsed, now);

    // Touch chat session updated_at
    db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

    res.json({
      reply: aiResult.content,
      tokensUsed: actualTokensUsed,
      balance: newBalance,
      sessionId,
      messageId: assistantMsgId,
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка при обработке сообщения' });
  }
});

export default router;
