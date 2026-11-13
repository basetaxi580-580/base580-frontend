import libroJson from './boletos-libro.data.json';
import { evaluarFormula, trasladarFormula } from './boletos-formula';
import { COLUMNAS_BASE_LIBRO, FILAS_BASE_LIBRO, LibroJson, MotorLibro, altoFila, anchoColumna, columnasDeHoja, formatear, filasDeHoja, fusionarCapturas, redondearExcel } from './boletos-libro';

const libro = libroJson as unknown as LibroJson;

describe('Réplica de PAGO BOLETOS 2026.xlsx', () => {

  it('crea, renombra y elimina una pestaña BASE personalizada sin tocar las 19 originales', () => {
    const motor = new MotorLibro(libro);
    const pestana = { id: 'base-nueva', nombre: 'BASE NUEVA' };
    expect(motor.agregarPersonalizada(pestana)).toBe(true);
    motor.establecer('BASE NUEVA', 'A1', '42');
    motor.establecerFormato('BASE NUEVA', 'A1', { b: true });
    motor.establecer('NORTE 26', 'A1', '=\'BASE NUEVA\'!A1');
    expect(motor.numero('NORTE 26', 'A1')).toBe(42);

    expect(motor.renombrarPersonalizada('base-nueva', 'BASE RENOMBRADA')).toBe(true);
    expect(motor.textoEdicion('BASE RENOMBRADA', 'A1')).toBe('42');
    expect(motor.textoEdicion('NORTE 26', 'A1')).toBe("='BASE RENOMBRADA'!A1");
    expect(motor.numero('NORTE 26', 'A1')).toBe(42);
    expect(motor.eliminarPersonalizada('base-nueva')).toBe(false);
    motor.establecer('NORTE 26', 'A1', '');
    expect(motor.eliminarPersonalizada('base-nueva')).toBe(true);
    expect(motor.hojas).toHaveLength(19);
    expect(motor.esOriginal('BASE NTE 25')).toBe(true);
    expect(motor.renombrarPersonalizada('missing', 'BASE OTRA')).toBe(false);
  });

  it('mantiene identificadores y rechaza nombres personalizados duplicados', () => {
    const motor = new MotorLibro(libro);
    expect(motor.agregarPersonalizada({ id: 'a', nombre: 'BASE CLIENTE' })).toBe(true);
    expect(motor.agregarPersonalizada({ id: 'b', nombre: 'BASE CLIENTE' })).toBe(false);
    expect(motor.personalizadas()).toEqual([{ id: 'a', nombre: 'BASE CLIENTE' }]);
  });

  it('crea libros con A-Z y 1-200 y permite insertar columnas y filas', () => {
    const motor = new MotorLibro(libro);
    expect(motor.agregarPersonalizada({ id: 'amplia', nombre: 'CLIENTE AMPLIA' })).toBe(true);
    const hoja = motor.hoja('CLIENTE AMPLIA');
    expect(hoja && columnasDeHoja(hoja)).toHaveLength(COLUMNAS_BASE_LIBRO);
    expect(hoja && filasDeHoja(hoja)).toHaveLength(FILAS_BASE_LIBRO);
    expect(motor.insertarColumna('CLIENTE AMPLIA', 0)).toBe(true);
    expect(motor.hoja('CLIENTE AMPLIA')?.maxCol).toBe(COLUMNAS_BASE_LIBRO + 1);
    expect(motor.insertarFila('CLIENTE AMPLIA', 1)).toBe(true);
    expect(motor.hoja('CLIENTE AMPLIA')?.maxRow).toBe(201);
    expect(motor.insertarFila('CLIENTE AMPLIA', 2)).toBe(true);
    expect(motor.insertarColumna('CLIENTE AMPLIA', 1)).toBe(true);
    expect(motor.hoja('CLIENTE AMPLIA')?.maxRow).toBe(202);
    expect(motor.hoja('CLIENTE AMPLIA')?.maxCol).toBe(COLUMNAS_BASE_LIBRO + 2);
  });

  it('mantiene la misma rejilla base para hojas importadas y nuevas', () => {
    const motor = new MotorLibro(libro);
    expect(columnasDeHoja(motor.hojaInicial())).toHaveLength(COLUMNAS_BASE_LIBRO);
    expect(filasDeHoja(motor.hojaInicial())).toHaveLength(FILAS_BASE_LIBRO);
  });

  it('reordena pestañas y reconstruye el mismo orden desde el estado', () => {
    const motor = new MotorLibro(libro);
    expect(motor.moverPestana('BASE NTE 25', 'BASE NTE 26')).toBe(true);
    const orden = motor.ordenPestanas();
    expect(orden.slice(0, 2)).toEqual(['BASE NTE 26', 'BASE NTE 25']);
    const recargado = new MotorLibro(libro);
    recargado.cargarOrden(orden);
    expect(recargado.ordenPestanas().slice(0, 2)).toEqual(['BASE NTE 26', 'BASE NTE 25']);
  });

  it('copia un libro completo, conserva cambios y reconstruye la copia', () => {
    const motor = new MotorLibro(libro);
    motor.establecer('NORTE 26', 'A3', '7');
    motor.establecerFormato('NORTE 26', 'A3', { b: true });
    expect(motor.cambiarAnchoColumna('NORTE 26', 0, 180)).toBe(true);
    expect(motor.copiarHoja('NORTE 26', { id: 'copia-norte', nombre: 'NORTE 26 COPIA' })).toBe(true);
    expect(motor.textoEdicion('NORTE 26 COPIA', 'A3')).toBe('7');
    expect(motor.formatoDe('NORTE 26 COPIA', 'A3')).toEqual({ b: true });
    expect(motor.hoja('NORTE 26 COPIA')?.cols['A']).toBe(180);
    motor.establecer('NORTE 26 COPIA', 'A3', '9');
    expect(motor.textoEdicion('NORTE 26', 'A3')).toBe('7');

    const recargado = new MotorLibro(libro);
    recargado.cargarPersonalizadas(motor.personalizadas());
    recargado.aplicarEstructura(motor.estructura());
    recargado.reemplazarCapturas(motor.capturas());
    recargado.reemplazarFormatos(motor.formatos());
    expect(recargado.textoEdicion('NORTE 26 COPIA', 'A3')).toBe('9');
    expect(recargado.formatoDe('NORTE 26 COPIA', 'A3')).toEqual({ b: true });
    expect(recargado.hoja('NORTE 26 COPIA')?.cells['B3']).toEqual(recargado.hoja('NORTE 26')?.cells['B3']);

    expect(recargado.renombrarPersonalizada('copia-norte', 'NORTE 26 CLON')).toBe(true);
    const renombrada = new MotorLibro(libro);
    renombrada.cargarPersonalizadas(recargado.personalizadas());
    renombrada.aplicarEstructura(recargado.estructura());
    renombrada.reemplazarCapturas(recargado.capturas());
    renombrada.reemplazarFormatos(recargado.formatos());
    expect(renombrada.textoEdicion('NORTE 26 CLON', 'A3')).toBe('9');
  });

  it('permite renombrar hojas importadas y protege su eliminación si hay referencias', () => {
    const motor = new MotorLibro(libro);
    motor.establecer('MANUALES', 'ZZ999', "='BASE NTE 25'!A1");
    expect(motor.capturas()).toEqual({ 'MANUALES!ZZ999': "='BASE NTE 25'!A1" });
    expect(motor.renombrarHoja('BASE NTE 25', 'CLIENTE A')).toBe(true);
    expect(motor.capturas()).toEqual({ 'MANUALES!ZZ999': "='CLIENTE A'!A1" });
    expect(motor.textoEdicion('MANUALES', 'ZZ999')).toBe("='CLIENTE A'!A1");
    motor.establecer('MANUALES', 'ZZ999', '');
    expect(motor.eliminarHoja('CLIENTE A')).toBe(false);
    expect(motor.hoja('CLIENTE A')).toBeDefined();
  });

  it('trae las 19 hojas en el orden del Excel', () => {
    expect(libro.sheets.map((hoja) => hoja.name.trim())).toEqual([
      'BASE NTE 25',
      'BASE NTE 26',
      'BASE NORTE ESPECIALES',
      'BASE TAPO 24',
      'BASE TAPO 25',
      'BASE TAPO REZ',
      'BASE PTE 25',
      'BASE PTE',
      'BASE SUR 25',
      'BASE SUR 26',
      'TAPO 25',
      'NORTE 25',
      'NORTE 26',
      'NORTE ESPECIALES',
      'PTE',
      'SUR 25',
      'SUR 26',
      'MANUALES',
      'TOTAL',
    ]);
  });

  it('calcula cada fórmula igual que Excel (valores guardados en el .xlsx)', () => {
    const motor = new MotorLibro(libro);
    const diferencias: string[] = [];
    let total = 0;
    for (const hoja of libro.sheets) {
      for (const [ref, celda] of Object.entries(hoja.cells)) {
        const [, formula, , esperado] = celda;
        if (!formula) continue;
        total++;
        const obtenido = motor.valor(hoja.name, ref);
        const ok =
          typeof esperado === 'number' &&
          obtenido.tipo === 'numero' &&
          Math.abs(obtenido.n - esperado) <= 1e-9 * Math.max(1, Math.abs(esperado));
        if (!ok) diferencias.push(`${hoja.name}!${ref} ${formula} esperado=${esperado} obtenido=${JSON.stringify(obtenido)}`);
      }
    }
    expect(total).toBe(2691);
    expect(diferencias).toEqual([]);
  });

  it('lee referencias a otras hojas, con y sin comillas', () => {
    const leidas: string[] = [];
    const leer = (ref: string) => {
      leidas.push(ref);
      return 2;
    };
    expect(evaluarFormula("='BASE NTE 25 '!F20*K3", leer)).toBe(4);
    expect(evaluarFormula('=+PTE!D25+MANUALES!R9', leer)).toBe(4);
    expect(evaluarFormula("=SUM('BASE PTE'!B3:B4)", leer)).toBe(4);
    expect(leidas).toEqual(['BASE NTE 25 !F20', 'K3', 'PTE!D25', 'MANUALES!R9', 'BASE PTE!B3', 'BASE PTE!B4']);
  });

  it('traslada referencias relativas de fórmulas al pegar un rango', () => {
    expect(trasladarFormula('=A1+$B2+SUMA(C1:C3)', 2, 1)).toBe('=B3+$B4+SUMA(D3:D5)');
    expect(trasladarFormula("='BASE NTE 26'!F3", 1, 2)).toBe("='BASE NTE 26'!H4");
  });

  it('recalcula en cadena de la captura al TOTAL', () => {
    const motor = new MotorLibro(libro);
    const tarifa = motor.numero('BASE NTE 26', 'F3');
    const senc = motor.numero('NORTE 26', 'D24');
    const total = motor.numero('TOTAL', 'D4');

    motor.establecer('NORTE 26', 'A3', '2');

    expect(motor.numero('NORTE 26', 'D3')).toBeCloseTo(2 * tarifa, 9);
    expect(motor.numero('NORTE 26', 'D21')).toBeCloseTo(2 * tarifa, 9);
    expect(motor.numero('NORTE 26', 'D24')).toBe(senc + 2);
    expect(motor.numero('TOTAL', 'D4')).toBe(total + 2);
  });

  it('cambiar una tarifa BASE impacta la captura que la usa', () => {
    const motor = new MotorLibro(libro);
    motor.establecer('NORTE 26', 'A3', '1');
    const antes = motor.numero('NORTE 26', 'D3');
    motor.establecer('BASE NTE 26', 'B3', String(motor.numero('BASE NTE 26', 'B3') + 10));
    expect(motor.numero('NORTE 26', 'D3')).toBeCloseTo(antes + 10, 9);
  });

  it('volver al valor original descarta la captura', () => {
    const motor = new MotorLibro(libro);
    motor.establecer('NORTE 26', 'A3', '3');
    expect(motor.tieneCaptura('NORTE 26', 'A3')).toBe(true);
    motor.establecer('NORTE 26', 'A3', '');
    expect(motor.tieneCaptura('NORTE 26', 'A3')).toBe(false);
    expect(motor.capturas()).toEqual({});
  });

  it('las celdas con fórmula del Excel quedan protegidas', () => {
    const motor = new MotorLibro(libro);
    expect(motor.protegida('NORTE 26', 'D3')).toBe(true);
    expect(motor.protegida('NORTE 26', 'A3')).toBe(false);
    expect(motor.hojaInicial().name).toBe('TAPO 25');
  });

  it('fusiona capturas de otro equipo sin perder las propias', () => {
    const base = { 'NORTE 26!A3': '1', 'PTE!A5': '2' };
    const servidor = { 'NORTE 26!A3': '1', 'PTE!A5': '9', 'SUR 25!A4': '7' };
    const local = { 'NORTE 26!A3': '4' };
    // Local cambió A3 y borró PTE!A5; el servidor agregó SUR 25!A4.
    expect(fusionarCapturas(servidor, base, local)).toEqual({ 'NORTE 26!A3': '4', 'SUR 25!A4': '7' });
  });

  it('formatea moneda como Excel', () => {
    expect(formatear({ tipo: 'numero', n: 1395.29 }, 'm2a')).toEqual({ texto: '1,395.29', simbolo: '$', alinear: 'right', rojo: false });
    expect(formatear({ tipo: 'numero', n: 0 }, 'm2a').texto).toBe('-');
    expect(formatear({ tipo: 'numero', n: -5 }, 'm2r')).toEqual({ texto: '-$5.00', alinear: 'right', rojo: true });
    expect(formatear({ tipo: 'numero', n: 157.25 }, 'm1r').texto).toBe('$157.3');
    expect(formatear({ tipo: 'numero', n: 0.1 + 0.2 }, 'g').texto).toBe('0.3');
    expect(redondearExcel(1.005, 2)).toBe(1.01);
    expect(redondearExcel(-2.5, 0)).toBe(-3);
  });

  it('aplica, comparte y descarta formato de celda', () => {
    const motor = new MotorLibro(libro);
    expect(motor.estilo('NORTE 26', 'A3').b).toBeFalsy();

    motor.establecerFormato('NORTE 26', 'A3', { b: true, sz: 14 });
    expect(motor.estilo('NORTE 26', 'A3').b).toBe(true);
    expect(motor.estilo('NORTE 26', 'A3').sz).toBe(14);
    expect(motor.formatos()['NORTE 26!A3']).toEqual({ b: true, sz: 14 });

    const otro = new MotorLibro(libro);
    otro.reemplazarFormatos(motor.formatos());
    expect(otro.estilo('NORTE 26', 'A3').b).toBe(true);

    // Quitar la negrita vuelve al original; limpiar borra el formato propio.
    motor.establecerFormato('NORTE 26', 'A3', { b: false });
    expect(motor.estilo('NORTE 26', 'A3').b).toBeFalsy();
    motor.limpiarFormato('NORTE 26', 'A3');
    expect(motor.tieneFormato('NORTE 26', 'A3')).toBe(false);
  });

  it('inserta y elimina columnas conservando los cálculos', () => {
    const motor = new MotorLibro(libro);
    motor.establecer('NORTE 26', 'A3', '2');
    const total = motor.numero('TOTAL', 'D4');

    // Insertar una columna vacía a la izquierda de NORTE 26 no cambia TOTAL (otra hoja).
    expect(motor.insertarColumna('NORTE 26', 0)).toBe(true);
    expect(motor.estructura().length).toBe(1);
    expect(motor.numero('TOTAL', 'D4')).toBe(total);
    // La captura y la fórmula se desplazaron juntas: el PAGAR quedó en E3.
    expect(motor.numero('NORTE 26', 'E3')).toBeGreaterThan(0);

    // Eliminar la misma columna (ahora vacía) deja registradas las dos operaciones
    // (insertar + eliminar, longitud 2), pero los cálculos quedan restaurados.
    expect(motor.eliminarColumna('NORTE 26', 0).ok).toBe(true);
    expect(motor.estructura().length).toBe(2);
    expect(motor.numero('TOTAL', 'D4')).toBe(total);

    // No se puede eliminar una columna usada por fórmulas (col A alimenta los PAGAR).
    expect(new MotorLibro(libro).eliminarColumna('NORTE 26', 0).ok).toBe(false);
  });

  it('permite cambiar y reconstruir anchos de columnas y altos de filas', () => {
    const motor = new MotorLibro(libro);
    expect(motor.cambiarAnchoColumna('NORTE 26', 9, 180)).toBe(true);
    expect(motor.cambiarAltoFila('NORTE 26', 3, 48)).toBe(true);
    expect(anchoColumna(motor.hoja('NORTE 26')!, 'J')).toBe(180);
    expect(altoFila(motor.hoja('NORTE 26')!, 3)).toBe(48);

    const recargado = new MotorLibro(libro);
    recargado.aplicarEstructura(motor.estructura());
    expect(anchoColumna(recargado.hoja('NORTE 26')!, 'J')).toBe(180);
    expect(altoFila(recargado.hoja('NORTE 26')!, 3)).toBe(48);
  });

  it('combina celdas vacías, rechaza solapamientos y permite quitar la combinación', () => {
    const motor = new MotorLibro(libro);
    expect(motor.agregarPersonalizada({ id: 'fusion', nombre: 'FUSION' })).toBe(true);
    expect(motor.fusionarCeldas('FUSION', 1, 0, 2, 1)).toBe(true);
    expect(motor.fusionDe('FUSION', 1, 0)).toEqual({ fila: 1, col: 0, hastaFila: 2, hastaCol: 1 });
    expect(motor.fusionarCeldas('FUSION', 2, 1, 3, 2)).toBe(false);
    expect(motor.desfusionarCeldas('FUSION', 1, 0)).toBe(true);
    expect(motor.puedeDesfusionar('FUSION', 1, 0)).toBe(false);
  });
});
