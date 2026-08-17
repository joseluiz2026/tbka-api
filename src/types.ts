export interface Record_ {
  id: string;
  ranking: number;
  categoria: string;
  cultura: string;
  regiao: string;
  nome: string;
  cientifico: string;
  agente: string;
  parte: string;
  sint_inicial: string;
  sint_avancado: string;
  confianca: number;
  manejo_prev: string;
  manejo_corr: string;
}

export interface ScoredRecord {
  record: Record_;
  score: number;
}
