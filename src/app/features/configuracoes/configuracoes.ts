import { Component, computed, inject } from '@angular/core';
import { PontoService } from '../../core/ponto.service';
import { NotificacaoService } from '../../core/notificacao/notificacao.service';
import { CorMarca, CORES_MARCA, TemaService } from '../../core/tema/tema.service';
import { formatSaldo } from '../../core/calculo/calculo';

const NOME_COR: Record<CorMarca, string> = {
  '#0f766e': 'Verde-azulado',
  '#c4007a': 'Rosa',
  '#1e40af': 'Azul',
  '#111111': 'Preto',
};

@Component({
  selector: 'app-configuracoes',
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.scss',
})
export class Configuracoes {
  readonly ponto = inject(PontoService);
  readonly notificacoes = inject(NotificacaoService);
  readonly tema = inject(TemaService);

  readonly coresMarca = CORES_MARCA.map(cor => ({ cor, nome: NOME_COR[cor] }));

  readonly totalDias = computed(() => this.ponto.diasComRegistros().length);
  readonly saldoAcumuladoLabel = computed(() => formatSaldo(this.ponto.saldoAcumuladoMin()));

  readonly rotuloPermissao = computed(() => {
    switch (this.notificacoes.permissao()) {
      case 'granted': return 'Ativadas';
      case 'denied': return 'Bloqueadas no navegador';
      default: return 'Não ativadas';
    }
  });

  pedirNotificacoes() {
    this.notificacoes.pedirPermissao();
  }

  escolherCor(cor: CorMarca) {
    this.tema.definir(cor);
  }

  async exportarBackup() {
    const dados = {
      exportadoEm: new Date().toISOString(),
      dias: this.ponto.diasComRegistros().map(d => ({ data: d.data, registros: d.registros, resumo: d.dia })),
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controle-de-ponto-backup-${this.ponto.hojeKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
