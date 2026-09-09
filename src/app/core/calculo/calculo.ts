import { Periodo } from '../models';
import { INTERVALO_MIN_MIN, META_COMPUTADO_MIN, TOLERANCIA_MIN } from '../constants';

export const pad = (n: number) => String(Math.trunc(n)).padStart(2, '0');

/** 'HH:MM' -> minutos desde 00:00, ou null se inválido/vazio. */
export function toMin(hm: string | null | undefined): number | null {
  if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** minutos (pode ser negativo/ >1440) -> 'HH:MM', normalizado dentro de um dia. */
export function toHM(min: number): string {
  const norm = ((Math.round(min) % 1440) + 1440) % 1440;
  return pad(Math.floor(norm / 60)) + ':' + pad(norm % 60);
}

/** duração em minutos formatada 'HH:MM' (pode ser negativa: prefixo é responsabilidade do chamador). */
export function fmtDur(min: number): string {
  const m = Math.max(0, Math.round(min));
  return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
}

function duracaoFechada(p: Periodo | undefined): number {
  if (!p) return 0;
  const e = toMin(p.e);
  const s = toMin(p.s);
  if (e === null || s === null) return 0;
  return ((s - e + 1440) % 1440);
}

export interface EstadoDia {
  periodos: Periodo[]; // até 3, cada {e,s}
  encerrada: boolean;
  fimReal: string | null;
  agoraMin: number; // minutos desde 00:00 do instante atual (ignorado se encerrada)
  /** dias passados não encerrados: não há "agora" válido, então o período aberto não soma tempo ao vivo. */
  semAgoraValido?: boolean;
}

export type StatusPeriodo = 'vazio' | 'em curso' | 'ok';
export type StatusDia = 'antes' | 'trabalhando' | 'intervalo' | 'pausa livre' | 'encerrada';

export interface ResultadoCalculo {
  /** índice (0-based) do período aberto (entrada sem saída), ou -1 se nenhum. */
  abertaIdx: number;
  statusDia: StatusDia;
  /** tempo trabalhado bruto (sem o intervalo), em minutos. */
  tempoTrabalhadoMin: number;
  /** tempo trabalhado + intervalo mínimo obrigatório fixo (o que conta pra meta), em minutos. */
  tempoComputadoMin: number;
  /** duração real do intervalo obrigatório (1ª saída -> 2ª entrada), ou null se ainda não apurável. */
  intervaloRealMin: number | null;
  /** minutos decorridos da pausa obrigatória em curso, ou null se não está nela. */
  intervaloEmCursoMin: number | null;
  /** horário previsto de saída ('HH:MM'), ou null se ainda não há entrada nenhuma. */
  previsto: string | null;
  /** minutos restantes até a meta a partir do tempo computado atual (pode ser negativo). */
  restanteMetaMin: number;
  statusPeriodos: StatusPeriodo[];
}

/**
 * Núcleo do cálculo de horas:
 * - jornada líquida de trabalho = 5h45 (345min); o dia = jornada líquida + intervalo
 *   obrigatório real (30-60min) entre o 1º e o 2º período. O 3º período é opcional,
 *   separado do 2º por uma pausa livre que não conta nem a favor nem contra.
 * - previsto = entrada do 1º período + 345min + intervalo real (integral, sem desconto).
 *   Só o que exceder o mínimo de 30min empurra o previsto pra frente.
 * - tempo computado = tempo trabalhado + 30min fixos (o mínimo do intervalo, não o
 *   intervalo real) — assim, bater exatamente no horário previsto sempre zera o saldo,
 *   independente da duração real do intervalo (30, 45 ou 60min).
 * - a previsão de saída "congela" no momento em que cada período abre, usando só o
 *   tempo computado já fechado até ali — e só volta a mudar quando um novo período abrir.
 */
export function calcular(estado: EstadoDia): ResultadoCalculo {
  const periodos = [0, 1, 2].map(i => estado.periodos[i] ?? { e: null, s: null });
  const trabalho = periodos.map(duracaoFechada);

  const s0 = toMin(periodos[0].s);
  const e1 = toMin(periodos[1].e);
  const intervaloRealMin = s0 !== null && e1 !== null ? ((e1 - s0 + 1440) % 1440) : null;

  // computedClosedBefore(idx): tempo computado já fechado antes do período `idx` abrir.
  // Usa o intervalo mínimo obrigatório (30min fixos, não o intervalo real) pra descontar
  // do previsto: só o tempo de intervalo que excede o mínimo empurra o horário previsto.
  const computedClosedBefore = (idx: number) => {
    let total = 0;
    for (let j = 0; j < idx; j++) total += trabalho[j];
    if (idx >= 1) total += INTERVALO_MIN_MIN;
    return total;
  };

  let abertaIdx = -1;
  if (!estado.encerrada) {
    abertaIdx = periodos.findIndex(p => toMin(p.e) !== null && toMin(p.s) === null);
  }

  const emCursoMin = abertaIdx !== -1 && !estado.semAgoraValido
    ? ((estado.agoraMin - (toMin(periodos[abertaIdx].e) as number) + 1440) % 1440)
    : 0;

  const tempoTrabalhadoMin = trabalho[0] + trabalho[1] + trabalho[2] + emCursoMin;
  // Consistente com o previsto: soma o intervalo mínimo obrigatório (30min fixos), não o
  // intervalo real — assim bater exatamente no horário previsto sempre zera o saldo.
  const descontoIntervaloMin = intervaloRealMin !== null ? INTERVALO_MIN_MIN : 0;
  const tempoComputadoMin = tempoTrabalhadoMin + descontoIntervaloMin;

  // Previsto: âncora no último período que teve uma entrada registrada.
  let previsto: string | null = null;
  const ultimoComEntrada = [2, 1, 0].find(i => toMin(periodos[i].e) !== null);
  if (estado.encerrada && estado.fimReal) {
    previsto = estado.fimReal;
  } else if (ultimoComEntrada !== undefined) {
    const anchor = toMin(periodos[ultimoComEntrada].e) as number;
    const restante = META_COMPUTADO_MIN - computedClosedBefore(ultimoComEntrada);
    previsto = toHM(anchor + restante);
  }

  // Status do dia
  let statusDia: StatusDia;
  if (estado.encerrada) statusDia = 'encerrada';
  else if (abertaIdx !== -1) statusDia = 'trabalhando';
  else if (toMin(periodos[0].s) !== null && toMin(periodos[1].e) === null) statusDia = 'intervalo';
  else if (toMin(periodos[1].s) !== null && toMin(periodos[2].e) === null) statusDia = 'pausa livre';
  else statusDia = 'antes';

  const intervaloEmCursoMin = statusDia === 'intervalo'
    ? ((estado.agoraMin - (s0 as number) + 1440) % 1440)
    : null;

  const statusPeriodos: StatusPeriodo[] = periodos.map((p, i) => {
    if (i === abertaIdx) return 'em curso';
    if (toMin(p.e) !== null && toMin(p.s) !== null) return 'ok';
    return 'vazio';
  });

  return {
    abertaIdx,
    statusDia,
    tempoTrabalhadoMin,
    tempoComputadoMin,
    intervaloRealMin,
    intervaloEmCursoMin,
    previsto,
    restanteMetaMin: META_COMPUTADO_MIN - tempoComputadoMin,
    statusPeriodos,
  };
}

/** Saldo do dia ao encerrar a jornada, com tolerância de 10min pra mais ou pra menos. */
export function saldoAoEncerrar(tempoComputadoFinalMin: number): number {
  const diff = Math.round(tempoComputadoFinalMin - META_COMPUTADO_MIN);
  if (Math.abs(diff) <= TOLERANCIA_MIN) return 0;
  return diff;
}

export function formatSaldo(saldoMin: number): string {
  const sinal = saldoMin > 0 ? '+' : saldoMin < 0 ? '−' : '';
  return sinal + fmtDur(Math.abs(saldoMin));
}
