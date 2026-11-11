import { desplazarColumnas, desplazarFilas, evaluarFormula, indiceColumna, letraColumna, separarRef } from './boletos-formula';
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
/** Operación estructural persistida del libro. */
export type OpLibro =
  | { hoja: string; tipo: 'insCol' | 'delCol'; col: number }
  | { hoja: string; tipo: 'insFila' | 'delFila'; fila: number }
  | { hoja: string; tipo: 'renHoja'; nuevo: string }
  | { hoja: string; tipo: 'delHoja' };
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

export type PestanaPersonalizada = { id: string; nombre: string };

export type ValorCalculado =
  | { tipo: 'vacio' }
  | { tipo: 'numero'; n: number }
  | { tipo: 'texto'; t: string }
  | { tipo: 'error'; e: string };

const VACIO: ValorCalculado = { tipo: 'vacio' };

export class MotorLibro {
  private porNombre = new Map<string, HojaLibro>();
  private readonly memo = new Map<string, ValorCalculado>();
  private readonly evaluando = new Set<string>();
  private entradas: Record<string, string>;
  /** Formato aplicado por el usuario encima del Excel (clave `Hoja!A1`). */
  private formatosMap: Record<string, EstiloLibro> = {};
  /** Libro original inmutable del Excel. */
  private readonly original: LibroJson;
  /** Operaciones de columna aplicadas, en orden. */
  private ops: OpLibro[] = [];
  private personales: PestanaPersonalizada[] = [];
  /** Copia de trabajo (el original con columnas insertadas/eliminadas). */
  libro: LibroJson;

  constructor(libro: LibroJson, entradas: Record<string, string> = {}) {
    this.original = clonarLibro(libro);
    this.libro = clonarLibro(libro);
    this.indexar();
    this.entradas = { ...entradas };
  }

