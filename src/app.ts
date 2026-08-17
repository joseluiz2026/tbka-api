import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { requireApiKey, requireIdentifyScope } from './lib/auth';
import recordsRoutes from './routes/records';
import identifyRoutes from './routes/identify';

// Payload maior que o padrão do Fastify (1MB) para caber até 5 fotos em
// base64 no /v1/identify. Atenção: a Vercel também limita o corpo da
// requisição em funções serverless (hoje 4.5MB) — ver README.
const BODY_LIMIT_BYTES = 20 * 1024 * 1024;

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
    bodyLimit: BODY_LIMIT_BYTES,
  });

  app.register(cors, { origin: true });

  app.get('/', async () => ({
    service: 'TB Knowledge Agro API',
    status: 'ok',
    version: 'v1',
  }));

  app.get('/v1/health', async () => ({ status: 'ok' }));

  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', requireApiKey);
    protectedApp.register(recordsRoutes);

    protectedApp.register(async (identifyApp) => {
      identifyApp.addHook('preHandler', requireIdentifyScope);
      identifyApp.register(identifyRoutes);
    });
  });

  return app;
}
