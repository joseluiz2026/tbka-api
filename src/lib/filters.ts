import type { Record_ } from '../types';

export interface RecordFilters {
  categoria?: string;
  cultura?: string;
  regiao?: string;
  q?: string;
}

// Mesma regra do protótipo (matchesFilters em tbka_prototype.html): categoria e
// regiao usam substring, cultura é match exato, q busca em texto combinado.
export function matchesFilters(d: Record_, { categoria, cultura, regiao, q }: RecordFilters): boolean {
  if (categoria && !d.categoria.includes(categoria)) return false;
  if (cultura && d.cultura !== cultura) return false;
  if (regiao && !d.regiao.includes(regiao)) return false;
  if (q) {
    const hay = [d.nome, d.cientifico, d.sint_inicial, d.sint_avancado, d.agente, d.parte, d.id].join(' ').toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  return true;
}

export function applyFilters(data: Record_[], filters: RecordFilters): Record_[] {
  return data.filter((d) => matchesFilters(d, filters));
}
