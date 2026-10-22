import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BoletosApiService, TicketSettlement, TicketSettlementInput } from '../data/boletos-api.service';
import { SettlementPreview } from './boletos-math';
import {
  Bloque,
  HOJAS,
  Hoja,
  HojaId,
  Row,
  bloquesDe,
  cantidadDe,
  claveDeLinea,
  copyRows,
  crearHojaLibre,
  dineroDistinto,
  esHojaLibre,
  fijarSiDifieren,
  filasInicialesLibres,
  hojaPorId,
  importeDe,
  lineToRow,
  netoDe,
  num,
  pieDe,
  setHojasDinamicas,
  tariffToRow,
} from './boletos-hojas';
import {
  CampoHoja,
  Posicion,
  columnasDeBloque,
  enRectangulo,
  leerNumero,
  moverEnBloque,
  moverEnHoja,
  parseTsv,
} from './boletos-grid';
import { evaluarFormula, indiceColumna, letraColumna } from './boletos-formula';

type FormatoCelda = {
  tamano?: number;
  color?: string;
  fondo?: string;
  negrita?: boolean;
  alinear?: 'left' | 'center' | 'right';
  numero?: 'entero' | 'decimal' | 'moneda';
};
type MedidasHoja = { cols: Record<string, number>; rows: Record<string, number> };
type FusionCelda = { bloque: number; fila1: number; fila2: number; col1: number; col2: number };
type PanelFormato = 'fuente' | 'texto' | 'celda';
type CeldaSubMenu = 'alinear' | 'formato' | null;
type FocoHdr = { campo: CampoHoja; pagar: string; lado: 'izq' | 'der' };
type FocoTitulo = { bloqueId: string; lado: 'izq' | 'der' };
type SnapshotHoja = {
  rows: Row[];
  formatos: Record<string, FormatoCelda>;
  formulas: Record<string, string>;
  fusiones: Record<string, FusionCelda[]>;
  etiquetas: Record<string, string>;
  tocadas: Record<string, true>;
  placas: string;
  nombre: string;
};
type BandaHoja = {
  izq: Bloque | null;
  der: Bloque | null;
  filas: number;
  titulo: number;
  encabezado: number;
  dato: number;
  vaciosAntes: number[];
  pagar: string;
};

