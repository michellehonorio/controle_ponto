import { pad } from './calculo';

/** Aplica a máscara HH:MM enquanto o usuário digita (chamado em cada tecla). */
export function mask(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : d.slice(0, 2) + ':' + d.slice(2);
}

/** Normaliza o valor ao sair do campo, garantindo HH:MM válido (ou string vazia). */
export function norm(v: string): string {
  const d = v.replace(/\D/g, '');
  if (!d) return '';
  const p4 = d.padStart(4, '0').slice(0, 4);
  const h = Math.min(23, Number(p4.slice(0, 2)));
  const m = Math.min(59, Number(p4.slice(2)));
  return pad(h) + ':' + pad(m);
}
