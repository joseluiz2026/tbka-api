import type { FastifyInstance } from 'fastify';
import { DATA } from '../data';
import { localMatch } from '../lib/matching';
import { groqChat, GroqError, RANK_MODEL, VISION_MODEL } from '../lib/groq';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGES = 5;

interface IdentifyImage {
  parte: string;
  mime_type: string;
  base64: string;
}

interface IdentifyBody {
  descricao?: string;
  imagens?: IdentifyImage[];
}

function candidateSummary(matches: ReturnType<typeof localMatch>) {
  return matches.map((m) => ({ id: m.record.id, nome: m.record.nome, categoria: m.record.categoria, relevancia: m.score }));
}

export default async function identifyRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: IdentifyBody }>('/v1/identify', async (request, reply) => {
    const { descricao, imagens } = request.body || {};
    const contextText = (descricao || '').trim();
    const images = Array.isArray(imagens) ? imagens : [];

    if (!contextText && images.length === 0) {
      reply.code(400).send({ error: 'bad_request', message: 'Informe "descricao" e/ou até 5 imagens em "imagens".' });
      return;
    }

    if (images.length > MAX_IMAGES) {
      reply.code(400).send({ error: 'bad_request', message: `No máximo ${MAX_IMAGES} imagens por requisição.` });
      return;
    }

    for (const img of images) {
      if (!img.parte || !img.mime_type || !img.base64) {
        reply.code(400).send({ error: 'bad_request', message: 'Cada imagem precisa de "parte", "mime_type" e "base64".' });
        return;
      }
      if (!ALLOWED_MIME.has(img.mime_type)) {
        reply.code(400).send({ error: 'bad_request', message: `mime_type "${img.mime_type}" não suportado. Use image/jpeg, image/png ou image/webp.` });
        return;
      }
    }

    try {
      // Caminho 1: só texto — matching local direto, sem custo de IA.
      // Bate com o contrato já documentado em tbka_developers.html.
      if (images.length === 0) {
        const matches = localMatch(DATA, contextText, 3);
        if (matches.length === 0) {
          reply.send({ data: [], message: `Nenhum registro correspondente encontrado nos ${DATA.length} problemas catalogados.` });
          return;
        }
        reply.send({
          data: candidateSummary(matches),
          disclaimer: 'Estimativa de triagem — não substitui inspeção de campo ou análise laboratorial.',
        });
        return;
      }

      // Caminho 2: fotos — visão Groq -> matching local -> ranking Groq.
      // Mesmo fluxo em duas etapas do protótipo, agora rodando no servidor
      // para que a GROQ_API_KEY nunca precise ser colada no navegador.
      const slotNames = images.map((img) => img.parte).join(', ');
      const visionPrompt = `Você é um assistente de triagem agrícola. Você recebeu ${images.length} foto(s) de uma planta de café, cada uma identificada por etiqueta antes da imagem correspondente (partes enviadas: ${slotNames}). Descreva OBJETIVAMENTE, em português, o que é visível em CADA parte, correlacionando sintomas com a parte da planta indicada pela etiqueta: cor das lesões/manchas, formato, distribuição, textura, e presença de insetos, teias, pó ou fungos visíveis. NÃO tente nomear uma doença ou praga específica — apenas descreva os atributos visuais por parte, em frases curtas.${contextText ? ` O usuário também descreveu: "${contextText}"` : ''}`;

      const imageContentBlocks = images.flatMap((img) => [
        { type: 'text' as const, text: `Imagem — ${img.parte}:` },
        { type: 'image_url' as const, image_url: { url: `data:${img.mime_type};base64,${img.base64}` } },
      ]);

      const description = await groqChat({
        model: VISION_MODEL,
        content: [{ type: 'text', text: visionPrompt }, ...imageContentBlocks],
        maxTokens: 350,
        temperature: 0.2,
      });

      const combinedQuery = `${description} ${contextText}`.trim();
      const matches = localMatch(DATA, combinedQuery, 5);

      if (matches.length === 0) {
        reply.send({
          data: [],
          observacao_visual: description,
          message: `Nenhum registro correspondente encontrado nos ${DATA.length} problemas catalogados.`,
        });
        return;
      }

      const candidatesText = matches
        .map((m) => {
          const r = m.record;
          let line = `${r.id} — ${r.nome} (${r.categoria}). Sintomas: ${r.sint_inicial} ${r.sint_avancado}`;
          // Campos do schema v2 (opcionais): quando existirem, dão ao modelo
          // pistas discriminativas melhores do que só os sintomas gerais.
          if (r.visual?.evidencias_chave?.length) {
            line += ` Evidências-chave: ${r.visual.evidencias_chave.join('; ')}.`;
          }
          if (r.visual?.diagnostico_diferencial?.length) {
            const dd = r.visual.diagnostico_diferencial
              .map((x) => `confundível com ${x.problema_id} (${x.diferenca_principal})`)
              .join('; ');
            line += ` Diagnóstico diferencial: ${dd}.`;
          }
          return line;
        })
        .join('\n');

      const rankPrompt = `Descrição visual observada: "${description}"
${contextText ? `Observação do usuário: "${contextText}"` : ''}

Candidatos da base de dados (use APENAS estes, nunca invente outro problema):
${candidatesText}

Escreva uma resposta curta (3-4 frases) em português indicando qual candidato parece mais consistente e por quê, mencionando o nível de incerteza e recomendando confirmação em campo.`;

      const explicacao = await groqChat({
        model: RANK_MODEL,
        content: rankPrompt,
        maxTokens: 250,
        temperature: 0.3,
      });

      reply.send({
        data: candidateSummary(matches.slice(0, 3)),
        observacao_visual: description,
        explicacao,
        disclaimer: 'Estimativa de triagem visual — não substitui inspeção de campo, análise laboratorial ou identificação taxonômica.',
      });
    } catch (err) {
      if (err instanceof GroqError) {
        request.log.error({ err: err.message }, 'groq_error');
        reply.code(502).send({ error: 'upstream_error', message: err.message });
        return;
      }
      throw err;
    }
  });
}
