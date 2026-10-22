import { TipoBoleto, TicketSettlementLine, TicketTariff } from '../data/boletos-api.service';
import { SettlementPreview, lineImporteCents, preview, toCents } from './boletos-math';

export type HojaId =
  | 'norte-2026'
  | 'norte-2025'
  | 'especiales'
  | 'sur-2026'
  | 'sur-2025'
  | 'tapo'
  | 'poniente'
  | 'manuales'
  | 'total'
  | string;

export type Row = {
  clave: string;
  base: string;
  vigencia: string;
  ambito: string;
  tipo: TipoBoleto;
  zona: string;
  precio: number;
  descuento: number;
  sitio: number;
  plata: number | null;
  usaPlata: boolean;
  cantidad: number | null;
  netoFijo: number | null;
  importeFijo: number | null;
  manual: boolean;
  orden: number | null;
};

export type Seccion = {
  ambito: string;
  titulo: string;
  izquierda: string;
  derecha: string;
  derechaTipo: 'doble' | 'nocturno';
};

export type Hoja = {
  id: HojaId;
  titulo: string;
  detalle: string;
  base: string;
  vigencia: string;
  plata: boolean;
  manual: boolean;
  especiales: boolean;
  /** Hoja BASE* del Excel: catálogo sin SERV (sin cantidad/importe). */
  catalogo?: boolean;
  /** Color de pestaña como en el .xlsx (#RRGGBB). */
  color?: string;
  libre?: boolean;
  precio: string;
  descuento: string;
  sitio: string;
  secciones: Seccion[];
  excel?: { titulo: number; encabezado: number; dato: number }[];
};

export type Bloque = {
  id: string;
  titulo: string;
  cuenta: string;
  ambito: string;
  tipo: TipoBoleto;
  filas: Row[];
  manual: boolean;
};

const cdmxEdomex = (derechaEstado: 'doble' | 'nocturno', etiquetaDerecha: string): Seccion[] => [
  { ambito: 'CDMX', titulo: 'CDMX', izquierda: 'Sencillos', derecha: 'Dobles', derechaTipo: 'doble' },
  { ambito: 'EDOMEX', titulo: 'Edomex', izquierda: 'Sencillos', derecha: etiquetaDerecha, derechaTipo: derechaEstado },
];

const layoutNte = [
  { titulo: 1, encabezado: 2, dato: 3 },
  { titulo: 18, encabezado: 19, dato: 20 },
];

