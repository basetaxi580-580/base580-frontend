export type LeerCelda = (ref: string) => number | string;

const FUNCIONES: Record<string, (args: Array<number | number[]>) => number | string> = {
  SUMA: sumar,
  SUM: sumar,
  PROMEDIO: promediar,
  AVERAGE: promediar,
  MIN: minimo,
  MAX: maximo,
  ABS: absoluto,
  REDONDEAR: redondear,
  ROUND: redondear,
};

export function evaluarFormula(fuente: string, leer: LeerCelda): number | string {
  const cuerpo = fuente.trim().replace(/^=/, '');
  if (!cuerpo) return '#¡VALOR!';
  const tokens = tokenizar(cuerpo);
  if (!tokens) return '#¡VALOR!';
  const parser = new Parser(tokens, leer);
  const valor = parser.expresion();
  if (parser.error) return parser.error;
  if (!parser.fin()) return '#¡VALOR!';
  return valor;
}

export function letraColumna(index: number): string {
  let n = index;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

export function indiceColumna(letra: string): number {
  let n = 0;
  for (const char of letra.toUpperCase()) {
    if (char < 'A' || char > 'Z') return -1;
    n = n * 26 + (char.charCodeAt(0) - 64);
  }
  return n - 1;
}

type Token =
  | { t: 'num'; v: number }
  | { t: 'ref'; v: string }
  | { t: 'name'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'sep' }
  | { t: 'colon' }
  | { t: 'lp' }
  | { t: 'rp' };

class Parser {
  error: string | null = null;
  private i = 0;

  constructor(private readonly tokens: Token[], private readonly leer: LeerCelda) {}

  fin(): boolean {
    return this.i >= this.tokens.length;
  }

  expresion(): number | string {
    let valor = this.termino();
    while (!this.error && this.esOp('+', '-')) {
      const op = (this.tokens[this.i++] as { v: '+' | '-' }).v;
      valor = this.combinar(valor, op, this.termino());
    }
    return valor;
  }

  private termino(): number | string {
    let valor = this.factor();
    while (!this.error && this.esOp('*', '/', '^')) {
      const op = (this.tokens[this.i++] as { v: '*' | '/' | '^' }).v;
      valor = this.combinar(valor, op, this.factor());
    }
    return valor;
  }

  private factor(): number | string {
    if (this.esOp('+')) {
      this.i++;
      return this.factor();
    }
    if (this.esOp('-')) {
      this.i++;
      const valor = this.factor();
      return typeof valor === 'number' ? -valor : valor;
    }
    const token = this.tokens[this.i];
    if (!token) return this.fallar('#¡VALOR!');
    if (token.t === 'num') {
      this.i++;
      return token.v;
    }
    if (token.t === 'ref') {
      this.i++;
      return this.comoNumero(this.leer(token.v));
    }
    if (token.t === 'name') {
      this.i++;
      return this.funcion(token.v);
    }
    if (token.t === 'lp') {
      this.i++;
      const valor = this.expresion();
      if (this.tokens[this.i]?.t !== 'rp') return this.fallar('#¡VALOR!');
      this.i++;
      return valor;
    }
    return this.fallar('#¡VALOR!');
  }

  private funcion(nombre: string): number | string {
    const fn = FUNCIONES[nombre];
    if (!fn) return this.fallar('#¿NOMBRE?');
    if (this.tokens[this.i]?.t !== 'lp') return this.fallar('#¡VALOR!');
    this.i++;
    const args: Array<number | number[]> = [];
    if (this.tokens[this.i]?.t !== 'rp') {
      while (!this.error) {
        const arg = this.argumento();
        if (typeof arg === 'string') return this.fallar(arg);
        if (this.error) return this.error;
        args.push(arg);
        if (this.tokens[this.i]?.t !== 'sep') break;
        this.i++;
      }
    }
    if (this.error) return this.error;
    if (this.tokens[this.i]?.t !== 'rp') return this.fallar('#¡VALOR!');
    this.i++;
    const valor = fn(args);
    if (typeof valor === 'string') this.error = valor;
    return valor;
  }

  private argumento(): number | number[] | string {
    const token = this.tokens[this.i];
    const siguiente = this.tokens[this.i + 1];
    const cierre = this.tokens[this.i + 2];
    if (token?.t === 'ref' && siguiente?.t === 'colon' && cierre?.t === 'ref') {
      this.i += 3;
      const refs = refsDeRango(token.v, cierre.v);
      if (!refs) return this.fallar('#¡REF!');
      const numeros: number[] = [];
      for (const ref of refs) {
        const valor = this.leer(ref);
        if (typeof valor === 'string') return this.fallar(valor);
        numeros.push(valor);
      }
      return numeros;
    }
    return this.expresion();
  }

  private combinar(izq: number | string, op: '+' | '-' | '*' | '/' | '^', der: number | string): number | string {
    const valor = operar(izq, op, der);
    if (typeof valor === 'string') this.error = valor;
    return valor;
  }

  private comoNumero(valor: number | string): number | string {
    if (typeof valor === 'string') this.error = valor;
    return valor;
  }

  private esOp(...ops: string[]): boolean {
    const token = this.tokens[this.i];
    return token?.t === 'op' && ops.includes(token.v);
  }

  private fallar(error: string): string {
    this.error = error;
    return error;
  }
}

function tokenizar(fuente: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < fuente.length) {
    const char = fuente[i];
    if (char === ' ' || char === '\t') {
      i++;
      continue;
    }
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '^') {
      tokens.push({ t: 'op', v: char });
      i++;
      continue;
    }
    if (char === '(') { tokens.push({ t: 'lp' }); i++; continue; }
    if (char === ')') { tokens.push({ t: 'rp' }); i++; continue; }
    if (char === ':') { tokens.push({ t: 'colon' }); i++; continue; }
    if (char === ';' || char === ',') { tokens.push({ t: 'sep' }); i++; continue; }
    if (/[0-9.]/.test(char)) {
      let j = i;
      let texto = '';
      while (j < fuente.length && /[0-9.]/.test(fuente[j])) texto += fuente[j++];
      const valor = Number(texto);
      if (!Number.isFinite(valor)) return null;
      tokens.push({ t: 'num', v: valor });
      i = j;
      continue;
    }
    if (/[A-Za-z$ÁÉÍÓÚÑáéíóúñ]/.test(char)) {
      let j = i;
      if (fuente[j] === '$') j++;
      const inicio = j;
      while (j < fuente.length && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(fuente[j])) j++;
      const letras = fuente.slice(inicio, j).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (fuente[j] === '$') j++;
      let fila = '';
      while (j < fuente.length && /[0-9]/.test(fuente[j])) fila += fuente[j++];
      if (!letras) return null;
      if (fila && indiceColumna(letras) >= 0) tokens.push({ t: 'ref', v: `${letras}${fila}` });
      else tokens.push({ t: 'name', v: letras });
      i = j;
      continue;
    }
    return null;
  }
  return tokens;
}

