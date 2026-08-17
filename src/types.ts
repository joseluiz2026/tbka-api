// Diferença semântica entre os dois tipos de relação (ver briefing de expansão,
// 2026-08-17): "semelhante" é confusão visual (diagnóstico diferencial);
// "associado" é relação de causa/consequência/coocorrência.
export interface DiagnosticoDiferencial {
  problema_id: string;
  semelhanca: string;
  diferenca_principal: string;
  orgao_diferenciador?: string;
  dificuldade?: 'baixa' | 'media' | 'alta';
}

export interface EstagioEvolucao {
  estagio: 'inicial' | 'intermediario' | 'avancado';
  aparencia: string;
  orgao?: string;
  intensidade?: string;
}

// Bloco opcional, visível na ficha pública quando presente. Todo campo é
// opcional para não travar em registros ainda não revisados (schemaVersion 1).
export interface VisualInfo {
  evidencias_chave?: string[];
  diagnostico_diferencial?: DiagnosticoDiferencial[];
  evidencias_confirmacao?: string[];
  proxima_foto_recomendada?: string[];
  evolucao?: EstagioEvolucao[];
  confiabilidade_visual?: 'alta' | 'media' | 'baixa';
  diagnostico_exclusivamente_visual?: 'sim' | 'parcialmente' | 'nao';
  necessita_confirmacao_laboratorial?: boolean;
}

// Bloco cru, sem compromisso de exibição na UI — destinado a uma futura IA
// de matching estruturado (ainda não existe; hoje o matching é por texto
// livre, ver src/lib/matching.ts). Preenchimento é oportunista, não bloqueia
// nada do resto do schema.
export interface IaMeta {
  orgao_principal_afetado?: string;
  orgaos_secundarios_afetados?: string[];
  fase_fenologica_mais_afetada?: string;
  condicoes_favoraveis?: string[];
  caracteristicas_visuais?: Record<string, unknown>;
}

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
  // Campos novos (schema v2, 2026-08-17). Ausentes = registro ainda v1.
  schemaVersion?: 2;
  visual?: VisualInfo;
  ia_meta?: IaMeta;
}

export interface ScoredRecord {
  record: Record_;
  score: number;
}