/** Orden y nombres = PAGO BOLETOS 2026.xlsx (19 hojas). */
export const HOJAS: Hoja[] = [
  {
    id: 'base-nte-25',
    titulo: 'BASE NTE 25',
    detalle: 'Catálogo BASE NTE 25 del Excel.',
    base: 'NORTE',
    vigencia: '2025',
    plata: true,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'base-nte-26',
    titulo: 'BASE NTE 26',
    detalle: 'Catálogo BASE NTE 26 del Excel.',
    base: 'NORTE',
    vigencia: '2026',
    plata: true,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'base-norte-especiales',
    titulo: 'BASE NORTE ESPECIALES',
    detalle: 'Catálogo BASE NORTE ESPECIALES del Excel.',
    base: 'ESPECIALES',
    vigencia: '2026',
    plata: false,
    manual: false,
    especiales: true,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: [],
    excel: layoutNte,
  },
  {
    id: 'base-tapo-24',
    titulo: 'BASE TAPO 24',
    detalle: 'Catálogo BASE TAPO 24 del Excel.',
    base: 'TAPO',
    vigencia: '2024',
    plata: false,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. TAPO',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'base-tapo-25',
    titulo: 'BASE TAPO 25',
    detalle: 'Catálogo BASE TAPO 25 del Excel.',
    base: 'TAPO',
    vigencia: '2025',
    plata: false,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. TAPO',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'base-tapo-rez',
    titulo: 'BASE TAPO REZ',
    detalle: 'Catálogo BASE TAPO REZ del Excel.',
    base: 'TAPO',
    vigencia: 'REZ',
    plata: false,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. TAPO',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'base-pte-25',
    titulo: 'BASE PTE 25',
    detalle: 'Catálogo BASE PTE 25 del Excel.',
    base: 'PTE',
    vigencia: '2025',
    plata: false,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'base-pte',
    titulo: 'BASE PTE',
    detalle: 'Catálogo BASE PTE vigente del Excel.',
    base: 'PTE',
    vigencia: 'VIGENTE',
    plata: false,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'base-sur-25',
    titulo: 'BASE SUR 25',
    detalle: 'Catálogo BASE SUR 25 del Excel.',
    base: 'SUR',
    vigencia: '2025',
    plata: true,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('doble', 'Dobles'),
    excel: layoutNte,
  },
  {
    id: 'base-sur-26',
    titulo: 'BASE SUR 26',
    detalle: 'Catálogo BASE SUR 26 del Excel.',
    base: 'SUR',
    vigencia: '2026',
    plata: true,
    manual: false,
    especiales: false,
    catalogo: true,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('doble', 'Dobles'),
    excel: layoutNte,
  },
  {
    id: 'tapo',
    titulo: 'TAPO 25',
    detalle: 'Captura TAPO 25. 12A–12E y 32 salen de rezago si faltan en BASE TAPO 25.',
    base: 'TAPO',
    vigencia: '2025',
    plata: false,
    manual: false,
    especiales: false,
    color: '#FF66FF',
    precio: 'Precio',
    descuento: 'Desc. TAPO',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
  },
  {
    id: 'norte-2025',
    titulo: 'NORTE 25',
    detalle: 'Captura NORTE 25.',
    base: 'NORTE',
    vigencia: '2025',
    plata: true,
    manual: false,
    especiales: false,
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'norte-2026',
    titulo: 'NORTE 26',
    detalle: 'Captura NORTE 26.',
    base: 'NORTE',
    vigencia: '2026',
    plata: true,
    manual: false,
    especiales: false,
    color: '#FFC000',
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
    excel: layoutNte,
  },
  {
    id: 'especiales',
    titulo: 'NORTE ESPECIALES',
    detalle: 'Captura NORTE ESPECIALES.',
    base: 'ESPECIALES',
    vigencia: '2026',
    plata: false,
    manual: false,
    especiales: true,
    color: '#FFFF00',
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: [],
  },
  {
    id: 'poniente',
    titulo: 'PTE',
    detalle: 'Captura PTE (BASE PTE vigente).',
    base: 'PTE',
    vigencia: 'VIGENTE',
    plata: false,
    manual: false,
    especiales: false,
    color: '#00B0F0',
    precio: 'Precio',
    descuento: 'Desc. NTE',
    sitio: 'Sitio',
    secciones: cdmxEdomex('nocturno', 'Nocturnos'),
  },
  {
    id: 'sur-2025',
    titulo: 'SUR 25',
    detalle: 'Captura SUR 25.',
    base: 'SUR',
    vigencia: '2025',
    plata: true,
    manual: false,
    especiales: false,
    precio: 'Importe',
    descuento: 'Central',
    sitio: 'Orga',
    secciones: cdmxEdomex('doble', 'Dobles'),
  },
  {
    id: 'sur-2026',
    titulo: 'SUR 26',
    detalle: 'Captura SUR 26.',
    base: 'SUR',
    vigencia: '2026',
    plata: true,
    manual: false,
    especiales: false,
    precio: 'Importe',
    descuento: 'Central',
    sitio: 'Orga',
    secciones: cdmxEdomex('doble', 'Dobles'),
  },
  {
    id: 'manuales',
    titulo: 'MANUALES',
    detalle: 'Pagar es importe menos central menos orga. El total del renglón es pagar por cantidad.',
    base: 'MANUAL',
    vigencia: '2026',
    plata: false,
    manual: true,
    especiales: false,
    precio: 'Importe',
    descuento: 'Central',
    sitio: 'Orga',
    secciones: cdmxEdomex('doble', 'Dobles'),
  },
  {
    id: 'total',
    titulo: 'TOTAL',
    detalle: 'Suma los pies de este corte. Cuádruple, quíntuple y séptuple salen del triple. No hay séxtuple.',
    base: '',
    vigencia: '',
    plata: false,
    manual: false,
    especiales: false,
    precio: '',
    descuento: '',
    sitio: '',
    secciones: [],
  },
];

let hojasDinamicas: Hoja[] = [];

export function setHojasDinamicas(hojas: Hoja[]): void {
  hojasDinamicas = hojas;
}

export function esHojaLibre(id: string | null | undefined): boolean {
  return !!id && (id.startsWith('libre-') || !!hojasDinamicas.find((hoja) => hoja.id === id)?.libre);
}

export function crearHojaLibre(numero: number): Hoja {
  const id = `libre-${Date.now()}`;
  return {
    id,
    titulo: `Hoja ${numero}`,
    detalle: 'Hoja de cálculo libre. Agrega renglones y usa la barra de fórmulas.',
    base: id.toUpperCase(),
    vigencia: 'LIBRE',
    plata: false,
    manual: true,
    especiales: false,
    libre: true,
    precio: 'Col B',
    descuento: 'Col C',
    sitio: 'Col D',
    secciones: [
      { ambito: 'CDMX', titulo: 'Datos', izquierda: 'Datos', derecha: 'Extra', derechaTipo: 'doble' },
    ],
  };
}

