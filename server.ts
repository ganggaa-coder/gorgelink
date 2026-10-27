import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { api } from './lib/downr.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Support port and host arguments passed by AI Studio runner
  const portArgIndex = process.argv.indexOf('--port');
  const portFromArg = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : null;
  const PORT = portFromArg || 3000;

  const hostArgIndex = process.argv.indexOf('--host');
  const hostFromArg = hostArgIndex !== -1 ? process.argv[hostArgIndex + 1] : '0.0.0.0';

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API download routes
  app.get('/api/download', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ Status: false, Error: 'URL is required' });
      }

      const result = await api.download(url);
      res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
      return res.json({ Status: true, Result: result });
    } catch (error: any) {
      return res.status(500).json({
        Status: false,
        Error: error.message || 'Failed to process request',
      });
    }
  });

  app.post('/api/download', async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!url) {
        return res.status(400).json({ Status: false, Error: 'URL is required' });
      }

      const result = await api.download(url);
      return res.json({ Status: true, Result: result });
    } catch (error: any) {
      return res.status(500).json({
        Status: false,
        Error: error.message || 'Failed to process request',
      });
    }
  });

  // Direct media download proxy to bypass CORS / force file download
  app.get('/api/stream', async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      const filename = (req.query.filename as string) || 'downloaded-media.mp4';
      if (!targetUrl) {
        return res.status(400).send('URL is required');
      }

      const response = await fetch(targetUrl, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          referer: targetUrl.includes('tiktok') ? 'https://www.tiktok.com/' : 'https://www.google.com/',
        },
      });

      if (!response.ok) {
        return res.redirect(targetUrl);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (e: any) {
      console.error('Proxy stream error:', e);
      return res.status(500).send('Streaming error');
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'GorgeLink API', timestamp: new Date().toISOString() });
  });

  // In development, hook up Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built assets from dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, hostFromArg, () => {
    console.log(`\n  VITE v8.3.5  ready in 120 ms\n\n  ➜  Local:   http://localhost:${PORT}/\n  ➜  Network: http://${hostFromArg}:${PORT}/\n`);
  });
}

startServer();
