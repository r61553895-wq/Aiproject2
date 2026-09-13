import express from 'express';
import cors from 'cors';
import { initDatabase } from './db.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import tokensRouter from './routes/tokens.js';
import adminRouter from './routes/admin.js';

let dbInitialized = false;
function ensureDb() {
  if (!dbInitialized) {
    initDatabase();
    dbInitialized = true;
  }
}

export function createApp() {
  ensureDb();
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-grokson-token', 'X-Requested-With'],
    })
  );

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Basic in-memory rate limiter
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  app.use('/api/', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + 60000 };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + 60000;
    }

    entry.count += 1;
    rateLimitMap.set(ip, entry);

    if (entry.count > 120) {
      res.status(429).json({ error: 'Слишком много запросов. Пожалуйста, подождите минуту.', code: 'RATE_LIMIT' });
      return;
    }

    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'GROKSON Core API', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/tokens', tokensRouter);
  app.use('/api', chatRouter);
  app.use('/api/admin', adminRouter);

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'SERVER_ERROR' });
  });

  return app;
}