  private indexar(): void {
    this.porNombre = new Map<string, HojaLibro>();
    for (const hoja of this.libro.sheets) this.porNombre.set(hoja.name, hoja);
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

  /** Estilo original del Excel para una celda. */
  estiloBase(hoja: string, ref: string): EstiloLibro {
    const celda = this.hoja(hoja)?.cells[ref];
    return celda ? (this.libro.styles[celda[2]] ?? {}) : {};
  }

  /** Estilo efectivo: el del Excel con el formato que el usuario aplicó encima. */
  estilo(hoja: string, ref: string): EstiloLibro {
    const override = this.formatosMap[claveDe(hoja, ref)];
    const base = this.estiloBase(hoja, ref);
    return override ? { ...base, ...override } : base;
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

  /** Formato aplicado por el usuario, por celda (clave `Hoja!A1`). */
  formatos(): Record<string, EstiloLibro> {
    return clonarFormatos(this.formatosMap);
  }

  /** Reemplaza todo el formato del usuario (al cargar, restaurar o deshacer). */
  reemplazarFormatos(formatos: Record<string, EstiloLibro>): void {
    this.formatosMap = clonarFormatos(formatos);
  }

  /** Formato propio de una celda (sin el del Excel); undefined si no tiene. */
  formatoDe(hoja: string, ref: string): EstiloLibro | undefined {
    return this.formatosMap[claveDe(hoja, ref)];
  }

  tieneFormato(hoja: string, ref: string): boolean {
    return claveDe(hoja, ref) in this.formatosMap;
  }

  /**
   * Aplica un cambio parcial de estilo a una celda. Una propiedad que vuelve a
   * coincidir con el Excel original se descarta; si la celda queda sin cambios,
   * se elimina su formato.
   */
  establecerFormato(hoja: string, ref: string, cambio: Partial<EstiloLibro>): void {
    const clave = claveDe(hoja, ref);
    const base = this.estiloBase(hoja, ref);
    const actual: EstiloLibro = { ...(this.formatosMap[clave] ?? {}) };
    for (const llave of Object.keys(cambio) as (keyof EstiloLibro)[]) {
      const valor = cambio[llave];
      if (valor === undefined || valor === null || valor === '') delete actual[llave];
      else (actual as Record<string, unknown>)[llave] = valor;
      if (igualAlBase(actual, base, llave)) delete actual[llave];
    }
    if (Object.keys(actual).length === 0) delete this.formatosMap[clave];
    else this.formatosMap[clave] = actual;
  }

  /** Quita todo el formato que el usuario aplicó en una celda (vuelve al Excel). */
  limpiarFormato(hoja: string, ref: string): void {
    delete this.formatosMap[claveDe(hoja, ref)];
  }

  /** Operaciones de columna aplicadas (para guardar/deshacer). */
  estructura(): OpLibro[] {
    return this.ops.map((op) => ({ ...op }));
  }

  /** Reconstruye el libro desde el original aplicando una lista de operaciones (al cargar/deshacer). */
  aplicarEstructura(ops: OpLibro[]): void {
    this.ops = ops.map((op) => ({ ...op }));
    this.reconstruir();
  }

  private reconstruir(): void {
    this.libro = clonarLibro(this.original);
    this.indexar();
    const nuevas = this.personales.map((p) => hojaPersonalizada(p.nombre));
    let ultimaBase = -1;
    for (let i = 0; i < this.libro.sheets.length; i++) {
      if (this.libro.sheets[i].name.trim().toUpperCase().startsWith('BASE ')) ultimaBase = i;
    }
    this.libro.sheets.splice(ultimaBase + 1, 0, ...nuevas);
    this.indexar();
    for (const op of this.ops) this.ejecutarOp(op);
    this.memo.clear();
  }

  esOriginal(nombre: string): boolean { return this.original.sheets.some((h) => h.name.trim().toUpperCase() === nombre.trim().toUpperCase()); }

  personalizadas(): PestanaPersonalizada[] { return this.personales.map((p) => ({ ...p })); }

  agregarPersonalizada(pestana: PestanaPersonalizada): boolean {
    if (this.hoja(pestana.nombre)) return false;
    this.personales.push({ ...pestana });
    this.libro.sheets.push(hojaPersonalizada(pestana.nombre));
    this.indexar();
    this.memo.clear();
    return true;
  }

  cargarPersonalizadas(pestanas: PestanaPersonalizada[]): void {
    this.personales = pestanas.map((p) => ({ ...p }));
    this.reconstruir();
  }

  renombrarPersonalizada(id: string, nombre: string): boolean {
    const pestana = this.personales.find((p) => p.id === id);
    if (!pestana || this.hoja(nombre)) return false;
    const anterior = pestana.nombre;
    const hoja = this.hoja(anterior);
    if (!hoja) return false;
    for (const otra of this.libro.sheets) {
      for (const celda of Object.values(otra.cells)) if (celda[1]) celda[1] = renombrarReferenciaHoja(celda[1], anterior, nombre);
    }
    this.entradas = renombrarClaves(this.entradas, anterior, nombre);
    this.entradas = renombrarValoresFormula(this.entradas, anterior, nombre);
    this.formatosMap = renombrarClaves(this.formatosMap, anterior, nombre);
    hoja.name = nombre;
    pestana.nombre = nombre;
    this.indexar();
    this.memo.clear();
    return true;
  }

  renombrarHoja(nombre: string, nuevo: string): boolean {
    const hoja = this.hoja(nombre);
    if (!hoja || this.hoja(nuevo)) return false;
    const anterior = hoja.name;
    this.ops.push({ hoja: anterior, tipo: 'renHoja', nuevo });
    this.entradas = renombrarClaves(this.entradas, anterior, nuevo);
    this.entradas = renombrarValoresFormula(this.entradas, anterior, nuevo);
    this.formatosMap = renombrarClaves(this.formatosMap, anterior, nuevo);
    this.reconstruir();
    this.memo.clear();
    return true;
  }

  eliminarPersonalizada(id: string): boolean {
    const pestana = this.personales.find((p) => p.id === id);
    if (!pestana || this.referenciasAHoja(pestana.nombre)) return false;
    this.personales = this.personales.filter((p) => p.id !== id);
    this.entradas = sinHoja(this.entradas, pestana.nombre);
    this.formatosMap = sinHoja(this.formatosMap, pestana.nombre);
    this.reconstruir();
    return true;
  }

  eliminarHoja(nombre: string): boolean {
    const hoja = this.hoja(nombre);
    if (!hoja || this.referenciasAHoja(hoja.name)) return false;
    this.ops.push({ hoja: hoja.name, tipo: 'delHoja' });
    this.entradas = sinHoja(this.entradas, hoja.name);
    this.formatosMap = sinHoja(this.formatosMap, hoja.name);
    this.reconstruir();
    return true;
  }

  private referenciasAHoja(nombre: string): boolean {
    for (const hoja of this.libro.sheets) for (const celda of Object.values(hoja.cells)) if (celda[1] && contieneReferenciaHoja(celda[1], nombre)) return true;
    for (const valor of Object.values(this.entradas)) if (valor.startsWith('=') && contieneReferenciaHoja(valor, nombre)) return true;
    return false;
  }

  /** Inserta una columna en `col` (0-based). Desplaza celdas, fórmulas, anchos y capturas. */
  insertarColumna(hojaNombre: string, col: number): boolean {
    const hoja = this.hoja(hojaNombre);
    if (!hoja || col < 0) return false;
    const op: OpLibro = { hoja: hoja.name, tipo: 'insCol', col };
    this.ops.push(op);
    this.reconstruir();
    this.entradas = desplazarClaves(this.entradas, hoja.name, col, 1);
    this.formatosMap = desplazarClaves(this.formatosMap, hoja.name, col, 1);
    this.memo.clear();
    return true;
  }

  /** Elimina la columna `col`. Si alguna fórmula la referencia, no la elimina y dice cuál. */
  eliminarColumna(hojaNombre: string, col: number): { ok: boolean; motivo?: string } {
    const hoja = this.hoja(hojaNombre);
    if (!hoja || col < 0) return { ok: false, motivo: 'Columna no válida.' };
    const usada = this.columnaReferenciada(hoja.name, col);
    if (usada) {
      return { ok: false, motivo: `No se puede eliminar la columna ${letraColumna(col)}: la usan fórmulas (p. ej. ${usada}).` };
    }
    const op: OpLibro = { hoja: hoja.name, tipo: 'delCol', col };
    this.ops.push(op);
    this.reconstruir();
    this.entradas = desplazarClaves(this.entradas, hoja.name, col, -1);
    this.formatosMap = desplazarClaves(this.formatosMap, hoja.name, col, -1);
    this.memo.clear();
    return { ok: true };
  }

  insertarFila(hojaNombre: string, fila: number): boolean {
    const hoja = this.hoja(hojaNombre);
    if (!hoja || fila < 1 || fila > hoja.maxRow + 1) return false;
    const op: OpLibro = { hoja: hoja.name, tipo: 'insFila', fila };
    this.ops.push(op);
    this.reconstruir();
    this.entradas = desplazarClavesFila(this.entradas, hoja.name, fila, 1);
    this.formatosMap = desplazarClavesFila(this.formatosMap, hoja.name, fila, 1);
    this.memo.clear();
    return true;
  }

  eliminarFila(hojaNombre: string, fila: number): { ok: boolean; motivo?: string } {
    const hoja = this.hoja(hojaNombre);
    if (!hoja || fila < 1 || fila > hoja.maxRow) return { ok: false, motivo: 'Fila no válida.' };
    const usada = this.filaReferenciada(hoja.name, fila);
    if (usada) return { ok: false, motivo: `No se puede eliminar la fila ${fila}: la usan fórmulas (p. ej. ${usada}).` };
    this.ops.push({ hoja: hoja.name, tipo: 'delFila', fila });
    this.reconstruir();
    this.entradas = desplazarClavesFila(this.entradas, hoja.name, fila, -1);
    this.formatosMap = desplazarClavesFila(this.formatosMap, hoja.name, fila, -1);
    this.memo.clear();
    return { ok: true };
  }

  private filaReferenciada(hojaNombre: string, fila: number): string | null {
    for (const hoja of this.libro.sheets) for (const [ref, celda] of Object.entries(hoja.cells)) {
      if (celda[1] && desplazarFilas(celda[1], hoja.name, { hoja: hojaNombre, fila, delta: -1 }).refInvalida) return `${hoja.name.trim()}!${ref}`;
    }
    return null;
  }

  /** Primera fórmula (de cualquier hoja) que referencia la columna `col` de `hojaNombre`, o null. */
  private columnaReferenciada(hojaNombre: string, col: number): string | null {
    for (const hoja of this.libro.sheets) {
      for (const [ref, celda] of Object.entries(hoja.cells)) {
        if (!celda[1]) continue;
        if (desplazarColumnas(celda[1], hoja.name, { hoja: hojaNombre, col, delta: -1 }).refInvalida) {
          return `${hoja.name.trim()}!${ref}`;
        }
      }
    }
    return null;
  }

  private ejecutarOp(op: OpLibro): void {
    const hoja = this.hoja(op.hoja);
    if (!hoja) return;
    if (op.tipo === 'renHoja') {
      for (const otra of this.libro.sheets) {
        for (const celda of Object.values(otra.cells)) if (celda[1]) celda[1] = renombrarReferenciaHoja(celda[1], hoja.name, op.nuevo);
      }
      hoja.name = op.nuevo;
      this.indexar();
      return;
    }
    if (op.tipo === 'delHoja') {
      this.libro.sheets = this.libro.sheets.filter((otra) => otra !== hoja);
      this.indexar();
      return;
    }
    if (op.tipo === 'insFila' || op.tipo === 'delFila') {
      const delta = op.tipo === 'insFila' ? 1 : -1;
      const celdas: Record<string, CeldaLibro> = {};
      for (const [ref, celda] of Object.entries(hoja.cells)) {
        const match = /^([A-Z]+)(\d+)$/.exec(ref);
        if (!match) { celdas[ref] = celda; continue; }
        const actual = Number(match[2]);
        const nueva = delta > 0 ? (actual >= op.fila ? actual + 1 : actual) : actual === op.fila ? -1 : actual > op.fila ? actual - 1 : actual;
        if (nueva >= 1) celdas[`${match[1]}${nueva}`] = celda;
      }
      hoja.cells = celdas;
      hoja.rows = desplazarAlturas(hoja.rows, op.fila, delta);
      hoja.hiddenRows = desplazarFilasOcultas(hoja.hiddenRows, op.fila, delta);
      hoja.maxRow = delta > 0 ? hoja.maxRow + 1 : Math.max(1, hoja.maxRow - 1);
      if (hoja.verFilas != null) hoja.verFilas = delta > 0 ? hoja.verFilas + 1 : Math.max(1, hoja.verFilas - 1);
      for (const otra of this.libro.sheets) for (const celda of Object.values(otra.cells)) if (celda[1]) celda[1] = desplazarFilas(celda[1], otra.name, { hoja: hoja.name, fila: op.fila, delta }).formula;
      return;
    }
    if (op.tipo !== 'insCol' && op.tipo !== 'delCol') return;
    const delta = op.tipo === 'insCol' ? 1 : -1;
    // 1) Mover las celdas de la hoja.
    const celdas: Record<string, CeldaLibro> = {};
    for (const [ref, celda] of Object.entries(hoja.cells)) {
      const match = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!match) {
        celdas[ref] = celda;
        continue;
      }
      const c = indiceColumna(match[1]);
      const nueva = delta > 0 ? (c >= op.col ? c + 1 : c) : c === op.col ? -1 : c > op.col ? c - 1 : c;
      if (nueva < 0) continue;
      celdas[`${letraColumna(nueva)}${match[2]}`] = celda;
    }
    hoja.cells = celdas;
    hoja.cols = desplazarAnchos(hoja.cols, op.col, delta);
    hoja.hiddenCols = desplazarOcultas(hoja.hiddenCols, op.col, delta);
    if (delta > 0) {
      hoja.maxCol += 1;
      if (hoja.verCols != null) hoja.verCols += 1;
    } else {
      hoja.maxCol = Math.max(1, hoja.maxCol - 1);
      if (hoja.verCols != null) hoja.verCols = Math.max(1, hoja.verCols - 1);
    }
    // 2) Reescribir las fórmulas de todas las hojas (refs a la hoja afectada).
    for (const otra of this.libro.sheets) {
      for (const celda of Object.values(otra.cells)) {
        if (!celda[1]) continue;
        celda[1] = desplazarColumnas(celda[1], otra.name, { hoja: hoja.name, col: op.col, delta }).formula;
      }
    }
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

/** Copia profunda ligera de un mapa de estilos por celda. */
function clonarFormatos(f: Record<string, EstiloLibro>): Record<string, EstiloLibro> {
  const r: Record<string, EstiloLibro> = {};
  for (const [clave, estilo] of Object.entries(f)) r[clave] = { ...estilo };
  return r;
}

/** Copia profunda del libro (el original se conserva intacto). */
function clonarLibro(libro: LibroJson): LibroJson {
  return JSON.parse(JSON.stringify(libro)) as LibroJson;
}

/** Desplaza las claves `Hoja!A1` de una hoja al insertar (delta>0) o eliminar (delta<0) una columna. */
function desplazarClaves<T>(mapa: Record<string, T>, hojaNombre: string, col: number, delta: number): Record<string, T> {
  const salida: Record<string, T> = {};
  for (const [clave, valor] of Object.entries(mapa)) {
    const corte = clave.lastIndexOf('!');
    const hoja = corte < 0 ? '' : clave.slice(0, corte);
    const ref = corte < 0 ? clave : clave.slice(corte + 1);
    if (corte < 0 || hoja.trim().toUpperCase() !== hojaNombre.trim().toUpperCase()) {
      salida[clave] = valor;
      continue;
    }
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!match) {
      salida[clave] = valor;
      continue;
    }
    const c = indiceColumna(match[1]);
    let nueva: number;
    if (delta > 0) nueva = c >= col ? c + 1 : c;
    else {
      if (c === col) continue;
      nueva = c > col ? c - 1 : c;
    }
    salida[`${hoja}!${letraColumna(nueva)}${match[2]}`] = valor;
  }
  return salida;
}

function desplazarClavesFila<T>(mapa: Record<string, T>, hojaNombre: string, fila: number, delta: number): Record<string, T> {
  const salida: Record<string, T> = {};
  for (const [clave, valor] of Object.entries(mapa)) {
    const corte = clave.lastIndexOf('!');
    const hoja = corte < 0 ? '' : clave.slice(0, corte);
    const ref = corte < 0 ? clave : clave.slice(corte + 1);
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (corte < 0 || hoja.trim().toUpperCase() !== hojaNombre.trim().toUpperCase() || !match) { salida[clave] = valor; continue; }
    const actual = Number(match[2]);
    const nueva = delta > 0 ? (actual >= fila ? actual + 1 : actual) : actual === fila ? -1 : actual > fila ? actual - 1 : actual;
    if (nueva >= 1) salida[`${hoja}!${match[1]}${nueva}`] = valor;
  }
  return salida;
}

function desplazarAlturas(rows: Record<string, number>, fila: number, delta: number): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const [clave, alto] of Object.entries(rows)) {
    const actual = Number(clave);
    const nueva = delta > 0 ? (actual >= fila ? actual + 1 : actual) : actual === fila ? -1 : actual > fila ? actual - 1 : actual;
    if (nueva >= 1) salida[String(nueva)] = alto;
  }
  return salida;
}

