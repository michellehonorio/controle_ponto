import { Component, computed, inject, signal } from '@angular/core';
import { PontoService } from '../../core/ponto.service';
import { mask, norm } from '../../core/calculo/mask';
import { dataKey } from '../../core/data-utils';
import { TipoRegistro } from '../../core/models';

@Component({
  selector: 'app-registro-manual',
  templateUrl: './registro-manual.html',
  styleUrl: './registro-manual.scss',
})
export class RegistroManual {
  readonly ponto = inject(PontoService);

  readonly data = signal(dataKey(new Date()));
  readonly sequencia = signal<1 | 2 | 3>(1);
  readonly tipo = signal<TipoRegistro>('entrada');
  readonly horario = signal('');
  readonly confirmacao = signal('');

  readonly maxData = computed(() => dataKey(new Date()));

  selecionarSequencia(s: 1 | 2 | 3) {
    this.sequencia.set(s);
  }

  selecionarTipo(t: TipoRegistro) {
    this.tipo.set(t);
  }

  onInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const masked = mask(input.value);
    input.value = masked;
    this.horario.set(masked);
  }

  async salvar() {
    const normalizado = norm(this.horario());
    if (!normalizado) return;
    await this.ponto.marcar(this.data(), this.sequencia(), this.tipo(), normalizado, 'manual');
    this.confirmacao.set(`${this.tipo() === 'entrada' ? 'Entrada' : 'Saída'} do ${this.sequencia()}º período em ${this.data().split('-').reverse().join('/')} registrada às ${normalizado}.`);
    this.horario.set('');
  }
}
