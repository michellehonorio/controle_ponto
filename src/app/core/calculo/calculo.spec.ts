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
  it('previsão inicial = entrada + 6h15 (spec 4.1)', () => {
    const r = dia([{ e: '08:00', s: null }]);
    expect(r.previsto).toBe('14:15');
    expect(r.statusDia).toBe('trabalhando');
  });
});

describe('calcular — intervalo obrigatório e crédito (spec 4.2/4.3)', () => {
  it('crédito fixo de 15min para intervalo de 30 a 60min, sem crescer com pausa maior', () => {
    const r45 = dia([{ e: '08:00', s: '12:00' }, { e: '12:45', s: null }]);
    expect(r45.creditoIntervaloMin).toBe(15);
    // computedClosedBefore(1) = 240 (trabalho1) + 15 (crédito) = 255; previsto = 12:45 + (375-255) = 12:45+120 = 14:45
    expect(r45.previsto).toBe('14:45');

    const r60 = dia([{ e: '08:00', s: '12:00' }, { e: '13:00', s: null }]);
    expect(r60.creditoIntervaloMin).toBe(15);
  });

  it('intervalo real menor que 15min limita o crédito à duração real (spec item 6)', () => {
    const r = dia([{ e: '08:00', s: '12:00' }, { e: '12:10', s: null }]);
    expect(r.intervaloRealMin).toBe(10);
    expect(r.creditoIntervaloMin).toBe(10);
  });

  it('intervalo maior que 1h não penaliza além do já previsto (spec 4.8)', () => {
    const r = dia([{ e: '08:00', s: '12:00' }, { e: '13:30', s: null }]);
    expect(r.creditoIntervaloMin).toBe(15); // crédito continua 15, sem desconto extra
  });
});

describe('calcular — pausa livre antes do 3º período (spec 3/4.6)', () => {
  it('pausa entre a 2ª saída e a 3ª entrada não soma nem desconta', () => {
    const r = dia([
      { e: '08:00', s: '12:00' }, // 4h
      { e: '12:45', s: '15:45' }, // 3h (crédito 15min do intervalo obrigatório)
      { e: '17:30', s: null },     // pausa livre de 1h45 entre 15:45 e 17:30, ignorada
    ]);
    // fechado antes do 3º abrir: 240 + 15(crédito) + 180 = 435min, já 60min acima da meta de 375min
    // -> previsto fica 60min ANTES da própria 3ª entrada (17:30 - 1h = 16:30)
    const closedBefore3 = 240 + 15 + 180;
    expect(toMin(r.previsto!)).toBe((17 * 60 + 30) + (375 - closedBefore3));
    expect(r.previsto).toBe('16:30');
  });
});

describe('saldoAoEncerrar — tolerância de 10min (spec 4.7)', () => {
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

describe('simulação de um dia inteiro de trabalho (2 períodos, dentro da meta)', () => {
  it('bate com a meta considerando o crédito do intervalo', () => {
    // 08:00-12:00 (4h=240) + intervalo 45min (15min pagos) + 12:45-14:45 (2h=120) = 375min = 6h15 exatas
    const periodos: Periodo[] = [{ e: '08:00', s: '12:00' }, { e: '12:45', s: '14:45' }];
    const r = dia(periodos, { encerrada: true, fimReal: '14:45' });
    expect(r.tempoComputadoMin).toBe(375);
    expect(saldoAoEncerrar(r.tempoComputadoMin)).toBe(0);
  });
});
