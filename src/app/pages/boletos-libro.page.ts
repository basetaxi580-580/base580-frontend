import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BoletosLibroApiService, ConflictoLibro, EstadoLibro, PestanaPersonalizada } from '../data/boletos-libro-api.service';
import { parseTsv } from './boletos-grid';
import {
  EstiloLibro,
  HojaLibro,
  LibroJson,
  MotorLibro,
  OpLibro,
  altoFila,
  anchoColumna,
  columnasDeHoja,
  filasDeHoja,
  formatear,
  fusionarCapturas,
  indiceColumna,
  mismasCapturas,
} from './boletos-libro';

type CeldaVista = {
  ref: string;
  texto: string;
  simbolo?: string;
  css: string;
  clase: string;
  /** Si el texto se desborda: hacia dónde se alinea (justify-content). */
  flujo?: string;
};
type FilaVista = { n: number; alto: number; celdas: CeldaVista[] };
type Vista = { cols: { letra: string; ancho: number }[]; filas: FilaVista[]; ancho: number };
type Seleccion = { fila: number; col: number };
type MenuCtx = { x: number; y: number; tipo: 'celda' | 'columna' | 'fila' | 'pestana'; col: number; fila?: number; nombre?: string };
type EstadoGuardado = 'cargando' | 'guardado' | 'guardando' | 'pendiente' | 'error' | 'sin-conexion';
type Instantanea = { estructura: string; capturas: Record<string, string>; formatos: Record<string, string>; pestanas: PestanaPersonalizada[]; ordenPestanas: string[] };
type Respaldo = { base: Instantanea; actual: Instantanea };

const CLAVE_RESPALDO = 'boletos-libro-respaldo';
const CLAVE_HOJA = 'boletos-libro-hoja';
const MAX_HISTORIAL = 50;
const MAX_CONFLICTOS = 5;
/** Ancho de la columna de números de fila (igual al de `col.c-num`). */
const ANCHO_NUMEROS = 40;

