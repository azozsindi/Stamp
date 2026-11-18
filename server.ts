import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import adminLoginHandler from './api/admin/login.ts';
import adminLogoutHandler from './api/admin/logout.ts';
import adminSessionHandler from './api/admin/session.ts';
import bannerHandler from './api/banner.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.all('/api/banner', (req, res) => {
    void bannerHandler(req, res);
  });
  app.all('/api/admin/login', (req, res) => {
    void adminLoginHandler(req, res);
  });
  app.all('/api/admin/logout', (req, res) => {
    void adminLogoutHandler(req, res);
  });
  app.all('/api/admin/session', (req, res) => {
    void adminSessionHandler(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

void startServer();
