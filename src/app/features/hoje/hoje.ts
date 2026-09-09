import { Component, computed, inject } from '@angular/core';
import { PontoService } from '../../core/ponto.service';
import { toHM, toMin } from '../../core/calculo/calculo';
import { mask, norm } from '../../core/calculo/mask';
import { INTERVALO_MIN_MIN } from '../../core/constants';
import { dataLegivel } from '../../core/data-utils';
import { StatusPeriodo } from '../../core/calculo/calculo';
import { Origem, TipoRegistro } from '../../core/models';

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

  readonly dataHoje = computed(() => dataLegivel(this.ponto.hojeKey()));
  readonly horaAgora = computed(() => {
    const d = this.ponto.agora();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  });

  readonly statusDiaLabel = computed(() => STATUS_DIA_LABEL[this.ponto.calculoHoje().statusDia]);

  readonly periodos = computed(() => {
    const calc = this.ponto.calculoHoje();
    const periodos = this.ponto.periodosHoje();
    const s0 = toMin(periodos[0].s);

    return periodos.map((p, i) => {
      const entradaHabilitada = !this.ponto.encerradaHoje() && toMin(p.e) === null && (i === 0 || toMin(periodos[i - 1]?.s) !== null);
      const saidaHabilitada = !this.ponto.encerradaHoje() && toMin(p.e) !== null && toMin(p.s) === null;
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

  readonly total = computed(() => this.fmt(this.ponto.calculoHoje().tempoComputadoMin));
  readonly previsto = computed(() => this.ponto.calculoHoje().previsto ?? '—');
  readonly progresso = computed(() => Math.min(100, (this.ponto.calculoHoje().tempoComputadoMin / 375) * 100).toFixed(1) + '%');
  readonly saldoLabel = computed(() => {
    const restante = this.ponto.calculoHoje().restanteMetaMin;
    const sinal = restante <= 0 ? '+' : '−';
    return sinal + this.fmt(Math.abs(restante));
  });
  readonly rotuloEncerrar = computed(() => this.ponto.encerradaHoje() ? 'Jornada encerrada' : 'Encerrar jornada');

  private fmt(min: number): string {
    const m = Math.max(0, Math.round(min));
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  onInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    input.value = mask(input.value);
  }

  onBlur(seq: number, tipo: TipoRegistro, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const normalizado = norm(input.value);
    this.ponto.marcar(this.ponto.hojeKey(), seq as 1 | 2 | 3, tipo, normalizado, 'manual' satisfies Origem);
  }

  marcarAgora(seq: number, tipo: TipoRegistro) {
    this.ponto.marcarAgora(seq as 1 | 2 | 3, tipo);
  }

  async encerrar() {
    await this.ponto.encerrarJornada(async saldoMin => {
      const horas = this.fmt(Math.abs(saldoMin));
      return confirm(`Você está encerrando ${horas} abaixo da meta de 6h15. Isso será lançado como saldo negativo no banco de horas. Encerrar mesmo assim?`);
    });
  }

  reiniciar() {
    if (confirm('Isso apaga todos os registros de hoje. Deseja recomeçar a jornada?')) {
      this.ponto.reiniciarDiaDeHoje();
    }
  }
}