@Component({
  selector: 'app-boletos-libro',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="libro">
      <header class="barra">
        <div>
          <h1>Corte de boletos</h1>
          <span class="fuente">Réplica de PAGO BOLETOS 2026.xlsx</span>
        </div>
        <div class="acciones">
          <span class="estado" [class]="'estado ' + estado()" role="status">{{ textoEstado() }}</span>
          <button type="button" class="guardar" title="Guardar (Ctrl+S)" [disabled]="!hayCambios()" (click)="guardarManual()">Guardar</button>
          <button type="button" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" [disabled]="!puedeDeshacer()" (click)="deshacerCambio()">↶</button>
          <button type="button" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" [disabled]="!puedeRehacer()" (click)="rehacerCambio()">↷</button>
          @if (confirmandoRestaurar()) {
            <span class="confirmar">¿Restaurar {{ nombreVisible() }} al Excel original?</span>
            <button type="button" class="peligro" (click)="restaurarHoja()">Sí, restaurar</button>
            <button type="button" (click)="confirmandoRestaurar.set(false)">No</button>
          } @else {
            <button type="button" [disabled]="!hojaConCapturas()" (click)="confirmandoRestaurar.set(true)">Restaurar hoja</button>
          }
        </div>
      </header>

      @if (errorCarga()) {
        <p class="error">{{ errorCarga() }}</p>
      }

      @if (vista(); as v) {
        <div class="fx">
          <span class="ref">{{ refActiva() }}</span>
          <span class="fx-ico">fx</span>
          <input
            #barra
            class="fx-input"
            aria-label="Contenido de la celda"
            [value]="textoBarra()"
            [readOnly]="protegidaActiva() && !apuntando()"
            (input)="escribirBarra($event)"
            (keydown)="teclaBarra($event)"
            (blur)="confirmarBarra()"
          />
          @if (apuntando(); as a) {
            <span class="apuntar">Apuntando a {{ a.hoja.trim() }}!{{ a.ref }} · Enter confirma, Esc cancela</span>
          } @else if (protegidaActiva()) {
            <span class="candado" title="Celda con fórmula del Excel: se calcula sola">🔒 Fórmula</span>
          }
        </div>

        <div class="formato" role="toolbar" aria-label="Formato de celda">
          <button type="button" [class.on]="fmtActivo('b')" (click)="alternar('b')" title="Negrita (Ctrl+B)" aria-label="Negrita"><b>N</b></button>
          <button type="button" [class.on]="fmtActivo('i')" (click)="alternar('i')" title="Cursiva (Ctrl+I)" aria-label="Cursiva"><i>K</i></button>
          <button type="button" [class.on]="fmtActivo('u')" (click)="alternar('u')" title="Subrayado (Ctrl+U)" aria-label="Subrayado"><u>S</u></button>
          <select aria-label="Tamaño de letra" [value]="tamActual()" (change)="cambiarTam($event)">
            @for (t of tamanos(); track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
          <label class="color" title="Color de texto">A<input type="color" aria-label="Color de texto" [value]="colorTexto()" (input)="cambiarColor('fc', $event)" /></label>
          <label class="color" title="Color de relleno">▦<input type="color" aria-label="Color de relleno" [value]="colorRelleno()" (input)="cambiarColor('bg', $event)" /></label>
          <span class="sep"></span>
          <button type="button" [class.on]="alineActual() === 'left'" (click)="alinear('left')" title="Alinear a la izquierda" aria-label="Izquierda">⟸</button>
          <button type="button" [class.on]="alineActual() === 'center'" (click)="alinear('center')" title="Centrar" aria-label="Centro">≡</button>
          <button type="button" [class.on]="alineActual() === 'right'" (click)="alinear('right')" title="Alinear a la derecha" aria-label="Derecha">⟹</button>
          <span class="sep"></span>
          <button type="button" (click)="limpiarFormatoActual()" title="Quitar el formato aplicado" aria-label="Quitar formato">Quitar formato</button>
        </div>

        <div
          #rejilla
          class="rejilla"
          tabindex="0"
          role="grid"
          [attr.aria-label]="'Hoja ' + nombreVisible()"
          (keydown)="tecla($event)"
          (copy)="copiar($event)"
          (paste)="pegar($event)"
        >
          <table [style.width.px]="v.ancho">
            <colgroup>
              <col class="c-num" />
              @for (c of v.cols; track c.letra) {
                <col [style.width.px]="c.ancho" />
              }
            </colgroup>
            <thead>
              <tr>
                <th class="esquina"></th>
                @for (c of v.cols; track c.letra; let ci = $index) {
                  <th [class.activa]="ci === sel().col" (contextmenu)="menuColumna(ci, $event)">{{ c.letra }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (f of v.filas; track f.n; let fi = $index) {
                <tr [style.height.px]="f.alto">
                  <th class="fila-h" [class.activa]="fi === sel().fila" (contextmenu)="menuFila(fi, $event)">{{ f.n }}</th>
                  @for (c of f.celdas; track c.ref; let ci = $index) {
                    <td
                      [class]="c.clase"
                      [class.sel]="fi === sel().fila && ci === sel().col"
                      [style]="c.css"
                      (mousedown)="seleccionar(fi, ci, $event)"
                      (dblclick)="editarActual()"
                      (contextmenu)="menuCelda(fi, ci, $event)"
                    >
                      @if (editando() !== null && fi === sel().fila && ci === sel().col) {
                        <input
                          #editor
                          class="editor"
                          [attr.aria-label]="'Editar ' + c.ref"
                          [value]="editando()"
                          (input)="escribirEditor($event)"
                          (keydown)="teclaEditor($event)"
                          (blur)="confirmarEdicion()"
                        />
                      } @else if (c.simbolo) {
                        <div class="contable"><span>{{ c.simbolo }}</span><span>{{ c.texto }}</span></div>
                      } @else if (c.flujo) {
                        <div class="flujo" [style.justify-content]="c.flujo"><span class="txt">{{ c.texto }}</span></div>
                      } @else {
                        <span class="txt">{{ c.texto }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <nav class="pestanas" aria-label="Hojas del libro" (contextmenu)="menuPestana(null, $event)">
          @for (h of hojas(); track h.name) {
            <button type="button" draggable="true" [class.activa]="h.name === hoja()?.name" [style.--tab]="h.tab" (dragstart)="arrastrarPestana(h.name, $event)" (dragover)="permitirSoltar($event)" (drop)="soltarPestana(h.name, $event)" (mousedown)="tabMousedown($event)" (click)="irAHoja(h.name)" (contextmenu)="menuPestana(h.name, $event)">
              {{ h.name.trim() }}
            </button>
          }
        </nav>
      } @else if (!errorCarga()) {
        <p class="cargando">Cargando libro…</p>
      }

      @if (aviso()) {
        <div class="aviso" role="status">{{ aviso() }}</div>
      }

      @if (menu(); as m) {
        <div class="menu-fondo" (mousedown)="cerrarMenu()" (contextmenu)="$event.preventDefault(); cerrarMenu()"></div>
        <div class="menu" role="menu" [style.left.px]="m.x" [style.top.px]="m.y" (mousedown)="$event.stopPropagation()">
          @if (m.tipo === 'pestana') {
            <button type="button" role="menuitem" (click)="agregarPestana(); cerrarMenu()"><span class="ic">＋</span><span>Añadir libro</span></button>
            <button type="button" role="menuitem" (click)="renombrarPestana(); cerrarMenu()"><span class="ic">✎</span><span>Cambiar nombre</span></button>
            <button type="button" role="menuitem" (click)="eliminarPestana(); cerrarMenu()"><span class="ic">✕</span><span>Eliminar</span></button>
          } @else if (m.tipo === 'celda') {
            <button type="button" role="menuitem" (click)="alternar('b'); cerrarMenu()"><b>N</b><span>Negrita</span></button>
            <button type="button" role="menuitem" (click)="alternar('i'); cerrarMenu()"><i>K</i><span>Cursiva</span></button>
            <button type="button" role="menuitem" (click)="alternar('u'); cerrarMenu()"><u>S</u><span>Subrayado</span></button>
            <div class="menu-sep"></div>
            <button type="button" role="menuitem" (click)="alinear('left'); cerrarMenu()"><span class="ic">⟸</span><span>Alinear a la izquierda</span></button>
            <button type="button" role="menuitem" (click)="alinear('center'); cerrarMenu()"><span class="ic">≡</span><span>Centrar</span></button>
            <button type="button" role="menuitem" (click)="alinear('right'); cerrarMenu()"><span class="ic">⟹</span><span>Alinear a la derecha</span></button>
            <div class="menu-sep"></div>
            <button type="button" role="menuitem" (click)="limpiarFormatoActual(); cerrarMenu()"><span class="ic">⌫</span><span>Quitar formato</span></button>
            <button type="button" role="menuitem" (click)="borrarCelda(); cerrarMenu()"><span class="ic">⌦</span><span>Borrar contenido</span></button>
          } @else if (m.tipo === 'columna') {
            <button type="button" role="menuitem" (click)="insertarColumna('izq')"><span class="ic">▮</span><span>Insertar columna a la izquierda</span></button>
            <button type="button" role="menuitem" (click)="insertarColumna('der')"><span class="ic">▮</span><span>Insertar columna a la derecha</span></button>
            <div class="menu-sep"></div>
            <button type="button" role="menuitem" (click)="eliminarColumna()"><span class="ic">✕</span><span>Eliminar columna</span></button>
          } @else {
            <button type="button" role="menuitem" (click)="insertarFila('arriba')"><span class="ic">＋</span><span>Agregar fila arriba</span></button>
            <button type="button" role="menuitem" (click)="insertarFila('abajo')"><span class="ic">＋</span><span>Agregar fila abajo</span></button>
            <div class="menu-sep"></div>
            <button type="button" role="menuitem" (click)="eliminarFila()"><span class="ic">✕</span><span>Eliminar fila</span></button>
          }
        </div>
      }
    </section>
  `,
  styles: `
    /* contain: el ancho de la tabla no empuja el layout; el scroll queda dentro de la rejilla. */
    :host { display: block; contain: inline-size; }
    .libro { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 10px; border-radius: 20px; color: #463255; background: #fff; }
    .barra, .fx, .formato { border: 1px solid rgba(236, 72, 153, 0.2); background: #fff; box-shadow: 0 8px 24px rgba(88, 28, 135, 0.08); }
    .barra { padding: 12px 14px; border-radius: 18px; }
    .barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
    h1 { margin: 0; font-size: 1.25rem; color: #3a214e; }
    .fuente { font-size: 0.8rem; color: #7c3aed; }
    .acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .acciones button, .acciones a { border: 1px solid rgba(124, 58, 237, 0.2); background: rgba(244, 114, 182, 0.1); color: #7c3aed; border-radius: 999px; padding: 7px 11px; font-weight: 700; font-size: 0.85rem; text-decoration: none; cursor: pointer; }
    .acciones button:disabled { opacity: 0.45; cursor: default; }
    .acciones .guardar { background: linear-gradient(135deg, #ec4899, #a855f7); border-color: transparent; color: #fff; }
    .acciones .guardar:disabled { background: rgba(244, 114, 182, 0.1); color: #7c3aed; }
    .acciones .peligro { background: #b91c1c; border-color: #b91c1c; color: #fff; }
    .confirmar { font-size: 0.85rem; color: #3a214e; }
    .estado { font-size: 0.8rem; padding: 4px 10px; border-radius: 999px; background: #ede9fe; color: #5b21b6; }
    .estado.guardado { background: #dcfce7; color: #166534; }
    .estado.error, .estado.sin-conexion { background: #fee2e2; color: #991b1b; }
    .fx { display: flex; align-items: center; gap: 6px; border-radius: 14px; padding: 6px 8px; }
    .ref { min-width: 56px; padding-right: 6px; border-right: 1px solid #e5e5e5; text-align: center; font: 600 13px Calibri, Carlito, Arial, sans-serif; }
    .fx-ico { font-style: italic; color: #6b7280; }
    .fx-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font: 14px Calibri, Carlito, Arial, sans-serif; }
    .candado { white-space: nowrap; font-size: 0.75rem; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 2px 6px; }
    .apuntar { white-space: nowrap; font-size: 0.75rem; color: #0f5132; background: #d3e9dc; border-radius: 6px; padding: 2px 8px; }
    .formato { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; border-radius: 16px; padding: 7px 8px; }
    .formato button { min-width: 30px; height: 30px; border: 1px solid transparent; background: transparent; color: #3a214e; border-radius: 9px; cursor: pointer; font-size: 0.9rem; line-height: 1; padding: 0 7px; }
    .formato button:hover, .formato button.on { background: rgba(244, 114, 182, 0.18); color: #7c3aed; }
    .formato button.on { border-color: rgba(124, 58, 237, 0.35); }
    .formato select { height: 30px; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 9px; background: #fff; color: #3a214e; font-size: 0.85rem; }
    .formato .color { display: inline-flex; align-items: center; gap: 2px; height: 30px; padding: 0 5px; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 9px; cursor: pointer; font-size: 0.85rem; color: #7c3aed; }
    .formato .color input { width: 22px; height: 20px; border: 0; background: transparent; padding: 0; cursor: pointer; }
    .formato .sep { width: 1px; align-self: stretch; background: #e5e5e5; margin: 2px; }
    .rejilla { overflow: auto; max-height: calc(100vh - 250px); min-height: 320px; border: 1px solid rgba(236, 72, 153, 0.2); border-radius: 16px 16px 0 0; background: #fff; outline: none; box-shadow: 0 10px 28px rgba(88, 28, 135, 0.08); }
    .rejilla:focus-visible { box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.24), 0 10px 28px rgba(88, 28, 135, 0.08); }
    table { border-collapse: separate; border-spacing: 0; table-layout: fixed; font: 11pt "Trebuchet MS", "Arial Rounded MT Bold", Calibri, Carlito, Arial, sans-serif; color: #000; }
    col.c-num { width: 40px; }
    th { background: #fce7f3; color: #9f1239; font: 700 12px "Trebuchet MS", "Arial Rounded MT Bold", Calibri, Carlito, Arial, sans-serif; border-right: 1px solid #e9a8c6; border-bottom: 1px solid #e9a8c6; user-select: none; }
    thead th { position: sticky; top: 0; z-index: 3; height: 20px; }
    .fila-h { position: sticky; left: 0; z-index: 2; text-align: center; }
    .esquina { left: 0; z-index: 4; }
    th.activa { background: #fce7f3; color: #9f1239; font-weight: 700; }
    td { position: relative; padding: 0 3px; overflow: hidden; white-space: nowrap; vertical-align: bottom; border-right: 1px solid #e1e1e1; border-bottom: 1px solid #e1e1e1; cursor: cell; }
    td.desborda { overflow: visible; }
    .flujo { display: flex; width: 100%; }
    .flujo .txt { flex: none; position: relative; z-index: 1; white-space: nowrap; }
    td.sel { box-shadow: inset 0 0 0 2px #7c3aed !important; z-index: 2; }
    .contable { display: flex; justify-content: space-between; gap: 4px; }
    .editor { position: absolute; inset: 0; z-index: 5; width: 100%; height: 100%; box-sizing: border-box; padding: 0 2px; border: 2px solid #7c3aed; outline: none; background: #fff; font: inherit; }
    .pestanas { position: sticky; bottom: 0; z-index: 10; display: flex; gap: 6px; overflow-x: auto; padding: 8px; background: #fff; border: 1px solid rgba(236, 72, 153, 0.2); border-radius: 0 0 16px 16px; box-shadow: 0 -8px 20px rgba(88, 28, 135, 0.1); }
    .pestanas button { flex: 0 0 auto; white-space: nowrap; cursor: pointer; padding: 8px 13px; border: 1px solid rgba(168, 85, 247, 0.2); border-top: 3px solid var(--tab, #d4d4d4); border-radius: 10px; background: #fff5fb; color: #7c3aed; font: 700 13px "Trebuchet MS", "Arial Rounded MT Bold", Calibri, Carlito, Arial, sans-serif; transition: transform .2s ease, background .2s ease, box-shadow .2s ease; }
    .pestanas button:hover { transform: translateY(-2px); background: #fce7f3; }
    .pestanas button.activa { background: linear-gradient(135deg, #ec4899, #a855f7); color: #fff; box-shadow: 0 5px 12px rgba(168, 85, 247, 0.24); }
    .aviso { position: fixed; right: 20px; bottom: 20px; z-index: 50; max-width: 340px; padding: 10px 14px; border-radius: 14px; background: #3a214e; color: #fff; font-size: 0.9rem; box-shadow: 0 12px 30px rgba(88, 28, 135, 0.2); }
    .menu-fondo { position: fixed; inset: 0; z-index: 60; }
    .menu { position: fixed; z-index: 61; min-width: 220px; padding: 6px; background: #fff; border: 1px solid rgba(236, 72, 153, 0.2); border-radius: 14px; box-shadow: 0 12px 30px rgba(88, 28, 135, 0.16); display: flex; flex-direction: column; }
    .menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 11px; border: 0; background: transparent; border-radius: 10px; cursor: pointer; font: 600 0.85rem "Trebuchet MS", "Arial Rounded MT Bold", Calibri, Carlito, Arial, sans-serif; color: #3a214e; text-align: left; }
    .menu button:hover { background: rgba(244, 114, 182, 0.16); color: #7c3aed; }
    .menu button .ic, .menu button b, .menu button i, .menu button u { display: inline-block; width: 18px; text-align: center; color: #7c3aed; font-style: normal; text-decoration: none; }
    .menu-sep { height: 1px; background: rgba(168, 85, 247, 0.16); margin: 5px 2px; }
    .error { color: #991b1b; }
    .cargando { color: #7c3aed; }
    @media (max-width: 700px) {
      .barra { align-items: stretch; }
      .acciones { justify-content: flex-start; }
      .rejilla { max-height: calc(100vh - 310px); }
    }
  `,
})
export class BoletosLibroPage implements OnInit {
  private readonly api = inject(BoletosLibroApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rejilla = viewChild<ElementRef<HTMLDivElement>>('rejilla');
  private readonly editor = viewChild<ElementRef<HTMLInputElement>>('editor');
  private readonly barra = viewChild<ElementRef<HTMLInputElement>>('barra');

  protected readonly motor = signal<MotorLibro | null>(null);
  protected readonly hojaNombre = signal('');
  /** Se incrementa en cada cambio de capturas para recalcular la vista. */
  protected readonly cambios = signal(0);
  protected readonly sel = signal<Seleccion>({ fila: 0, col: 0 });
  /** Texto del editor en celda; null cuando no se edita. */
  protected readonly editando = signal<string | null>(null);
  /** Menú contextual abierto (click derecho); null cuando está cerrado. */
  protected readonly menu = signal<MenuCtx | null>(null);
  /** Modo apuntar entre pestañas: fórmula en curso anclada a una celda mientras se ven otras hojas. */
  protected readonly apuntando = signal<{ hoja: string; ref: string; texto: string } | null>(null);
  protected readonly estado = signal<EstadoGuardado>('cargando');
  protected readonly actualizado = signal<string | null>(null);
  protected readonly aviso = signal('');
  protected readonly errorCarga = signal('');
  protected readonly confirmandoRestaurar = signal(false);
  private readonly historial = signal({ deshacer: 0, rehacer: 0 });

  protected readonly hojas = computed(() => {
    this.cambios();
    return this.motor()?.hojas ?? [];
  });
  protected readonly hoja = computed<HojaLibro | null>(() => {
    this.cambios();
    const motor = this.motor();
    if (!motor) return null;
    return motor.hoja(this.hojaNombre()) ?? motor.hojaInicial();
  });
  protected readonly nombreVisible = computed(() => this.hoja()?.name.trim() ?? '');
  protected readonly vista = computed<Vista | null>(() => {
    this.cambios();
    const motor = this.motor();
    const hoja = this.hoja();
    return motor && hoja ? construirVista(motor, hoja) : null;
  });
  protected readonly refActiva = computed(() => {
    const vista = this.vista();
    const { fila, col } = this.sel();
    const c = vista?.cols[col];
    const f = vista?.filas[fila];
    return c && f ? `${c.letra}${f.n}` : '';
  });
  protected readonly protegidaActiva = computed(() => {
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    return !!motor && !!hoja && !!ref && motor.protegida(hoja.name, ref);
  });
  protected readonly textoBarra = computed(() => {
    this.cambios();
    const apuntando = this.apuntando();
    if (apuntando) return apuntando.texto;
    const editando = this.editando();
    if (editando !== null) return editando;
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    return motor && hoja && ref ? motor.textoEdicion(hoja.name, ref) : '';
  });
  protected readonly hojaConCapturas = computed(() => {
    this.cambios();
    const hoja = this.hoja();
    const motor = this.motor();
    if (!hoja || !motor) return false;
    const prefijo = `${hoja.name}!`;
    return (
      Object.keys(motor.capturas()).some((clave) => clave.startsWith(prefijo)) ||
      Object.keys(motor.formatos()).some((clave) => clave.startsWith(prefijo))
    );
  });
  protected readonly puedeDeshacer = computed(() => this.historial().deshacer > 0);
  protected readonly puedeRehacer = computed(() => this.historial().rehacer > 0);
  /** Hay cambios sin guardar (habilita el botón Guardar). */
  protected readonly hayCambios = computed(() => {
    this.cambios();
    const motor = this.motor();
    if (!motor) return false;
    return (
      !mismasCapturas(motor.capturas(), this.base) ||
      !mismasCapturas(this.serializarFormatos(motor.formatos()), this.baseFormatos) ||
      JSON.stringify(motor.estructura()) !== this.baseEstructura
      || !mismasPestanas(motor.personalizadas(), this.basePestanas)
      || !mismoOrden(motor.ordenPestanas(), this.baseOrden)
    );
  });
  /** Estilo efectivo de la celda activa (para pintar la barra de formato). */
  protected readonly estiloActivo = computed<EstiloLibro>(() => {
    this.cambios();
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    return motor && hoja && ref ? motor.estilo(hoja.name, ref) : {};
  });
  private readonly TAMANOS_BASE = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36];
  protected readonly tamanos = computed<number[]>(() => {
    const juego = new Set(this.TAMANOS_BASE);
    juego.add(this.estiloActivo().sz ?? 11);
    return [...juego].sort((a, b) => a - b);
  });
  protected readonly textoEstado = computed(() => {
    switch (this.estado()) {
      case 'cargando':
        return 'Cargando…';
      case 'guardando':
        return 'Guardando…';
      case 'pendiente':
        return 'Cambios sin guardar';
      case 'error':
        return 'Error al guardar, reintentando…';
      case 'sin-conexion':
        return 'Sin conexión con el servidor';
      default:
        return this.actualizado() ? `Guardado ${horaCorta(this.actualizado()!)}` : 'Guardado';
    }
  });

  private version: number | null = null;
  /** Últimas capturas confirmadas por el servidor. */
  private base: Record<string, string> = {};
  /** Últimos formatos confirmados por el servidor (clave `Hoja!A1` -> JSON). */
  private baseFormatos: Record<string, string> = {};
  /** Última estructura (operaciones de columna) confirmada por el servidor, como JSON. */
  private baseEstructura = '[]';
  private basePestanas: PestanaPersonalizada[] = [];
  private baseOrden: string[] = [];
  private arrastrandoPestana: string | null = null;
  private guardando = false;
  private repetir = false;
  private conflictos = 0;
  private timerGuardado: ReturnType<typeof setTimeout> | null = null;
  private timerAviso: ReturnType<typeof setTimeout> | null = null;
  private pilaDeshacer: Instantanea[] = [];
  private pilaRehacer: Instantanea[] = [];
  private bufferBarra: string | null = null;
  /** Celda que se está editando en la barra de fórmulas (se fija al teclear). */
  private objetivoBarra: { hoja: string; ref: string } | null = null;
  /** Celda que se está editando en el editor de celda (se fija al empezar). */
  private objetivo: { hoja: string; ref: string } | null = null;
  /** true cuando la edición empezó tecleando (las flechas confirman y mueven, como en Excel). */
  private modoEntrada = false;

  constructor() {
    // El editor aparece en el siguiente render: enfocarlo en cuanto existe.
    afterRenderEffect(() => {
      const input = this.editor()?.nativeElement;
      if (!input || document.activeElement === input) return;
      input.focus();
      const fin = input.value.length;
      input.setSelectionRange(fin, fin);
    });
  }

  async ngOnInit(): Promise<void> {
    let libro: LibroJson;
    try {
      libro = (await import('./boletos-libro.data.json')).default as unknown as LibroJson;
    } catch {
      this.errorCarga.set('No se pudo cargar el libro de boletos. Recarga la página.');
      return;
    }
    const motor = new MotorLibro(libro);
    const pedida = this.route.snapshot.queryParamMap.get('hoja') ?? leerLocal(CLAVE_HOJA) ?? '';
    this.hojaNombre.set(motor.hoja(pedida)?.name ?? motor.hojaInicial().name);
    this.motor.set(motor);
    this.cargarEstado();
    const sondeo = setInterval(() => this.sondear(), 15000);
    this.destroyRef.onDestroy(() => {
      clearInterval(sondeo);
      if (this.timerGuardado) clearTimeout(this.timerGuardado);
      if (this.timerAviso) clearTimeout(this.timerAviso);
    });
  }

  @HostListener('window:focus')
  protected alEnfocarVentana(): void {
    this.sondear();
  }

  @HostListener('document:keydown.escape')
  protected cerrarMenuEsc(): void {
    this.cerrarMenu();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected antesDeSalir(event: BeforeUnloadEvent): void {
    const motor = this.motor();
    if (!motor) return;
    if (
      !mismasCapturas(motor.capturas(), this.base) ||
      !mismasCapturas(this.serializarFormatos(motor.formatos()), this.baseFormatos) ||
      JSON.stringify(motor.estructura()) !== this.baseEstructura
      || !mismasPestanas(motor.personalizadas(), this.basePestanas)
      || !mismoOrden(motor.ordenPestanas(), this.baseOrden)
    ) {
      event.preventDefault();
    }
  }

  protected irAHoja(nombre: string): void {
    if (this.editandoFormula()) {
      this.promoverAApuntar();
    } else {
      this.confirmarEdicion();
      this.confirmarBarra();
    }
    const apuntando = this.apuntando() !== null;
    this.hojaNombre.set(nombre);
    if (!apuntando) this.sel.set({ fila: 0, col: 0 });
    this.confirmandoRestaurar.set(false);
    this.cerrarMenu();
    escribirLocal(CLAVE_HOJA, nombre);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { hoja: nombre.trim() }, replaceUrl: true });
    if (apuntando) this.enfocarBarra();
    else this.enfocarRejilla();
  }

  protected menuPestana(nombre: string | null, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(4, Math.min(rect.left, window.innerWidth - 220));
    const y = Math.max(8, rect.top - 104);
    this.menu.set({ x, y, tipo: 'pestana', col: -1, nombre: nombre ?? undefined });
  }

  protected arrastrarPestana(nombre: string, event: DragEvent): void {
    this.arrastrandoPestana = nombre;
    event.dataTransfer?.setData('text/plain', nombre);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected permitirSoltar(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  protected soltarPestana(destino: string, event: DragEvent): void {
    event.preventDefault();
    const origen = this.arrastrandoPestana ?? event.dataTransfer?.getData('text/plain') ?? null;
    this.arrastrandoPestana = null;
    const motor = this.motor();
    if (!motor || !origen || origen === destino) return;
    if (motor.moverPestana(origen, destino)) {
      this.cambios.update((n) => n + 1);
      this.trasCambio();
    }
  }

  protected agregarPestana(): void {
    const valor = window.prompt('Nombre de la nueva base:');
    const texto = valor?.trim() ?? '';
    if (!texto || texto.includes('!') || texto.length > 64) { if (valor !== null) this.avisar('El nombre debe tener entre 1 y 64 caracteres y no contener !.'); return; }
    const nombre = texto;
    const motor = this.motor();
    if (!motor || motor.hoja(nombre)) { this.avisar('Ya existe una pestaña con ese nombre.'); return; }
    const pestana = { id: crearIdPestana(), nombre };
    motor.agregarPersonalizada(pestana);
    this.trasCambio();
    this.irAHoja(nombre);
  }

  protected renombrarPestana(): void {
    const nombre = this.menu()?.nombre;
    const motor = this.motor();
    const pestana = motor?.personalizadas().find((p) => p.nombre === nombre);
    if (!motor || !nombre) return;
    const valor = window.prompt('Nuevo nombre de la base:', nombre);
    const texto = valor?.trim() ?? '';
    if (!texto || texto.includes('!') || texto.length > 64) { if (valor !== null) this.avisar('El nombre debe tener entre 1 y 64 caracteres y no contener !.'); return; }
    const nuevo = texto;
    const ok = pestana ? motor.renombrarPersonalizada(pestana.id, nuevo) : motor.renombrarHoja(nombre, nuevo);
    if (!ok) { this.avisar('Ya existe una pestaña con ese nombre.'); return; }
    if (this.hojaNombre() === nombre) this.hojaNombre.set(nuevo);
    this.trasCambio();
  }

  protected eliminarPestana(): void {
    const nombre = this.menu()?.nombre;
    const motor = this.motor();
    const pestana = motor?.personalizadas().find((p) => p.nombre === nombre);
    if (!motor || !nombre) return;
    if (!window.confirm(`¿Eliminar ${nombre}?`)) return;
    const ok = pestana ? motor.eliminarPersonalizada(pestana.id) : motor.eliminarHoja(nombre);
    if (!ok) { this.avisar('No se puede eliminar: una fórmula todavía referencia esta pestaña.'); return; }
    if (this.hojaNombre() === nombre) this.hojaNombre.set(motor.hojaInicial().name);
    this.trasCambio();
  }

  protected tabMousedown(event: MouseEvent): void {
    // Al cambiar de pestaña escribiendo una fórmula, no se pierde el foco ni se confirma.
    if (this.editandoFormula()) event.preventDefault();
  }

  private editandoFormula(): boolean {
    if (this.apuntando() !== null) return true;
    const enCelda = this.editando();
    if (enCelda !== null && enCelda.trimStart().startsWith('=')) return true;
    if (this.bufferBarra !== null && this.bufferBarra.trimStart().startsWith('=')) return true;
    return false;
  }

  private promoverAApuntar(): void {
    if (this.apuntando() !== null) return;
    const enCelda = this.editando();
    if (enCelda !== null && enCelda.trimStart().startsWith('=') && this.objetivo) {
      this.apuntando.set({ hoja: this.objetivo.hoja, ref: this.objetivo.ref, texto: enCelda });
      this.editando.set(null);
      this.objetivo = null;
      return;
    }
    if (this.bufferBarra !== null && this.bufferBarra.trimStart().startsWith('=') && this.objetivoBarra) {
      this.apuntando.set({ hoja: this.objetivoBarra.hoja, ref: this.objetivoBarra.ref, texto: this.bufferBarra });
      this.bufferBarra = null;
      this.objetivoBarra = null;
    }
  }

  private confirmarApuntar(): void {
    const ap = this.apuntando();
    this.apuntando.set(null);
    if (!ap) return;
    this.aplicar([{ hoja: ap.hoja, ref: ap.ref, texto: ap.texto }]);
    this.volverAOrigen(ap.hoja, ap.ref);
  }

  private cancelarApuntar(): void {
    const ap = this.apuntando();
    this.apuntando.set(null);
    if (ap) this.volverAOrigen(ap.hoja, ap.ref);
  }

  private volverAOrigen(hoja: string, ref: string): void {
    this.hojaNombre.set(hoja);
    escribirLocal(CLAVE_HOJA, hoja);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { hoja: hoja.trim() }, replaceUrl: true });
    setTimeout(() => {
      this.seleccionarRef(ref);
      this.enfocarRejilla();
    });
  }

  private seleccionarRef(ref: string): void {
    const vista = this.vista();
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!vista || !match) return;
    const col = vista.cols.findIndex((c) => c.letra === match[1]);
    const fila = vista.filas.findIndex((f) => f.n === Number(match[2]));
    if (col >= 0 && fila >= 0) this.sel.set({ fila, col });
  }

  private enfocarBarra(): void {
    setTimeout(() => this.barra()?.nativeElement.focus({ preventScroll: true }));
  }

  protected seleccionar(fila: number, col: number, event: MouseEvent): void {
    if (event.button !== 0) return;
    // Modo apuntar: si se edita una fórmula, el clic inserta la referencia en vez de confirmar.
    if (this.insertarReferencia(fila, col, event)) return;
    if (this.editando() !== null && fila === this.sel().fila && col === this.sel().col) return;
    // Confirmar antes de mover la selección: el blur del editor llega después del mousedown.
    this.confirmarEdicion();
    this.confirmarBarra();
    this.sel.set({ fila, col });
  }

  /** Inserta la referencia de la celda clicada dentro de la fórmula en edición (como Excel). */
  private insertarReferencia(fila: number, col: number, event: MouseEvent): boolean {
    const vista = this.vista();
    if (!vista) return false;
    const columna = vista.cols[col];
    const renglon = vista.filas[fila];
    if (!columna || !renglon) return false;

    const ap = this.apuntando();
    if (ap) {
      event.preventDefault();
      const actual = this.hoja();
      const refApunta =
        actual && actual.name !== ap.hoja
          ? `'${actual.name.replace(/'/g, "''")}'!${columna.letra}${renglon.n}`
          : `${columna.letra}${renglon.n}`;
      const nuevo = insertarRefEnFormula(ap.texto, refApunta);
      if (nuevo !== null) {
        this.apuntando.set({ ...ap, texto: nuevo });
        const input = this.barra()?.nativeElement;
        if (input) {
          input.value = nuevo;
          input.focus();
          input.setSelectionRange(nuevo.length, nuevo.length);
        }
      }
      return true;
    }

    if (fila === this.sel().fila && col === this.sel().col) return false;
    const ref = `${columna.letra}${renglon.n}`;

    const enCelda = this.editando();
    if (enCelda !== null && enCelda.trimStart().startsWith('=')) {
      const nuevo = insertarRefEnFormula(enCelda, ref);
      if (nuevo === null) return false;
      event.preventDefault();
      this.editando.set(nuevo);
      setTimeout(() => {
        const input = this.editor()?.nativeElement;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
      return true;
    }

    if (this.bufferBarra !== null && this.bufferBarra.trimStart().startsWith('=')) {
      const nuevo = insertarRefEnFormula(this.bufferBarra, ref);
      if (nuevo === null) return false;
      event.preventDefault();
      this.bufferBarra = nuevo;
      const input = this.barra()?.nativeElement;
      if (input) {
        input.value = nuevo;
        input.focus();
        input.setSelectionRange(nuevo.length, nuevo.length);
      }
      return true;
    }

    return false;
  }

  protected menuCelda(fila: number, col: number, event: MouseEvent): void {
    event.preventDefault();
    this.confirmarEdicion();
    this.confirmarBarra();
    this.sel.set({ fila, col });
    const x = Math.max(4, Math.min(event.clientX, window.innerWidth - 212));
    this.menu.set({ x, y: event.clientY, tipo: 'celda', col });
  }

  protected cerrarMenu(): void {
    if (this.menu()) this.menu.set(null);
  }

  protected borrarCelda(): void {
    this.borrarActual();
  }

  protected menuColumna(ci: number, event: MouseEvent): void {
    event.preventDefault();
    const vista = this.vista();
    const letra = vista?.cols[ci]?.letra;
    if (!letra) return;
    this.confirmarEdicion();
    this.confirmarBarra();
    this.sel.update((s) => ({ fila: s.fila, col: ci }));
    const x = Math.max(4, Math.min(event.clientX, window.innerWidth - 252));
    this.menu.set({ x, y: event.clientY, tipo: 'columna', col: indiceColumna(letra) });
  }

  protected menuFila(fi: number, event: MouseEvent): void {
    event.preventDefault();
    this.confirmarEdicion();
    this.confirmarBarra();
    const vista = this.vista();
    const fila = vista?.filas[fi]?.n;
    if (!fila) return;
    this.sel.update((s) => ({ fila: fi, col: s.col }));
    const x = Math.max(4, Math.min(event.clientX, window.innerWidth - 220));
    this.menu.set({ x, y: event.clientY, tipo: 'fila', col: -1, fila });
  }

  protected insertarColumna(lado: 'izq' | 'der'): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const menu = this.menu();
    this.cerrarMenu();
    if (!motor || !hoja || !menu) return;
    const col = lado === 'izq' ? menu.col : menu.col + 1;
    const antes = this.instantanea();
    if (!motor.insertarColumna(hoja.name, col)) return;
    this.registrarDeshacer(antes);
    this.trasCambio();
    this.avisar(`Columna insertada en ${hoja.name.trim()}.`);
  }

  protected eliminarColumna(): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const menu = this.menu();
    this.cerrarMenu();
    if (!motor || !hoja || !menu) return;
    const antes = this.instantanea();
    const resultado = motor.eliminarColumna(hoja.name, menu.col);
    if (!resultado.ok) {
      this.avisar(resultado.motivo ?? 'No se pudo eliminar la columna.');
      return;
    }
    this.registrarDeshacer(antes);
    this.trasCambio();
    this.avisar(`Columna eliminada en ${hoja.name.trim()}.`);
  }

  protected insertarFila(lado: 'arriba' | 'abajo'): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const menu = this.menu();
    this.cerrarMenu();
    if (!motor || !hoja || !menu || menu.fila == null) return;
    const fila = lado === 'arriba' ? menu.fila : menu.fila + 1;
    const antes = this.instantanea();
    if (!motor.insertarFila(hoja.name, fila)) return;
    this.registrarDeshacer(antes);
    this.trasCambio();
    this.avisar(`Fila insertada en ${hoja.name.trim()}.`);
  }

  protected eliminarFila(): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const menu = this.menu();
    this.cerrarMenu();
    if (!motor || !hoja || !menu || menu.fila == null) return;
    const antes = this.instantanea();
    const resultado = motor.eliminarFila(hoja.name, menu.fila);
    if (!resultado.ok) {
      this.avisar(resultado.motivo ?? 'No se pudo eliminar la fila.');
      return;
    }
    this.registrarDeshacer(antes);
    this.trasCambio();
    this.avisar(`Fila eliminada en ${hoja.name.trim()}.`);
  }

  protected editarActual(inicial?: string): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    if (!motor || !hoja || !ref) return;
    if (motor.protegida(hoja.name, ref)) {
      this.avisar('Esta celda tiene una fórmula del Excel y está protegida: se calcula sola.');
      return;
    }
    this.modoEntrada = inicial !== undefined;
    this.objetivo = { hoja: hoja.name, ref };
    this.editando.set(inicial ?? motor.textoEdicion(hoja.name, ref));
  }

  protected escribirEditor(event: Event): void {
    this.editando.set((event.target as HTMLInputElement).value);
  }

  protected teclaEditor(event: KeyboardEvent): void {
    const mover = (fila: number, col: number) => {
      event.preventDefault();
      this.confirmarEdicion();
      this.mover(fila, col);
    };
    switch (event.key) {
      case 'Enter':
        return mover(event.shiftKey ? -1 : 1, 0);
      case 'Tab':
        return mover(0, event.shiftKey ? -1 : 1);
      case 'Escape':
        event.preventDefault();
        this.editando.set(null);
        this.enfocarRejilla();
        return;
      case 'ArrowUp':
        return mover(-1, 0);
      case 'ArrowDown':
        return mover(1, 0);
      case 'ArrowLeft':
        if (this.modoEntrada) mover(0, -1);
        return;
      case 'ArrowRight':
        if (this.modoEntrada) mover(0, 1);
        return;
    }
  }

  protected confirmarEdicion(): void {
    const texto = this.editando();
    if (texto === null) return;
    this.editando.set(null);
    const objetivo = this.objetivo;
    this.objetivo = null;
    if (objetivo) this.aplicar([{ ...objetivo, texto }]);
    this.enfocarRejilla();
  }

  protected escribirBarra(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    const ap = this.apuntando();
    if (ap) {
      this.apuntando.set({ ...ap, texto: valor });
      return;
    }
    this.bufferBarra = valor;
    const hoja = this.hoja();
    const ref = this.refActiva();
    if (!this.objetivoBarra && hoja && ref) this.objetivoBarra = { hoja: hoja.name, ref };
  }

  protected teclaBarra(event: KeyboardEvent): void {
    if (this.apuntando() !== null) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.confirmarApuntar();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelarApuntar();
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmarBarra();
      this.enfocarRejilla();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.bufferBarra = null;
      this.objetivoBarra = null;
      (event.target as HTMLInputElement).value = this.textoBarra();
      this.enfocarRejilla();
    }
  }

  protected confirmarBarra(): void {
    if (this.apuntando() !== null) return;
    const texto = this.bufferBarra;
    const objetivo = this.objetivoBarra;
    this.bufferBarra = null;
    this.objetivoBarra = null;
    if (texto === null || !objetivo) return;
    this.aplicar([{ ...objetivo, texto }]);
  }

  protected tecla(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;
    if (this.editando() !== null) {
      // Las teclas del editor ya las maneja teclaEditor (llegan aquí por burbujeo).
      if (event.target instanceof HTMLInputElement) return;
      // Teclas que llegan antes de que el editor tenga el foco: no se pierden.
      if (event.key.length === 1 && !ctrl && !event.altKey) {
        event.preventDefault();
        this.editando.update((texto) => (texto ?? '') + event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        this.editando.update((texto) => (texto ?? '').slice(0, -1));
      } else {
        this.teclaEditor(event);
      }
      return;
    }
    const tecla = event.key.toLowerCase();
    if (ctrl && tecla === 's') {
      event.preventDefault();
      this.guardarManual();
      return;
    }
    if (ctrl && tecla === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.rehacerCambio();
      else this.deshacerCambio();
      return;
    }
    if (ctrl && tecla === 'y') {
      event.preventDefault();
      this.rehacerCambio();
      return;
    }
    if (ctrl && (tecla === 'b' || tecla === 'i' || tecla === 'u')) {
      event.preventDefault();
      this.alternar(tecla as 'b' | 'i' | 'u');
      return;
    }
    if (ctrl || event.altKey) return;
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        return this.mover(-1, 0);
      case 'ArrowDown':
        event.preventDefault();
        return this.mover(1, 0);
      case 'ArrowLeft':
        event.preventDefault();
        return this.mover(0, -1);
      case 'ArrowRight':
        event.preventDefault();
        return this.mover(0, 1);
      case 'Enter':
        event.preventDefault();
        return this.mover(event.shiftKey ? -1 : 1, 0);
      case 'Tab':
        event.preventDefault();
        return this.mover(0, event.shiftKey ? -1 : 1);
      case 'F2':
        event.preventDefault();
        return this.editarActual();
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        return this.borrarActual();
    }
    if (event.key.length === 1) {
      event.preventDefault();
      this.editarActual(event.key);
    }
  }

  protected copiar(event: ClipboardEvent): void {
    if (this.editando() !== null) return;
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    if (!motor || !hoja || !ref) return;
    const valor = motor.valor(hoja.name, ref);
    const texto = valor.tipo === 'numero' ? String(valor.n) : valor.tipo === 'texto' ? valor.t : valor.tipo === 'error' ? valor.e : '';
    event.clipboardData?.setData('text/plain', texto);
    event.preventDefault();
  }

  protected pegar(event: ClipboardEvent): void {
    if (this.editando() !== null) return;
    const texto = event.clipboardData?.getData('text/plain');
    const vista = this.vista();
    const hoja = this.hoja();
    const motor = this.motor();
    if (!texto || !vista || !hoja || !motor) return;
    event.preventDefault();
    const matriz = parseTsv(texto);
    const { fila, col } = this.sel();
    const cambios: { hoja: string; ref: string; texto: string }[] = [];
    let saltadas = 0;
    matriz.forEach((renglon, i) =>
      renglon.forEach((valor, j) => {
        const c = vista.cols[col + j];
        const f = vista.filas[fila + i];
        if (!c || !f) return;
        const ref = `${c.letra}${f.n}`;
        if (motor.protegida(hoja.name, ref)) saltadas++;
        else cambios.push({ hoja: hoja.name, ref, texto: valor.trim() });
      }),
    );
    this.aplicar(cambios);
    if (saltadas) this.avisar(`Se omitieron ${saltadas} celda(s) con fórmula protegida.`);
  }

  protected deshacerCambio(): void {
    const motor = this.motor();
    const previo = this.pilaDeshacer.pop();
    if (!motor || !previo) return;
    this.pilaRehacer.push(this.instantanea());
    this.restaurarInstantanea(previo);
    this.trasCambio();
  }

  protected rehacerCambio(): void {
    const motor = this.motor();
    const siguiente = this.pilaRehacer.pop();
    if (!motor || !siguiente) return;
    this.pilaDeshacer.push(this.instantanea());
    this.restaurarInstantanea(siguiente);
    this.trasCambio();
  }

  protected restaurarHoja(): void {
    this.confirmandoRestaurar.set(false);
    const motor = this.motor();
    const hoja = this.hoja();
    if (!motor || !hoja) return;
    const prefijo = `${hoja.name}!`;
    const sinHoja = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).filter(([clave]) => !clave.startsWith(prefijo)));
    const antes = this.instantanea();
    const despues: Instantanea = { ...antes, capturas: sinHoja(antes.capturas), formatos: sinHoja(antes.formatos) };
    if (this.mismasInstantaneas(antes, despues)) return;
    this.registrarDeshacer(antes);
    this.restaurarInstantanea(despues);
    this.trasCambio();
    this.avisar(`${hoja.name.trim()} quedó como en el Excel original.`);
  }

  protected fmtActivo(llave: 'b' | 'i' | 'u'): boolean {
    return !!this.estiloActivo()[llave];
  }

  protected tamActual(): number {
    return this.estiloActivo().sz ?? 11;
  }

  protected colorTexto(): string {
    return this.estiloActivo().fc ?? '#000000';
  }

  protected colorRelleno(): string {
    return this.estiloActivo().bg ?? '#FFFFFF';
  }

  protected alineActual(): string {
    return this.estiloActivo().ha ?? '';
  }

  protected alternar(llave: 'b' | 'i' | 'u'): void {
    const cambio: Partial<EstiloLibro> = {};
    cambio[llave] = !this.estiloActivo()[llave];
    this.aplicarFormato(cambio);
  }

  protected cambiarTam(event: Event): void {
    const sz = Number((event.target as HTMLSelectElement).value) || 11;
    this.aplicarFormato({ sz });
  }

  protected cambiarColor(prop: 'fc' | 'bg', event: Event): void {
    const valor = (event.target as HTMLInputElement).value.toUpperCase();
    const cambio: Partial<EstiloLibro> = {};
    cambio[prop] = valor;
    this.aplicarFormato(cambio);
  }

  protected alinear(ha: 'left' | 'center' | 'right'): void {
    this.aplicarFormato({ ha: this.alineActual() === ha ? '' : ha });
  }

  protected limpiarFormatoActual(): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    if (!motor || !hoja || !ref) return;
    const antes = this.instantanea();
    motor.limpiarFormato(hoja.name, ref);
    if (this.mismasInstantaneas(antes, this.instantanea())) return;
    this.registrarDeshacer(antes);
    this.trasCambio();
  }

  private aplicarFormato(cambio: Partial<EstiloLibro>): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    if (!motor || !hoja || !ref) return;
    const antes = this.instantanea();
    motor.establecerFormato(hoja.name, ref, cambio);
    if (this.mismasInstantaneas(antes, this.instantanea())) return;
    this.registrarDeshacer(antes);
    this.trasCambio();
  }

  private instantanea(): Instantanea {
    const motor = this.motor();
    return {
      estructura: motor ? JSON.stringify(motor.estructura()) : '[]',
      capturas: motor ? motor.capturas() : {},
      formatos: motor ? this.serializarFormatos(motor.formatos()) : {},
      pestanas: motor ? motor.personalizadas() : [],
      ordenPestanas: motor ? motor.ordenPestanas() : [],
    };
  }

  private restaurarInstantanea(inst: Instantanea): void {
    const motor = this.motor();
    if (!motor) return;
    motor.aplicarEstructura(this.parsearEstructura(inst.estructura));
    motor.cargarPersonalizadas(inst.pestanas ?? []);
    motor.cargarOrden(inst.ordenPestanas ?? []);
    motor.reemplazarCapturas(inst.capturas);
    motor.reemplazarFormatos(this.parsearFormatos(inst.formatos));
  }

  private mismasInstantaneas(a: Instantanea, b: Instantanea): boolean {
    return a.estructura === b.estructura && mismasCapturas(a.capturas, b.capturas) && mismasCapturas(a.formatos, b.formatos) && mismasPestanas(a.pestanas, b.pestanas) && mismoOrden(a.ordenPestanas, b.ordenPestanas);
  }

  private serializarFormatos(formatos: Record<string, EstiloLibro>): Record<string, string> {
    const r: Record<string, string> = {};
    for (const [clave, estilo] of Object.entries(formatos)) r[clave] = JSON.stringify(estilo);
    return r;
  }

  private parsearFormatos(formatos: Record<string, string>): Record<string, EstiloLibro> {
    const r: Record<string, EstiloLibro> = {};
    for (const [clave, texto] of Object.entries(formatos)) {
      try {
        const estilo = JSON.parse(texto) as EstiloLibro;
        if (estilo && typeof estilo === 'object') r[clave] = estilo;
      } catch {
        // Formato ilegible: se ignora.
      }
    }
    return r;
  }

  private parsearEstructura(texto: string): OpLibro[] {
    try {
      const ops = JSON.parse(texto || '[]') as OpLibro[];
      return Array.isArray(ops) ? ops : [];
    } catch {
      return [];
    }
  }

  private borrarActual(): void {
    const motor = this.motor();
    const hoja = this.hoja();
    const ref = this.refActiva();
    if (!motor || !hoja || !ref) return;
    if (motor.protegida(hoja.name, ref)) {
      this.avisar('Esta celda tiene una fórmula del Excel y está protegida: se calcula sola.');
      return;
    }
    this.aplicar([{ hoja: hoja.name, ref, texto: '' }]);
  }

  /** Aplica uno o más cambios como un solo paso de deshacer. */
  private aplicar(cambios: { hoja: string; ref: string; texto: string }[]): void {
    const motor = this.motor();
    if (!motor) return;
    const antes = this.instantanea();
    for (const cambio of cambios) {
      if (motor.protegida(cambio.hoja, cambio.ref)) continue;
      if (motor.textoEdicion(cambio.hoja, cambio.ref) === cambio.texto) continue;
      motor.establecer(cambio.hoja, cambio.ref, cambio.texto);
    }
    if (mismasCapturas(antes.capturas, motor.capturas())) return;
    this.registrarDeshacer(antes);
    this.trasCambio();
  }

  private registrarDeshacer(antes: Instantanea): void {
    this.pilaDeshacer.push(antes);
    if (this.pilaDeshacer.length > MAX_HISTORIAL) this.pilaDeshacer.shift();
    this.pilaRehacer = [];
  }

  private trasCambio(): void {
    this.cambios.update((n) => n + 1);
    this.historial.set({ deshacer: this.pilaDeshacer.length, rehacer: this.pilaRehacer.length });
    this.respaldar();
    this.marcarPendiente();
  }

  private mover(deltaFila: number, deltaCol: number): void {
    const vista = this.vista();
    if (!vista) return;
    const { fila, col } = this.sel();
    this.sel.set({
      fila: Math.min(vista.filas.length - 1, Math.max(0, fila + deltaFila)),
      col: Math.min(vista.cols.length - 1, Math.max(0, col + deltaCol)),
    });
    setTimeout(() => this.rejilla()?.nativeElement.querySelector('td.sel')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }

  private enfocarRejilla(): void {
    setTimeout(() => this.rejilla()?.nativeElement.focus({ preventScroll: true }));
  }

  private avisar(texto: string): void {
    this.aviso.set(texto);
    if (this.timerAviso) clearTimeout(this.timerAviso);
    this.timerAviso = setTimeout(() => this.aviso.set(''), 4000);
  }

  // ---- Sincronización con el servidor ----

  private cargarEstado(): void {
    this.api.estado().subscribe({
      next: (estado) => {
        this.adoptar(estado);
        const respaldo = leerRespaldo();
        const motor = this.motor();
        if (respaldo && motor) {
          const serverE = estado.estructura ?? '[]';
          const mismaEstructura = respaldo.base.estructura === serverE && respaldo.actual.estructura === serverE;
          if (mismaEstructura) {
            const capturas = fusionarCapturas(estado.capturas, respaldo.base.capturas, respaldo.actual.capturas);
            const formatos = fusionarCapturas(estado.formatos ?? {}, respaldo.base.formatos, respaldo.actual.formatos);
            const pestanas = respaldo.actual.pestanas;
            const orden = respaldo.actual.ordenPestanas;
            if (!mismasCapturas(capturas, estado.capturas) || !mismasCapturas(formatos, estado.formatos ?? {}) || !mismasPestanas(pestanas, estado.pestanasPersonalizadas ?? []) || !mismoOrden(orden, estado.ordenPestanas ?? [])) {
              motor.cargarPersonalizadas(pestanas);
              motor.cargarOrden(orden);
              motor.reemplazarCapturas(capturas);
              motor.reemplazarFormatos(this.parsearFormatos(formatos));
              this.cambios.update((n) => n + 1);
              this.avisar('Se recuperaron cambios que no se habían guardado.');
              this.marcarPendiente();
              return;
            }
          } else {
            motor.aplicarEstructura(this.parsearEstructura(respaldo.actual.estructura));
            motor.cargarPersonalizadas(respaldo.actual.pestanas);
            motor.cargarOrden(respaldo.actual.ordenPestanas);
            motor.reemplazarCapturas(respaldo.actual.capturas);
            motor.reemplazarFormatos(this.parsearFormatos(respaldo.actual.formatos));
            this.cambios.update((n) => n + 1);
            this.avisar('Se recuperaron cambios que no se habían guardado (incluye columnas).');
            this.marcarPendiente();
            return;
          }
          borrarRespaldo();
        }
        this.estado.set('guardado');
      },
      error: () => {
        this.estado.set('sin-conexion');
        this.avisar('No hay conexión con el servidor. Tus cambios se guardan en este equipo hasta reconectar.');
        const respaldo = leerRespaldo();
        const motor = this.motor();
        if (respaldo && motor) {
          motor.aplicarEstructura(this.parsearEstructura(respaldo.actual.estructura));
          motor.cargarPersonalizadas(respaldo.actual.pestanas);
          motor.cargarOrden(respaldo.actual.ordenPestanas);
          motor.reemplazarCapturas(respaldo.actual.capturas);
          motor.reemplazarFormatos(this.parsearFormatos(respaldo.actual.formatos));
          this.base = respaldo.base.capturas;
          this.baseFormatos = respaldo.base.formatos;
          this.baseEstructura = respaldo.base.estructura;
          this.basePestanas = respaldo.base.pestanas;
          this.baseOrden = respaldo.base.ordenPestanas;
          this.cambios.update((n) => n + 1);
        }
        this.timerGuardado = setTimeout(() => this.cargarEstado(), 10000);
      },
    });
  }

  /** Toma el estado del servidor como base y lo muestra. */
  private adoptar(estado: EstadoLibro): void {
    this.version = estado.version;
    this.base = { ...(estado.capturas ?? {}) };
    this.baseFormatos = { ...(estado.formatos ?? {}) };
    this.baseEstructura = estado.estructura ?? '[]';
    this.basePestanas = (estado.pestanasPersonalizadas ?? []).map((p) => ({ ...p }));
    this.baseOrden = [...(estado.ordenPestanas ?? [])];
    this.actualizado.set(estado.actualizado);
    const motor = this.motor();
    motor?.aplicarEstructura(this.parsearEstructura(this.baseEstructura));
    motor?.cargarPersonalizadas(this.basePestanas);
    motor?.cargarOrden(this.baseOrden);
    motor?.reemplazarCapturas(this.base);
    motor?.reemplazarFormatos(this.parsearFormatos(this.baseFormatos));
    this.cambios.update((n) => n + 1);
  }

  private marcarPendiente(): void {
    if (this.estado() !== 'sin-conexion') this.estado.set('pendiente');
  }

  protected guardarManual(): void {
    this.guardar();
  }

  private guardar(): void {
    const motor = this.motor();
    if (!motor) return;
    if (this.guardando) {
      this.repetir = true;
      return;
    }
    const capturas = motor.capturas();
    const formatos = this.serializarFormatos(motor.formatos());
    const estructura = JSON.stringify(motor.estructura());
    const pestanas = motor.personalizadas();
    const orden = motor.ordenPestanas();
    if (
      mismasCapturas(capturas, this.base) &&
      mismasCapturas(formatos, this.baseFormatos) &&
      estructura === this.baseEstructura &&
      mismasPestanas(pestanas, this.basePestanas) &&
      mismoOrden(orden, this.baseOrden) &&
      this.version !== null
    ) {
      this.estado.set('guardado');
      borrarRespaldo();
      return;
    }
    this.guardando = true;
    this.estado.set('guardando');
    this.api.guardar(capturas, formatos, estructura, pestanas, orden, this.version).subscribe({
      next: (estado) => {
        this.guardando = false;
        this.conflictos = 0;
        this.version = estado.version;
        this.base = { ...(estado.capturas ?? {}) };
        this.baseFormatos = { ...(estado.formatos ?? {}) };
        this.baseEstructura = estado.estructura ?? '[]';
        this.basePestanas = (estado.pestanasPersonalizadas ?? []).map((p) => ({ ...p }));
        this.baseOrden = [...(estado.ordenPestanas ?? [])];
        this.actualizado.set(estado.actualizado);
        this.cambios.update((n) => n + 1);
        const pendiente =
          this.repetir ||
          !mismasCapturas(motor.capturas(), this.base) ||
          !mismasCapturas(this.serializarFormatos(motor.formatos()), this.baseFormatos) ||
          JSON.stringify(motor.estructura()) !== this.baseEstructura ||
          !mismasPestanas(motor.personalizadas(), this.basePestanas) ||
          !mismoOrden(motor.ordenPestanas(), this.baseOrden);
        if (pendiente) {
          this.repetir = false;
          this.guardar();
          return;
        }
        this.estado.set('guardado');
        borrarRespaldo();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        const conflicto = error.status === 409 ? (error.error as ConflictoLibro | null)?.actual : null;
        if (conflicto && this.conflictos < MAX_CONFLICTOS) {
          this.conflictos++;
          const serverE = conflicto.estructura ?? '[]';
          if (serverE !== this.baseEstructura || serverE !== JSON.stringify(motor.estructura()) || !mismasPestanas(conflicto.pestanasPersonalizadas ?? [], motor.personalizadas()) || !mismoOrden(conflicto.ordenPestanas ?? [], motor.ordenPestanas())) {
            // Divergencia de columnas: se adopta la estructura del servidor para no corromper el libro.
            this.version = conflicto.version;
            this.base = { ...(conflicto.capturas ?? {}) };
            this.baseFormatos = { ...(conflicto.formatos ?? {}) };
            this.baseEstructura = serverE;
            this.basePestanas = (conflicto.pestanasPersonalizadas ?? []).map((p) => ({ ...p }));
            this.baseOrden = [...(conflicto.ordenPestanas ?? [])];
            motor.aplicarEstructura(this.parsearEstructura(serverE));
            motor.cargarPersonalizadas(this.basePestanas);
            motor.cargarOrden(this.baseOrden);
            motor.reemplazarCapturas(this.base);
            motor.reemplazarFormatos(this.parsearFormatos(this.baseFormatos));
            this.cambios.update((n) => n + 1);
            this.avisar('Otro equipo cambió las columnas: se adoptó su versión del libro.');
            this.estado.set('guardado');
            borrarRespaldo();
            return;
          }
          const capturasComb = fusionarCapturas(conflicto.capturas ?? {}, this.base, motor.capturas());
          const formatosComb = fusionarCapturas(conflicto.formatos ?? {}, this.baseFormatos, this.serializarFormatos(motor.formatos()));
          this.version = conflicto.version;
          this.base = { ...(conflicto.capturas ?? {}) };
          this.baseFormatos = { ...(conflicto.formatos ?? {}) };
          motor.reemplazarCapturas(capturasComb);
          motor.reemplazarFormatos(this.parsearFormatos(formatosComb));
          this.cambios.update((n) => n + 1);
          this.avisar('Otro equipo guardó cambios: se combinaron con los tuyos.');
          this.guardar();
          return;
        }
        this.estado.set(error.status === 0 ? 'sin-conexion' : 'error');
      },
    });
  }

  /** Trae cambios de otros equipos cuando aquí no hay nada pendiente. */
  private sondear(): void {
    const motor = this.motor();
    if (!motor || this.guardando || this.editando() !== null) return;
    const sinCambios =
      mismasCapturas(motor.capturas(), this.base) &&
      mismasCapturas(this.serializarFormatos(motor.formatos()), this.baseFormatos) &&
      JSON.stringify(motor.estructura()) === this.baseEstructura &&
      mismasPestanas(motor.personalizadas(), this.basePestanas) &&
      mismoOrden(motor.ordenPestanas(), this.baseOrden);
    if (this.estado() === 'cargando' || !sinCambios) return;
    this.api.estado().subscribe({
      next: (estado) => {
        if (estado.version === this.version) return;
        const siguenSinCambios =
          mismasCapturas(motor.capturas(), this.base) &&
          mismasCapturas(this.serializarFormatos(motor.formatos()), this.baseFormatos) &&
          JSON.stringify(motor.estructura()) === this.baseEstructura &&
          mismasPestanas(motor.personalizadas(), this.basePestanas) &&
          mismoOrden(motor.ordenPestanas(), this.baseOrden);
        if (!siguenSinCambios) return;
        this.pilaDeshacer = [];
        this.pilaRehacer = [];
        this.historial.set({ deshacer: 0, rehacer: 0 });
        this.adoptar(estado);
        this.estado.set('guardado');
      },
      error: () => undefined,
    });
  }

  private respaldar(): void {
    const motor = this.motor();
    if (!motor) return;
    const respaldo: Respaldo = {
      base: { estructura: this.baseEstructura, capturas: this.base, formatos: this.baseFormatos, pestanas: this.basePestanas, ordenPestanas: this.baseOrden },
      actual: { estructura: JSON.stringify(motor.estructura()), capturas: motor.capturas(), formatos: this.serializarFormatos(motor.formatos()), pestanas: motor.personalizadas(), ordenPestanas: motor.ordenPestanas() },
    };
    escribirLocal(CLAVE_RESPALDO, JSON.stringify(respaldo));
  }
}

function construirVista(motor: MotorLibro, hoja: HojaLibro): Vista {
  const letras = columnasDeHoja(hoja);
  const filas = filasDeHoja(hoja);
  const cols = letras.map((letra) => ({ letra, ancho: anchoColumna(hoja, letra) }));
  return {
    ancho: ANCHO_NUMEROS + cols.reduce((total, col) => total + col.ancho, 0),
    cols,
    filas: filas.map((n) => {
      const base = letras.map((letra) => {
        const ref = `${letra}${n}`;
        const estilo = motor.estilo(hoja.name, ref);
        const valor = motor.valor(hoja.name, ref);
        const formato = formatear(valor, estilo.nf);
        const alinear = estilo.ha === 'center' || estilo.ha === 'right' || estilo.ha === 'left' ? estilo.ha : formato.alinear;
        return { ref, estilo, valor, formato, alinear };
      });
      // Desborde como Excel: el texto que no cabe invade celdas vacías vecinas
      // (a la derecha si va a la izquierda, a ambos lados si va centrado, a la izquierda
      // si va a la derecha) y dentro del tramo no se dibujan bordes ni cuadrícula.
      const desborda = new Map<number, string>();
      const sinDerecho = new Set<number>();
      const sinIzquierdo = new Set<number>();
      base.forEach((celda, i) => {
        if (celda.valor.tipo !== 'texto' || celda.estilo.wr) return;
        const sobra = medirTexto(celda.formato.texto, celda.estilo) + 6 - cols[i].ancho;
        if (sobra <= 0) return;
        let derecha = celda.alinear === 'left' ? sobra : celda.alinear === 'center' ? sobra / 2 : 0;
        let izquierda = celda.alinear === 'right' ? sobra : celda.alinear === 'center' ? sobra / 2 : 0;
        let desde = i;
        let hasta = i;
        while (derecha > 0 && hasta + 1 < base.length && base[hasta + 1].valor.tipo === 'vacio') derecha -= cols[++hasta].ancho;
        while (izquierda > 0 && desde - 1 >= 0 && base[desde - 1].valor.tipo === 'vacio') izquierda -= cols[--desde].ancho;
        if (desde === hasta) return;
        for (let k = desde; k < hasta; k++) sinDerecho.add(k);
        for (let k = desde + 1; k <= hasta; k++) sinIzquierdo.add(k);
        desborda.set(i, celda.alinear === 'center' ? 'center' : celda.alinear === 'right' ? 'flex-end' : 'flex-start');
      });
      return {
        n,
        alto: altoFila(hoja, n),
        celdas: base.map(({ ref, estilo, formato, alinear }, i) => {
        const css: string[] = [];
        if (estilo.bg) css.push(`background:${estilo.bg}`);
        if (formato.rojo) css.push('color:#FF0000');
        else if (estilo.fc) css.push(`color:${estilo.fc}`);
        if (estilo.b) css.push('font-weight:700');
        if (estilo.i) css.push('font-style:italic');
        if (estilo.u) css.push('text-decoration:underline');
        if (estilo.sz) css.push(`font-size:${estilo.sz}pt`);
        if (estilo.fn) css.push(`font-family:'${estilo.fn.replace(/'/g, '')}',Arial,sans-serif`);
        if (estilo.va === 'top' || estilo.va === 'center') css.push(`vertical-align:${estilo.va === 'center' ? 'middle' : 'top'}`);
        if (estilo.wr) css.push('white-space:normal;overflow-wrap:anywhere');
        css.push(`text-align:${alinear}`);
        // Bordes: derecho/inferior como borde real; superior/izquierdo como sombra interior
        // (así no compiten con la cuadrícula de la celda vecina). Como en Excel, una celda
        // con relleno oculta su cuadrícula, y dentro de un desborde no hay líneas.
        const bordes = grosores(estilo.bd);
        const oculto = estilo.bg ?? 'transparent';
        if (sinDerecho.has(i)) css.push(`border-right-color:${oculto}`);
        else if (bordes.r) css.push(`border-right:${bordes.r}px solid #000`);
        else if (estilo.bg) css.push(`border-right-color:${estilo.bg}`);
        if (bordes.b) css.push(`border-bottom:${bordes.b}px solid #000`);
        else if (estilo.bg) css.push(`border-bottom-color:${estilo.bg}`);
        const sombras: string[] = [];
        if (bordes.t) sombras.push(`inset 0 ${bordes.t}px 0 #000`);
        if (bordes.l && !sinIzquierdo.has(i)) sombras.push(`inset ${bordes.l}px 0 0 #000`);
        if (sombras.length) css.push(`box-shadow:${sombras.join(',')}`);
        return {
          ref,
          texto: formato.texto,
          simbolo: formato.simbolo,
          css: css.join(';'),
          clase: desborda.has(i) ? 'desborda' : '',
          flujo: desborda.get(i),
        };
      }),
      };
    }),
  };
}

let lienzo: CanvasRenderingContext2D | null | undefined;

/** Ancho en px del texto con la fuente de la celda (0 si no hay canvas, p. ej. en pruebas). */
function medirTexto(texto: string, estilo: EstiloLibro): number {
  if (lienzo === undefined) {
    try {
      lienzo = document.createElement('canvas').getContext('2d');
    } catch {
      lienzo = null;
    }
  }
  if (!lienzo) return 0;
  const familia = estilo.fn ? `'${estilo.fn.replace(/'/g, '')}', Arial, sans-serif` : 'Calibri, Carlito, Arial, sans-serif';
  lienzo.font = `${estilo.i ? 'italic ' : ''}${estilo.b ? '700 ' : ''}${estilo.sz ?? 11}pt ${familia}`;
  return lienzo.measureText(texto).width;
}

/** "t2r1b1" -> { t: 2, r: 1, b: 1 } (grosor en px por lado). */
function grosores(bd: string | undefined): Partial<Record<'t' | 'r' | 'b' | 'l', number>> {
  const lados: Partial<Record<'t' | 'r' | 'b' | 'l', number>> = {};
  for (const [, lado, grosor] of (bd ?? '').matchAll(/([trbl])(\d)/g)) lados[lado as 't' | 'r' | 'b' | 'l'] = Number(grosor);
  return lados;
}

/**
 * Inserta (o re-apunta) una referencia al final de una fórmula cuando la cola
 * espera una: tras `=`, un operador, `(`, `,`, `;` o `:`, o reemplazando la
 * referencia ya escrita en esa posición. Devuelve null si no es un punto válido.
 */
function insertarRefEnFormula(texto: string, ref: string): string | null {
  const m = /([=+\-*/^(,;:])(\s*)((?:'(?:[^']|'')*'!|[A-Za-z0-9_.áéíóúñ]+!)?[A-Za-z]{1,3}\d{1,7})?$/.exec(texto);
  if (!m) return null;
  if (m[3]) return texto.slice(0, texto.length - m[3].length) + ref;
  return texto + ref;
}

function horaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirLocal(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento local: el respaldo es solo una conveniencia.
  }
}

function leerRespaldo(): Respaldo | null {
  try {
    const raw = localStorage.getItem(CLAVE_RESPALDO);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Respaldo;
    const ok =
      parsed &&
      parsed.base &&
      parsed.actual &&
      typeof parsed.base.capturas === 'object' &&
      typeof parsed.actual.capturas === 'object';
    if (!ok) return null;
    parsed.base.formatos ??= {};
    parsed.actual.formatos ??= {};
    parsed.base.estructura ??= '[]';
    parsed.actual.estructura ??= '[]';
    parsed.base.pestanas ??= [];
    parsed.actual.pestanas ??= [];
    parsed.base.ordenPestanas ??= [];
    parsed.actual.ordenPestanas ??= [];
    return parsed;
  } catch {
    return null;
  }
}

function borrarRespaldo(): void {
  try {
    localStorage.removeItem(CLAVE_RESPALDO);
  } catch {
    // Ignorado.
  }
}

function crearIdPestana(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pestana-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mismasPestanas(a: PestanaPersonalizada[], b: PestanaPersonalizada[]): boolean {
  return a.length === b.length && a.every((p, i) => p.id === b[i]?.id && p.nombre === b[i]?.nombre);
}

function mismoOrden(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((nombre, i) => nombre === b[i]);
}
