export type TipoRegistro = 'entrada' | 'saida';
export type Origem = 'automatico' | 'manual';

export interface Registro {
  id?: number;
  data: string; // 'YYYY-MM-DD'
  tipo: TipoRegistro;
  sequencia: 1 | 2 | 3;
  horario: string; // 'HH:MM'
  origem: Origem;
  editado: boolean;
  criadoEm: number;
}

export interface DiaResumo {
  data: string; // PK 'YYYY-MM-DD'
  encerrada: boolean;
  fimReal?: string;
  tempoTrabalhadoMin?: number;
  tempoComputadoMin?: number;
  saldoDiaMin?: number;
}

/** Um par entrada/saída dentro de um dia (1º, 2º ou 3º período). */
export interface Periodo {
  e: string | null;
  s: string | null;
}
