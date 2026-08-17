import type { IncomingMessage, ServerResponse } from 'http';
import { buildApp } from '../src/app';

// Padrão oficial do Fastify para rodar em funções serverless: mantém uma
// única instância do app por instância "quente" da função e delega a
// requisição para o servidor HTTP interno do Fastify.
const app = buildApp();
let readyPromise: PromiseLike<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!readyPromise) readyPromise = app.ready().then(() => undefined);
  await readyPromise;
  app.server.emit('request', req, res);
}
