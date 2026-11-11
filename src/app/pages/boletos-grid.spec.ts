import { moverEnSecuenciaEnter, SecuenciaEnter } from './boletos-grid';

describe('navegación Enter por bloques de captura', () => {
  const bloques: SecuenciaEnter[] = [
    { col: 0, filas: [2, 3, 4, 18] },
    { col: 5, filas: [2, 3, 4, 18] },
    { col: 10, filas: [2, 3, 4, 5] },
  ];

  it('avanza verticalmente dentro del bloque', () => {
    expect(moverEnSecuenciaEnter(bloques, 3, 0, 1)).toEqual({ fila: 4, col: 0 });
  });

  it('salta al primer dato del bloque derecho al terminar', () => {
    expect(moverEnSecuenciaEnter(bloques, 18, 0, 1)).toEqual({ fila: 2, col: 5 });
  });

  it('retrocede al último dato del bloque izquierdo con Shift+Enter', () => {
    expect(moverEnSecuenciaEnter(bloques, 2, 5, -1)).toEqual({ fila: 18, col: 0 });
  });

  it('conserva la celda cuando no hay bloque vecino', () => {
    expect(moverEnSecuenciaEnter(bloques, 5, 10, 1)).toEqual({ fila: 5, col: 10 });
  });
});
