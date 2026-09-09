import { describe, expect, it } from 'vitest';
import { calcular, saldoAoEncerrar, toHM, toMin } from './calculo';
import { Periodo } from '../models';

function dia(periodos: Periodo[], opts: Partial<{ encerrada: boolean; fimReal: string | null; agoraMin: number }> = {}) {
  return calcular({
    periodos,
    encerrada: opts.encerrada ?? false,
    fimReal: opts.fimReal ?? null,
    agoraMin: opts.agoraMin ?? 0,
  });
}

describe('toMin / toHM', () => {
  it('converte HH:MM para minutos e volta', () => {
    expect(toMin('08:30')).toBe(510);
    expect(toHM(510)).toBe('08:30');
    expect(toMin('')).toBeNull();
    expect(toMin('25:00')).toBeNull();
  });
});

describe('calcular — 1ª entrada', () => {
  it('previsão inicial = entrada + 6h15 (jornada líquida de 5h45 + intervalo mínimo de 30min)', () => {
    const r = dia([{ e: '08:00', s: null }]);
    expect(r.previsto).toBe('14:15');
    expect(r.statusDia).toBe('trabalhando');
  });
});

describe('calcular — intervalo obrigatório: previsto = entrada1 + 5h45 + intervalo real', () => {
  it('intervalo de 30min (mínimo): previsto não é empurrado, fica em 14:15', () => {
    const r = dia([{ e: '08:00', s: '12:00' }, { e: '12:30', s: null }]);
    expect(r.intervaloRealMin).toBe(30);
    expect(r.previsto).toBe('14:15');
  });

  it('intervalo de 40min: só os 10min que excedem o mínimo empurram o previsto', () => {
    const r = dia([{ e: '08:00', s: '12:00' }, { e: '12:40', s: null }]);
    expect(r.intervaloRealMin).toBe(40);
    expect(r.previsto).toBe('14:25');
  });

  it('intervalo de 45min: previsto = 14:30', () => {
    const r = dia([{ e: '08:00', s: '12:00' }, { e: '12:45', s: null }]);
    expect(r.previsto).toBe('14:30');
  });

  it('intervalo de 60min (máximo): previsto = 14:45', () => {
    const r = dia([{ e: '08:00', s: '12:00' }, { e: '13:00', s: null }]);
    expect(r.previsto).toBe('14:45');
  });
});

describe('calcular — pausa livre antes do 3º período (não soma nem desconta, só empurra o previsto)', () => {
  it('pausa entre a 2ª saída e a 3ª entrada não afeta o tempo computado', () => {
    const r = dia([
      { e: '08:00', s: '12:00' }, // 4h
      { e: '12:45', s: '15:45' }, // 3h (intervalo obrigatório de 45min antes, desconta só o mínimo de 30min)
      { e: '17:30', s: null },     // pausa livre de 1h45 entre 15:45 e 17:30, ignorada
    ]);
    // fechado antes do 3º abrir: 240 (1º) + 30 (mínimo fixo) + 180 (2º) = 450min, já 75min acima da meta de 375min
    // -> previsto fica 75min ANTES da própria 3ª entrada (17:30 - 1h15 = 16:15)
    const closedBefore3 = 240 + 30 + 180;
    expect(toMin(r.previsto!)).toBe((17 * 60 + 30) + (375 - closedBefore3));
    expect(r.previsto).toBe('16:15');
  });
});

describe('saldoAoEncerrar — tolerância de 10min', () => {
  it('diferença dentro de 10min não afeta o saldo', () => {
    expect(saldoAoEncerrar(375)).toBe(0);
    expect(saldoAoEncerrar(385)).toBe(0); // +10
    expect(saldoAoEncerrar(365)).toBe(0); // -10
  });

  it('11min ou mais além da meta lança o excedente inteiro como saldo positivo', () => {
    expect(saldoAoEncerrar(386)).toBe(11);
    expect(saldoAoEncerrar(400)).toBe(25);
  });

  it('11min ou mais antes da meta lança a diferença inteira como saldo negativo', () => {
    expect(saldoAoEncerrar(364)).toBe(-11);
    expect(saldoAoEncerrar(340)).toBe(-35);
  });
});

describe('simulação de um dia inteiro de trabalho (2 períodos, intervalo de 30min)', () => {
  it('sair exatamente no horário previsto (14:15) sempre zera o saldo', () => {
    const periodos: Periodo[] = [{ e: '08:00', s: '12:00' }, { e: '12:30', s: '14:15' }];
    const r = dia(periodos, { encerrada: true, fimReal: '14:15' });
    expect(r.tempoComputadoMin).toBe(375);
    expect(saldoAoEncerrar(r.tempoComputadoMin)).toBe(0);
  });

  it('sair 15min depois do previsto (14:30) deixa saldo positivo de 15min', () => {
    const periodos: Periodo[] = [{ e: '08:00', s: '12:00' }, { e: '12:30', s: '14:30' }];
    const r = dia(periodos, { encerrada: true, fimReal: '14:30' });
    expect(r.tempoComputadoMin).toBe(390);
    expect(saldoAoEncerrar(r.tempoComputadoMin)).toBe(15);
  });

  it('sair 15min antes do previsto (14:00) deixa saldo negativo de 15min', () => {
    const periodos: Periodo[] = [{ e: '08:00', s: '12:00' }, { e: '12:30', s: '14:00' }];
    const r = dia(periodos, { encerrada: true, fimReal: '14:00' });
    expect(r.tempoComputadoMin).toBe(360);
    expect(saldoAoEncerrar(r.tempoComputadoMin)).toBe(-15);
  });

  it('sair entre 14:05 e 14:25 fica dentro da tolerância — saldo zero', () => {
    const cedo = dia([{ e: '08:00', s: '12:00' }, { e: '12:30', s: '14:05' }], { encerrada: true, fimReal: '14:05' });
    expect(saldoAoEncerrar(cedo.tempoComputadoMin)).toBe(0);

    const tarde = dia([{ e: '08:00', s: '12:00' }, { e: '12:30', s: '14:25' }], { encerrada: true, fimReal: '14:25' });
    expect(saldoAoEncerrar(tarde.tempoComputadoMin)).toBe(0);
  });
});
