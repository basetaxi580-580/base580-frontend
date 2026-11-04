import { evaluarFormula, indiceColumna, letraColumna, separarRef } from './boletos-formula';
import { leerNumero } from './boletos-grid';

/**
 * Réplica fiel de PAGO BOLETOS 2026.xlsx.
 *
 * El libro se extrae del .xlsx a JSON (`src/app/pages/boletos-libro.data.json`,
 * generado por `scripts/extract_boletos_libro.py`). Cada hoja conserva sus celdas,
 * fórmulas, estilos, anchos y color de pestaña. Este motor evalúa las fórmulas en
 * cadena entre hojas (BASE → captura → TOTAL), igual que Excel.
 */

export type ValorLibro = string | number | boolean | null;
/** [valor, fórmula, índice de estilo, valor calculado por Excel] */
export type CeldaLibro = [ValorLibro, string | null, number, ValorLibro];

export type EstiloLibro = {
  /** Relleno #RRGGBB */
  bg?: string;
  /** Color de fuente #RRGGBB */
  fc?: string;
  b?: boolean;
  i?: boolean;
  /** Subrayado */
  u?: boolean;
  /** Tamaño en pt (si no viene: 11, la base del libro) */
  sz?: number;
  /** Fuente (si no viene: Calibri, la base del libro) */
  fn?: string;
  ha?: string;
  /** Alineación vertical (si no viene: abajo, como Excel) */
  va?: string;
  /** Ajustar texto */
  wr?: boolean;
  /** Formato numérico: g, n2, p, m{decimales}[a contable][r negativos en rojo] */
  nf?: string;
  /** Bordes por lado con grosor en px: "t2r1b1l2" */
  bd?: string;
};

export type HojaLibro = {
  name: string;
  tab: string | null;
  /** Última fila/columna con datos. */
  maxRow: number;
  maxCol: number;
  /** Filas/columnas que se muestran (datos + margen vacío, como Excel). */
  verFilas?: number;
  verCols?: number;
  /** Ancho/alto predeterminados de la hoja en px. */
  anchoDef?: number;
  altoDef?: number;
  /** Anchos/altos en px que difieren del predeterminado. */
  cols: Record<string, number>;
  rows: Record<string, number>;
  hiddenCols: string[];
  hiddenRows: number[];
  freeze: string | null;
  cells: Record<string, CeldaLibro>;
};

export type LibroJson = {
  version: number;
  source: string;
  /** Índice de la hoja activa al guardar el Excel. */
  active?: number;
  styles: EstiloLibro[];
  sheets: HojaLibro[];
};

export type ValorCalculado =
  | { tipo: 'vacio' }
  | { tipo: 'numero'; n: number }
  | { tipo: 'texto'; t: string }
  | { tipo: 'error'; e: string };

const VACIO: ValorCalculado = { tipo: 'vacio' };

export class MotorLibro {
  private readonly porNombre = new Map<string, HojaLibro>();
  private readonly memo = new Map<string, ValorCalculado>();
  private readonly evaluando = new Set<string>();
  private entradas: Record<string, string>;

  constructor(
    readonly libro: LibroJson,
    entradas: Record<string, string> = {},
  ) {
    for (const hoja of libro.sheets) this.porNombre.set(hoja.name, hoja);
    this.entradas = { ...entradas };
  }

  get hojas(): HojaLibro[] {
    return this.libro.sheets;
  }

  /** Busca la hoja por nombre exacto; si no, sin distinguir mayúsculas ni espacios extremos (como Excel). */
  hoja(nombre: string): HojaLibro | undefined {
    const exacta = this.porNombre.get(nombre);
    if (exacta) return exacta;
    const buscado = nombre.trim().toUpperCase();
    return this.libro.sheets.find((hoja) => hoja.name.trim().toUpperCase() === buscado);
  }

  estilo(hoja: string, ref: string): EstiloLibro {
    const celda = this.hoja(hoja)?.cells[ref];
    return celda ? (this.libro.styles[celda[2]] ?? {}) : {};
  }

  esFormula(hoja: string, ref: string): boolean {
    return this.contenido(hoja, ref).formula !== null;
  }

  /** Celdas con fórmula en el Excel original: se respetan y no se editan. */
  protegida(hoja: string, ref: string): boolean {
    return !!this.hoja(hoja)?.cells[ref]?.[1];
  }

  /** Hoja con la que abre el libro (la activa del Excel). */
  hojaInicial(): HojaLibro {
    return this.libro.sheets[this.libro.active ?? 0] ?? this.libro.sheets[0];
  }