@Component({
  standalone: true,
  selector: 'app-boletos-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="boletos-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">{{ tituloDe(hojaActual()) }}</p>
          <h2>Corte de boletos</h2>
          <p class="subtitle">{{ hojaActual().detalle }}</p>
        </div>
        <a routerLink="/inicio" class="back-link">Volver al inicio</a>
      </div>

      <div
        class="tabs"
        role="tablist"
        aria-label="Hojas del corte"
        [class.temblando]="editandoPestanas"
      >
        <div
          class="tab-wrap"
          *ngFor="let hoja of hojas; let i = index; trackBy: trackHoja"
          [class.arrastrando]="arrastreTab === hoja.id"
          [attr.draggable]="editandoPestanas"
          (dragstart)="iniciarArrastreTab($event, hoja)"
          (dragover)="sobreArrastreTab($event, hoja)"
          (drop)="soltarArrastreTab($event, hoja)"
          (dragend)="terminarArrastreTab()"
        >
          <button
            type="button"
            role="tab"
            [id]="'tab-' + hoja.id"
            [attr.aria-selected]="hoja.id === hojaActiva"
            [class.active]="hoja.id === hojaActiva"
            [class.con-color]="!!hoja.color"
            [style.--tab-color]="hoja.color || null"
            [style.background]="hoja.id === hojaActiva ? null : (hoja.color || null)"
            [title]="editandoPestanas ? 'Arrastra para mover' : 'Mantén 1 segundo para editar pestañas'"
            (pointerdown)="pulsarTab($event, hoja)"
            (pointerup)="soltarPulsoTab($event)"
            (pointerleave)="soltarPulsoTab($event)"
            (pointercancel)="soltarPulsoTab($event)"
            (pointermove)="moverPulsoTab($event)"
            (click)="clickTab($event, hoja)"
            (contextmenu)="abrirMenu($event, hoja)"
          >
            <input
              *ngIf="renombrando === hoja.id; else tituloTab"
              class="tab-rename"
              [id]="'rename-' + hoja.id"
              [name]="'nombre-' + hoja.id"
              [(ngModel)]="nombreBorrador"
              (click)="$event.stopPropagation()"
              (keydown.enter)="confirmarNombre($event)"
              (keydown.escape)="cancelarNombre($event)"
              (blur)="confirmarNombre()"
            />
            <ng-template #tituloTab>{{ tituloDe(hoja) }}</ng-template>
          </button>
          <button
            type="button"
            class="tab-x"
            *ngIf="editandoPestanas"
            title="Eliminar pestaña"
            aria-label="Eliminar pestaña"
            (pointerdown)="$event.stopPropagation()"
            (click)="pedirBorrarHoja($event, hoja)"
          >×</button>
        </div>
      </div>
      <p class="hint tab-hint" *ngIf="editandoPestanas">Arrastra para mover. Esc o toca fuera para salir.</p>

      <div
        class="tab-menu"
        *ngIf="menu"
        role="menu"
        aria-label="Opciones de la pestaña"
        [style.left.px]="menu.x"
        [style.top.px]="menu.y"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <button type="button" role="menuitem" (click)="empezarNombre()">Cambiar nombre</button>
        <button type="button" role="menuitem" *ngIf="menu && esHojaLibre(menu.id)" (click)="eliminarHojaLibre()">Eliminar pestaña</button>
      </div>

      <div
        class="celda-menu"
        *ngIf="celdaMenu"
        role="menu"
        aria-label="Herramientas de celda"
        [style.left.px]="celdaMenu.x"
        [style.top.px]="celdaMenu.y"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <div class="menu-grupo" [class.abierto]="celdaSub === 'alinear'">
          <button type="button" role="menuitem" class="con-sub" (click)="alternarSubMenu('alinear')">Alineación de texto</button>
          <div class="submenu" *ngIf="celdaSub === 'alinear'" role="menu" aria-label="Alineación">
            <button type="button" role="menuitem" (click)="aplicarAlinear('left')">Izquierda</button>
            <button type="button" role="menuitem" (click)="aplicarAlinear('center')">Centro</button>
            <button type="button" role="menuitem" (click)="aplicarAlinear('right')">Derecha</button>
          </div>
        </div>
        <div class="menu-grupo" [class.abierto]="celdaSub === 'formato'">
          <button type="button" role="menuitem" class="con-sub" (click)="alternarSubMenu('formato')">Tipo de dato</button>
          <div class="submenu" *ngIf="celdaSub === 'formato'" role="menu" aria-label="Tipo de dato">
            <button type="button" role="menuitem" (click)="aplicarNumero('entero')">Número</button>
            <button type="button" role="menuitem" (click)="aplicarNumero('decimal')">Decimal</button>
            <button type="button" role="menuitem" (click)="aplicarNumero('moneda')">Moneda</button>
          </div>
        </div>
        <button type="button" role="menuitem" *ngIf="puedeCombinar()" (click)="combinarCeldas()">Combinar celdas</button>
        <button type="button" role="menuitem" *ngIf="puedeSeparar()" (click)="separarCeldas()">Separar celdas</button>
      </div>

      <div class="herramientas" role="toolbar" aria-label="Formato de la tabla" (click)="$event.stopPropagation()">
        <button type="button" class="tool-btn" title="Atrás" aria-label="Atrás" [disabled]="!puedeDeshacer()" (click)="deshacer()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Adelante" aria-label="Adelante" [disabled]="!puedeRehacer()" (click)="rehacer()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22l2.36.78C4.9 13.31 7.91 11 11.5 11c1.95 0 3.73.72 5.12 1.88L13 16.5h9v-9l-3.6 3.1z"/></svg>
        </button>
        <button type="button" class="tool-btn" title="Nueva pestaña" aria-label="Nueva pestaña" (click)="nuevaHoja()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
        <div class="tool">
          <button type="button" class="tool-btn" title="Tamaño de fuente" aria-label="Tamaño de fuente" [attr.aria-expanded]="panel === 'fuente'" (click)="alternarPanel('fuente')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 19 10.2 5h2.1L17.5 19h-2.2l-1.15-3.2H8.35L7.2 19H5zm3.8-5h5L11.25 7.7 8.8 14z"/></svg>
          </button>
          <div class="tool-panel sizes" *ngIf="panel === 'fuente'" role="menu" aria-label="Tamaños de fuente">
            <button type="button" *ngFor="let tamano of tamanos" [class.marcado]="tamano === tamanoActivo" (click)="aplicarTamano(tamano)">{{ tamano }}</button>
          </div>
        </div>
        <button
          type="button"
          class="tool-btn negrita"
          [class.activo]="negritaActiva()"
          [attr.aria-pressed]="negritaActiva()"
          title="Negrita"
          aria-label="Poner en negritas o normal"
          (click)="alternarNegrita()"
        >
          <span aria-hidden="true">B</span>
        </button>
        <div class="tool">
          <button type="button" class="tool-btn" title="Color de fuente" aria-label="Color de fuente" [attr.aria-expanded]="panel === 'texto'" (click)="alternarPanel('texto')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 16 10.4 4h2.2L17 16h-2.1l-.9-2.6H9l-.9 2.6H6zm3.45-4.4h4.1L11.5 6.8 9.45 11.6z"/></svg>
            <span class="muestra" [style.background]="colorActivo"></span>
          </button>
          <div class="tool-panel colors" *ngIf="panel === 'texto'" role="menu" aria-label="Colores de fuente">
            <button type="button" class="swatch" *ngFor="let color of colores" [style.background]="color" [attr.aria-label]="color" (click)="aplicarColor(color)"></button>
            <button type="button" class="swatch claro" aria-label="Quitar color de fuente" (click)="aplicarColor(null)">∅</button>
            <label class="swatch custom" aria-label="Otro color de fuente">
              <input type="color" [value]="colorActivo" (input)="colorDesdeSelector($event, 'color')" />
            </label>
          </div>
        </div>
        <div class="tool">
          <button type="button" class="tool-btn" title="Color de celda" aria-label="Color de celda" [attr.aria-expanded]="panel === 'celda'" (click)="alternarPanel('celda')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.2 3.8a1.5 1.5 0 0 1 2.1 0l2.9 2.9a1.5 1.5 0 0 1 0 2.1L9.4 19.6 4 20.9 5.3 15.5 15.2 3.8zM7 16.2l7.8-7.8 1.8 1.8L8.8 18l-2.7.6.9-2.4z"/></svg>
            <span class="muestra" [style.background]="fondoActivo"></span>
          </button>
          <div class="tool-panel colors" *ngIf="panel === 'celda'" role="menu" aria-label="Colores de celda">
            <button type="button" class="swatch" *ngFor="let color of colores" [style.background]="color" [attr.aria-label]="color" (click)="aplicarFondo(color)"></button>
            <button type="button" class="swatch claro" aria-label="Quitar color de celda" (click)="aplicarFondo(null)">∅</button>
            <label class="swatch custom" aria-label="Otro color de celda">
              <input type="color" [value]="fondoActivo" (input)="colorDesdeSelector($event, 'fondo')" />
            </label>
          </div>
        </div>
        <button type="button" class="tool-btn" [class.activo]="cuadricula" [attr.aria-pressed]="cuadricula" [title]="cuadricula ? 'Ocultar cuadrícula' : 'Ver cuadrícula'" [attr.aria-label]="cuadricula ? 'Ocultar cuadrícula' : 'Ver cuadrícula'" (click)="alternarCuadricula()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h6.5v6.5H4V4zm9.5 0H20v6.5h-6.5V4zM4 13.5h6.5V20H4v-6.5zm9.5 0H20V20h-6.5v-6.5z"/></svg>
        </button>
      </div>

      <div class="dialogo-fondo" *ngIf="dialogoNuevaHoja" (click)="cancelarNuevaHoja()">
        <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titulo-nueva-hoja" (click)="$event.stopPropagation()">
          <h3 id="titulo-nueva-hoja">Nueva pestaña</h3>
          <p>Escribe el nombre de la hoja de cálculo.</p>
          <label>
            <span>Nombre</span>
            <input
              id="nombre-nueva-hoja"
              name="nombre-nueva-hoja"
              type="text"
              autocomplete="off"
              [(ngModel)]="nombreNuevaHoja"
              (keydown.enter)="confirmarNuevaHoja($event)"
              (keydown.escape)="cancelarNuevaHoja($event)"
            />
          </label>
          <div class="dialogo-acciones">
            <button type="button" class="secondary" (click)="cancelarNuevaHoja()">Cancelar</button>
            <button type="button" class="primary" [disabled]="!nombreNuevaHoja.trim()" (click)="confirmarNuevaHoja()">Crear</button>
          </div>
        </div>
      </div>

      <div class="dialogo-fondo" *ngIf="dialogoBorrarHoja" (click)="cancelarBorrarHoja()">
        <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titulo-borrar-hoja" (click)="$event.stopPropagation()">
          <h3 id="titulo-borrar-hoja">¿Borrar pestaña?</h3>
          <p>Se eliminará «{{ dialogoBorrarHoja.titulo }}» y no hay vuelta atrás.</p>
          <div class="dialogo-acciones">
            <button type="button" class="secondary" (click)="cancelarBorrarHoja()">Cancelar</button>
            <button type="button" class="peligro" (click)="confirmarBorrarHoja()">Borrar</button>
          </div>
        </div>
      </div>

      <p class="banner error" *ngIf="error">{{ error }}</p>
      <p class="banner" *ngIf="loading">Cargando tarifas.</p>

      <ng-container *ngIf="!loading && rows.length">
        <ng-template #celda let-row="row" let-campo="campo" let-cols="cols" let-rows="rows">
          <td
            [ngClass]="{ sel: enSeleccion(row, campo), activa: esActiva(row, campo), fusion: (cols ?? 1) > 1 || (rows ?? 1) > 1 }"
            [attr.colspan]="(cols ?? 1) > 1 ? cols : null"
            [attr.rowspan]="(rows ?? 1) > 1 ? rows : null"
            [attr.data-campo]="campo"
            [style.background]="fondoDe(row, campo)"
            (mouseenter)="extenderArrastre(row, campo)"
          >
            <input
              class="celda"
              [class.zona]="campo === 'zona'"
              [style.color]="colorDe(row, campo)"
              [style.font-size]="tamanoDe(row, campo)"
              [style.font-weight]="pesoDe(row, campo)"
              [style.text-align]="alinearDe(row, campo)"
              type="text"
              autocomplete="off"
              [attr.inputmode]="campo === 'zona' ? 'text' : 'decimal'"
              [name]="row.clave + '-' + campo"
              [id]="idDe(row, campo)"
              [attr.aria-label]="etiqueta(row, campo)"
              [readonly]="!esEdicion(row, campo)"
              [value]="textoCelda(row, campo)"
              (mousedown)="marcar($event, row, campo)"
              (contextmenu)="menuCelda($event, row, campo)"
              (dblclick)="comenzarEdicion(row, campo); $event.preventDefault()"
              (keydown)="tecla($event, row, campo)"
              (input)="escribir($event, row, campo)"
              (copy)="copiar($event)"
              (paste)="pegar($event)"
            />
          </td>
        </ng-template>

        <ng-container *ngIf="hojaActiva !== 'total'; else totalHoja">
          <article class="card">
            <div class="formula-bar" (click)="$event.stopPropagation()">
              <input
                class="ref-box"
                aria-label="Referencia de la celda"
                [value]="nombreEditando ? nombreTexto : referenciaActiva()"
                (focus)="nombreEditando = true; nombreTexto = referenciaActiva()"
                (input)="nombreTexto = valorInput($event)"
                (keydown.enter)="irAReferencia($event)"
                (blur)="nombreEditando = false"
              />
              <button type="button" class="marca" *ngIf="enEdicion()" title="Cancelar" (mousedown)="$event.preventDefault()" (click)="cancelarDesdeBarra()">×</button>
              <button type="button" class="marca ok" *ngIf="enEdicion()" title="Aceptar" (mousedown)="$event.preventDefault()" (click)="confirmarDesdeBarra()">✓</button>
              <div class="fx-wrap">
                <button type="button" class="fx" title="Insertar función" aria-label="Insertar función" [attr.aria-expanded]="panelFx" (mousedown)="$event.preventDefault()" (click)="alternarFunciones()">fx</button>
                <div class="fx-menu" *ngIf="panelFx" role="menu">
                  <button type="button" *ngFor="let fn of funciones" (mousedown)="$event.preventDefault()" (click)="elegirFuncion(fn)">{{ fn }}</button>
                </div>
              </div>
              <input
                id="formula-caja"
                class="fx-box"
                aria-label="Fórmula"
                [disabled]="!referenciaActiva()"
                [value]="textoBarra()"
                (mousedown)="abrirBarra()"
                (focus)="abrirBarra()"
                (input)="escribirBarra($event)"
                (keydown)="teclaBarra($event)"
                (blur)="cerrarBarra($event)"
              />
            </div>
            <div class="table-wrap sheet" [class.sin-cuadricula]="!cuadricula" [class.resizing-col]="resize?.tipo === 'col'" [class.resizing-row]="resize?.tipo === 'row'">
              <table>
                <colgroup>
                  <col class="coord-col" />
                  <col *ngFor="let letra of clavesColumnas()" [style.width.px]="anchoColumna(letra)" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="coord origen"></th>
                    <th class="coord" *ngFor="let letra of letras(anchoCampo())" scope="col" [style.width.px]="anchoColumna(letra)">
                      {{ letra }}
                      <span class="resize-col" title="Arrastra para cambiar el ancho" (mousedown)="iniciarAncho($event, letra)"></span>
                    </th>
                    <th class="coord" *ngIf="esExcel()" [style.width.px]="anchoColumna('G')">
                      G
                      <span class="resize-col" title="Arrastra para cambiar el ancho" (mousedown)="iniciarAncho($event, 'G')"></span>
                    </th>
                    <th class="coord" *ngIf="hojaActual().manual" [style.width.px]="anchoColumna('Q1')">
                      <span class="resize-col" title="Arrastra para cambiar el ancho" (mousedown)="iniciarAncho($event, 'Q1')"></span>
                    </th>
                    <ng-container *ngIf="tieneDerecha()">
                      <th class="coord" *ngFor="let letra of letrasDesde(inicioDerecha())" scope="col" [style.width.px]="anchoColumna(letra)">
                        {{ letra }}
                        <span class="resize-col" title="Arrastra para cambiar el ancho" (mousedown)="iniciarAncho($event, letra)"></span>
                      </th>
                      <th class="coord" *ngIf="hojaActual().manual" [style.width.px]="anchoColumna('Q2')">
                        <span class="resize-col" title="Arrastra para cambiar el ancho" (mousedown)="iniciarAncho($event, 'Q2')"></span>
                      </th>
                    </ng-container>
                  </tr>
                </thead>
                <tbody>
                  <ng-container *ngFor="let banda of bandas(); trackBy: trackBanda">
                    <tr class="vacio" *ngFor="let n of banda.vaciosAntes" [style.height.px]="altoFila(n)">
                      <th class="coord" scope="row">
                        {{ n }}
                        <span class="resize-row" title="Arrastra para cambiar el alto" (mousedown)="iniciarAlto($event, n)"></span>
                      </th>
                      <td class="hueco" *ngFor="let _ of rango(anchoHoja())"></td>
                    </tr>
                    <tr class="seccion" [style.height.px]="altoFila(banda.titulo)">
                      <th class="coord" scope="row">
                        {{ banda.titulo }}
                        <span class="resize-row" title="Arrastra para cambiar el alto" (mousedown)="iniciarAlto($event, banda.titulo)"></span>
                      </th>
                      <th
                        *ngIf="banda.izq as bloque"
                        [attr.colspan]="anchoLado()"
                        [ngClass]="{ sel: esTituloActivo(bloque.id, 'izq'), activa: esTituloActivo(bloque.id, 'izq') }"
                        [style.background]="estiloTitulo(bloque.id, 'izq', 'fondo')"
                        (contextmenu)="menuTitulo($event, bloque.id, 'izq')"
                      >
                        <input
                          class="celda titulo"
                          [id]="'titulo-' + bloque.id + '-izq'"
                          [style.color]="estiloTitulo(bloque.id, 'izq', 'color')"
                          [style.font-size]="estiloTitulo(bloque.id, 'izq', 'tamano')"
                          [style.font-weight]="estiloTitulo(bloque.id, 'izq', 'peso')"
                          [style.text-align]="estiloTitulo(bloque.id, 'izq', 'alinear')"
                          [readonly]="!esEdicionTitulo(bloque.id, 'izq')"
                          [value]="textoTitulo(bloque)"
                          (mousedown)="marcarTitulo($event, bloque.id, 'izq')"
                          (dblclick)="comenzarEdicionTitulo(bloque.id, 'izq'); $event.preventDefault()"
                          (keydown)="teclaTitulo($event, bloque.id, 'izq')"
                          (input)="escribirTitulo($event, bloque.id, 'izq')"
                          (contextmenu)="menuTitulo($event, bloque.id, 'izq')"
                        />
                        <span *ngIf="!esExcel()">{{ bloque.cuenta }}</span>
                        <button type="button" class="secondary add" *ngIf="bloque.manual" (click)="agregar(bloque)">Agregar renglón</button>
                      </th>
                      <td class="hueco" *ngIf="esExcel()"></td>
                      <th
                        *ngIf="banda.der as bloque"
                        [attr.colspan]="anchoLado()"
                        [ngClass]="{ sel: esTituloActivo(bloque.id, 'der'), activa: esTituloActivo(bloque.id, 'der') }"
                        [style.background]="estiloTitulo(bloque.id, 'der', 'fondo')"
                        (contextmenu)="menuTitulo($event, bloque.id, 'der')"
                      >
                        <input
                          class="celda titulo"
                          [id]="'titulo-' + bloque.id + '-der'"
                          [style.color]="estiloTitulo(bloque.id, 'der', 'color')"
                          [style.font-size]="estiloTitulo(bloque.id, 'der', 'tamano')"
                          [style.font-weight]="estiloTitulo(bloque.id, 'der', 'peso')"
                          [style.text-align]="estiloTitulo(bloque.id, 'der', 'alinear')"
                          [readonly]="!esEdicionTitulo(bloque.id, 'der')"
                          [value]="textoTitulo(bloque)"
                          (mousedown)="marcarTitulo($event, bloque.id, 'der')"
                          (dblclick)="comenzarEdicionTitulo(bloque.id, 'der'); $event.preventDefault()"
                          (keydown)="teclaTitulo($event, bloque.id, 'der')"
                          (input)="escribirTitulo($event, bloque.id, 'der')"
                          (contextmenu)="menuTitulo($event, bloque.id, 'der')"
                        />
                        <span *ngIf="!esExcel()">{{ bloque.cuenta }}</span>
                        <button type="button" class="secondary add" *ngIf="bloque.manual" (click)="agregar(bloque)">Agregar renglón</button>
                      </th>
                    </tr>
                    <tr [style.height.px]="altoFila(banda.encabezado)">
                      <th class="coord" scope="row">
                        {{ banda.encabezado }}
                        <span class="resize-row" title="Arrastra para cambiar el alto" (mousedown)="iniciarAlto($event, banda.encabezado)"></span>
                      </th>
                      <ng-container *ngTemplateOutlet="nombres; context: { pagar: banda.pagar, lado: 'izq' }"></ng-container>
                      <td class="hueco" *ngIf="esExcel()"></td>
                      <ng-container *ngIf="tieneDerecha()"><ng-container *ngTemplateOutlet="nombres; context: { pagar: banda.pagar, lado: 'der' }"></ng-container></ng-container>
                    </tr>
                    <tr *ngFor="let i of rango(banda.filas); trackBy: trackIndice" [style.height.px]="altoFila(banda.dato + i)">
                      <th class="coord" scope="row">
                        {{ banda.dato + i }}
                        <span class="resize-row" title="Arrastra para cambiar el alto" (mousedown)="iniciarAlto($event, banda.dato + i)"></span>
                      </th>
                      <ng-container *ngTemplateOutlet="lado; context: { row: filaEn(banda.izq, i) }"></ng-container>
                      <td class="hueco" *ngIf="esExcel()"></td>
                      <ng-container *ngIf="tieneDerecha()">
                        <ng-container *ngTemplateOutlet="lado; context: { row: filaEn(banda.der, i) }"></ng-container>
                      </ng-container>
                    </tr>
                  </ng-container>
                </tbody>
              </table>
            </div>
          </article>

          <ng-template #nombres let-pagar="pagar" let-lado="lado">
            <th
              *ngFor="let campo of columnas()"
              [attr.data-campo]="campo"
              [ngClass]="{ sel: esHdrActiva(campo, pagar, lado), activa: esHdrActiva(campo, pagar, lado) }"
              [style.background]="estiloHdr(campo, pagar, lado, 'fondo')"
              (contextmenu)="menuEncabezado($event, campo, pagar, lado)"
            >
              <input
                class="celda"
                [id]="idHdr(campo, pagar, lado)"
                [style.color]="estiloHdr(campo, pagar, lado, 'color')"
                [style.font-size]="estiloHdr(campo, pagar, lado, 'tamano')"
                [style.font-weight]="estiloHdr(campo, pagar, lado, 'peso')"
                [style.text-align]="estiloHdr(campo, pagar, lado, 'alinear')"
                type="text"
                autocomplete="off"
                [attr.aria-label]="'Encabezado ' + etiquetaColumnaDefault(campo, pagar)"
                [readonly]="!esEdicionHdr(campo, pagar, lado)"
                [value]="textoHdr(campo, pagar, lado)"
                (mousedown)="marcarHdr($event, campo, pagar, lado)"
                (dblclick)="comenzarEdicionHdr(campo, pagar, lado); $event.preventDefault()"
                (keydown)="teclaHdr($event, campo, pagar, lado)"
                (input)="escribirHdr($event, campo, pagar, lado)"
                (contextmenu)="menuEncabezado($event, campo, pagar, lado)"
              />
            </th>
            <th *ngIf="hojaActual().manual"></th>
          </ng-template>

          <ng-template #lado let-row="row">
            <ng-container *ngIf="row; else hueco">
              <ng-container *ngFor="let campo of columnas()">
                <ng-container *ngIf="spanCelda(row, campo) as span">
                  <ng-container *ngTemplateOutlet="celda; context: { row: row, campo: campo, cols: span.cols, rows: span.rows }"></ng-container>
                </ng-container>
              </ng-container>
              <td *ngIf="hojaActual().manual">
                <button type="button" class="quitar" (click)="quitar(row.clave)">Quitar</button>
              </td>
            </ng-container>
          </ng-template>
          <ng-template #hueco>
            <td *ngFor="let _ of columnas()"></td>
            <td *ngIf="hojaActual().manual"></td>
          </ng-template>

          <article class="card totals" aria-label="Totales de la hoja">
            <div><span>Servicios</span><strong id="total-servicios">{{ pieActivo().servicios }}</strong></div>
            <div><span>Importe</span><strong id="total-importe">{{ money(pieActivo().importe) }}</strong></div>
            <div><span>Sin ahorro</span><strong id="total-sin-ahorro">{{ money(pieActivo().sinAhorro) }}</strong></div>
            <div><span>Sencillo</span><strong id="total-sencillo">{{ money(pieActivo().sencillo) }}</strong></div>
            <div><span>Doble</span><strong id="total-doble">{{ money(pieActivo().doble) }}</strong></div>
            <div><span>Triple</span><strong id="total-triple">{{ money(pieActivo().triple) }}</strong></div>
          </article>
          <p class="hint">Flechas, Enter y Tab mueven la celda. Clic derecho abre el menú de alineación, tipo de dato y combinar (también en títulos y encabezados). Doble clic, F2 o una tecla editan. Mayús extiende la selección; también se puede arrastrar. Arrastra el borde de la letra o del número para agrandar columnas y renglones. Ctrl+C y Ctrl+V copian y pegan. Supr limpia. La columna izquierda cuenta la cuota una vez. Dobles y nocturnos la cuentan dos veces.</p>
        </ng-container>

        <ng-template #totalHoja>
          <article class="card">
            <div class="form-grid">
              <label>
                <span>Placas</span>
                <input name="placas" id="placas" [(ngModel)]="placas" (ngModelChange)="editado()" autocomplete="off" />
              </label>
              <label>
                <span>Nombre</span>
                <input name="nombre" id="nombre" [(ngModel)]="nombre" (ngModelChange)="editado()" autocomplete="off" />
              </label>
            </div>
            <p class="hint">Placas y nombre se guardan con el corte y valen para todas las pestañas.</p>
          </article>

          <article class="card">
            <div class="table-wrap sheet" [class.sin-cuadricula]="!cuadricula" [class.resizing-col]="resize?.tipo === 'col'" [class.resizing-row]="resize?.tipo === 'row'">
              <table>
                <colgroup>
                  <col class="coord-col" />
                  <col *ngFor="let letra of letras(7)" [style.width.px]="anchoColumna(letra)" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="coord origen"></th>
                    <th class="coord" *ngFor="let letra of letras(7)" scope="col" [style.width.px]="anchoColumna(letra)">
                      {{ letra }}
                      <span class="resize-col" title="Arrastra para cambiar el ancho" (mousedown)="iniciarAncho($event, letra)"></span>
                    </th>
                  </tr>
                  <tr [style.height.px]="altoFila(1)">
                    <th class="coord" scope="row">
                      1
                      <span class="resize-row" title="Arrastra para cambiar el alto" (mousedown)="iniciarAlto($event, 1)"></span>
                    </th>
                    <th>Hoja</th>
                    <th>Servicios</th>
                    <th>Importe</th>
                    <th>Sin ahorro</th>
                    <th>Sencillo</th>
                    <th>Doble</th>
                    <th>Triple</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let hoja of hojasDeCaptura(); let i = index" [style.height.px]="altoFila(i + 2)">
                    <th class="coord" scope="row">
                      {{ i + 2 }}
                      <span class="resize-row" title="Arrastra para cambiar el alto" (mousedown)="iniciarAlto($event, i + 2)"></span>
                    </th>
                    <td>{{ tituloDe(hoja) }}</td>
                    <td [attr.id]="'pie-' + hoja.id + '-servicios'">{{ pieDeHoja(hoja.id).servicios }}</td>
                    <td [attr.id]="'pie-' + hoja.id + '-importe'">{{ money(pieDeHoja(hoja.id).importe) }}</td>
                    <td>{{ money(pieDeHoja(hoja.id).sinAhorro) }}</td>
                    <td>{{ money(pieDeHoja(hoja.id).sencillo) }}</td>
                    <td>{{ money(pieDeHoja(hoja.id).doble) }}</td>
                    <td>{{ money(pieDeHoja(hoja.id).triple) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="card totals" aria-label="Totales del corte">
            <div><span>Servicios</span><strong id="total-servicios">{{ pieGeneral().servicios }}</strong></div>
            <div><span>Importe</span><strong id="total-importe">{{ money(pieGeneral().importe) }}</strong></div>
            <div><span>Sin ahorro</span><strong id="total-sin-ahorro">{{ money(pieGeneral().sinAhorro) }}</strong></div>
            <div><span>Sencillo</span><strong id="total-sencillo">{{ money(pieGeneral().sencillo) }}</strong></div>
            <div><span>Doble</span><strong id="total-doble">{{ money(pieGeneral().doble) }}</strong></div>
            <div><span>Triple</span><strong id="total-triple">{{ money(pieGeneral().triple) }}</strong></div>
            <div><span>Cuádruple</span><strong id="total-cuadruple">{{ money(pieGeneral().cuadruple) }}</strong></div>
            <div><span>Quíntuple</span><strong id="total-quintuple">{{ money(pieGeneral().quintuple) }}</strong></div>
            <div><span>Séptuple</span><strong id="total-septuple">{{ money(pieGeneral().septuple) }}</strong></div>
          </article>
          <p class="hint">Cuádruple, quíntuple y séptuple restan al triple los servicios por 5.30, 10.60 y 21.20. No hay séxtuple.</p>
        </ng-template>

        <article class="card">
          <div class="card-head">
            <h3>Cortes guardados</h3>
            <span>{{ cortes.length }}</span>
          </div>
          <p class="hint" *ngIf="!cortes.length">Todavía no hay cortes guardados.</p>
          <div class="corte-list">
            <button type="button" class="corte" *ngFor="let corte of cortes" (click)="abrir(corte.id)">
              {{ corte.placas || 'Sin placas' }} · {{ corte.nombre || 'Sin nombre' }} · {{ money(corte.importe) }}
            </button>
          </div>
        </article>
      </ng-container>
    </section>
  `,
  styles: [
    `
      .boletos-page { display: grid; gap: 18px; color: #463255; }
      .page-header, .card-head, .action-row, .totals { display: flex; justify-content: space-between; gap: 12px; }
      .page-header { align-items: start; }
      .eyebrow { margin: 0 0 8px; color: #c02686; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.78rem; font-weight: 700; }
      h2, h3, p { margin: 0; }
      .subtitle, .hint, .card-head span { color: #7d6792; }
      .subtitle, .hint { margin-top: 8px; }
      .hint.inline { margin-top: 0; align-self: center; }
      .back-link, .primary, .secondary, .corte, .tabs button[role='tab'] { border: 0; border-radius: 999px; padding: 10px 14px; font-weight: 700; }
      .back-link { text-decoration: none; color: #7c3aed; background: rgba(244, 114, 182, 0.14); }
      .primary, .tabs button[role='tab'].active { background: linear-gradient(135deg, #ec4899, #a855f7); color: white; }
      .secondary, .corte, .tabs button[role='tab'] { background: rgba(244, 114, 182, 0.14); color: #7c3aed; }
      .tabs button[role='tab'].con-color:not(.active) { color: #1f2937; border: 1px solid rgba(0,0,0,0.08); }
      .tabs button[role='tab'].con-color.active { box-shadow: inset 0 -3px 0 rgba(0,0,0,0.25); }
      .primary:disabled { opacity: 0.6; }
      .tabs { display: flex; gap: 8px; overflow-x: auto; padding: 14px 8px 16px; }
      .tab-wrap { position: relative; flex: 0 0 auto; transform-origin: center center; transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
      .tabs:not(.temblando) .tab-wrap:hover { transform: scale(1.1); z-index: 1; }
      .tabs:not(.temblando) .tab-wrap:has(button[role='tab'].active) { transform: scale(1.06); }
      .tabs:not(.temblando) .tab-wrap:has(button[role='tab'].active):hover { transform: scale(1.12); }
      .tabs button[role='tab'] { flex: 0 0 auto; transition: background 0.35s ease, color 0.35s ease, box-shadow 0.35s ease; }
      .tabs.temblando .tab-wrap { animation: temblor 0.7s ease-in-out infinite; transition: none; }
      .tabs.temblando .tab-wrap:nth-child(odd) { animation-direction: reverse; animation-delay: -0.2s; }
      .tabs.temblando .tab-wrap.arrastrando { animation: none; opacity: 0.72; transform: scale(1.04); z-index: 2; }
      @keyframes temblor {
        0% { transform: rotate(-1.4deg) translateY(0); }
        25% { transform: rotate(1.2deg) translateY(-1px); }
        50% { transform: rotate(-1.1deg) translateY(0); }
        75% { transform: rotate(1.4deg) translateY(1px); }
        100% { transform: rotate(-1.4deg) translateY(0); }
      }
      .tabs .tab-wrap > button.tab-x {
        position: absolute; right: -6px; top: -6px; z-index: 5;
        width: 20px; height: 20px; min-width: 20px; min-height: 20px; padding: 0; margin: 0;
        border: 2px solid #ffffff; border-radius: 999px;
        background: #ef4444; color: #ffffff; font-size: 13px; font-weight: 900; line-height: 1;
        display: grid; place-items: center; cursor: pointer;
        box-shadow: 0 2px 6px rgba(185, 28, 28, 0.45);
      }
      .tabs .tab-wrap > button.tab-x:hover { background: #dc2626; color: #ffffff; }
      .tab-hint { margin-top: -6px; font-size: 0.85rem; }
      .peligro { border: 0; border-radius: 999px; padding: 10px 14px; font-weight: 700; background: #9f1239; color: white; }
      .tab-rename { width: 8.5rem; margin: -4px 0; padding: 4px 8px; border-radius: 999px; font-weight: 700; color: #3a214e; background: white; }
      .tab-menu, .celda-menu { position: fixed; z-index: 40; min-width: 200px; padding: 6px; border-radius: 14px; background: white; border: 1px solid rgba(236, 72, 153, 0.2); box-shadow: 0 12px 30px rgba(88, 28, 135, 0.16); }
      .tab-menu button, .celda-menu button { display: block; width: 100%; text-align: left; border: 0; border-radius: 10px; background: transparent; color: #7c3aed; font-weight: 700; padding: 10px 12px; }
      .tab-menu button:hover, .tab-menu button:focus-visible, .celda-menu button:hover, .celda-menu button:focus-visible { background: rgba(244, 114, 182, 0.16); }
      .celda-menu .menu-grupo { position: relative; }
      .celda-menu .con-sub::after { content: '▸'; float: right; opacity: 0.7; }
      .celda-menu .submenu { position: absolute; left: calc(100% + 4px); top: 0; min-width: 140px; padding: 6px; border-radius: 14px; background: white; border: 1px solid rgba(236, 72, 153, 0.2); box-shadow: 0 12px 30px rgba(88, 28, 135, 0.16); }
      .sheet td.fusion { vertical-align: middle; }
      .herramientas { display: flex; align-items: center; gap: 8px; width: fit-content; max-width: 100%; padding: 8px; border-radius: 16px; background: rgba(255, 255, 255, 0.72); border: 1px solid rgba(236, 72, 153, 0.16); }
      .dialogo-fondo { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(58, 33, 78, 0.28); padding: 16px; }
      .dialogo { width: min(360px, 100%); display: grid; gap: 12px; padding: 18px; border-radius: 20px; background: white; border: 1px solid rgba(236, 72, 153, 0.2); box-shadow: 0 18px 40px rgba(88, 28, 135, 0.2); }
      .dialogo h3, .dialogo p { margin: 0; }
      .dialogo p { color: #7d6792; }
      .dialogo-acciones { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .tool { position: relative; }
      .tool-btn { display: grid; justify-items: center; gap: 2px; width: 42px; height: 42px; padding: 6px; border: 0; border-radius: 12px; background: transparent; color: #7c3aed; }
      .tool-btn svg { width: 22px; height: 22px; }
      .tool-btn.negrita { font-family: Georgia, "Times New Roman", serif; font-size: 1.2rem; font-weight: 800; line-height: 1; }
      .tool-btn:hover, .tool-btn[aria-expanded='true'], .tool-btn.activo { background: rgba(244, 114, 182, 0.18); }
      .tool-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .tool-btn:disabled:hover { background: transparent; }
      .muestra { width: 16px; height: 3px; border-radius: 999px; background: #3a214e; }
      .tool-panel { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; display: flex; gap: 6px; padding: 8px; border-radius: 14px; background: white; border: 1px solid rgba(236, 72, 153, 0.2); box-shadow: 0 12px 30px rgba(88, 28, 135, 0.16); }
      .tool-panel.sizes { flex-direction: column; min-width: 72px; }
      .tool-panel.colors { display: grid; grid-template-columns: repeat(6, 28px); width: max-content; }
      .tool-panel button, .swatch { border: 1px solid rgba(168, 85, 247, 0.18); background: white; color: #3a214e; border-radius: 8px; font-weight: 700; }
      .tool-panel.sizes button { padding: 6px 10px; }
      .tool-panel.sizes button.marcado { background: rgba(168, 85, 247, 0.16); }
      .swatch { width: 28px; height: 28px; padding: 0; }
      .swatch.claro { background: white; }
      .swatch.custom { display: grid; place-items: center; overflow: hidden; }
      .herramientas input { width: 28px; height: 28px; padding: 0; border: 0; background: transparent; }
      .tool-btn:focus-visible, .tool-panel button:focus-visible { outline: 2px solid #a855f7; outline-offset: 2px; }
      .card { border: 1px solid rgba(236, 72, 153, 0.12); border-radius: 20px; background: rgba(255, 255, 255, 0.72); padding: 18px; }
      .form-grid, .totals { display: grid; gap: 14px; }
      .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .totals { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); align-items: end; }
      .totals div { display: grid; gap: 6px; }
      .totals strong { font-size: 1.35rem; color: #3a214e; }
      label { display: grid; gap: 8px; }
      label span { color: #7d6792; font-weight: 600; }
      input { width: 100%; border-radius: 14px; border: 1px solid rgba(168, 85, 247, 0.18); background: rgba(255, 255, 255, 0.9); color: #3a214e; padding: 12px 14px; outline: none; box-sizing: border-box; }
      .table-wrap { overflow-x: auto; }
      .table-wrap.sheet { border-radius: 14px 0 0 0; }
      table { width: max-content; min-width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { text-align: left; padding: 8px 6px; white-space: nowrap; overflow: hidden; }
      th { color: #8f7aa8; font-size: 0.78rem; }
      td input { width: 100%; padding: 8px 10px; box-sizing: border-box; }
      .sheet { user-select: none; }
      .sheet.resizing-col, .sheet.resizing-row { cursor: inherit; }
      .sheet.resizing-col { cursor: col-resize; }
      .sheet.resizing-row { cursor: row-resize; }
      .sheet td, .sheet th { border: 1.5px solid rgba(75, 85, 99, 0.4); }
      .formula-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
      .formula-bar input { padding: 6px 10px; border-radius: 8px; background: white; }
      .formula-bar .ref-box { width: 84px; flex: 0 0 84px; text-align: center; font-weight: 800; color: #3a214e; }
      .formula-bar .fx-box { flex: 1; width: auto; min-width: 0; font-family: Consolas, "Courier New", monospace; }
      .fx-box:disabled { background: rgba(255, 255, 255, 0.55); }
      .fx-wrap { position: relative; }
      .fx, .marca { width: 34px; height: 34px; border: 0; border-radius: 8px; background: transparent; font-weight: 800; }
      .fx { font-family: Georgia, "Times New Roman", serif; font-style: italic; color: #1d4ed8; font-size: 1.05rem; }
      .fx:hover, .fx[aria-expanded='true'], .marca:hover { background: rgba(244, 114, 182, 0.18); }
      .marca { color: #9f1239; font-size: 1.3rem; line-height: 1; }
      .marca.ok { color: #047857; }
      .fx-menu { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; display: grid; min-width: 140px; padding: 6px; border-radius: 14px; background: white; border: 1px solid rgba(236, 72, 153, 0.2); box-shadow: 0 12px 30px rgba(88, 28, 135, 0.16); }
      .fx-menu button { border: 0; border-radius: 8px; background: transparent; color: #3a214e; font-weight: 700; text-align: left; padding: 8px 10px; }
      .fx-menu button:hover { background: rgba(168, 85, 247, 0.12); }
      .sheet col.coord-col { width: 2.4rem; }
      .sheet th.coord { position: relative; width: 2.4rem; text-align: center; font-size: 0.72rem; font-weight: 800; color: #9f1239; background: #fbcfe8; }
      .sheet th.coord.origen { border-top-left-radius: 14px; }
      .sheet .resize-col, .sheet .resize-row { position: absolute; z-index: 2; }
      .sheet .resize-col { top: 0; right: -3px; width: 7px; height: 100%; cursor: col-resize; }
      .sheet .resize-row { left: 0; bottom: -3px; width: 100%; height: 7px; cursor: row-resize; }
      .sheet .resize-col:hover, .sheet .resize-row:hover { background: rgba(124, 58, 237, 0.35); }
      .sheet tr.seccion th { background: #9999ff; color: #111827; font-size: 0.95rem; }
      .sheet td[data-campo='zona'] { background: #9966ff; }
      .sheet td[data-campo='descuento'] { background: #ff6600; }
      .sheet td[data-campo='sitio'] { background: #ff99ff; }
      .sheet td[data-campo='neto'] { background: #ffc000; }
      .sheet td.hueco, .sheet tr.vacio td { background: transparent; }
      .sheet tr.seccion span { margin-left: 8px; color: #8f7aa8; font-size: 0.78rem; font-weight: 600; }
      .sheet tr.seccion .add { margin: 0 0 0 12px; padding: 4px 10px; }
      .sheet.sin-cuadricula td, .sheet.sin-cuadricula th { border-color: transparent; }
      .sheet td.sel { box-shadow: inset 0 0 0 999px rgba(168, 85, 247, 0.16); }
      .sheet td.activa { box-shadow: inset 0 0 0 2px #7c3aed; }
      .sheet input.celda { width: 100%; min-width: 0; border-color: transparent; background: transparent; border-radius: 8px; cursor: cell; }
      .sheet input.celda.zona { width: 100%; }
      .sheet input.celda.titulo { font-weight: 700; }
      .sheet th input.celda { color: inherit; font: inherit; font-weight: 700; }
      .sheet input.celda[readonly] { caret-color: transparent; }
      .sheet input.celda:not([readonly]) { cursor: text; caret-color: auto; background: #fff; border-color: #7c3aed; user-select: text; }
      .sheet th.sel { box-shadow: inset 0 0 0 999px rgba(168, 85, 247, 0.16); }
      .sheet th.activa { box-shadow: inset 0 0 0 2px #7c3aed; }
      .action-row, .corte-list { display: flex; gap: 10px; flex-wrap: wrap; }
      .add { margin-top: 12px; }
      .quitar { border: 0; background: transparent; color: #9f1239; font-weight: 700; padding: 8px; }
      .banner { padding: 12px 14px; border-radius: 14px; background: rgba(244, 114, 182, 0.14); }
      .error { color: #9f1239; }
      .status { margin-top: 12px; color: #7c3aed; font-weight: 700; }
      @media (max-width: 1100px) {
        .form-grid, .page-header { grid-template-columns: 1fr; display: grid; }
      }
    `,
  ],
})
export class BoletosPage {
  private readonly api = inject(BoletosApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);

  protected hojasLibres: Hoja[] = this.leerHojasLibres();
  private hojasOcultas: string[] = this.leerHojasOcultas();
  private ordenHojas: string[] = this.leerOrdenHojas();
  protected hojas: Hoja[] = this.armarListaHojas();
  protected rows: Row[] = [];
  protected bloques: Bloque[] = [];
  protected cortes: TicketSettlement[] = [];
  protected placas = '';
  protected nombre = '';
  protected hojaActiva: HojaId = 'norte-2026';
  protected loading = true;
  protected saving = false;
  protected error = '';
  protected status = '';
  private sucio = false;
  private guardarTimer: ReturnType<typeof setTimeout> | null = null;
  private guardarPendiente = false;
  protected menu: { id: HojaId; x: number; y: number } | null = null;
  protected celdaMenu: { x: number; y: number } | null = null;
  protected celdaSub: CeldaSubMenu = null;
  protected renombrando: HojaId | null = null;
  protected nombreBorrador = '';
  protected dialogoNuevaHoja = false;
  protected nombreNuevaHoja = '';
  protected editandoPestanas = false;
  protected arrastreTab: HojaId | null = null;
  protected dialogoBorrarHoja: { id: HojaId; titulo: string } | null = null;
  protected nombres: Partial<Record<HojaId, string>> = this.leerNombres();
  private pulsoTab: { id: HojaId; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
  private ignorarClickTab = false;
  protected readonly esHojaLibre = esHojaLibre;
  protected readonly tamanos = [12, 14, 16, 18, 20, 24];
  protected readonly colores = ['#3a214e', '#111827', '#9f1239', '#c02686', '#7c3aed', '#1d4ed8', '#047857', '#b45309', '#ffffff', '#fce7f3', '#ede9fe', '#dbeafe', '#dcfce7', '#fef3c7'];
  protected panel: PanelFormato | null = null;
  protected cuadricula = this.leerCuadricula();
  protected formatos: Record<string, FormatoCelda> = this.leerFormatos();
  protected medidas: Record<string, MedidasHoja> = this.leerMedidas();
  protected fusiones: Record<string, FusionCelda[]> = this.leerFusiones();
  protected etiquetas: Record<string, string> = this.leerEtiquetas();
  protected resize: { tipo: 'col' | 'row'; clave: string; inicio: number; medida: number } | null = null;
  protected nombreEditando = false;
  protected nombreTexto = '';
  protected panelFx = false;
  protected readonly funciones = ['SUMA', 'PROMEDIO', 'MIN', 'MAX', 'REDONDEAR', 'ABS'];
  protected readonly colorActivo = '#3a214e';
  protected readonly fondoActivo = '#fce7f3';
  protected readonly tamanoActivo = 14;
  private ignorarCierre = false;
  private ignorarCierreCeldaMenu = false;
  private ancla: Posicion | null = null;
  private foco: Posicion | null = null;
  private focoHdr: FocoHdr | null = null;
  private focoTitulo: FocoTitulo | null = null;
  private editando: { clave: string; campo: CampoHoja; previo: string } | null = null;
  private editandoHdr: (FocoHdr & { previo: string }) | null = null;
  private editandoTitulo: (FocoTitulo & { previo: string }) | null = null;
  private buffer = '';
  private arrastrando = false;
  private arrastreMovio = false;
  private readonly maxHistorial = 5;
  private historial: SnapshotHoja[] = [];
  private futuro: SnapshotHoja[] = [];
  private snapAntesEdicion: SnapshotHoja | null = null;
  private restaurando = false;
  private seed: Row[] = [];
  private corteId: string | null = null;
  private ready = false;
  private hydrating = false;
  private formulas: Record<string, string> = this.leerFormulas();
  private tocadas: Record<string, true> = this.leerTocadas();
  private errores: Record<string, string> = {};
  private calculando = false;

  constructor() {
    setHojasDinamicas(this.hojasLibres);
    this.hojaActiva = hojaPorId(this.route.snapshot.queryParamMap.get('hoja')).id;
    this.route.queryParamMap.subscribe((params) => {
      const hoja = hojaPorId(params.get('hoja')).id;
      if (hoja !== this.hojaActiva) {
        this.hojaActiva = hoja;
        this.limpiarCursor();
        this.armar();
        this.paint();
      }
      const id = params.get('corte');
      if (!this.ready || !id || id === this.corteId) return;
      void this.abrirCorte(id);
    });
    void this.boot();
  }

  protected hojaActual(): Hoja {
    return hojaPorId(this.hojaActiva);
  }

  protected hojasDeCaptura(): Hoja[] {
    return this.hojas.filter((hoja) => hoja.id !== 'total' && !hoja.catalogo);
  }

  protected pieActivo(): SettlementPreview {
    return pieDe(this.filasDe(this.hojaActiva));
  }

  protected pieDeHoja(id: HojaId): SettlementPreview {
    return pieDe(this.filasDe(id));
  }

  protected pieGeneral(): SettlementPreview {
    return pieDe(this.rows);
  }

  protected netoFila(row: Row): number {
    return netoDe(row);
  }

  protected importeFila(row: Row): number {
    return importeDe(row);
  }

  protected money(value: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
  }

  protected idDe(row: Row, campo: string): string {
    const prefijo = row.ambito === 'CDMX' ? '' : `${row.ambito}-`;
    return `${prefijo}${campo}-${row.tipo}-${row.zona}`;
  }

  protected tituloDe(hoja: Hoja): string {
    const propio = this.nombres[hoja.id]?.trim();
    return propio || hoja.titulo;
  }

  protected abrirMenu(event: MouseEvent, hoja: Hoja): void {
    event.preventDefault();
    event.stopPropagation();
    const ancho = 190;
    const x = Math.min(event.clientX, window.innerWidth - ancho - 8);
    const y = Math.min(event.clientY, window.innerHeight - 52);
    this.menu = { id: hoja.id, x: Math.max(8, x), y: Math.max(8, y) };
  }

  protected empezarNombre(): void {
    if (!this.menu) return;
    const hoja = hojaPorId(this.menu.id);
    this.renombrando = hoja.id;
    this.nombreBorrador = this.tituloDe(hoja);
    this.menu = null;
    setTimeout(() => {
      const input = document.getElementById(`rename-${hoja.id}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected confirmarNombre(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.ignorarCierre) {
      this.ignorarCierre = false;
      return;
    }
    if (!this.renombrando) return;
    const id = this.renombrando;
    const texto = this.nombreBorrador.trim();
    const siguientes = { ...this.nombres };
    if (!texto || texto === hojaPorId(id).titulo) {
      delete siguientes[id];
    } else {
      siguientes[id] = texto;
    }
    this.nombres = siguientes;
    this.renombrando = null;
    this.guardarNombres();
    if (esHojaLibre(id) && texto) {
      this.hojasLibres = this.hojasLibres.map((hoja) => (hoja.id === id ? { ...hoja, titulo: texto } : hoja));
      this.guardarHojasLibres();
      setHojasDinamicas(this.hojasLibres);
      this.hojas = this.armarListaHojas();
    }
  }

  protected cancelarNombre(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.ignorarCierre = true;
    this.renombrando = null;
  }

  protected seleccionar(id: HojaId): void {
    if (this.renombrando === id) return;
    this.hojaActiva = id;
    this.limpiarCursor();
    this.armar();
    void this.router.navigate([], { queryParams: { hoja: id }, queryParamsHandling: 'merge' });
  }

  protected trackHoja(_index: number, hoja: Hoja): string {
    return hoja.id;
  }

  protected clickTab(event: MouseEvent, hoja: Hoja): void {
    if (this.ignorarClickTab) {
      this.ignorarClickTab = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.editandoPestanas) {
      event.preventDefault();
      return;
    }
    this.seleccionar(hoja.id);
  }

  protected pulsarTab(event: PointerEvent, hoja: Hoja): void {
    if (event.button !== 0 || this.editandoPestanas || this.renombrando) return;
    this.cancelarPulsoTab();
    this.pulsoTab = {
      id: hoja.id,
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        this.pulsoTab = null;
        this.editandoPestanas = true;
        this.ignorarClickTab = true;
        this.menu = null;
        this.panel = null;
        this.cerrarCeldaMenu();
        this.cd.detectChanges();
      }, 1000),
    };
  }

  protected moverPulsoTab(event: PointerEvent): void {
    if (!this.pulsoTab) return;
    if (Math.hypot(event.clientX - this.pulsoTab.x, event.clientY - this.pulsoTab.y) > 12) {
      this.cancelarPulsoTab();
    }
  }

  protected soltarPulsoTab(_event?: PointerEvent): void {
    this.cancelarPulsoTab();
  }

  protected iniciarArrastreTab(event: DragEvent, hoja: Hoja): void {
    if (!this.editandoPestanas) {
      event.preventDefault();
      return;
    }
    this.arrastreTab = hoja.id;
    event.dataTransfer?.setData('text/plain', hoja.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected sobreArrastreTab(event: DragEvent, hoja: Hoja): void {
    if (!this.editandoPestanas || !this.arrastreTab || this.arrastreTab === hoja.id) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const desde = this.hojas.findIndex((item) => item.id === this.arrastreTab);
    const hacia = this.hojas.findIndex((item) => item.id === hoja.id);
    if (desde < 0 || hacia < 0 || desde === hacia) return;
    const siguientes = [...this.hojas];
    const [movida] = siguientes.splice(desde, 1);
    siguientes.splice(hacia, 0, movida);
    this.hojas = siguientes;
    this.ordenHojas = siguientes.map((item) => item.id);
  }

  protected soltarArrastreTab(event: DragEvent, _hoja: Hoja): void {
    if (!this.editandoPestanas) return;
    event.preventDefault();
    this.guardarOrdenHojas();
    this.arrastreTab = null;
  }

  protected terminarArrastreTab(): void {
    this.arrastreTab = null;
    this.guardarOrdenHojas();
  }

  protected salirEdicionPestanas(): void {
    this.editandoPestanas = false;
    this.arrastreTab = null;
    this.cancelarPulsoTab();
  }

  protected pedirBorrarHoja(event: Event, hoja: Hoja): void {
    event.preventDefault();
    event.stopPropagation();
    this.dialogoBorrarHoja = { id: hoja.id, titulo: this.tituloDe(hoja) };
  }

  protected cancelarBorrarHoja(): void {
    this.dialogoBorrarHoja = null;
  }

  protected confirmarBorrarHoja(): void {
    if (!this.dialogoBorrarHoja) return;
    this.borrarPestana(this.dialogoBorrarHoja.id);
    this.dialogoBorrarHoja = null;
  }

  protected nuevaHoja(): void {
    this.panel = null;
    this.menu = null;
    this.cerrarCeldaMenu();
    this.nombreNuevaHoja = `Hoja ${this.hojasLibres.length + 1}`;
    this.dialogoNuevaHoja = true;
    setTimeout(() => {
      const input = document.getElementById('nombre-nueva-hoja') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected cancelarNuevaHoja(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.dialogoNuevaHoja = false;
    this.nombreNuevaHoja = '';
  }

  protected confirmarNuevaHoja(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const nombre = this.nombreNuevaHoja.trim();
    if (!nombre) return;
    const hoja = crearHojaLibre(this.hojasLibres.length + 1);
    hoja.titulo = nombre;
    hoja.detalle = `Hoja de cálculo: ${nombre}.`;
    this.hojasLibres = [...this.hojasLibres, hoja];
    this.refrescarHojas();
    this.rows = [...this.rows, ...filasInicialesLibres(hoja)];
    this.nombres = { ...this.nombres, [hoja.id]: nombre };
    this.guardarNombres();
    this.guardarHojasLibres();
    this.dialogoNuevaHoja = false;
    this.nombreNuevaHoja = '';
    this.seleccionar(hoja.id);
    this.editado();
  }

  protected eliminarHojaLibre(): void {
    if (!this.menu || !esHojaLibre(this.menu.id)) return;
    const hoja = hojaPorId(this.menu.id);
    this.menu = null;
    this.dialogoBorrarHoja = { id: hoja.id, titulo: this.tituloDe(hoja) };
  }

  private borrarPestana(id: HojaId): void {
    if (esHojaLibre(id)) {
      const hoja = hojaPorId(id);
      this.hojasLibres = this.hojasLibres.filter((item) => item.id !== id);
      this.rows = this.rows.filter((row) => !(row.base === hoja.base && row.vigencia === hoja.vigencia));
      const nombres = { ...this.nombres };
      delete nombres[id];
      this.nombres = nombres;
      this.guardarNombres();
      this.guardarHojasLibres();
      this.editado();
    } else {
      if (!this.hojasOcultas.includes(id)) this.hojasOcultas = [...this.hojasOcultas, id];
      this.guardarHojasOcultas();
    }
    this.ordenHojas = this.ordenHojas.filter((item) => item !== id);
    this.guardarOrdenHojas();
    this.refrescarHojas();
    if (this.hojaActiva === id) {
      const siguiente = this.hojas[0]?.id ?? 'norte-2026';
      this.seleccionar(siguiente);
    } else {
      this.armar();
    }
  }

  private cancelarPulsoTab(): void {
    if (!this.pulsoTab) return;
    clearTimeout(this.pulsoTab.timer);
    this.pulsoTab = null;
  }

  protected etiqueta(row: Row, campo: CampoHoja): string {
    const hoja = this.hojaActual();
    const nombre = campo === 'precio' ? hoja.precio
      : campo === 'descuento' ? hoja.descuento
        : campo === 'sitio' ? hoja.sitio
          : campo === 'plata' ? 'Plata'
            : campo === 'neto' ? (hoja.manual ? 'Pagar' : 'Neto')
              : campo === 'cantidad' ? 'Cantidad'
                : campo === 'importe' ? (hoja.manual ? 'Total' : 'Importe')
                  : 'Zona';
    return `${nombre} ${row.tipo} zona ${row.zona}`;
  }

  protected esActiva(row: Row, campo: CampoHoja): boolean {
    const pos = this.posDe(row, campo);
    return !!pos && this.misma(pos, this.foco);
  }

  protected esEdicion(row: Row, campo: CampoHoja): boolean {
    return this.editando?.clave === row.clave && this.editando.campo === campo;
  }

  protected enSeleccion(row: Row, campo: CampoHoja): boolean {
    const pos = this.posDe(row, campo);
    return !!pos && !!this.ancla && !!this.foco && enRectangulo(this.ancla, this.foco, pos);
  }

  protected textoCelda(row: Row, campo: CampoHoja): string {
    if (this.esEdicion(row, campo)) return this.buffer;
    const error = this.errores[this.claveFormato(row, campo)];
    if (error) return error;
    return this.textoFormateado(row, campo);
  }

  protected alinearDe(row: Row, campo: CampoHoja): string | null {
    return this.formatos[this.claveFormato(row, campo)]?.alinear ?? null;
  }

  protected spanCelda(row: Row, campo: CampoHoja): { cols: number; rows: number } | null {
    const pos = this.posDe(row, campo);
    if (!pos) return { cols: 1, rows: 1 };
    const fusion = this.fusionQueCubre(pos);
    if (!fusion) return { cols: 1, rows: 1 };
    if (pos.fila === fusion.fila1 && pos.col === fusion.col1) {
      return { cols: fusion.col2 - fusion.col1 + 1, rows: fusion.fila2 - fusion.fila1 + 1 };
    }
    return null;
  }

  protected marcar(event: MouseEvent, row: Row, campo: CampoHoja): void {
    if (event.button !== 0) return;
    if (this.esEdicion(row, campo)) return;
    event.preventDefault();
    const pos = this.posDe(row, campo);
    if (!pos) return;
    const master = this.posMaestra(pos);
    this.focoHdr = null;
    this.focoTitulo = null;
    this.editandoHdr = null;
    this.editandoTitulo = null;
    if (event.shiftKey && this.ancla) {
      this.foco = master;
    } else if (this.misma(this.foco, master) && !this.arrastreMovio) {
      this.celdaMenu = null;
      this.comenzarEdicion(row, campo);
      return;
    } else {
      this.editando = null;
      this.ancla = master;
      this.foco = master;
    }
    this.arrastrando = true;
    this.arrastreMovio = false;
    this.enfocar(master);
  }

  protected menuCelda(event: MouseEvent, row: Row, campo: CampoHoja): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.esEdicion(row, campo)) return;
    const pos = this.posDe(row, campo);
    if (!pos) return;
    const master = this.posMaestra(pos);
    this.focoHdr = null;
    this.focoTitulo = null;
    this.editandoHdr = null;
    this.editandoTitulo = null;
    const enSel = this.enSeleccion(row, campo);
    if (!enSel) {
      this.editando = null;
      this.ancla = master;
      this.foco = master;
      this.enfocar(master);
    }
    this.mostrarMenuCeldaEn(event.clientX, event.clientY);
  }

  protected extenderArrastre(row: Row, campo: CampoHoja): void {
    if (!this.arrastrando || !this.ancla) return;
    const pos = this.posDe(row, campo);
    if (!pos || pos.bloque !== this.ancla.bloque || this.misma(pos, this.foco)) return;
    this.arrastreMovio = true;
    this.foco = pos;
  }

  protected comenzarEdicion(row: Row, campo: CampoHoja): void {
    const pos = this.posDe(row, campo);
    if (!pos) return;
    if (!this.snapAntesEdicion) this.snapAntesEdicion = this.tomarSnapshot();
    const previo = this.formulas[this.claveFormato(row, campo)] ?? this.textoPlano(row, campo);
    this.ancla = pos;
    this.foco = pos;
    this.buffer = previo;
    this.editando = { clave: row.clave, campo, previo };
    setTimeout(() => {
      const input = document.getElementById(this.idDe(row, campo)) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected escribir(event: Event, row: Row, campo: CampoHoja): void {
    if (!this.esEdicion(row, campo)) return;
    this.buffer = (event.target as HTMLInputElement).value;
    if (this.buffer.trim().startsWith('=')) return;
    this.aplicarTexto(row, campo, this.buffer, true);
  }

  protected tecla(event: KeyboardEvent, row: Row, campo: CampoHoja): void {
    const ctrl = event.ctrlKey || event.metaKey;
    if (this.esEdicion(row, campo)) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.terminarEdicion();
        this.desplazar(event.shiftKey ? -1 : 1, 0, false);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        this.terminarEdicion();
        this.desplazar(0, event.shiftKey ? -1 : 1, false);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.cancelarEdicion(row, campo);
      }
      return;
    }
    if (ctrl && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      this.seleccionarBloque();
      return;
    }
    if (ctrl && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void navigator.clipboard.writeText(this.textoSeleccion());
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.desplazar(event.shiftKey ? -1 : 1, 0, false);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.desplazar(0, event.shiftKey ? -1 : 1, false);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.desplazar(-1, 0, event.shiftKey);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.desplazar(1, 0, event.shiftKey);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.desplazar(0, -1, event.shiftKey);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.desplazar(0, 1, event.shiftKey);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.irAlBorde(ctrl, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.irAlBorde(ctrl, false);
    } else if (event.key === 'F2') {
      event.preventDefault();
      this.comenzarEdicion(row, campo);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.limpiarSeleccion();
    } else if (!ctrl && !event.altKey && event.key.length === 1) {
      if (campo !== 'zona' && event.key !== '=' && !/^[0-9.,-]$/.test(event.key)) return;
      event.preventDefault();
      this.empezarConTecla(row, campo, event.key);
    }
  }

  protected copiar(event: ClipboardEvent): void {
    if (this.editando) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', this.textoSeleccion());
  }

  protected pegar(event: ClipboardEvent): void {
    if (this.editando) return;
    event.preventDefault();
    this.pegarTexto(event.clipboardData?.getData('text/plain') ?? '');
  }

  @HostListener('document:mousemove', ['$event'])
  protected moverResize(event: MouseEvent): void {
    if (!this.resize) return;
    event.preventDefault();
    if (this.resize.tipo === 'col') {
      const next = Math.max(40, Math.round(this.resize.medida + (event.clientX - this.resize.inicio)));
      this.fijarAncho(this.resize.clave, next);
    } else {
      const next = Math.max(22, Math.round(this.resize.medida + (event.clientY - this.resize.inicio)));
      this.fijarAlto(this.resize.clave, next);
    }
    this.cd.detectChanges();
  }

  @HostListener('document:mouseup')
  protected soltarArrastre(): void {
    this.arrastrando = false;
    this.arrastreMovio = false;
    if (!this.resize) return;
    this.resize = null;
    this.guardarMedidas();
  }

  protected iniciarAncho(event: MouseEvent, letra: string): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.arrastrando = false;
    this.resize = { tipo: 'col', clave: letra, inicio: event.clientX, medida: this.anchoColumna(letra) };
  }

  protected iniciarAlto(event: MouseEvent, fila: number): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.arrastrando = false;
    this.resize = { tipo: 'row', clave: String(fila), inicio: event.clientY, medida: this.altoFila(fila) };
  }

  protected anchoColumna(letra: string): number {
    const guardado = this.medidasDeHoja().cols[letra];
    if (guardado) return guardado;
    if (letra === 'G') return 28;
    if (letra === 'Q1' || letra === 'Q2') return 72;
    if (letra === 'A' || letra === letraColumna(this.inicioDerecha())) return 120;
    return 96;
  }

  protected altoFila(fila: number): number {
    return this.medidasDeHoja().rows[String(fila)] ?? 36;
  }

  protected clavesColumnas(): string[] {
    const claves = [...this.letras(this.anchoCampo())];
    if (this.esExcel()) claves.push('G');
    if (this.hojaActual().manual) claves.push('Q1');
    if (this.tieneDerecha()) {
      claves.push(...this.letrasDesde(this.inicioDerecha()));
      if (this.hojaActual().manual) claves.push('Q2');
    }
    return claves;
  }

  protected alternarPanel(panel: PanelFormato): void {
    this.panel = this.panel === panel ? null : panel;
    this.menu = null;
  }

  protected puedeDeshacer(): boolean {
    return this.historial.length > 0;
  }

  protected puedeRehacer(): boolean {
    return this.futuro.length > 0;
  }

  protected deshacer(): void {
    if (!this.historial.length) return;
    const actual = this.tomarSnapshot();
    const previo = this.historial[this.historial.length - 1];
    this.historial = this.historial.slice(0, -1);
    this.futuro = [actual, ...this.futuro].slice(0, this.maxHistorial);
    this.restaurarSnapshot(previo);
    this.panel = null;
    this.cerrarCeldaMenu();
  }

  protected rehacer(): void {
    if (!this.futuro.length) return;
    const actual = this.tomarSnapshot();
    const siguiente = this.futuro[0];
    this.futuro = this.futuro.slice(1);
    this.historial = [...this.historial, actual].slice(-this.maxHistorial);
    this.restaurarSnapshot(siguiente);
    this.panel = null;
    this.cerrarCeldaMenu();
  }

  protected aplicarTamano(tamano: number): void {
    this.aplicarFormato({ tamano });
  }

  protected negritaActiva(): boolean {
    const claves = this.clavesParaFormato();
    if (!claves.length) return false;
    return claves.every((clave) => !!this.formatos[clave]?.negrita);
  }

  protected alternarNegrita(): void {
    this.panel = null;
    if (this.negritaActiva()) this.aplicarFormato({}, 'negrita');
    else this.aplicarFormato({ negrita: true });
  }

  protected pesoDe(row: Row, campo: CampoHoja): string | null {
    return this.formatos[this.claveFormato(row, campo)]?.negrita ? '700' : null;
  }

  protected aplicarColor(color: string | null): void {
    if (color == null) this.aplicarFormato({}, 'color');
    else this.aplicarFormato({ color });
  }

  protected aplicarFondo(color: string | null): void {
    if (color == null) this.aplicarFormato({}, 'fondo');
    else this.aplicarFormato({ fondo: color });
  }

  protected colorDesdeSelector(event: Event, cual: 'color' | 'fondo'): void {
    const valor = (event.target as HTMLInputElement).value;
    this.aplicarFormato(cual === 'color' ? { color: valor } : { fondo: valor });
  }

  protected alternarCuadricula(): void {
    this.cuadricula = !this.cuadricula;
    this.panel = null;
    localStorage.setItem('boletos-cuadricula', this.cuadricula ? '1' : '0');
  }

  protected fondoDe(row: Row, campo: CampoHoja): string | null {
    return this.formatos[this.claveFormato(row, campo)]?.fondo ?? null;
  }

  protected colorDe(row: Row, campo: CampoHoja): string | null {
    return this.formatos[this.claveFormato(row, campo)]?.color ?? null;
  }

  protected tamanoDe(row: Row, campo: CampoHoja): string | null {
    const tamano = this.formatos[this.claveFormato(row, campo)]?.tamano;
    return tamano ? `${tamano}px` : null;
  }

  protected alternarSubMenu(cual: Exclude<CeldaSubMenu, null>): void {
    this.celdaSub = this.celdaSub === cual ? null : cual;
  }

  protected aplicarAlinear(alinear: 'left' | 'center' | 'right'): void {
    this.aplicarFormato({ alinear });
    this.cerrarCeldaMenu();
  }

  protected aplicarNumero(numero: 'entero' | 'decimal' | 'moneda'): void {
    this.aplicarFormato({ numero });
    this.cerrarCeldaMenu();
  }

  protected puedeCombinar(): boolean {
    if (this.focoHdr || this.focoTitulo) return false;
    return this.celdasSeleccionadas().length >= 2;
  }

  protected puedeSeparar(): boolean {
    return !!this.fusionEnSeleccion();
  }

  protected combinarCeldas(): void {
    if (!this.ancla || !this.foco || this.ancla.bloque !== this.foco.bloque) return;
    if (this.celdasSeleccionadas().length < 2) return;
    this.conHistorial(() => {
      const fusion: FusionCelda = {
        bloque: this.ancla!.bloque,
        fila1: Math.min(this.ancla!.fila, this.foco!.fila),
        fila2: Math.max(this.ancla!.fila, this.foco!.fila),
        col1: Math.min(this.ancla!.col, this.foco!.col),
        col2: Math.max(this.ancla!.col, this.foco!.col),
      };
      const hoja = this.hojaActiva;
      const actual = (this.fusiones[hoja] ?? []).filter((item) => !this.fusionesSeSolapan(item, fusion));
      this.fusiones = { ...this.fusiones, [hoja]: [...actual, fusion] };
      this.ancla = { bloque: fusion.bloque, fila: fusion.fila1, col: fusion.col1 };
      this.foco = this.ancla;
      this.guardarFusiones();
      this.cerrarCeldaMenu();
      this.enfocar(this.ancla);
    });
  }

  protected separarCeldas(): void {
    const fusion = this.fusionEnSeleccion();
    if (!fusion) return;
    this.conHistorial(() => {
      const hoja = this.hojaActiva;
      this.fusiones = {
        ...this.fusiones,
        [hoja]: (this.fusiones[hoja] ?? []).filter((item) => item !== fusion),
      };
      this.guardarFusiones();
      this.cerrarCeldaMenu();
    });
  }

  @HostListener('document:click', ['$event'])
  protected cerrarMenu(event: MouseEvent): void {
    if (this.ignorarCierreCeldaMenu || this.dialogoNuevaHoja || this.dialogoBorrarHoja) return;
    const alvo = event.target as HTMLElement | null;
    if (this.editandoPestanas && !alvo?.closest('.tabs, .tab-hint, .dialogo-fondo')) {
      this.salirEdicionPestanas();
    }
    this.menu = null;
    this.panel = null;
    this.panelFx = false;
    this.cerrarCeldaMenu();
  }

  @HostListener('document:keydown.escape')
  protected cerrarMenuConEscape(): void {
    if (this.dialogoBorrarHoja) {
      this.cancelarBorrarHoja();
      return;
    }
    if (this.dialogoNuevaHoja) {
      this.cancelarNuevaHoja();
      return;
    }
    if (this.editandoPestanas) {
      this.salirEdicionPestanas();
      return;
    }
    this.menu = null;
    this.panel = null;
    this.panelFx = false;
    this.cerrarCeldaMenu();
  }

  @HostListener('document:keydown', ['$event'])
  protected atajosHistorial(event: KeyboardEvent): void {
    if (this.editando || this.editandoHdr || this.editandoTitulo) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl) return;
    if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.deshacer();
    } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.rehacer();
    }
  }

  protected editado(): void {
    if (this.hydrating || this.restaurando) return;
    this.sucio = true;
    this.status = '';
    this.programarGuardado();
  }

  private programarGuardado(): void {
    if (this.guardarTimer) clearTimeout(this.guardarTimer);
    this.guardarTimer = setTimeout(() => {
      this.guardarTimer = null;
      void this.guardar();
    }, 1500);
  }

  private guardarAhora(): void {
    if (this.guardarTimer) {
      clearTimeout(this.guardarTimer);
      this.guardarTimer = null;
    }
    void this.guardar();
  }

  protected agregar(bloque: Bloque): void {
    this.conHistorial(() => {
      const orden = this.rows.reduce((max, row) => Math.max(max, row.orden ?? 0), 0) + 1;
      this.rows.push({
        clave: `manual-nuevo-${Date.now()}`,
        base: 'MANUAL',
        vigencia: '2026',
        ambito: bloque.ambito,
        tipo: bloque.tipo,
        zona: '',
        precio: 0,
        descuento: 0,
        sitio: 0,
        plata: null,
        usaPlata: false,
        cantidad: 0,
        netoFijo: null,
        importeFijo: null,
        manual: true,
        orden,
      });
      this.armar();
      this.editado();
    });
  }

  protected quitar(clave: string): void {
    this.conHistorial(() => {
      this.rows = this.rows.filter((row) => row.clave !== clave);
      this.armar();
      this.editado();
    });
  }

  private async guardar(): Promise<void> {
    if (this.hydrating || this.restaurando) return;
    if (this.saving) {
      this.guardarPendiente = true;
      return;
    }
    if (!this.sucio) return;
    this.saving = true;
    this.error = '';
    const input = this.payload();
    try {
      const saved = this.corteId
        ? await firstValueFrom(this.api.actualizarCorte(this.corteId, input))
        : await firstValueFrom(this.api.crearCorte(input));
      this.aplicar(saved);
      this.sucio = false;
      this.status = '';
      this.cortes = await firstValueFrom(this.api.cortes());
      await this.router.navigate([], {
        queryParams: { corte: saved.id, hoja: this.hojaActiva },
        queryParamsHandling: 'merge',
      });
    } catch {
      this.error = 'No se pudo guardar el corte.';
    } finally {
      this.saving = false;
      this.paint();
      if (this.guardarPendiente || this.sucio) {
        this.guardarPendiente = false;
        this.programarGuardado();
      }
    }
  }

  protected abrir(id: string): void {
    void this.router.navigate([], { queryParams: { corte: id, hoja: this.hojaActiva }, queryParamsHandling: 'merge' });
  }

  private async boot(): Promise<void> {
    try {
      const tariffs = await firstValueFrom(this.api.tarifas());
      this.seed = tariffs.map(tariffToRow);
      this.rows = copyRows(this.seed);
      this.armar();
      this.cortes = await firstValueFrom(this.api.cortes());
      const id = this.route.snapshot.queryParamMap.get('corte');
      if (id) await this.abrirCorte(id);
      if (!this.route.snapshot.queryParamMap.get('hoja')) {
        await this.router.navigate([], { queryParams: { hoja: this.hojaActiva }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    } catch {
      this.error = 'No se pudieron cargar las tarifas.';
    } finally {
      this.loading = false;
      this.ready = true;
      this.paint();
    }
  }

  private async abrirCorte(id: string): Promise<void> {
    this.hydrating = true;
    this.error = '';
    try {
      const corte = await firstValueFrom(this.api.corte(id));
      this.aplicar(corte);
      this.status = 'Corte abierto.';
    } catch {
      this.error = 'No se pudo abrir el corte.';
    } finally {
      this.hydrating = false;
      this.paint();
    }
  }

  private aplicar(corte: TicketSettlement): void {
    this.hydrating = true;
    this.corteId = corte.id;
    this.placas = corte.placas ?? '';
    this.nombre = corte.nombre ?? '';
    this.rows = copyRows(this.seed);
    const lineas = corte.lineas ?? [];
    const manuales = lineas.filter((line) => line.manual || line.base === 'MANUAL');
    if (corte.manualesEditados) {
      this.rows = this.rows.filter((row) => !row.manual);
      for (const line of manuales) this.rows.push(lineToRow(line));
    }
    for (const line of lineas) {
      if (line.manual || line.base === 'MANUAL') continue;
      const row = this.rows.find((item) => item.clave === claveDeLinea(line));
      if (!row) continue;
      row.cantidad = line.cantidad;
      row.zona = line.zona;
      row.precio = num(line.precio);
      row.descuento = num(line.descuento);
      row.sitio = num(line.sitio);
      if (row.usaPlata) row.plata = num(line.plata);
      fijarSiDifieren(row, line.neto, line.importe);
    }
    this.sucio = false;
    this.armar();
    this.hydrating = false;
    this.paint();
  }

  private payload(): TicketSettlementInput {
    const lineas: TicketSettlementInput['lineas'] = [];
    for (const row of this.rows) {
      const seed = this.seed.find((item) => item.clave === row.clave);
      const cantidad = cantidadDe(row.cantidad);
      const zonaDistinta = !!seed && row.zona !== seed.zona;
      const fijo = row.netoFijo != null || row.importeFijo != null;
      if (!row.manual && cantidad === 0 && !dineroDistinto(row, seed) && !zonaDistinta && !fijo) continue;
      lineas.push({
        base: row.base,
        vigencia: row.vigencia,
        ambito: row.ambito,
        zona: row.zona,
        tipo: row.tipo,
        cantidad,
        precio: num(row.precio),
        descuento: num(row.descuento),
        sitio: num(row.sitio),
        plata: row.usaPlata ? num(row.plata) : null,
        neto: netoDe(row),
        importe: importeDe(row),
        manual: row.manual,
        clave: row.clave,
      });
    }
    return {
      placas: this.placas,
      nombre: this.nombre,
      manualesEditados: true,
      lineas,
    };
  }

  private filasDe(id: HojaId): Row[] {
    if (id === 'total') return this.rows;
    const hoja = hojaPorId(id);
    return this.rows.filter((row) => row.base === hoja.base && row.vigencia === hoja.vigencia);
  }

  private armar(): void {
    const hoja = hojaPorId(this.hojaActiva);
    this.bloques = hoja.id === 'total' ? [] : bloquesDe(hoja, this.rows);
    this.sembrarFormulasExcel();
    this.recalcularFormulas();
  }

  private paint(): void {
    this.cd.detectChanges();
  }

  private leerNombres(): Partial<Record<HojaId, string>> {
    try {
      const raw = localStorage.getItem('boletos-hoja-nombres');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<Record<HojaId, string>>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private guardarNombres(): void {
    localStorage.setItem('boletos-hoja-nombres', JSON.stringify(this.nombres));
  }

  private armarListaHojas(): Hoja[] {
    const ocultas = new Set(this.hojasOcultas ?? []);
    const fijas = HOJAS.filter((hoja) => hoja.id !== 'total' && !ocultas.has(hoja.id));
    const total = HOJAS.find((hoja) => hoja.id === 'total' && !ocultas.has(hoja.id));
    const libres = (this.hojasLibres ?? []).filter((hoja) => !ocultas.has(hoja.id));
    const base = total ? [...fijas, ...libres, total] : [...fijas, ...libres];
    const orden = this.ordenHojas ?? [];
    if (!orden.length) return base;
    const mapa = new Map(base.map((hoja) => [hoja.id, hoja]));
    const ordenadas: Hoja[] = [];
    for (const id of orden) {
      const hoja = mapa.get(id);
      if (hoja) {
        ordenadas.push(hoja);
        mapa.delete(id);
      }
    }
    for (const hoja of base) {
      if (mapa.has(hoja.id)) ordenadas.push(hoja);
    }
    return ordenadas;
  }

  private refrescarHojas(): void {
    setHojasDinamicas(this.hojasLibres);
    this.hojas = this.armarListaHojas();
    this.ordenHojas = this.hojas.map((hoja) => hoja.id);
    this.guardarOrdenHojas();
  }

  private guardarOrdenHojas(): void {
    this.ordenHojas = this.hojas.map((hoja) => hoja.id);
    localStorage.setItem('boletos-hojas-orden', JSON.stringify(this.ordenHojas));
  }

  private leerOrdenHojas(): string[] {
    try {
      const raw = localStorage.getItem('boletos-hojas-orden');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return [];
      const ids = parsed.filter((id) => typeof id === 'string');
      // Si falta alguna hoja BASE* del Excel, usar el orden del libro.
      const catalogos = HOJAS.filter((hoja) => hoja.catalogo).map((hoja) => hoja.id);
      if (catalogos.some((id) => !ids.includes(id))) return [];
      return ids;
    } catch {
      return [];
    }
  }

  private guardarHojasOcultas(): void {
    localStorage.setItem('boletos-hojas-ocultas', JSON.stringify(this.hojasOcultas));
  }

  private leerHojasOcultas(): string[] {
    try {
      const raw = localStorage.getItem('boletos-hojas-ocultas');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private guardarHojasLibres(): void {
    localStorage.setItem('boletos-hojas-libres', JSON.stringify(this.hojasLibres));
  }

  private leerHojasLibres(): Hoja[] {
    try {
      const raw = localStorage.getItem('boletos-hojas-libres');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Hoja[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((hoja) => hoja && typeof hoja.id === 'string' && hoja.libre);
    } catch {
      return [];
    }
  }

  private aplicarFormato(parcial: FormatoCelda, quitar?: keyof FormatoCelda): void {
    this.conHistorial(() => {
      const next = { ...this.formatos };
      const claves = this.clavesParaFormato();
      for (const key of claves) {
        const actual: FormatoCelda = { ...next[key], ...parcial };
        if (quitar) delete actual[quitar];
        if (!actual.tamano && !actual.color && !actual.fondo && !actual.negrita && !actual.alinear && !actual.numero) delete next[key];
        else next[key] = actual;
      }
      this.formatos = next;
      this.panel = null;
      localStorage.setItem('boletos-formatos', JSON.stringify(this.formatos));
    });
  }

  private tomarSnapshot(): SnapshotHoja {
    return {
      rows: copyRows(this.rows),
      formatos: structuredClone(this.formatos),
      formulas: { ...this.formulas },
      fusiones: structuredClone(this.fusiones),
      etiquetas: { ...this.etiquetas },
      tocadas: { ...this.tocadas },
      placas: this.placas,
      nombre: this.nombre,
    };
  }

  private restaurarSnapshot(snap: SnapshotHoja): void {
    this.restaurando = true;
    try {
      this.rows = copyRows(snap.rows);
      this.formatos = structuredClone(snap.formatos);
      this.formulas = { ...snap.formulas };
      this.fusiones = structuredClone(snap.fusiones);
      this.etiquetas = { ...snap.etiquetas };
      this.tocadas = { ...snap.tocadas };
      this.placas = snap.placas;
      this.nombre = snap.nombre;
      localStorage.setItem('boletos-formatos', JSON.stringify(this.formatos));
      localStorage.setItem('boletos-formulas', JSON.stringify(this.formulas));
      localStorage.setItem('boletos-fusiones', JSON.stringify(this.fusiones));
      localStorage.setItem('boletos-etiquetas', JSON.stringify(this.etiquetas));
      localStorage.setItem('boletos-formulas-tocadas', JSON.stringify(this.tocadas));
      this.armar();
      this.cd.detectChanges();
    } finally {
      this.restaurando = false;
      this.editado();
    }
  }

  private conHistorial(accion: () => void): void {
    if (this.restaurando || this.hydrating) {
      accion();
      return;
    }
    const antes = this.tomarSnapshot();
    accion();
    if (this.snapshotIgual(antes, this.tomarSnapshot())) return;
    this.historial = [...this.historial, antes].slice(-this.maxHistorial);
    this.futuro = [];
  }

  private registrarEdicionSiCambio(): void {
    if (!this.snapAntesEdicion || this.restaurando) {
      this.snapAntesEdicion = null;
      return;
    }
    if (!this.snapshotIgual(this.snapAntesEdicion, this.tomarSnapshot())) {
      this.historial = [...this.historial, this.snapAntesEdicion].slice(-this.maxHistorial);
      this.futuro = [];
    }
    this.snapAntesEdicion = null;
  }

  private snapshotIgual(a: SnapshotHoja, b: SnapshotHoja): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private clavesParaFormato(): string[] {
    if (this.focoHdr) return [this.claveHdr(this.focoHdr.campo, this.focoHdr.pagar, this.focoHdr.lado)];
    if (this.focoTitulo) return [this.claveTitulo(this.focoTitulo.bloqueId, this.focoTitulo.lado)];
    return this.celdasParaFormato().map((celda) => this.claveFormato(celda.row, celda.campo));
  }

  private mostrarMenuCeldaEn(clientX: number, clientY: number): void {
    const ancho = 220;
    const alto = 200;
    const x = Math.min(clientX, window.innerWidth - ancho - 8);
    const y = Math.min(clientY, window.innerHeight - alto - 8);
    this.celdaMenu = { x: Math.max(8, x), y: Math.max(8, y) };
    this.celdaSub = null;
    this.ignorarCierreCeldaMenu = true;
    setTimeout(() => {
      this.ignorarCierreCeldaMenu = false;
    });
  }

  private cerrarCeldaMenu(): void {
    this.celdaMenu = null;
    this.celdaSub = null;
  }

  private textoFormateado(row: Row, campo: CampoHoja): string {
    const plano = this.textoPlano(row, campo);
    if (campo === 'zona' || plano === '') return plano;
    const formato = this.formatos[this.claveFormato(row, campo)]?.numero;
    if (!formato) return plano;
    const numero = this.numeroCelda(row, campo);
    if (typeof numero !== 'number') return plano;
    if (formato === 'entero') return String(Math.round(numero));
    if (formato === 'decimal') return numero.toFixed(2);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(numero);
  }

  private fusionesDeHoja(): FusionCelda[] {
    return this.fusiones[this.hojaActiva] ?? [];
  }

  private fusionQueCubre(pos: Posicion): FusionCelda | null {
    return this.fusionesDeHoja().find((fusion) => (
      fusion.bloque === pos.bloque
      && pos.fila >= fusion.fila1 && pos.fila <= fusion.fila2
      && pos.col >= fusion.col1 && pos.col <= fusion.col2
    )) ?? null;
  }

  private posMaestra(pos: Posicion): Posicion {
    const fusion = this.fusionQueCubre(pos);
    return fusion ? { bloque: fusion.bloque, fila: fusion.fila1, col: fusion.col1 } : pos;
  }

  private fusionEnSeleccion(): FusionCelda | null {
    if (!this.ancla || !this.foco || this.ancla.bloque !== this.foco.bloque) {
      return this.foco ? this.fusionQueCubre(this.foco) : null;
    }
    const rect: FusionCelda = {
      bloque: this.ancla.bloque,
      fila1: Math.min(this.ancla.fila, this.foco.fila),
      fila2: Math.max(this.ancla.fila, this.foco.fila),
      col1: Math.min(this.ancla.col, this.foco.col),
      col2: Math.max(this.ancla.col, this.foco.col),
    };
    return this.fusionesDeHoja().find((fusion) => this.fusionesSeSolapan(fusion, rect)) ?? null;
  }

  private fusionesSeSolapan(a: FusionCelda, b: FusionCelda): boolean {
    return a.bloque === b.bloque
      && a.fila1 <= b.fila2 && a.fila2 >= b.fila1
      && a.col1 <= b.col2 && a.col2 >= b.col1;
  }

  private guardarFusiones(): void {
    localStorage.setItem('boletos-fusiones', JSON.stringify(this.fusiones));
  }

  private leerFusiones(): Record<string, FusionCelda[]> {
    try {
      const raw = localStorage.getItem('boletos-fusiones');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, FusionCelda[]>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private celdasParaFormato(): { row: Row; campo: CampoHoja }[] {
    const seleccion = this.celdasSeleccionadas();
    if (seleccion.length) return seleccion;
    const columnas = this.columnas();
    const celdas: { row: Row; campo: CampoHoja }[] = [];
    for (const bloque of this.bloques) {
      for (const row of bloque.filas) {
        for (const campo of columnas) celdas.push({ row, campo });
      }
    }
    return celdas;
  }

  private claveFormato(row: Row, campo: CampoHoja): string {
    return `${row.clave}|${campo}`;
  }

  private leerFormatos(): Record<string, FormatoCelda> {
    try {
      const raw = localStorage.getItem('boletos-formatos');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, FormatoCelda>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private leerFormulas(): Record<string, string> {
    try {
      const raw = localStorage.getItem('boletos-formulas');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private leerCuadricula(): boolean {
    return localStorage.getItem('boletos-cuadricula') !== '0';
  }

  private medidasDeHoja(): MedidasHoja {
    return this.medidas[this.hojaActiva] ?? { cols: {}, rows: {} };
  }

  private fijarAncho(letra: string, px: number): void {
    const actual = this.medidasDeHoja();
    this.medidas = {
      ...this.medidas,
      [this.hojaActiva]: { cols: { ...actual.cols, [letra]: px }, rows: { ...actual.rows } },
    };
  }

  private fijarAlto(fila: string, px: number): void {
    const actual = this.medidasDeHoja();
    this.medidas = {
      ...this.medidas,
      [this.hojaActiva]: { cols: { ...actual.cols }, rows: { ...actual.rows, [fila]: px } },
    };
  }

  private guardarMedidas(): void {
    localStorage.setItem('boletos-medidas', JSON.stringify(this.medidas));
  }

  private leerMedidas(): Record<string, MedidasHoja> {
    try {
      const raw = localStorage.getItem('boletos-medidas');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, MedidasHoja>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  protected letras(cantidad: number): string[] {
    return Array.from({ length: cantidad }, (_, index) => letraColumna(index));
  }

  protected letrasDesde(inicio: number): string[] {
    return this.columnas().map((_, index) => letraColumna(inicio + index));
  }

  protected esExcel(): boolean {
    return !!this.hojaActual().excel;
  }

  protected inicioDerecha(): number {
    return this.anchoCampo() + (this.esExcel() ? 1 : 0);
  }

  protected anchoCampo(): number {
    return this.columnas().length;
  }

  protected anchoLado(): number {
    return this.anchoCampo() + (this.hojaActual().manual ? 1 : 0);
  }

  protected anchoHoja(): number {
    return this.anchoLado() + (this.esExcel() ? 1 : 0) + (this.tieneDerecha() ? this.anchoLado() : 0);
  }

  protected tieneDerecha(): boolean {
    return this.bloques.some((bloque) => bloque.tipo !== 'sencillo');
  }

  protected bandas(): BandaHoja[] {
    const orden: string[] = [];
    const mapa = new Map<string, { izq: Bloque | null; der: Bloque | null }>();
    for (const bloque of this.bloques) {
      const clave = claveDeBanda(bloque);
      if (!mapa.has(clave)) {
        mapa.set(clave, { izq: null, der: null });
        orden.push(clave);
      }
      const banda = mapa.get(clave)!;
      if (bloque.tipo === 'sencillo') banda.izq = bloque;
      else banda.der = bloque;
    }
    const excel = this.hojaActual().excel;
    let fila = 1;
    return orden.map((clave, index) => {
      const banda = mapa.get(clave)!;
      const filas = Math.max(banda.izq?.filas.length ?? 0, banda.der?.filas.length ?? 0);
      const fijo = excel?.[index];
      const titulo = fijo?.titulo ?? fila;
      const encabezado = fijo?.encabezado ?? fila + 1;
      const dato = fijo?.dato ?? fila + 2;
      const vaciosAntes: number[] = [];
      for (let n = fila; n < titulo; n++) vaciosAntes.push(n);
      fila = dato + filas;
      const edomex = banda.izq?.ambito === 'EDOMEX' || banda.der?.ambito === 'EDOMEX';
      const pagar = this.esExcel() ? (edomex ? 'TOTAL' : 'PAGAR') : this.hojaActual().manual ? 'Pagar' : 'Neto';
      return { ...banda, filas, titulo, encabezado, dato, vaciosAntes, pagar };
    });
  }

  protected filaEn(bloque: Bloque | null, index: number): Row | null {
    return bloque?.filas[index] ?? null;
  }

  protected rango(cantidad: number): number[] {
    return Array.from({ length: cantidad }, (_, index) => index);
  }

  protected trackBanda(_: number, banda: BandaHoja): string {
    return `${banda.izq?.id ?? ''}|${banda.der?.id ?? ''}`;
  }

  protected trackIndice(_: number, index: number): number {
    return index;
  }

  protected columnas(): CampoHoja[] {
    const hoja = this.hojaActual();
    return columnasDeBloque(hoja.plata, !!hoja.catalogo);
  }

  private posDe(row: Row, campo: CampoHoja): Posicion | null {
    const col = this.columnas().indexOf(campo);
    if (col < 0) return null;
    for (let bloque = 0; bloque < this.bloques.length; bloque++) {
      const fila = this.bloques[bloque].filas.findIndex((item) => item.clave === row.clave);
      if (fila >= 0) return { bloque, fila, col };
    }
    return null;
  }

  private celdaEn(pos: Posicion | null): { row: Row; campo: CampoHoja } | null {
    if (!pos) return null;
    const row = this.bloques[pos.bloque]?.filas[pos.fila];
    const campo = this.columnas()[pos.col];
    return row && campo ? { row, campo } : null;
  }

  private celdasSeleccionadas(): { row: Row; campo: CampoHoja }[] {
    if (!this.ancla || !this.foco) {
      const unica = this.celdaEn(this.foco);
      return unica ? [unica] : [];
    }
    const bloque = this.bloques[this.ancla.bloque];
    if (!bloque || this.ancla.bloque !== this.foco.bloque) {
      const unica = this.celdaEn(this.foco);
      return unica ? [unica] : [];
    }
    const columnas = this.columnas();
    const fila1 = Math.min(this.ancla.fila, this.foco.fila);
    const fila2 = Math.max(this.ancla.fila, this.foco.fila);
    const col1 = Math.min(this.ancla.col, this.foco.col);
    const col2 = Math.max(this.ancla.col, this.foco.col);
    const celdas: { row: Row; campo: CampoHoja }[] = [];
    for (let fila = fila1; fila <= fila2; fila++) {
      for (let col = col1; col <= col2; col++) {
        const row = bloque.filas[fila];
        const campo = columnas[col];
        if (row && campo) celdas.push({ row, campo });
      }
    }
    return celdas;
  }

  private desplazar(deltaFila: number, deltaCol: number, extender: boolean): void {
    if (!this.foco) return;
    const alturas = this.bloques.map((bloque) => bloque.filas.length);
    const anchos = this.bloques.map(() => this.columnas().length);
    const siguiente = extender
      ? moverEnBloque(alturas[this.foco.bloque] ?? 0, anchos[this.foco.bloque] ?? 0, this.foco, deltaFila, deltaCol)
      : moverEnHoja(alturas, anchos, this.foco, deltaFila, deltaCol);
    this.foco = siguiente;
    if (!extender) this.ancla = siguiente;
    this.enfocar(siguiente);
  }

  private irAlBorde(bloqueCompleto: boolean, inicio: boolean): void {
    if (!this.foco) return;
    const filas = this.bloques[this.foco.bloque]?.filas.length ?? 0;
    const cols = this.columnas().length;
    if (!filas || !cols) return;
    const pos: Posicion = bloqueCompleto
      ? { bloque: this.foco.bloque, fila: inicio ? 0 : filas - 1, col: inicio ? 0 : cols - 1 }
      : { bloque: this.foco.bloque, fila: this.foco.fila, col: inicio ? 0 : cols - 1 };
    this.ancla = pos;
    this.foco = pos;
    this.enfocar(pos);
  }

  private seleccionarBloque(): void {
    if (!this.foco) return;
    const filas = this.bloques[this.foco.bloque]?.filas.length ?? 0;
    const cols = this.columnas().length;
    if (!filas || !cols) return;
    this.ancla = { bloque: this.foco.bloque, fila: 0, col: 0 };
    this.foco = { bloque: this.foco.bloque, fila: filas - 1, col: cols - 1 };
    this.enfocar(this.foco);
  }

  private enfocar(pos: Posicion): void {
    const celda = this.celdaEn(pos);
    if (!celda) return;
    setTimeout(() => {
      const input = document.getElementById(this.idDe(celda.row, celda.campo)) as HTMLInputElement | null;
      input?.focus();
      input?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  private empezarConTecla(row: Row, campo: CampoHoja, tecla: string): void {
    const pos = this.posDe(row, campo);
    if (!pos) return;
    if (!this.snapAntesEdicion) this.snapAntesEdicion = this.tomarSnapshot();
    const previo = this.formulas[this.claveFormato(row, campo)] ?? this.textoPlano(row, campo);
    this.ancla = pos;
    this.foco = pos;
    this.buffer = tecla;
    this.editando = { clave: row.clave, campo, previo };
    if (!tecla.startsWith('=')) this.aplicarTexto(row, campo, tecla, true);
    setTimeout(() => {
      const input = document.getElementById(this.idDe(row, campo)) as HTMLInputElement | null;
      if (!input) return;
      input.focus();
      const fin = input.value.length;
      input.setSelectionRange(fin, fin);
    });
  }

  private terminarEdicion(): void {
    const edit = this.editando;
    const texto = this.buffer;
    this.editando = null;
    this.buffer = '';
    if (!edit) {
      this.snapAntesEdicion = null;
      return;
    }
    const row = this.rows.find((item) => item.clave === edit.clave);
    if (!row) {
      this.snapAntesEdicion = null;
      return;
    }
    this.confirmarContenido(row, edit.campo, texto);
    this.registrarEdicionSiCambio();
    this.guardarAhora();
  }

  private cancelarEdicion(row: Row, campo: CampoHoja): void {
    const previo = this.editando?.previo ?? '';
    this.editando = null;
    this.buffer = '';
    this.snapAntesEdicion = null;
    this.confirmarContenido(row, campo, previo);
    const input = document.getElementById(this.idDe(row, campo)) as HTMLInputElement | null;
    if (input) input.value = this.textoCelda(row, campo);
    input?.focus();
  }

  private limpiarSeleccion(): void {
    this.conHistorial(() => {
      for (const celda of this.celdasSeleccionadas()) this.aplicarTexto(celda.row, celda.campo, '', false);
    });
  }

  private textoSeleccion(): string {
    const celdas = this.celdasSeleccionadas();
    if (!this.ancla || !this.foco || this.ancla.bloque !== this.foco.bloque) {
      const unica = celdas[0];
      return unica ? this.textoPlano(unica.row, unica.campo) : '';
    }
    const lineas: string[] = [];
    let filaActual = -1;
    let columnas: string[] = [];
    for (const celda of celdas) {
      const pos = this.posDe(celda.row, celda.campo);
      if (!pos) continue;
      if (pos.fila !== filaActual) {
        if (columnas.length) lineas.push(columnas.join('\t'));
        columnas = [];
        filaActual = pos.fila;
      }
      columnas.push(this.textoPlano(celda.row, celda.campo));
    }
    if (columnas.length) lineas.push(columnas.join('\t'));
    return lineas.join('\n');
  }

  private textoPlano(row: Row, campo: CampoHoja): string {
    if (campo === 'zona') return row.zona;
    if (campo === 'neto') return String(netoDe(row));
    if (campo === 'importe') return String(importeDe(row));
    const valor = campo === 'plata' ? row.plata : campo === 'precio' ? row.precio : campo === 'descuento' ? row.descuento : campo === 'sitio' ? row.sitio : row.cantidad;
    return valor == null ? '' : String(valor);
  }

  private pegarTexto(texto: string): void {
    if (!this.foco) return;
    const matriz = parseTsv(texto);
    if (!matriz.length) return;
    this.conHistorial(() => {
      if (matriz.length === 1 && matriz[0].length === 1 && this.celdasSeleccionadas().length > 1) {
        for (const celda of this.celdasSeleccionadas()) this.aplicarTexto(celda.row, celda.campo, matriz[0][0], false);
        return;
      }
      const origen = this.foco!;
      const filas = this.bloques[origen.bloque]?.filas.length ?? 0;
      const columnas = this.columnas();
      let ultimo = origen;
      for (let fila = 0; fila < matriz.length; fila++) {
        for (let col = 0; col < matriz[fila].length; col++) {
          const destinoFila = origen.fila + fila;
          const destinoCol = origen.col + col;
          if (destinoFila >= filas || destinoCol >= columnas.length) continue;
          const row = this.bloques[origen.bloque].filas[destinoFila];
          const campo = columnas[destinoCol];
          if (!row || !campo) continue;
          this.aplicarTexto(row, campo, matriz[fila][col], false);
          ultimo = { bloque: origen.bloque, fila: destinoFila, col: destinoCol };
        }
      }
      this.ancla = origen;
      this.foco = ultimo;
      this.enfocar(ultimo);
    });
  }

  private aplicarTexto(row: Row, campo: CampoHoja, texto: string, parcial: boolean): void {
    if (!parcial && texto.trim().startsWith('=')) {
      this.confirmarContenido(row, campo, texto);
      return;
    }
    if (!parcial || !texto.trim().startsWith('=')) this.quitarFormula(row, campo);
    if (campo === 'zona') {
      row.zona = texto;
      this.editado();
      this.recalcularFormulas();
      return;
    }
    if ((campo === 'neto' || campo === 'importe') && texto.trim() === '') {
      if (campo === 'neto') row.netoFijo = null;
      row.importeFijo = null;
      this.editado();
      this.recalcularFormulas();
      return;
    }
    const numero = leerNumero(texto);
    if (numero == null) {
      if (!parcial || texto.trim() === '') this.ponerNumero(row, campo, 0);
      return;
    }
    this.ponerNumero(row, campo, campo === 'cantidad' ? Math.max(0, Math.trunc(numero)) : numero);
  }

  private ponerNumero(row: Row, campo: CampoHoja, valor: number): void {
    if (campo === 'precio') row.precio = valor;
    else if (campo === 'descuento') row.descuento = valor;
    else if (campo === 'sitio') row.sitio = valor;
    else if (campo === 'cantidad') row.cantidad = valor;
    else if (campo === 'plata') row.plata = valor;
    else if (campo === 'neto') row.netoFijo = valor;
    else if (campo === 'importe') row.importeFijo = valor;
    if (campo === 'precio' || campo === 'descuento' || campo === 'sitio' || campo === 'plata') {
      if (!this.formulas[this.claveFormato(row, 'neto')]) row.netoFijo = null;
      if (!this.formulas[this.claveFormato(row, 'importe')]) row.importeFijo = null;
    } else if (campo === 'cantidad' || campo === 'neto') {
      if (!this.formulas[this.claveFormato(row, 'importe')]) row.importeFijo = null;
    }
    this.editado();
    this.recalcularFormulas();
  }

  protected enEdicion(): boolean {
    return this.editando != null;
  }

  protected referenciaActiva(): string {
    return this.foco ? this.direccionDe(this.foco) : '';
  }

  protected textoBarra(): string {
    if (this.editando) return this.buffer;
    const celda = this.celdaEn(this.foco);
    if (!celda) return '';
    return this.formulas[this.claveFormato(celda.row, celda.campo)] ?? this.textoPlano(celda.row, celda.campo);
  }

  protected valorInput(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected irAReferencia(event: Event): void {
    event.preventDefault();
    const destino = this.celdaPorDireccion(this.nombreTexto);
    this.nombreEditando = false;
    if (!destino) return;
    this.ancla = destino.pos;
    this.foco = destino.pos;
    this.enfocar(destino.pos);
  }

  protected alternarFunciones(): void {
    if (!this.foco) return;
    this.panelFx = !this.panelFx;
  }

  protected elegirFuncion(nombre: string): void {
    this.panelFx = false;
    if (!this.editando) this.abrirBarra();
    if (!this.editando) return;
    const actual = this.buffer.trim();
    this.buffer = actual.startsWith('=') && actual.length > 1 ? `${actual}${nombre}(` : `=${nombre}(`;
    this.enfocarBarra();
  }

  protected abrirBarra(): void {
    if (this.editando) return;
    const celda = this.celdaEn(this.foco);
    if (!celda) return;
    const previo = this.formulas[this.claveFormato(celda.row, celda.campo)] ?? this.textoPlano(celda.row, celda.campo);
    this.ancla = this.foco;
    this.buffer = previo;
    this.editando = { clave: celda.row.clave, campo: celda.campo, previo };
  }

  protected escribirBarra(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.editando) this.abrirBarra();
    const celda = this.celdaEn(this.foco);
    if (!celda || !this.editando) return;
    this.buffer = input.value;
    if (this.buffer.trim().startsWith('=')) return;
    this.aplicarTexto(celda.row, celda.campo, this.buffer, true);
  }

  protected teclaBarra(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    if (!this.editando) this.abrirBarra();
    this.buffer = input.value;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.terminarEdicion();
      this.desplazar(event.shiftKey ? -1 : 1, 0, false);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.terminarEdicion();
      this.desplazar(0, event.shiftKey ? -1 : 1, false);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelarDesdeBarra();
    }
  }

  protected cerrarBarra(event?: Event): void {
    if (event?.target instanceof HTMLInputElement) this.buffer = event.target.value;
    if (!this.editando) return;
    this.terminarEdicion();
  }

  protected confirmarDesdeBarra(): void {
    this.terminarEdicion();
    if (this.foco) this.enfocar(this.foco);
  }

  protected cancelarDesdeBarra(): void {
    const edit = this.editando;
    if (!edit) return;
    const row = this.rows.find((item) => item.clave === edit.clave);
    if (!row) return;
    this.cancelarEdicion(row, edit.campo);
  }

  private enfocarBarra(): void {
    setTimeout(() => {
      const input = document.getElementById('formula-caja') as HTMLInputElement | null;
      if (!input) return;
      input.focus();
      const fin = input.value.length;
      input.setSelectionRange(fin, fin);
    });
  }

  private confirmarContenido(row: Row, campo: CampoHoja, texto: string): void {
    if (texto.trim().startsWith('=')) {
      this.formulas = { ...this.formulas, [this.claveFormato(row, campo)]: texto.trim() };
      this.guardarFormulas();
      this.recalcularFormulas();
      this.editado();
      return;
    }
    this.quitarFormula(row, campo);
    this.aplicarTexto(row, campo, texto, false);
  }

  private quitarFormula(row: Row, campo: CampoHoja): void {
    const clave = this.claveFormato(row, campo);
    if (this.formulas[clave] || this.errores[clave]) {
      const formulas = { ...this.formulas };
      delete formulas[clave];
      this.formulas = formulas;
      this.ponerError(clave, null);
      this.guardarFormulas();
    }
    this.tocar(clave);
  }

  private sembrarFormulasExcel(): void {
    if (!this.esExcel()) return;
    const cols = this.columnas();
    const iPrecio = cols.indexOf('precio');
    const iDesc = cols.indexOf('descuento');
    const iSitio = cols.indexOf('sitio');
    const iPlata = cols.indexOf('plata');
    if (iPrecio < 0 || iDesc < 0 || iSitio < 0 || iPlata < 0) return;

    const next = { ...this.formulas };
    let cambio = false;
    const letraIzqPrecio = letraColumna(iPrecio);
    for (const banda of this.bandas()) {
      for (const lado of [banda.izq, banda.der]) {
        if (!lado) continue;
        const derecha = lado === banda.der;
        const base = derecha ? this.inicioDerecha() : 0;
        const p = letraColumna(base + iPrecio);
        const d = letraColumna(base + iDesc);
        const s = letraColumna(base + iSitio);
        const pl = letraColumna(base + iPlata);
        for (let i = 0; i < lado.filas.length; i++) {
          const row = lado.filas[i];
          const excel = banda.dato + i;
          const esperado = `=${p}${excel}-${d}${excel}-${s}${excel}-${pl}${excel}`;
          const neto = this.claveFormato(row, 'neto');
          const actual = next[neto];
          if (!this.tocadas[neto] && actual !== esperado) {
            next[neto] = esperado;
            cambio = true;
          }
          if (derecha && /[U-Z]/i.test(row.zona.trim())) {
            const precio = this.claveFormato(row, 'precio');
            const precioEsp = `=${letraIzqPrecio}${excel}+20`;
            const precioAct = next[precio];
            if (!this.tocadas[precio] && precioAct !== precioEsp) {
              next[precio] = precioEsp;
              cambio = true;
            }
          }
        }
      }
    }
    if (!cambio) return;
    this.formulas = next;
    this.guardarFormulas();
  }

  private tocar(clave: string): void {
    if (this.tocadas[clave]) return;
    this.tocadas = { ...this.tocadas, [clave]: true };
    localStorage.setItem('boletos-formulas-tocadas', JSON.stringify(this.tocadas));
  }

  private leerTocadas(): Record<string, true> {
    try {
      const raw = localStorage.getItem('boletos-formulas-tocadas');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, true>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private guardarFormulas(): void {
    localStorage.setItem('boletos-formulas', JSON.stringify(this.formulas));
  }

  private recalcularFormulas(): void {
    if (this.calculando) return;
    this.calculando = true;
    try {
      for (const clave of Object.keys(this.formulas)) this.evaluarClave(clave, []);
    } finally {
      this.calculando = false;
    }
  }

  private evaluarClave(clave: string, pila: string[]): number | string {
    const formula = this.formulas[clave];
    if (!formula) return '#¡REF!';
    if (pila.includes(clave)) return '#¡CÍCLICA!';
    const celda = this.celdaPorClave(clave);
    if (!celda) return '#¡REF!';
    const valor = evaluarFormula(formula, (ref) => this.valorReferencia(ref, [...pila, clave]));
    if (typeof valor === 'string') this.ponerError(clave, valor);
    else {
      this.ponerError(clave, null);
      this.aplicarResultado(celda.row, celda.campo, valor);
    }
    return valor;
  }

  private valorReferencia(ref: string, pila: string[]): number | string {
    const celda = this.celdaPorDireccion(ref);
    if (!celda) return '#¡REF!';
    const clave = this.claveFormato(celda.row, celda.campo);
    if (this.formulas[clave]) return this.evaluarClave(clave, pila);
    return this.numeroCelda(celda.row, celda.campo);
  }

  private numeroCelda(row: Row, campo: CampoHoja): number | string {
    if (campo === 'zona') {
      if (!row.zona.trim()) return 0;
      const numero = leerNumero(row.zona);
      return numero == null ? '#¡VALOR!' : numero;
    }
    if (campo === 'neto') return netoDe(row);
    if (campo === 'importe') return importeDe(row);
    if (campo === 'plata') return row.plata ?? 0;
    if (campo === 'precio') return row.precio;
    if (campo === 'descuento') return row.descuento;
    if (campo === 'sitio') return row.sitio;
    return row.cantidad ?? 0;
  }

  private aplicarResultado(row: Row, campo: CampoHoja, valor: number): void {
    const redondo = Math.round(valor * 100) / 100;
    if (campo === 'zona') row.zona = String(redondo);
    else if (campo === 'precio') row.precio = redondo;
    else if (campo === 'descuento') row.descuento = redondo;
    else if (campo === 'sitio') row.sitio = redondo;
    else if (campo === 'plata') row.plata = redondo;
    else if (campo === 'cantidad') row.cantidad = Math.max(0, Math.trunc(valor));
    else if (campo === 'neto') row.netoFijo = redondo;
    else if (campo === 'importe') row.importeFijo = redondo;
    if (campo === 'precio' || campo === 'descuento' || campo === 'sitio' || campo === 'plata') {
      if (!this.formulas[this.claveFormato(row, 'neto')]) row.netoFijo = null;
      if (!this.formulas[this.claveFormato(row, 'importe')]) row.importeFijo = null;
    } else if (campo === 'cantidad' || campo === 'neto') {
      if (!this.formulas[this.claveFormato(row, 'importe')]) row.importeFijo = null;
    }
  }

  private ponerError(clave: string, error: string | null): void {
    const next = { ...this.errores };
    if (error) next[clave] = error;
    else delete next[clave];
    this.errores = next;
  }

  private celdaPorClave(clave: string): { row: Row; campo: CampoHoja } | null {
    const corte = clave.lastIndexOf('|');
    if (corte < 0) return null;
    const campo = clave.slice(corte + 1);
    const campos: CampoHoja[] = ['zona', 'precio', 'descuento', 'sitio', 'plata', 'neto', 'cantidad', 'importe'];
    if (!campos.includes(campo as CampoHoja)) return null;
    const row = this.rows.find((item) => item.clave === clave.slice(0, corte));
    return row ? { row, campo: campo as CampoHoja } : null;
  }

  private direccionDe(pos: Posicion): string {
    const bloque = this.bloques[pos.bloque];
    const banda = this.bandas().find((item) => item.izq?.id === bloque?.id || item.der?.id === bloque?.id);
    if (!bloque || !banda) return '';
    const columna = (banda.der?.id === bloque.id ? this.inicioDerecha() : 0) + pos.col;
    return `${letraColumna(columna)}${banda.dato + pos.fila}`;
  }

  private celdaPorDireccion(texto: string): { row: Row; campo: CampoHoja; pos: Posicion } | null {
    const match = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(texto.trim());
    if (!match) return null;
    const columna = indiceColumna(match[1]);
    const fila = Number(match[2]);
    const ancho = this.anchoCampo();
    const inicio = this.inicioDerecha();
    const tope = inicio + (this.tieneDerecha() ? ancho : 0);
    if (columna < 0 || columna >= tope || (this.esExcel() && columna === ancho)) return null;
    const derecha = columna >= inicio;
    const campo = this.columnas()[derecha ? columna - inicio : columna];
    if (!campo) return null;
    for (const banda of this.bandas()) {
      if (fila < banda.dato || fila >= banda.dato + banda.filas) continue;
      const bloque = derecha ? banda.der : banda.izq;
      const row = bloque?.filas[fila - banda.dato];
      if (!bloque || !row) return null;
      const pos = this.posDe(row, campo);
      return pos ? { row, campo, pos } : null;
    }
    return null;
  }

  private misma(a: Posicion | null, b: Posicion | null): boolean {
    return !!a && !!b && a.bloque === b.bloque && a.fila === b.fila && a.col === b.col;
  }

  private limpiarCursor(): void {
    this.ancla = null;
    this.foco = null;
    this.focoHdr = null;
    this.focoTitulo = null;
    this.editando = null;
    this.editandoHdr = null;
    this.editandoTitulo = null;
    this.buffer = '';
    this.arrastrando = false;
    this.cerrarCeldaMenu();
  }

  protected idHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): string {
    return `hdr-${this.hojaActiva}-${lado}-${campo}-${pagar}`;
  }

  protected etiquetaColumnaDefault(campo: CampoHoja, pagar: string): string {
    const hoja = this.hojaActual();
    if (campo === 'zona') return 'Zona';
    if (campo === 'precio') return hoja.precio;
    if (campo === 'descuento') return hoja.descuento;
    if (campo === 'sitio') return hoja.sitio;
    if (campo === 'plata') return 'Plata';
    if (campo === 'neto') return hoja.manual ? 'Pagar' : pagar;
    if (campo === 'cantidad') return 'Cantidad';
    return hoja.manual ? 'Total' : 'Importe';
  }

  protected textoHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): string {
    if (this.esEdicionHdr(campo, pagar, lado)) return this.buffer;
    return this.etiquetas[this.claveEtiqueta(campo, pagar, lado)] ?? this.etiquetaColumnaDefault(campo, pagar);
  }

  protected esHdrActiva(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): boolean {
    return !!this.focoHdr && this.focoHdr.campo === campo && this.focoHdr.pagar === pagar && this.focoHdr.lado === lado;
  }

  protected esEdicionHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): boolean {
    return !!this.editandoHdr && this.editandoHdr.campo === campo && this.editandoHdr.pagar === pagar && this.editandoHdr.lado === lado;
  }

  protected estiloHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der', cual: 'fondo' | 'color' | 'tamano' | 'peso' | 'alinear'): string | null {
    const fmt = this.formatos[this.claveHdr(campo, pagar, lado)];
    if (!fmt) return null;
    if (cual === 'fondo') return fmt.fondo ?? null;
    if (cual === 'color') return fmt.color ?? null;
    if (cual === 'tamano') return fmt.tamano ? `${fmt.tamano}px` : null;
    if (cual === 'peso') return fmt.negrita ? '700' : null;
    return fmt.alinear ?? null;
  }

  protected marcarHdr(event: MouseEvent, campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): void {
    if (event.button !== 0) return;
    if (this.esEdicionHdr(campo, pagar, lado)) return;
    event.preventDefault();
    this.limpiarFocoDatos();
    if (this.esHdrActiva(campo, pagar, lado) && !this.arrastreMovio) {
      this.comenzarEdicionHdr(campo, pagar, lado);
      return;
    }
    this.focoHdr = { campo, pagar, lado };
    this.focoTitulo = null;
    this.editandoHdr = null;
    this.editandoTitulo = null;
    this.enfocarHdr(campo, pagar, lado);
  }

  protected comenzarEdicionHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): void {
    this.limpiarFocoDatos();
    if (!this.snapAntesEdicion) this.snapAntesEdicion = this.tomarSnapshot();
    this.focoHdr = { campo, pagar, lado };
    this.focoTitulo = null;
    this.buffer = this.etiquetas[this.claveEtiqueta(campo, pagar, lado)] ?? this.etiquetaColumnaDefault(campo, pagar);
    this.editandoHdr = { campo, pagar, lado, previo: this.buffer };
    this.editandoTitulo = null;
    setTimeout(() => {
      const input = document.getElementById(this.idHdr(campo, pagar, lado)) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected escribirHdr(event: Event, campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): void {
    if (!this.esEdicionHdr(campo, pagar, lado)) return;
    this.buffer = (event.target as HTMLInputElement).value;
    this.guardarEtiqueta(campo, pagar, lado, this.buffer);
  }

  protected teclaHdr(event: KeyboardEvent, campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): void {
    if (!this.esEdicionHdr(campo, pagar, lado)) {
      if (event.key === 'F2' || (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        event.preventDefault();
        this.comenzarEdicionHdr(campo, pagar, lado);
        if (event.key !== 'F2') {
          this.buffer = event.key;
          this.guardarEtiqueta(campo, pagar, lado, this.buffer);
        }
      }
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.terminarEdicionHdr();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelarEdicionHdr(campo, pagar, lado);
    }
  }

  protected menuEncabezado(event: MouseEvent, campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.esEdicionHdr(campo, pagar, lado)) return;
    this.limpiarFocoDatos();
    this.focoHdr = { campo, pagar, lado };
    this.focoTitulo = null;
    this.enfocarHdr(campo, pagar, lado);
    this.mostrarMenuCeldaEn(event.clientX, event.clientY);
  }

  protected textoTitulo(bloque: Bloque): string {
    if (this.editandoTitulo?.bloqueId === bloque.id) return this.buffer;
    return this.etiquetas[this.claveEtiquetaTitulo(bloque.id)] ?? bloque.titulo;
  }

  protected esTituloActivo(bloqueId: string, lado: 'izq' | 'der'): boolean {
    return !!this.focoTitulo && this.focoTitulo.bloqueId === bloqueId && this.focoTitulo.lado === lado;
  }

  protected esEdicionTitulo(bloqueId: string, lado: 'izq' | 'der'): boolean {
    return !!this.editandoTitulo && this.editandoTitulo.bloqueId === bloqueId && this.editandoTitulo.lado === lado;
  }

  protected estiloTitulo(bloqueId: string, lado: 'izq' | 'der', cual: 'fondo' | 'color' | 'tamano' | 'peso' | 'alinear'): string | null {
    const fmt = this.formatos[this.claveTitulo(bloqueId, lado)];
    if (!fmt) return null;
    if (cual === 'fondo') return fmt.fondo ?? null;
    if (cual === 'color') return fmt.color ?? null;
    if (cual === 'tamano') return fmt.tamano ? `${fmt.tamano}px` : null;
    if (cual === 'peso') return fmt.negrita ? '700' : null;
    return fmt.alinear ?? null;
  }

  protected marcarTitulo(event: MouseEvent, bloqueId: string, lado: 'izq' | 'der'): void {
    if (event.button !== 0) return;
    if (this.esEdicionTitulo(bloqueId, lado)) return;
    event.preventDefault();
    this.limpiarFocoDatos();
    if (this.esTituloActivo(bloqueId, lado)) {
      this.comenzarEdicionTitulo(bloqueId, lado);
      return;
    }
    this.focoTitulo = { bloqueId, lado };
    this.focoHdr = null;
    this.editandoTitulo = null;
    this.editandoHdr = null;
    this.enfocarTitulo(bloqueId, lado);
  }

  protected comenzarEdicionTitulo(bloqueId: string, lado: 'izq' | 'der'): void {
    this.limpiarFocoDatos();
    if (!this.snapAntesEdicion) this.snapAntesEdicion = this.tomarSnapshot();
    const bloque = this.bloques.find((item) => item.id === bloqueId);
    this.focoTitulo = { bloqueId, lado };
    this.focoHdr = null;
    this.buffer = this.etiquetas[this.claveEtiquetaTitulo(bloqueId)] ?? bloque?.titulo ?? '';
    this.editandoTitulo = { bloqueId, lado, previo: this.buffer };
    this.editandoHdr = null;
    setTimeout(() => {
      const input = document.getElementById(`titulo-${bloqueId}-${lado}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected escribirTitulo(event: Event, bloqueId: string, lado: 'izq' | 'der'): void {
    if (!this.esEdicionTitulo(bloqueId, lado)) return;
    this.buffer = (event.target as HTMLInputElement).value;
    this.guardarEtiquetaTitulo(bloqueId, this.buffer);
  }

  protected teclaTitulo(event: KeyboardEvent, bloqueId: string, lado: 'izq' | 'der'): void {
    if (!this.esEdicionTitulo(bloqueId, lado)) {
      if (event.key === 'F2' || (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        event.preventDefault();
        this.comenzarEdicionTitulo(bloqueId, lado);
        if (event.key !== 'F2') {
          this.buffer = event.key;
          this.guardarEtiquetaTitulo(bloqueId, this.buffer);
        }
      }
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.terminarEdicionTitulo();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelarEdicionTitulo(bloqueId, lado);
    }
  }

  protected menuTitulo(event: MouseEvent, bloqueId: string, lado: 'izq' | 'der'): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.esEdicionTitulo(bloqueId, lado)) return;
    this.limpiarFocoDatos();
    this.focoTitulo = { bloqueId, lado };
    this.focoHdr = null;
    this.enfocarTitulo(bloqueId, lado);
    this.mostrarMenuCeldaEn(event.clientX, event.clientY);
  }

  private limpiarFocoDatos(): void {
    this.ancla = null;
    this.foco = null;
    this.editando = null;
    this.arrastrando = false;
  }

  private terminarEdicionHdr(): void {
    if (!this.editandoHdr) {
      this.snapAntesEdicion = null;
      return;
    }
    this.guardarEtiqueta(this.editandoHdr.campo, this.editandoHdr.pagar, this.editandoHdr.lado, this.buffer);
    this.editandoHdr = null;
    this.buffer = '';
    this.registrarEdicionSiCambio();
  }

  private cancelarEdicionHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): void {
    const previo = this.editandoHdr?.previo ?? this.etiquetaColumnaDefault(campo, pagar);
    this.editandoHdr = null;
    this.buffer = '';
    this.snapAntesEdicion = null;
    this.guardarEtiqueta(campo, pagar, lado, previo === this.etiquetaColumnaDefault(campo, pagar) ? '' : previo);
    const input = document.getElementById(this.idHdr(campo, pagar, lado)) as HTMLInputElement | null;
    if (input) input.value = this.textoHdr(campo, pagar, lado);
  }

  private terminarEdicionTitulo(): void {
    if (!this.editandoTitulo) {
      this.snapAntesEdicion = null;
      return;
    }
    this.guardarEtiquetaTitulo(this.editandoTitulo.bloqueId, this.buffer);
    this.editandoTitulo = null;
    this.buffer = '';
    this.registrarEdicionSiCambio();
  }

  private cancelarEdicionTitulo(bloqueId: string, lado: 'izq' | 'der'): void {
    const bloque = this.bloques.find((item) => item.id === bloqueId);
    const previo = this.editandoTitulo?.previo ?? bloque?.titulo ?? '';
    this.editandoTitulo = null;
    this.buffer = '';
    this.snapAntesEdicion = null;
    this.guardarEtiquetaTitulo(bloqueId, previo === bloque?.titulo ? '' : previo);
    const input = document.getElementById(`titulo-${bloqueId}-${lado}`) as HTMLInputElement | null;
    if (input && bloque) input.value = this.etiquetas[this.claveEtiquetaTitulo(bloqueId)] ?? bloque.titulo;
  }

  private enfocarHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): void {
    setTimeout(() => {
      const input = document.getElementById(this.idHdr(campo, pagar, lado)) as HTMLInputElement | null;
      input?.focus();
    });
  }

  private enfocarTitulo(bloqueId: string, lado: 'izq' | 'der'): void {
    setTimeout(() => {
      const input = document.getElementById(`titulo-${bloqueId}-${lado}`) as HTMLInputElement | null;
      input?.focus();
    });
  }

  private claveEtiqueta(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): string {
    return `${this.hojaActiva}|${lado}|${campo}|${pagar}`;
  }

  private claveHdr(campo: CampoHoja, pagar: string, lado: 'izq' | 'der'): string {
    return `hdr|${this.claveEtiqueta(campo, pagar, lado)}`;
  }

  private claveEtiquetaTitulo(bloqueId: string): string {
    return `${this.hojaActiva}|titulo|${bloqueId}`;
  }

  private claveTitulo(bloqueId: string, lado: 'izq' | 'der'): string {
    return `hdr|${this.hojaActiva}|titulo|${bloqueId}|${lado}`;
  }

  private guardarEtiqueta(campo: CampoHoja, pagar: string, lado: 'izq' | 'der', texto: string): void {
    const key = this.claveEtiqueta(campo, pagar, lado);
    const def = this.etiquetaColumnaDefault(campo, pagar);
    const next = { ...this.etiquetas };
    if (!texto.trim() || texto.trim() === def) delete next[key];
    else next[key] = texto;
    this.etiquetas = next;
    localStorage.setItem('boletos-etiquetas', JSON.stringify(this.etiquetas));
  }

  private guardarEtiquetaTitulo(bloqueId: string, texto: string): void {
    const key = this.claveEtiquetaTitulo(bloqueId);
    const bloque = this.bloques.find((item) => item.id === bloqueId);
    const next = { ...this.etiquetas };
    if (!texto.trim() || texto.trim() === bloque?.titulo) delete next[key];
    else next[key] = texto;
    this.etiquetas = next;
    localStorage.setItem('boletos-etiquetas', JSON.stringify(this.etiquetas));
  }

  private leerEtiquetas(): Record<string, string> {
    try {
      const raw = localStorage.getItem('boletos-etiquetas');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}

function claveDeBanda(bloque: Bloque): string {
  if (bloque.id.startsWith('aaa-')) return 'aaa';
  if (bloque.id.startsWith('aa-')) return 'aa';
  return bloque.ambito;
}
