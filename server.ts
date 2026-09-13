import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db';
import authRouter from './server/routes/auth';
import chatRouter from './server/routes/chat';
import tokensRouter from './server/routes/tokens';
import adminRouter from './server/routes/admin';

async function startServer() {
  // Initialize Database
  initDatabase();

  const app = express();
  const PORT = 3000;

  // Permissive CORS that automatically works with GitHub Pages, Cloud Run, localhost and all web clients
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

  // Basic in-memory rate limiter per IP to prevent spam (60 requests per minute for chat, 120 general)
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

  // Vite middleware for development vs static for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GROKSON Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