  /** Texto que se edita en la celda: la fórmula o el valor capturado. */
  textoEdicion(hoja: string, ref: string): string {
    const clave = claveDe(hoja, ref);
    if (clave in this.entradas) return this.entradas[clave];
    return textoOriginal(this.hoja(hoja)?.cells[ref]);
  }

  /** Cambia el contenido de una celda. Si vuelve a su valor original, se descarta la captura. */
  establecer(hoja: string, ref: string, texto: string): void {
    const clave = claveDe(hoja, ref);
    const original = textoOriginal(this.hoja(hoja)?.cells[ref]);
    if (texto === original) delete this.entradas[clave];
    else this.entradas[clave] = texto;
    this.memo.clear();
  }

  /** Capturas del usuario (clave `Hoja!A1`) para guardarlas. */
  capturas(): Record<string, string> {
    return { ...this.entradas };
  }

  /** Reemplaza todas las capturas (al restaurar o deshacer). */
  reemplazarCapturas(entradas: Record<string, string>): void {
    this.entradas = { ...entradas };
    this.memo.clear();
  }

  tieneCaptura(hoja: string, ref: string): boolean {
    return claveDe(hoja, ref) in this.entradas;
  }

  valor(hoja: string, ref: string): ValorCalculado {
    const clave = claveDe(hoja, ref);
    const previo = this.memo.get(clave);
    if (previo) return previo;
    const { formula, valor } = this.contenido(hoja, ref);
    let resultado: ValorCalculado;
    if (formula !== null) {
      if (this.evaluando.has(clave)) return { tipo: 'error', e: '#¡CÍCLICA!' };
      this.evaluando.add(clave);
      try {
        const r = evaluarFormula(formula, (x, enRango) => this.leer(hoja, x, !!enRango));
        if (typeof r === 'number') resultado = Number.isFinite(r) ? { tipo: 'numero', n: r } : { tipo: 'error', e: '#¡NUM!' };
        else resultado = { tipo: 'error', e: r };
      } finally {
        this.evaluando.delete(clave);
      }
    } else {
      resultado = desdeValor(valor);
    }
    this.memo.set(clave, resultado);
    return resultado;
  }

  /** Número de una celda (0 si vacía o no numérica). Útil para totales y pruebas. */
  numero(hoja: string, ref: string): number {
    const v = this.valor(hoja, ref);
    return v.tipo === 'numero' ? v.n : 0;
  }

  private contenido(hoja: string, ref: string): { formula: string | null; valor: ValorLibro } {
    const clave = claveDe(hoja, ref);
    if (clave in this.entradas) {
      const texto = this.entradas[clave].trim();
      if (texto.startsWith('=')) return { formula: texto, valor: null };
      if (texto === '') return { formula: null, valor: null };
      const numero = leerNumero(texto);
      return { formula: null, valor: numero ?? this.entradas[clave] };
    }
    const celda = this.hoja(hoja)?.cells[ref];
    if (!celda) return { formula: null, valor: null };
    return { formula: celda[1], valor: celda[0] };
  }

  private leer(hojaBase: string, ref: string, enRango: boolean): number | string | null {
    const partes = separarRef(ref);
    const destino = partes.hoja === null ? this.hoja(hojaBase) : this.hoja(partes.hoja);
    if (!destino) return '#¡REF!';
    const v = this.valor(destino.name, partes.ref);
    if (v.tipo === 'vacio') return null;
    if (v.tipo === 'numero') return v.n;
    if (v.tipo === 'error') return v.e;
    // Texto: dentro de rangos se ignora; en aritmética Excel convierte el texto numérico.
    if (enRango) return null;
    const numero = leerNumero(v.t);
    return numero == null ? '#¡VALOR!' : numero;
  }
}

export function claveDe(hoja: string, ref: string): string {
  return `${hoja}!${ref}`;
}

/**
 * Fusiona capturas cuando otro equipo guardó antes (conflicto 409).
 * Parte del estado del servidor y aplica encima solo las celdas que este equipo
 * cambió desde la última sincronización (`base` → `local`). Gana el último por celda.
 */
export function fusionarCapturas(
  servidor: Record<string, string>,
  base: Record<string, string>,
  local: Record<string, string>,
): Record<string, string> {
  const resultado = { ...servidor };
  const claves = new Set([...Object.keys(base), ...Object.keys(local)]);
  for (const clave of claves) {
    if (base[clave] === local[clave]) continue;
    if (clave in local) resultado[clave] = local[clave];
    else delete resultado[clave];
  }
  return resultado;
}

