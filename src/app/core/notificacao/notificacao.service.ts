import { Injectable, effect, inject, signal } from '@angular/core';
import { PontoService } from '../ponto.service';
import { ALERTA_INTERVALO_ANTECEDENCIA_MIN, ALERTA_META_ANTECEDENCIA_MIN, INTERVALO_MIN_MIN, META_COMPUTADO_MIN } from '../constants';

type ChaveAlerta = 'intervalo-perto' | 'intervalo-completo' | 'meta-perto' | 'meta-completa';

/**
 * Alertas dinâmicos calculados a partir dos horários realmente registrados (spec item 8):
 * fim do intervalo obrigatório (5min antes / aos 30min) e fim da jornada (10min antes / ao
 * atingir a meta de 6h15). Cada alerta dispara no máximo uma vez por dia.
 */
@Injectable({ providedIn: 'root' })
export class NotificacaoService {
  private readonly ponto = inject(PontoService);
  readonly permissao = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  private disparados = new Set<string>();
  private ultimoDia = '';

  constructor() {
    effect(() => {
      const dia = this.ponto.hojeKey();
      if (dia !== this.ultimoDia) {
        this.disparados.clear();
        this.ultimoDia = dia;
      }
      const calc = this.ponto.calculoHoje();
      this.verificar('intervalo-perto', calc.statusDia === 'intervalo' && (calc.intervaloEmCursoMin ?? 0) >= INTERVALO_MIN_MIN - ALERTA_INTERVALO_ANTECEDENCIA_MIN,
        'Intervalo quase completo', `Faltam ${ALERTA_INTERVALO_ANTECEDENCIA_MIN} minutos para completar os ${INTERVALO_MIN_MIN} min mínimos do intervalo.`);
      this.verificar('intervalo-completo', calc.statusDia === 'intervalo' && (calc.intervaloEmCursoMin ?? 0) >= INTERVALO_MIN_MIN,
        'Intervalo mínimo completo', 'Você já pode voltar do intervalo quando quiser.');
      this.verificar('meta-perto', calc.statusDia === 'trabalhando' && calc.restanteMetaMin <= ALERTA_META_ANTECEDENCIA_MIN && calc.restanteMetaMin > 0,
        'Quase lá', `Faltam ${Math.ceil(calc.restanteMetaMin)} minutos para atingir a meta de 6h15.`);
      this.verificar('meta-completa', calc.statusDia === 'trabalhando' && calc.tempoComputadoMin >= META_COMPUTADO_MIN,
        'Meta atingida', 'Você completou as 6h15 de tempo computado de hoje.');
    });
  }

  async pedirPermissao(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    const resultado = await Notification.requestPermission();
    this.permissao.set(resultado);
  }

  private verificar(chave: ChaveAlerta, condicao: boolean, titulo: string, corpo: string) {
    const chaveDia = chave + ':' + this.ponto.hojeKey();
    if (!condicao || this.disparados.has(chaveDia)) return;
    this.disparados.add(chaveDia);
    this.notificar(titulo, corpo);
  }

  private notificar(titulo: string, corpo: string) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(titulo, { body: corpo, icon: 'icons/icon-192x192.png' });
    }
  }
}