function desplazarFilasOcultas(filas: number[], fila: number, delta: number): number[] {
  return filas.flatMap((actual) => {
    const nueva = delta > 0 ? (actual >= fila ? actual + 1 : actual) : actual === fila ? -1 : actual > fila ? actual - 1 : actual;
    return nueva >= 1 ? [nueva] : [];
  });
}

/** Desplaza los anchos de columna (claves por letra) al mover columnas. */
function desplazarAnchos(cols: Record<string, number>, col: number, delta: number): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const [letra, ancho] of Object.entries(cols)) {
    const c = indiceColumna(letra);
    if (c < 0) {
      salida[letra] = ancho;
      continue;
    }
    let nueva: number;
    if (delta > 0) nueva = c >= col ? c + 1 : c;
    else {
      if (c === col) continue;
      nueva = c > col ? c - 1 : c;
    }
    salida[letraColumna(nueva)] = ancho;
  }
  return salida;
}

/** Desplaza las letras de columnas ocultas al mover columnas. */
function desplazarOcultas(ocultas: string[], col: number, delta: number): string[] {
  const salida: string[] = [];
  for (const letra of ocultas) {
    const c = indiceColumna(letra);
    if (c < 0) continue;
    if (delta > 0) salida.push(letraColumna(c >= col ? c + 1 : c));
    else if (c !== col) salida.push(letraColumna(c > col ? c - 1 : c));
  }
  return salida;
}

