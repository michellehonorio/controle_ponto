import { Injectable, computed, signal } from '@angular/core';
import { DbService } from './db/db.service';
import { DiaResumo, Origem, Periodo, Registro, TipoRegistro } from './models';
import { calcular, saldoAoEncerrar, toMin } from './calculo/calculo';
import { dataKey, horaAtual, minutosDoDia } from './data-utils';

/** Agrupa os registros de um dia em até 3 pares {entrada, saída}, por sequência. */
export function paraPeriodos(registros: Registro[]): Periodo[] {
  const periodos: Periodo[] = [{ e: null, s: null }, { e: null, s: null }, { e: null, s: null }];
  for (const r of registros) {
    const p = periodos[r.sequencia - 1];
    if (!p) continue;
    if (r.tipo === 'entrada') p.e = r.horario;
    else p.s = r.horario;
  }
  return periodos;
}

@Injectable({ providedIn: 'root' })
export class PontoService {
  private readonly registros = signal<Registro[]>([]);
  private readonly dias = signal<DiaResumo[]>([]);
  readonly agora = signal<Date>(new Date());
  readonly carregado = signal(false);
  readonly aviso = signal('');

  readonly hojeKey = computed(() => dataKey(this.agora()));

  readonly registrosHoje = computed(() =>
    this.registros().filter(r => r.data === this.hojeKey()).sort((a, b) => a.sequencia - b.sequencia)
  );
  readonly periodosHoje = computed(() => paraPeriodos(this.registrosHoje()));
  readonly diaHoje = computed(() => this.dias().find(d => d.data === this.hojeKey()));
  readonly encerradaHoje = computed(() => this.diaHoje()?.encerrada ?? false);

  readonly calculoHoje = computed(() => calcular({
    periodos: this.periodosHoje(),
    encerrada: this.encerradaHoje(),
    fimReal: this.diaHoje()?.fimReal ?? null,
    agoraMin: minutosDoDia(this.agora()),
  }));

  readonly saldoAcumuladoMin = computed(() =>
    this.dias().reduce((acc, d) => acc + (d.saldoDiaMin ?? 0), 0)
  );

  readonly diasComRegistros = computed(() => {
    const porData = new Map<string, Registro[]>();
    for (const r of this.registros()) {
      if (!porData.has(r.data)) porData.set(r.data, []);
      porData.get(r.data)!.push(r);
    }
    const diasMap = new Map(this.dias().map(d => [d.data, d]));
    const datas = new Set([...porData.keys(), ...diasMap.keys()]);
    return [...datas].sort().reverse().map(data => {
      const registrosDoDia = (porData.get(data) ?? []).sort((a, b) => a.sequencia - b.sequencia || (a.tipo === 'entrada' ? -1 : 1));
      const dia = diasMap.get(data);
      const periodos = paraPeriodos(registrosDoDia);
      const ehHoje = data === this.hojeKey();
      const calc = calcular({
        periodos,
        encerrada: dia?.encerrada ?? false,
        fimReal: dia?.fimReal ?? null,
        agoraMin: ehHoje ? minutosDoDia(this.agora()) : 0,
        semAgoraValido: !ehHoje,
      });
      return { data, registros: registrosDoDia, dia, periodos, calc };
    });
  });

  constructor(private db: DbService) {
    this.carregar();
    setInterval(() => this.agora.set(new Date()), 1000);
  }

  private async carregar() {
    const [registros, dias] = await Promise.all([this.db.listarRegistros(), this.db.listarDias()]);
    this.registros.set(registros);
    this.dias.set(dias);
    this.carregado.set(true);
  }

  private async gravarRegistro(registro: Registro) {
    const id = await this.db.salvarRegistro(registro);
    const comId = { ...registro, id };
    this.registros.update(lista => {
      const idx = lista.findIndex(r => r.id === comId.id);
      if (idx === -1) return [...lista, comId];
      const copia = [...lista];
      copia[idx] = comId;
      return copia;
    });
    return comId;
  }

  private async gravarDia(dia: DiaResumo) {
    await this.db.salvarDia(dia);
    this.dias.update(lista => {
      const idx = lista.findIndex(d => d.data === dia.data);
      if (idx === -1) return [...lista, dia];
      const copia = [...lista];
      copia[idx] = dia;
      return copia;
    });
  }

  private registroExistente(data: string, sequencia: 1 | 2 | 3, tipo: TipoRegistro): Registro | undefined {
    return this.registros().find(r => r.data === data && r.sequencia === sequencia && r.tipo === tipo);
  }

