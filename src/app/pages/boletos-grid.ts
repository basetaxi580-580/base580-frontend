export type CampoHoja = 'zona' | 'precio' | 'descuento' | 'sitio' | 'plata' | 'neto' | 'cantidad' | 'importe';

export type Posicion = { bloque: number; fila: number; col: number };

export function columnasDeBloque(plata: boolean, catalogo = false): CampoHoja[] {
  const columnas: CampoHoja[] = ['zona', 'precio', 'descuento', 'sitio'];
  if (plata) columnas.push('plata');
  columnas.push('neto');
  // Hojas BASE* del Excel son catálogo (sin SERV). Captura lleva cantidad/importe.
  if (!catalogo) columnas.push('cantidad', 'importe');
  return columnas;
}

export function moverEnBloque(altura: number, ancho: number, actual: Posicion, deltaFila: number, deltaCol: number): Posicion {
  if (altura <= 0 || ancho <= 0) return actual;
  return {
    bloque: actual.bloque,
    fila: clamp(actual.fila + deltaFila, 0, altura - 1),
    col: clamp(actual.col + deltaCol, 0, ancho - 1),
  };
}

export function moverEnHoja(
  alturas: number[],
  anchos: number[],
  actual: Posicion,
  deltaFila: number,
  deltaCol: number,
): Posicion {
  const total = alturas.length;
  if (!total || alturas[actual.bloque] <= 0) return actual;

  if (deltaCol !== 0 && deltaFila === 0) {
    const col = actual.col + deltaCol;
    if (col >= 0 && col < anchos[actual.bloque]) return { ...actual, col };
    const paso = deltaCol > 0 ? 1 : -1;
    const hayPareja = paso > 0 ? actual.bloque % 2 === 0 : actual.bloque % 2 === 1;
    const vecino = actual.bloque + paso;
    if (hayPareja && vecino >= 0 && vecino < total && alturas[vecino] > 0 && anchos[vecino] > 0) {
      return {
        bloque: vecino,
        fila: Math.min(actual.fila, alturas[vecino] - 1),
        col: paso > 0 ? 0 : anchos[vecino] - 1,
      };
    }
    return actual;
  }

  if (deltaFila !== 0 && deltaCol === 0) {
    const fila = actual.fila + deltaFila;
    if (fila >= 0 && fila < alturas[actual.bloque]) return { ...actual, fila };
    const paso = deltaFila > 0 ? 2 : -2;
    for (let bloque = actual.bloque + paso; bloque >= 0 && bloque < total; bloque += paso) {
      if (alturas[bloque] > 0 && anchos[bloque] > 0) {
        return {
          bloque,
          fila: paso > 0 ? 0 : alturas[bloque] - 1,
          col: Math.min(actual.col, anchos[bloque] - 1),
        };
      }
    }
  }

  return actual;
}

export function enRectangulo(ancla: Posicion, foco: Posicion, celda: Posicion): boolean {
  if (ancla.bloque !== foco.bloque || celda.bloque !== ancla.bloque) return false;
  const fila1 = Math.min(ancla.fila, foco.fila);
  const fila2 = Math.max(ancla.fila, foco.fila);
  const col1 = Math.min(ancla.col, foco.col);
  const col2 = Math.max(ancla.col, foco.col);
  return celda.fila >= fila1 && celda.fila <= fila2 && celda.col >= col1 && celda.col <= col2;
}

export function parseTsv(texto: string): string[][] {
  const lineas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lineas.length > 1 && lineas[lineas.length - 1] === '') lineas.pop();
  return lineas.map((linea) => linea.split('\t'));
}

export function leerNumero(texto: string): number | null {
  let limpio = texto.trim().replace(/[$\s]/g, '');
  if (!limpio || limpio === '-') return null;
  const coma = limpio.lastIndexOf(',');
  const punto = limpio.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    limpio = coma > punto ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '');
  } else if (coma >= 0) {
    limpio = limpio.replace(',', '.');
  } else if ((limpio.match(/\./g) || []).length > 1) {
    limpio = limpio.replace(/\./g, '');
  }
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function clamp(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}