/** Una propiedad del override coincide con el Excel (tratando ausencia y false como iguales). */
function igualAlBase(actual: EstiloLibro, base: EstiloLibro, llave: keyof EstiloLibro): boolean {
  const a = actual[llave];
  const b = base[llave];
  if ((a === undefined || a === false) && (b === undefined || b === false)) return true;
  return a === b;
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

function hojaPersonalizada(nombre: string): HojaLibro {
  return { name: nombre, tab: '#70AD47', maxRow: 200, maxCol: 26, verFilas: 200, verCols: 26, cols: {}, rows: {}, hiddenCols: [], hiddenRows: [], freeze: null, cells: {} };
}

function renombrarReferenciaHoja(formula: string, anterior: string, nuevo: string): string {
  const nombresAnteriores = [...new Set([anterior, anterior.trim()])].filter(Boolean);
  const nuevoNombre = nuevo.trim();
  const nuevoExcel = nuevoNombre.replace(/'/g, "''");
  let resultado = formula;
  for (const nombre of nombresAnteriores) {
    const anteriorExcel = nombre.replace(/'/g, "''");
    resultado = reemplazarSinMayusculas(resultado, `'${anteriorExcel}'!`, `'${nuevoExcel}'!`);
    resultado = reemplazarSinMayusculas(resultado, `"${nombre}"!`, `'${nuevoExcel}'!`);
    resultado = reemplazarSinMayusculas(resultado, `${nombre}!`, `${nuevoNombre}!`);
  }
  return resultado;
}

function reemplazarSinMayusculas(texto: string, busca: string, reemplazo: string): string {
  const fuente = texto.toLocaleLowerCase();
  const objetivo = busca.toLocaleLowerCase();
  let salida = '';
  let inicio = 0;
  let indice = fuente.indexOf(objetivo, inicio);
  while (indice >= 0) {
    salida += texto.slice(inicio, indice) + reemplazo;
    inicio = indice + busca.length;
    indice = fuente.indexOf(objetivo, inicio);
  }
  return salida + texto.slice(inicio);
}

function contieneReferenciaHoja(formula: string, nombre: string): boolean {
  return renombrarReferenciaHoja(formula, nombre, '__REFERENCIA__') !== formula;
}

function renombrarClaves<T>(mapa: Record<string, T>, anterior: string, nuevo: string): Record<string, T> {
  const salida: Record<string, T> = {};
  for (const [clave, valor] of Object.entries(mapa)) {
    const corte = clave.lastIndexOf('!');
    const hoja = corte < 0 ? '' : clave.slice(0, corte);
    salida[hoja.trim().toUpperCase() === anterior.trim().toUpperCase() ? `${nuevo}!${clave.slice(corte + 1)}` : clave] = valor;
  }
  return salida;
}

function sinHoja<T>(mapa: Record<string, T>, nombre: string): Record<string, T> {
  const prefijo = `${nombre}!`;
  return Object.fromEntries(Object.entries(mapa).filter(([clave]) => !clave.startsWith(prefijo)));
}

function renombrarValoresFormula(mapa: Record<string, string>, anterior: string, nuevo: string): Record<string, string> {
  return Object.fromEntries(Object.entries(mapa).map(([clave, valor]) => [clave, valor.startsWith('=') ? renombrarReferenciaHoja(valor, anterior, nuevo) : valor]));
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
