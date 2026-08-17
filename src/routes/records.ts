import type { FastifyInstance } from 'fastify';
import { DATA, findById } from '../data';
import { applyFilters } from '../lib/filters';

interface ListQuery {
  categoria?: string;
  cultura?: string;
  regiao?: string;
  q?: string;
  page?: string;
  page_size?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export default async function recordsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListQuery }>('/v1/records', async (request, reply) => {
    const { categoria, cultura, regiao, q, page, page_size } = request.query;

    const filtered = applyFilters(DATA, { categoria, cultura, regiao, q });

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || DEFAULT_PAGE_SIZE));
    const start = (pageNum - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    reply.send({
      data: pageItems,
      meta: {
        total: filtered.length,
        page: pageNum,
        page_size: pageSize,
        total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      },
    });
  });

  // Endpoint dedicado de busca — o mesmo comportamento de /v1/records com
  // filtros, exposto separadamente porque a página de developers já o
  // documenta como endpoint próprio (antes marcado como roadmap).
  app.get<{ Querystring: ListQuery }>('/v1/records/search', async (request, reply) => {
    const { categoria, cultura, regiao, q } = request.query;
    const filtered = applyFilters(DATA, { categoria, cultura, regiao, q });
    reply.send({
      data: filtered,
      meta: { total: filtered.length },
    });
  });

  app.get<{ Params: { id: string } }>('/v1/records/:id', async (request, reply) => {
    const record = findById(request.params.id);
    if (!record) {
      reply.code(404).send({ error: 'not_found', message: 'Nenhum registro encontrado para o id informado.' });
      return;
    }
    reply.send(record);
  });
}
