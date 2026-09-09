export function dataKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function horaAtual(d: Date): string {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function minutosDoDia(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function dataLegivel(dataStr: string): string {
  const [y, m, d] = dataStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const texto = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function dataCurta(dataStr: string): string {
  const [, m, d] = dataStr.split('-').map(Number);
  return String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0');
}
