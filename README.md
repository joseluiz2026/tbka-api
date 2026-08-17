# TB Knowledge Agro — API v1

Backend real da TB Knowledge Agro (TBKA): serve os 50 registros do catálogo
(pragas, doenças, deficiências e distúrbios do café no ES) e faz o proxy
server-side da identificação por foto via Groq — a `GROQ_API_KEY` nunca
precisa ser colada no navegador.

Ver `D:\000 - TERRABASE\TB KNOWLEDGE\briefing_backend_tbka.md` para o
briefing completo que originou este projeto.

## Stack

Node.js + TypeScript + Fastify, pensado para rodar como função serverless na
Vercel. Dataset em `src/data/records.json` (mesmos 50 registros do protótipo
`tbka_prototype.html` / `tbka_developers.html`) — sem banco de dados nesta
etapa.

## Setup

```bash
npm install
cp .env.example .env
```

Preencha o `.env`:

- `GROQ_API_KEY` — chave da Groq, só usada pelo servidor no `/v1/identify`
  quando a requisição inclui fotos. Sem imagens, o endpoint não chama a Groq.
- `TBKA_API_KEYS` — chaves de API dos consumidores autorizados, separadas por
  vírgula (ex: `tbka_live_terrabase,tbka_live_parceiroX`). Geração manual por
  enquanto — v1 simples, sem endpoint de cadastro. Dá acesso aos endpoints de
  consulta (`/v1/records*`).
- `TBKA_API_KEYS_IDENTIFY` — subconjunto de `TBKA_API_KEYS` autorizado também
  a chamar `/v1/identify` (plano pago, usa Groq). Uma chave fora desta lista
  continua consultando normalmente mas recebe `403` em `/v1/identify` — é
  assim que planos free (só consulta) e pagos (consulta + foto) são
  diferenciados hoje, sem sistema de billing.
- `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` — limite básico por chave
  (padrão: 60 requisições por minuto).

## Rodando localmente

```bash
npm run dev
```

Sobe em `http://localhost:3333`. Todas as rotas `/v1/*` exigem
`Authorization: Bearer <chave>` com uma chave presente em `TBKA_API_KEYS`.

## Endpoints

- `GET /v1/records` — lista com paginação (`page`, `page_size`) e filtros
  `categoria`, `cultura`, `regiao`, `q`.
- `GET /v1/records/{id}` — ficha completa de um registro (`CAF-001`..`CAF-050`).
- `GET /v1/records/search` — mesmos filtros de `/v1/records`, sem paginação
  (era o endpoint marcado como roadmap em `tbka_developers.html`; agora
  funcional).
- `POST /v1/identify` — aceita `descricao` (texto) e/ou `imagens` (array de
  até 5 objetos `{ parte, mime_type, base64 }`). Só texto → matching local
  direto contra os 50 registros (mesmo contrato já documentado no
  playground). Com fotos → roda o mesmo fluxo em duas etapas do protótipo
  (visão Groq → matching local → ranking Groq), com a chave só no servidor.

O matching local (`src/lib/matching.ts`) e os filtros (`src/lib/filters.ts`)
são portas 1:1 da lógica que já existia no cliente, para o comportamento
bater com o que o playground de `tbka_developers.html` já promete.

## Deploy na Vercel

```bash
vercel deploy        # preview
vercel deploy --prod # produção
```

Configure as env vars (`GROQ_API_KEY`, `TBKA_API_KEYS`, etc.) no projeto da
Vercel antes do deploy — não em código. `api/index.ts` expõe o app Fastify
inteiro como uma única função serverless; `vercel.json` reescreve todas as
rotas para ela.

**Atenção a dois limites da Vercel relevantes para o `/v1/identify` com
fotos:**

1. **Corpo da requisição**: hoje a Vercel limita o payload de funções
   serverless a ~4.5MB. Cinco fotos em base64 podem estourar isso — se isso
   virar problema real, o próximo passo é aceitar `multipart/form-data` com
   upload direto para storage (ex: Vercel Blob) em vez de base64 no corpo.
2. **Timeout da função**: o fluxo com fotos faz duas chamadas sequenciais à
   Groq. No plano Hobby o timeout padrão de função é curto (10s) — pode não
   ser suficiente. Sabemos por experiência em outro projeto (POSTime) que
   esse tipo de limite trava fluxos de IA em sequência; se acontecer aqui, a
   solução é aumentar o timeout da função (`maxDuration` no plano Pro) ou
   rodar as duas chamadas Groq em paralelo quando possível.

## O que fica de fora nesta etapa

Ver seção 10 do briefing: nenhuma feature operacional do TerraBase, sem
migração para banco de dados, sem sistema completo de contas de
desenvolvedor (só chave manual + rate limit básico), sem fotos reais.

## Restrição legal — não alterar

A API nunca retorna produto comercial ou dosagem, só categoria de insumo
(`manejo_prev` / `manejo_corr`). Isso já está no dataset e não deve mudar
(Lei 14.785/2023, Resolução Confea 1.149/2025).
