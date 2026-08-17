import type { FastifyReply, FastifyRequest } from 'fastify';

function loadKeySet(envVar: string): Set<string> {
  const raw = process.env[envVar] || '';
  return new Set(
    raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 60);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);

// Rate limit em memória, por processo. Em serverless cada instância fria tem
// sua própria janela — suficiente para v1 "básico", não é um limite global exato.
const hits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    hits.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt };
  }
  entry.count += 1;
  const allowed = entry.count <= RATE_LIMIT_MAX;
  return { allowed, remaining: Math.max(0, RATE_LIMIT_MAX - entry.count), resetAt: entry.resetAt };
}

export function requireApiKey(request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void): void {
  const header = request.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    reply.code(401).send({ error: 'unauthorized', message: 'Envie a chave no cabeçalho Authorization: Bearer <chave>.' });
    return;
  }

  const validKeys = loadKeySet('TBKA_API_KEYS');
  if (!validKeys.has(token)) {
    reply.code(401).send({ error: 'unauthorized', message: 'Chave de API inválida.' });
    return;
  }

  const { allowed, remaining, resetAt } = checkRateLimit(token);
  reply.header('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  reply.header('X-RateLimit-Remaining', String(remaining));
  reply.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

  if (!allowed) {
    reply.code(429).send({ error: 'rate_limited', message: 'Limite de requisições excedido. Tente novamente em instantes.' });
    return;
  }

  done();
}

// Escopo extra além de requireApiKey: além de a chave ser válida, ela precisa
// estar autorizada especificamente para /v1/identify (plano pago). Chaves em
// TBKA_API_KEYS mas fora de TBKA_API_KEYS_IDENTIFY continuam funcionando
// normalmente para os endpoints de consulta (/v1/records*).
export function requireIdentifyScope(request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void): void {
  const header = request.headers.authorization || '';
  const [, token] = header.split(' ');

  const identifyKeys = loadKeySet('TBKA_API_KEYS_IDENTIFY');
  if (!token || !identifyKeys.has(token)) {
    reply.code(403).send({
      error: 'forbidden',
      message: 'Este plano não inclui identificação por foto. Faça upgrade para habilitar o /v1/identify.',
    });
    return;
  }

  done();
}
