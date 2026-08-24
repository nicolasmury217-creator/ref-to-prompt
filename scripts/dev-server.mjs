// Local dev-only server: mounts api/analyze.ts on top of Vite's middleware,
// so /api routes can be tested without `vercel login` / project linking.
// Production still deploys through Vercel's zero-config Vite + api/ detection.
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer, loadEnv } from 'vite';

const root = process.cwd();
const env = loadEnv('development', root, '');
Object.assign(process.env, env);

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });

const API_ROUTES = {
  '/api/analyze': '/api/analyze.ts',
};

const server = createHttpServer(async (req, res) => {
  const modulePath = req.url && API_ROUTES[req.url.split('?')[0]];

  if (modulePath && req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf-8')) : {};
    } catch {
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'Corps JSON invalide' }));
      return;
    }

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(data));
    };

    try {
      const { default: handler } = await vite.ssrLoadModule(modulePath);
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: (err instanceof Error ? err.message : String(err)) }));
    }
    return;
  }

  vite.middlewares(req, res);
});

const port = Number(process.env.PORT) || 3210;
server.listen(port, () => {
  console.log(`dev-server (vite + api/analyze) sur http://localhost:${port}`);
});