function operar(izq: number | string, op: '+' | '-' | '*' | '/' | '^', der: number | string): number | string {
  if (typeof izq === 'string') return izq;
  if (typeof der === 'string') return der;
  if (op === '+') return izq + der;
  if (op === '-') return izq - der;
  if (op === '*') return izq * der;
  if (op === '^') return izq ** der;
  if (der === 0) return '#¡DIV/0!';
  return izq / der;
}

function sumar(args: Array<number | number[]>): number | string {
  const lista = aplanar(args);
  return lista.reduce((total, valor) => total + valor, 0);
}

function promediar(args: Array<number | number[]>): number | string {
  const lista = aplanar(args);
  if (!lista.length) return '#¡DIV/0!';
  return lista.reduce((total, valor) => total + valor, 0) / lista.length;
}

function minimo(args: Array<number | number[]>): number | string {
  const lista = aplanar(args);
  if (!lista.length) return 0;
  return Math.min(...lista);
}

function maximo(args: Array<number | number[]>): number | string {
  const lista = aplanar(args);
  if (!lista.length) return 0;
  return Math.max(...lista);
}

function absoluto(args: Array<number | number[]>): number | string {
  const lista = aplanar(args);
  if (lista.length !== 1) return '#¡VALOR!';
  return Math.abs(lista[0]);
}

function redondear(args: Array<number | number[]>): number | string {
  const lista = aplanar(args);
  if (lista.length < 1 || lista.length > 2) return '#¡VALOR!';
  const digitos = lista.length === 2 ? lista[1] : 0;
  const factor = 10 ** digitos;
  return Math.round(lista[0] * factor) / factor;
}

function aplanar(args: Array<number | number[]>): number[] {
  const lista: number[] = [];
  for (const arg of args) {
    if (typeof arg === 'number') lista.push(arg);
    else lista.push(...arg);
  }
  return lista;
}

function refsDeRango(desde: string, hasta: string): string[] | null {
  const a = partir(desde);
  const b = partir(hasta);
  if (!a || !b) return null;
  const refs: string[] = [];
  for (let fila = Math.min(a.fila, b.fila); fila <= Math.max(a.fila, b.fila); fila++) {
    for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col++) refs.push(`${letraColumna(col)}${fila}`);
  }
  return refs;
}

function partir(ref: string): { col: number; fila: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return null;
  const col = indiceColumna(match[1]);
  const fila = Number(match[2]);
  if (col < 0 || fila <= 0) return null;
  return { col, fila };
}
