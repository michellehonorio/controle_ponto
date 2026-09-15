import { Component, computed, inject, signal } from '@angular/core';
import { PontoService } from '../../core/ponto.service';
import { calcular, toHM, toMin } from '../../core/calculo/calculo';
import { mask, norm } from '../../core/calculo/mask';
import { INTERVALO_MIN_MIN } from '../../core/constants';
import { dataLegivel } from '../../core/data-utils';
import { StatusPeriodo } from '../../core/calculo/calculo';
import { Origem, Periodo, TipoRegistro } from '../../core/models';

interface ChipStatus {
  label: string;
  bg: string;
  cor: string;
}

const CHIP: Record<StatusPeriodo, ChipStatus> = {
  'em curso': { label: 'em curso', bg: 'var(--cor-chip-curso-bg)', cor: 'var(--cor-chip-curso-texto)' },
  ok: { label: 'ok', bg: 'var(--cor-ok-bg)', cor: 'var(--cor-ok-texto)' },
  vazio: { label: 'vazio', bg: 'var(--cor-vazio-bg)', cor: 'var(--cor-vazio-texto)' },
};

const STATUS_DIA_LABEL: Record<string, string> = {
  antes: 'aguardando início',
  trabalhando: 'trabalhando',
  intervalo: 'em intervalo',
  'pausa livre': 'pausa livre',
  encerrada: 'encerrada',
};

@Component({
  selector: 'app-hoje',
  templateUrl: './hoje.html',
  styleUrl: './hoje.scss',
})
export class Hoje {
  readonly ponto = inject(PontoService);

  readonly dataSelecionada = signal(this.ponto.hojeKey());
  /** Períodos editados localmente numa data que não é hoje — só é gravado ao clicar em "Salvar alterações". */
  readonly rascunho = signal<Periodo[] | null>(null);

  readonly ehHoje = computed(() => this.dataSelecionada() === this.ponto.hojeKey());
  readonly maxData = computed(() => this.ponto.hojeKey());

  readonly dataLabel = computed(() => dataLegivel(this.dataSelecionada()));
  readonly horaAgora = computed(() => {
    const d = this.ponto.agora();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  });

  private readonly periodosBase = computed(() =>
    this.ehHoje() ? this.ponto.periodosHoje() : this.ponto.periodosPorData(this.dataSelecionada())
  );
  readonly encerradaSelecionada = computed(() =>
    this.ehHoje() ? this.ponto.encerradaHoje() : (this.ponto.diaPorData(this.dataSelecionada())?.encerrada ?? false)
  );
  readonly fimRealSelecionado = computed(() =>
    this.ehHoje() ? this.ponto.diaHoje()?.fimReal : this.ponto.diaPorData(this.dataSelecionada())?.fimReal
  );

  readonly calculoSelecionado = computed(() => {
    if (this.ehHoje()) return this.ponto.calculoHoje();
    const dia = this.ponto.diaPorData(this.dataSelecionada());
    return calcular({
      periodos: this.rascunho() ?? this.periodosBase(),
      encerrada: dia?.encerrada ?? false,
      fimReal: dia?.fimReal ?? null,
      agoraMin: 0,
      semAgoraValido: true,
    });
  });

  readonly statusDiaLabel = computed(() => STATUS_DIA_LABEL[this.calculoSelecionado().statusDia]);

  readonly dirty = computed(() => {
    if (this.ehHoje()) return false;
    const r = this.rascunho();
    return r !== null && JSON.stringify(r) !== JSON.stringify(this.periodosBase());
  });

  readonly periodos = computed(() => {
    const calc = this.calculoSelecionado();
    const periodos = this.rascunho() ?? this.periodosBase();
    const s0 = toMin(periodos[0].s);
    const ehHoje = this.ehHoje();
    const encerrada = this.encerradaSelecionada();

    return periodos.map((p, i) => {
      const entradaHabilitada = ehHoje && !encerrada && toMin(p.e) === null && (i === 0 || toMin(periodos[i - 1]?.s) !== null);
      const saidaHabilitada = ehHoje && !encerrada && toMin(p.e) !== null && toMin(p.s) === null;
      return {
        titulo: ['1º Período', '2º Período', '3º Período'][i],
        entrada: p.e ?? '',
        saida: p.s ?? '',
        status: CHIP[calc.statusPeriodos[i]],
        temLimite: i === 1 && calc.statusDia === 'intervalo' && s0 !== null,
        limite: s0 !== null ? toHM(s0 + INTERVALO_MIN_MIN) : '00:00',
        entradaHabilitada,
        saidaHabilitada,
      };
    });
  });

  readonly total = computed(() => this.fmt(this.calculoSelecionado().tempoComputadoMin));
  readonly previsto = computed(() => this.calculoSelecionado().previsto ?? '—');
  readonly progresso = computed(() => Math.min(100, (this.calculoSelecionado().tempoComputadoMin / 375) * 100).toFixed(1) + '%');
  readonly saldoLabel = computed(() => {
    const restante = this.calculoSelecionado().restanteMetaMin;
    const sinal = restante <= 0 ? '+' : '−';
    return sinal + this.fmt(Math.abs(restante));
  });

  readonly rotuloBotao = computed(() => {
    if (this.ehHoje()) return this.ponto.encerradaHoje() ? 'Jornada encerrada' : 'Encerrar jornada';
    return 'Salvar alterações';
  });
  readonly botaoDesabilitado = computed(() => this.ehHoje() ? this.ponto.encerradaHoje() : !this.dirty());

  private fmt(min: number): string {
    const m = Math.max(0, Math.round(min));
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  selecionarData(ev: Event) {
    const valor = (ev.target as HTMLInputElement).value;
    if (!valor) return;
    this.dataSelecionada.set(valor);
    this.rascunho.set(null);
  }

  onInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    input.value = mask(input.value);
  }

  onBlur(seq: number, tipo: TipoRegistro, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const normalizado = norm(input.value);
    if (this.ehHoje()) {
      this.ponto.marcar(this.ponto.hojeKey(), seq as 1 | 2 | 3, tipo, normalizado, 'manual' satisfies Origem);
      return;
    }
    const base = this.rascunho() ?? this.periodosBase();
    const copia = base.map(p => ({ ...p }));
    const p = copia[seq - 1];
    if (tipo === 'entrada') p.e = normalizado || null; else p.s = normalizado || null;
    this.rascunho.set(copia);
  }

  marcarAgora(seq: number, tipo: TipoRegistro) {
    this.ponto.marcarAgora(seq as 1 | 2 | 3, tipo);
  }

  async encerrar() {
    if (this.ehHoje()) {
      await this.ponto.encerrarJornada(async saldoMin => {
        const horas = this.fmt(Math.abs(saldoMin));
        return confirm(`Você está encerrando ${horas} abaixo da meta de 6h15. Isso será lançado como saldo negativo no banco de horas. Encerrar mesmo assim?`);
      });
      return;
    }
    const rascunho = this.rascunho();
    if (!rascunho) return;
    const salvou = await this.ponto.salvarDiaEditado(this.dataSelecionada(), rascunho, async saldoMin => {
      const horas = this.fmt(Math.abs(saldoMin));
      return confirm(`Esse dia vai fechar com ${horas} abaixo da meta de 6h15, lançado como saldo negativo. Salvar mesmo assim?`);
    });
    if (salvou) this.rascunho.set(null);
  }

  reiniciar() {
    if (confirm('Isso apaga todos os registros de hoje. Deseja recomeçar a jornada?')) {
      this.ponto.reiniciarDiaDeHoje();
    }
  }
}