export function filasInicialesLibres(hoja: Hoja, cantidad = 12): Row[] {
  return Array.from({ length: cantidad }, (_, index) => ({
    clave: `${hoja.base}|CDMX|sencillo|${index + 1}`,
    base: hoja.base,
    vigencia: hoja.vigencia,
    ambito: 'CDMX',
    tipo: 'sencillo' as TipoBoleto,
    zona: String(index + 1),
    precio: 0,
    descuento: 0,
    sitio: 0,
    plata: null,
    usaPlata: false,
    cantidad: 0,
    netoFijo: null,
    importeFijo: null,
    manual: true,
    orden: index + 1,
  }));
}

export function hojaPorId(id: string | null | undefined): Hoja {
  return HOJAS.find((hoja) => hoja.id === id)
    ?? hojasDinamicas.find((hoja) => hoja.id === id)
    ?? HOJAS.find((hoja) => hoja.id === 'base-nte-26')
    ?? HOJAS[0];
}

export function num(value: number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cantidadDe(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return 0;
  return Math.trunc(Number(value));
}

export function netoCents(row: Pick<Row, 'precio' | 'descuento' | 'sitio' | 'plata' | 'usaPlata'>): number {
  let cents = toCents(num(row.precio)) - toCents(num(row.descuento)) - toCents(num(row.sitio));
  if (row.usaPlata) cents -= toCents(num(row.plata));
  return cents;
}

export function netoDe(row: Pick<Row, 'precio' | 'descuento' | 'sitio' | 'plata' | 'usaPlata'> & { netoFijo?: number | null }): number {
  if (row.netoFijo != null && Number.isFinite(row.netoFijo)) return row.netoFijo;
  return netoCents(row) / 100;
}

export function importeDe(row: Row): number {
  if (row.importeFijo != null && Number.isFinite(row.importeFijo)) return row.importeFijo;
  return lineImporteCents(cantidadDe(row.cantidad), netoDe(row)) / 100;
}

export function pieDe(rows: Row[]): SettlementPreview {
  let cents = 0;
  let left = 0;
  let right = 0;
  for (const row of rows) {
    const cantidad = cantidadDe(row.cantidad);
    cents += toCents(importeDe(row));
    if (row.tipo === 'doble' || row.tipo === 'nocturno') right += cantidad;
    else left += cantidad;
  }
  return preview(cents, left, right);
}

export function copyRows(rows: Row[]): Row[] {
  return rows.map((row) => ({ ...row }));
}

export function tariffToRow(tariff: TicketTariff): Row {
  const usaPlata = tariff.plata != null;
  return {
    clave: tariff.clave || `${tariff.base}|${tariff.vigencia}|${tariff.ambito}|${tariff.tipo}|${tariff.zona}`,
    base: tariff.base,
    vigencia: tariff.vigencia,
    ambito: tariff.ambito,
    tipo: tariff.tipo,
    zona: tariff.zona,
    precio: num(tariff.precio),
    descuento: num(tariff.descuento),
    sitio: num(tariff.sitio),
    plata: usaPlata ? num(tariff.plata) : null,
    usaPlata,
    cantidad: 0,
    netoFijo: null,
    importeFijo: null,
    manual: tariff.base === 'MANUAL',
    orden: tariff.orden ?? null,
  };
}

export function claveDeLinea(line: TicketSettlementLine): string {
  if (line.clave) return line.clave;
  return `${line.base || 'NORTE'}|${line.vigencia || '2026'}|${line.ambito || 'CDMX'}|${line.tipo}|${line.zona}`;
}

export function lineToRow(line: TicketSettlementLine): Row {
  const manual = !!line.manual || line.base === 'MANUAL';
  const usaPlata = !manual && line.plata != null;
  const row: Row = {
    clave: claveDeLinea(line),
    base: line.base || (manual ? 'MANUAL' : 'NORTE'),
    vigencia: line.vigencia || '2026',
    ambito: line.ambito || 'CDMX',
    tipo: line.tipo,
    zona: line.zona,
    precio: num(line.precio),
    descuento: num(line.descuento),
    sitio: num(line.sitio),
    plata: usaPlata ? num(line.plata) : null,
    usaPlata,
    cantidad: line.cantidad,
    netoFijo: null,
    importeFijo: null,
    manual,
    orden: null,
  };
  fijarSiDifieren(row, line.neto, line.importe);
  return row;
}

export function fijarSiDifieren(row: Row, neto: number | null | undefined, importe: number | null | undefined): void {
  row.netoFijo = null;
  row.importeFijo = null;
  if (neto != null && toCents(num(neto)) !== netoCents(row)) row.netoFijo = num(neto);
  if (importe != null && toCents(num(importe)) !== toCents(importeDe(row))) row.importeFijo = num(importe);
}

export function bloquesDe(hoja: Hoja, rows: Row[]): Bloque[] {
  const filas = rows
    .filter((row) => row.base === hoja.base && row.vigencia === hoja.vigencia)
    .sort(bySheet);
  if (hoja.libre) {
    return [
      bloque(
        hoja,
        'libre-datos',
        'Datos',
        '',
        'CDMX',
        'sencillo',
        filas.filter((row) => row.tipo === 'sencillo'),
      ),
    ];
  }
  if (hoja.especiales) {
    return [
      bloque(hoja, 'aa-sencillo', 'AA a ZZ · sencillos', 'Cuentan una vez', 'CDMX', 'sencillo', filas.filter((row) => row.tipo === 'sencillo' && row.zona.length <= 2)),
      bloque(hoja, 'aa-doble', 'AA a ZZ · dobles', 'Cuentan dos veces', 'CDMX', 'doble', filas.filter((row) => row.tipo === 'doble' && row.zona.length <= 2)),
      bloque(hoja, 'aaa-sencillo', 'AAA a ZZZ · sencillos', 'Cuentan una vez', 'CDMX', 'sencillo', filas.filter((row) => row.tipo === 'sencillo' && row.zona.length > 2)),
      bloque(hoja, 'aaa-doble', 'AAA a ZZZ · dobles', 'Cuentan dos veces', 'CDMX', 'doble', filas.filter((row) => row.tipo === 'doble' && row.zona.length > 2)),
    ];
  }
  return hoja.secciones.flatMap((seccion) => [
    bloque(
      hoja,
      `${seccion.ambito}-sencillo`,
      tituloCaptura(hoja, seccion, 'izquierda'),
      'Cuentan una vez',
      seccion.ambito,
      'sencillo',
      filas.filter((row) => row.ambito === seccion.ambito && row.tipo === 'sencillo'),
    ),
    bloque(
      hoja,
      `${seccion.ambito}-${seccion.derechaTipo}`,
      tituloCaptura(hoja, seccion, 'derecha'),
      'Cuentan dos veces',
      seccion.ambito,
      seccion.derechaTipo,
      filas.filter((row) => row.ambito === seccion.ambito && row.tipo === seccion.derechaTipo),
    ),
  ]).filter((item) => item.filas.length > 0 || hoja.manual);
}

/** Etiquetas como en PAGO BOLETOS 2026.xlsx (hojas de captura). */
function tituloCaptura(hoja: Hoja, seccion: Seccion, lado: 'izquierda' | 'derecha'): string {
  const der = lado === 'derecha';
  if (hoja.base === 'SUR') {
    if (seccion.ambito === 'CDMX') return der ? 'CDMX DOBLES' : 'CDMX SENCILLO';
    return der ? 'ESTADO DOBLES' : 'ESTADO SENCILLOS';
  }
  if (hoja.base === 'TAPO') {
    if (seccion.ambito === 'CDMX') return der ? 'DF DOBLES' : 'DF SENCILLOS';
    return der ? 'EDO DOBLES' : 'EDO SENCILLOS';
  }
  if (hoja.base === 'MANUAL') {
    if (seccion.ambito === 'CDMX') return der ? 'CDMX DOBLES' : 'CDMX SENCILLO';
    return der ? 'ESTADO DOBLES' : 'ESTADO SENCILLOS';
  }
  // NORTE / PTE (y resto DF/EDOS)
  if (seccion.ambito === 'CDMX') return der ? 'DF DOBLES' : 'DF SENCILLOS';
  if (seccion.derechaTipo === 'nocturno') return der ? 'EDOS SENCILLOS NOCTURNOS' : 'EDOS SENCILLOS';
  return der ? 'EDOS DOBLES' : 'EDOS SENCILLOS';
}

function bloque(
  hoja: Hoja,
  id: string,
  titulo: string,
  cuenta: string,
  ambito: string,
  tipo: TipoBoleto,
  filas: Row[],
): Bloque {
  return { id, titulo, cuenta, ambito, tipo, filas, manual: hoja.manual };
}

function bySheet(a: Row, b: Row): number {
  if (a.orden != null && b.orden != null) return a.orden - b.orden;
  return zoneRank(a.zona) - zoneRank(b.zona);
}

function zoneRank(zona: string): number {
  const bare = zona.replace(/ \(\d+\)$/, '');
  if (/^\d+$/.test(bare)) return Number(bare);
  if (bare === 'SAL' || bare === 'SALIDA') return 13;
  return 1000;
}

export function dineroDistinto(row: Row, seed: Row | undefined): boolean {
  if (!seed) return true;
  return toCents(num(row.precio)) !== toCents(seed.precio)
    || toCents(num(row.descuento)) !== toCents(seed.descuento)
    || toCents(num(row.sitio)) !== toCents(seed.sitio)
    || (row.usaPlata && toCents(num(row.plata)) !== toCents(num(seed.plata)));
}
