import { Component, computed, inject } from '@angular/core';
import { PontoService } from '../../core/ponto.service';
import { mask, norm } from '../../core/calculo/mask';
import { formatSaldo, pad } from '../../core/calculo/calculo';
import { dataCurta } from '../../core/data-utils';
import { Registro, TipoRegistro } from '../../core/models';

interface CampoView {
  registroId?: number;
  horario: string;
}

interface PeriodoView {
  titulo: string;
  entrada: CampoView;
  saida: CampoView;
}

interface DiaView {
  data: string;
  dataCurta: string;
  status: string;
  periodos: PeriodoView[];
  tempoComputado: string;
  saldoLabel: string;
  saldoClasse: 'positivo' | 'negativo' | 'neutro';
}

function fmt(min: number): string {
  const m = Math.max(0, Math.round(min));
  return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
}

@Component({
  selector: 'app-historico',
  templateUrl: './historico.html',
  styleUrl: './historico.scss',
})
export class Historico {
  readonly ponto = inject(PontoService);

  readonly saldoAcumuladoLabel = computed(() => formatSaldo(this.ponto.saldoAcumuladoMin()));
  readonly saldoAcumuladoClasse = computed(() => {
    const v = this.ponto.saldoAcumuladoMin();
    return v > 0 ? 'positivo' : v < 0 ? 'negativo' : 'neutro';
  });

  readonly dias = computed<DiaView[]>(() => this.ponto.diasComRegistros().map(({ data, registros, dia, calc }) => {
    const acha = (seq: 1 | 2 | 3, tipo: TipoRegistro): CampoView => {
      const r = registros.find((x: Registro) => x.sequencia === seq && x.tipo === tipo);
      return { registroId: r?.id, horario: r?.horario ?? '' };
    };
    const periodos: PeriodoView[] = [1, 2, 3].map(seq => ({
      titulo: ['1º Período', '2º Período', '3º Período'][seq - 1],
      entrada: acha(seq as 1 | 2 | 3, 'entrada'),
      saida: acha(seq as 1 | 2 | 3, 'saida'),
    })).filter(p => p.entrada.horario || p.saida.horario);

    const saldoMin = dia?.saldoDiaMin ?? 0;
    return {
      data,
      dataCurta: dataCurta(data),
      status: dia?.encerrada ? 'encerrada' : calc.statusDia === 'antes' ? 'sem registros' : 'em aberto',
      periodos,
      tempoComputado: fmt(calc.tempoComputadoMin),
      saldoLabel: dia?.encerrada ? formatSaldo(saldoMin) : '—',
      saldoClasse: !dia?.encerrada ? 'neutro' : saldoMin > 0 ? 'positivo' : saldoMin < 0 ? 'negativo' : 'neutro',
    };
  }));

  onInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    input.value = mask(input.value);
  }

  onBlur(data: string, seq: number, tipo: TipoRegistro, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const normalizado = norm(input.value);
    this.ponto.marcar(data, seq as 1 | 2 | 3, tipo, normalizado, 'manual');
  }

  excluir(data: string, registroId: number | undefined) {
    if (registroId === undefined) return;
    if (confirm('Excluir este registro? O saldo do dia será recalculado.')) {
      this.ponto.excluirRegistro(registroId, data);
    }
  }
}