  /** Marca um horário (agora, ou manual) para um período/tipo específico. Horário vazio apaga o registro. */
  async marcar(data: string, sequencia: 1 | 2 | 3, tipo: TipoRegistro, horario: string, origem: Origem) {
    this.aviso.set('');
    const existente = this.registroExistente(data, sequencia, tipo);
    if (!horario) {
      if (existente?.id !== undefined) await this.excluirRegistro(existente.id, data);
      return;
    }
    const registro: Registro = existente
      ? { ...existente, horario, editado: origem === 'manual' ? true : existente.editado }
      : { data, sequencia, tipo, horario, origem, editado: false, criadoEm: Date.now() };
    await this.gravarRegistro(registro);
    if (data === this.hojeKey()) await this.recalcularDia(data);
  }

  async marcarAgora(sequencia: 1 | 2 | 3, tipo: TipoRegistro) {
    if (this.encerradaHoje()) return;
    await this.marcar(this.hojeKey(), sequencia, tipo, horaAtual(this.agora()), 'automatico');
  }

  async excluirRegistro(id: number, data: string) {
    await this.db.excluirRegistro(id);
    this.registros.update(lista => lista.filter(r => r.id !== id));
    await this.recalcularDia(data);
  }

  /** Recalcula tempoComputado/saldo de um dia já encerrado, após edição/exclusão de registros. */
  private async recalcularDia(data: string) {
    const dia = this.dias().find(d => d.data === data);
    if (!dia?.encerrada) return;
    const registrosDoDia = this.registros().filter(r => r.data === data);
    const periodos = paraPeriodos(registrosDoDia);
    const calc = calcular({ periodos, encerrada: true, fimReal: dia.fimReal ?? null, agoraMin: 0 });
    await this.gravarDia({
      ...dia,
      tempoTrabalhadoMin: calc.tempoTrabalhadoMin,
      tempoComputadoMin: calc.tempoComputadoMin,
      saldoDiaMin: saldoAoEncerrar(calc.tempoComputadoMin),
    });
  }

  /**
   * Encerra a jornada de hoje. Se houver um período aberto, fecha-o com o horário
   * atual antes de calcular o saldo final. Aplica a tolerância de 10min; se o saldo
   * ficar negativo além da tolerância, `confirmarSaldoNegativo` decide se prossegue.
   */
  async encerrarJornada(confirmarSaldoNegativo: (saldoMin: number) => boolean | Promise<boolean>) {
    if (this.encerradaHoje()) return;
    const periodos = this.periodosHoje();
    const abertaIdx = periodos.findIndex(p => toMin(p.e) !== null && toMin(p.s) === null);
    const temAlgumaEntrada = periodos.some(p => toMin(p.e) !== null);
    if (!temAlgumaEntrada) {
      this.aviso.set('Marque a entrada do 1º período primeiro.');
      return;
    }

    const agora = horaAtual(this.agora());
    let periodosFinais = periodos;
    if (abertaIdx !== -1) {
      const sequencia = (abertaIdx + 1) as 1 | 2 | 3;
      await this.marcar(this.hojeKey(), sequencia, 'saida', agora, 'automatico');
      periodosFinais = paraPeriodos(this.registrosHoje());
    }

    const calc = calcular({ periodos: periodosFinais, encerrada: true, fimReal: agora, agoraMin: 0 });
    const saldoMin = saldoAoEncerrar(calc.tempoComputadoMin);

    if (saldoMin < 0) {
      const prosseguir = await confirmarSaldoNegativo(saldoMin);
      if (!prosseguir) return;
    }

    await this.gravarDia({
      data: this.hojeKey(),
      encerrada: true,
      fimReal: agora,
      tempoTrabalhadoMin: calc.tempoTrabalhadoMin,
      tempoComputadoMin: calc.tempoComputadoMin,
      saldoDiaMin: saldoMin,
    });
    this.aviso.set('');
  }

  /** Apaga os registros de hoje e o resumo do dia, permitindo recomeçar do zero. */
  async reiniciarDiaDeHoje() {
    const hoje = this.hojeKey();
    for (const r of this.registrosHoje()) {
      if (r.id !== undefined) await this.db.excluirRegistro(r.id);
    }
    this.registros.update(lista => lista.filter(r => r.data !== hoje));
    await this.gravarDia({ data: hoje, encerrada: false });
    this.aviso.set('');
  }
}