export function mismasCapturas(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((clave) => clave in b && a[clave] === b[clave]);
}

function desdeValor(valor: ValorLibro): ValorCalculado {
  if (valor === null || valor === '') return VACIO;
  if (typeof valor === 'number') return { tipo: 'numero', n: valor };
  if (typeof valor === 'boolean') return { tipo: 'numero', n: valor ? 1 : 0 };
  return { tipo: 'texto', t: valor };
}

function textoOriginal(celda: CeldaLibro | undefined): string {
  if (!celda) return '';
  if (celda[1]) return celda[1];
  const valor = celda[0];
  return valor === null ? '' : String(valor);
}

/** Redondeo de visualización como Excel: decimal y "mitad hacia afuera". */
export function redondearExcel(n: number, decimales: number): number {
  const signo = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const texto = String(abs);
  if (texto.includes('e')) return (signo * Math.round(abs * 10 ** decimales)) / 10 ** decimales;
  return signo * Number(`${Math.round(Number(`${texto}e${decimales}`))}e-${decimales}`);
}

export type TextoCelda = {
  texto: string;
  /** Para formato contable: el signo de pesos va pegado a la izquierda. */
  simbolo?: string;
  rojo?: boolean;
  /** Alineación por defecto según el tipo (números a la derecha). */
  alinear: 'left' | 'right' | 'center';
  error?: boolean;
};

/** Formatea un valor calculado con el formato numérico de la celda. */
export function formatear(valor: ValorCalculado, nf: string | undefined): TextoCelda {
  if (valor.tipo === 'vacio') return { texto: '', alinear: 'left' };
  if (valor.tipo === 'error') return { texto: valor.e, alinear: 'center', error: true };
  if (valor.tipo === 'texto') return { texto: valor.t, alinear: 'left' };
  const n = valor.n;
  const formato = nf ?? 'g';
  if (formato.startsWith('m')) {
    const decimales = Number(formato[1]) || 0;
    const contable = formato.includes('a');
    const rojo = formato.includes('r') && n < 0;
    const redondo = redondearExcel(n, decimales);
    const cifra = Math.abs(redondo).toLocaleString('en-US', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    if (contable) {
      if (redondo === 0) return { texto: '-', simbolo: '$', alinear: 'right' };
      return { texto: redondo < 0 ? `-${cifra}` : cifra, simbolo: '$', alinear: 'right', rojo };
    }
    return { texto: `${redondo < 0 ? '-' : ''}$${cifra}`, alinear: 'right', rojo };
  }
  if (formato === 'n2') {
    return { texto: redondearExcel(n, 2).toFixed(2), alinear: 'right' };
  }
  if (formato === 'p') {
    return { texto: `${redondearExcel(n * 100, 0)}%`, alinear: 'right' };
  }
  return { texto: general(n), alinear: 'right' };
}

/** Formato "General" de Excel: hasta 11 caracteres, sin separador de miles. */
function general(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e11) return String(n);
  const preciso = Number(n.toPrecision(10));
  const texto = String(preciso);
  if (texto.length <= 11 || texto.includes('e')) return texto;
  const enteros = Math.trunc(Math.abs(preciso)).toString().length;
  const decimales = Math.max(0, 10 - enteros - (preciso < 0 ? 1 : 0));
  return String(redondearExcel(preciso, decimales));
}

/** Columnas visibles A..maxCol de una hoja. */
export function columnasDeHoja(hoja: HojaLibro): string[] {
  const ocultas = new Set(hoja.hiddenCols);
  return Array.from({ length: hoja.verCols ?? hoja.maxCol }, (_, i) => letraColumna(i)).filter((letra) => !ocultas.has(letra));
}

/** Filas visibles 1..maxRow de una hoja. */
export function filasDeHoja(hoja: HojaLibro): number[] {
  const ocultas = new Set(hoja.hiddenRows);
  return Array.from({ length: hoja.verFilas ?? hoja.maxRow }, (_, i) => i + 1).filter((fila) => !ocultas.has(fila));
}

/** Ancho de columna en px (el predeterminado de la hoja si no tiene uno propio). */
export function anchoColumna(hoja: HojaLibro, letra: string): number {
  return hoja.cols[letra] ?? hoja.anchoDef ?? 64;
}

/** Alto de fila en px (el predeterminado de la hoja si no tiene uno propio). */
export function altoFila(hoja: HojaLibro, fila: number): number {
  return hoja.rows[String(fila)] ?? hoja.altoDef ?? 20;
}

export { indiceColumna, letraColumna };
