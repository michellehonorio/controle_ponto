import { Injectable, effect, signal } from '@angular/core';

const KEY = 'cp-cor-marca';

/** Opções de marca do design (seção "Marca" no Claude Design), na ordem atual: teal é o padrão. */
export const CORES_MARCA = ['#0f766e', '#c4007a', '#1e40af', '#111111'] as const;
export type CorMarca = (typeof CORES_MARCA)[number];

@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly corPrimaria = signal<CorMarca>(this.corSalva());

  constructor() {
    effect(() => {
      document.documentElement.style.setProperty('--cor-primaria', this.corPrimaria());
    });
  }

  private corSalva(): CorMarca {
    try {
      const salva = localStorage.getItem(KEY);
      if (salva && (CORES_MARCA as readonly string[]).includes(salva)) return salva as CorMarca;
    } catch { /* localStorage indisponível */ }
    return CORES_MARCA[0];
  }

  definir(cor: CorMarca) {
    this.corPrimaria.set(cor);
    try { localStorage.setItem(KEY, cor); } catch { /* localStorage indisponível */ }
  }
}
