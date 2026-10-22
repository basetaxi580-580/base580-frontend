export const SIN_AHORRO_CENTS = 30;
export const SENCILLO_CENTS = 530;
export const DOBLE_CENTS = 1060;
export const TRIPLE_CENTS = 1590;
export const CUADRUPLE_CENTS = 530;
export const QUINTUPLE_CENTS = 1060;
export const SEPTUPLE_CENTS = 2120;

export type SettlementPreview = {
  servicios: number;
  conteo: number;
  importe: number;
  sinAhorro: number;
  sencillo: number;
  doble: number;
  triple: number;
  cuadruple: number;
  quintuple: number;
  septuple: number;
};

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function lineImporteCents(cantidad: number, neto: number): number {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;
  return Math.trunc(cantidad) * toCents(neto);
}

export function preview(importeCents: number, izquierda: number, derecha: number): SettlementPreview {
  const left = Math.max(0, izquierda);
  const right = Math.max(0, derecha);
  const conteo = left + right * 2;
  const apply = (rate: number) => (importeCents - conteo * rate) / 100;
  const servicios = left + right;
  const triple = apply(TRIPLE_CENTS);
  const desdeTriple = (rate: number) => (toCents(triple) - servicios * rate) / 100;
  return {
    servicios,
    conteo,
    importe: importeCents / 100,
    sinAhorro: apply(SIN_AHORRO_CENTS),
    sencillo: apply(SENCILLO_CENTS),
    doble: apply(DOBLE_CENTS),
    triple,
    cuadruple: desdeTriple(CUADRUPLE_CENTS),
    quintuple: desdeTriple(QUINTUPLE_CENTS),
    septuple: desdeTriple(SEPTUPLE_CENTS),
  };
}
