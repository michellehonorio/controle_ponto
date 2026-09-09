import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NotificacaoService } from './core/notificacao/notificacao.service';
import { TemaService } from './core/tema/tema.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // injetados aqui só para ficarem vivos durante toda a sessão do app (alertas e cor de marca)
  private readonly notificacoes = inject(NotificacaoService);
  private readonly tema = inject(TemaService);
}
