import type { Record_, ScoredRecord } from '../types';

// Portado 1:1 da lógica já usada no cliente (tbka_prototype.html / tbka_developers.html
// playground), para que o comportamento do servidor bata com o que já foi prometido.
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'em', 'na', 'no', 'nas', 'nos',
  'a', 'o', 'e', 'ou', 'um', 'uma', 'para', 'por', 'que', 'se', 'ao', 'aos', 'as',
]);

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function searchableTextFor(d: Record_): string {
  const base = [d.nome, d.cientifico, d.sint_inicial, d.sint_avancado, d.agente, d.parte, d.categoria, d.cultura, d.regiao];
  // Campos do schema v2 (opcionais) entram na busca quando presentes, sem exigir
  // que todo registro já tenha sido migrado — ver src/types.ts (VisualInfo).
  if (d.visual?.evidencias_chave) base.push(...d.visual.evidencias_chave);
  if (d.visual?.diagnostico_diferencial) {
    base.push(...d.visual.diagnostico_diferencial.map((x) => x.diferenca_principal));
  }
  return base.join(' ');
}

export function localMatch(data: Record_[], query: string, topN = 3): ScoredRecord[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const scored = data
    .map((d) => {
      const hay = tokenize(searchableTextFor(d));
      const haySet = new Set(hay);
      let score = 0;
      qTokens.forEach((t) => {
        if (haySet.has(t)) score += 2;
        else if (hay.some((h) => h.includes(t) || t.includes(h))) score += 1;
      });
      return { record: d, score };
    })
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
