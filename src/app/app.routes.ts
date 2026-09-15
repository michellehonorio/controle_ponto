import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'hoje', pathMatch: 'full' },
  { path: 'hoje', loadComponent: () => import('./features/hoje/hoje').then(m => m.Hoje) },
  { path: 'historico', loadComponent: () => import('./features/historico/historico').then(m => m.Historico) },
  { path: 'configuracoes', loadComponent: () => import('./features/configuracoes/configuracoes').then(m => m.Configuracoes) },
  { path: '**', redirectTo: 'hoje' },
];
