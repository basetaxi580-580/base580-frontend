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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BoletosLibroApiService, ConflictoLibro, EstadoLibro } from '../data/boletos-libro-api.service';
import { parseTsv } from './boletos-grid';
import {
  EstiloLibro,
  HojaLibro,
  LibroJson,
  MotorLibro,
  altoFila,
  anchoColumna,
  columnasDeHoja,
  filasDeHoja,
  formatear,
  fusionarCapturas,
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
type EstadoGuardado = 'cargando' | 'guardado' | 'guardando' | 'pendiente' | 'error' | 'sin-conexion';
type Respaldo = { base: Record<string, string>; actual: Record<string, string> };

const CLAVE_RESPALDO = 'boletos-libro-respaldo';
const CLAVE_HOJA = 'boletos-libro-hoja';
const MAX_HISTORIAL = 50;
const MAX_CONFLICTOS = 5;
/** Ancho de la columna de números de fila (igual al de `col.c-num`). */
const ANCHO_NUMEROS = 40;

@Component({
  selector: 'app-boletos-libro',
  imports: [RouterLink],
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
          <button type="button" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" [disabled]="!puedeDeshacer()" (click)="deshacerCambio()">↶</button>
          <button type="button" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" [disabled]="!puedeRehacer()" (click)="rehacerCambio()">↷</button>
          @if (confirmandoRestaurar()) {
            <span class="confirmar">¿Restaurar {{ nombreVisible() }} al Excel original?</span>
            <button type="button" class="peligro" (click)="restaurarHoja()">Sí, restaurar</button>
            <button type="button" (click)="confirmandoRestaurar.set(false)">No</button>
          } @else {
            <button type="button" [disabled]="!hojaConCapturas()" (click)="confirmandoRestaurar.set(true)">Restaurar hoja</button>
          }
          <a routerLink="/boletos/anterior">Versión anterior</a>
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
            [readOnly]="protegidaActiva()"
            (input)="escribirBarra($event)"
            (keydown)="teclaBarra($event)"
            (blur)="confirmarBarra()"
          />
          @if (protegidaActiva()) {
            <span class="candado" title="Celda con fórmula del Excel: se calcula sola">🔒 Fórmula</span>
          }
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
                  <th [class.activa]="ci === sel().col">{{ c.letra }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (f of v.filas; track f.n; let fi = $index) {
                <tr [style.height.px]="f.alto">
                  <th class="fila-h" [class.activa]="fi === sel().fila">{{ f.n }}</th>
                  @for (c of f.celdas; track c.ref; let ci = $index) {
                    <td
                      [class]="c.clase"
                      [class.sel]="fi === sel().fila && ci === sel().col"
                      [style]="c.css"
                      (mousedown)="seleccionar(fi, ci, $event)"
                      (dblclick)="editarActual()"
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

        <nav class="pestanas" aria-label="Hojas del libro">
          @for (h of hojas(); track h.name) {
            <button type="button" [class.activa]="h.name === hoja()?.name" [style.--tab]="h.tab" (click)="irAHoja(h.name)">
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
    </section>
  `,
  styles: `
    /* contain: el ancho de la tabla no empuja el layout; el scroll queda dentro de la rejilla. */
    :host { display: block; contain: inline-size; }
    .libro { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
    h1 { margin: 0; font-size: 1.25rem; color: #3a214e; }
    .fuente { font-size: 0.8rem; color: #7c3aed; }
    .acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .acciones button, .acciones a { border: 1px solid rgba(124, 58, 237, 0.25); background: #fff; color: #7c3aed; border-radius: 10px; padding: 6px 10px; font-weight: 700; font-size: 0.85rem; text-decoration: none; cursor: pointer; }
    .acciones button:disabled { opacity: 0.45; cursor: default; }
    .acciones .peligro { background: #b91c1c; border-color: #b91c1c; color: #fff; }
    .confirmar { font-size: 0.85rem; color: #3a214e; }
    .estado { font-size: 0.8rem; padding: 4px 10px; border-radius: 999px; background: #ede9fe; color: #5b21b6; }
    .estado.guardado { background: #dcfce7; color: #166534; }
    .estado.error, .estado.sin-conexion { background: #fee2e2; color: #991b1b; }
    .fx { display: flex; align-items: center; gap: 6px; border: 1px solid #d4d4d4; background: #fff; border-radius: 8px; padding: 4px 6px; }
    .ref { min-width: 56px; padding-right: 6px; border-right: 1px solid #e5e5e5; text-align: center; font: 600 13px Calibri, Carlito, Arial, sans-serif; }
    .fx-ico { font-style: italic; color: #6b7280; }
    .fx-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font: 14px Calibri, Carlito, Arial, sans-serif; }
    .candado { white-space: nowrap; font-size: 0.75rem; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 2px 6px; }
    .rejilla { overflow: auto; max-height: calc(100vh - 250px); min-height: 320px; border: 1px solid #d4d4d4; background: #fff; outline: none; }
    .rejilla:focus-visible { box-shadow: 0 0 0 2px rgba(33, 115, 70, 0.35); }
    table { border-collapse: separate; border-spacing: 0; table-layout: fixed; font: 11pt Calibri, Carlito, Arial, sans-serif; color: #000; }
    col.c-num { width: 40px; }
    th { background: #f3f3f3; color: #444; font: 400 12px Calibri, Carlito, Arial, sans-serif; border-right: 1px solid #d4d4d4; border-bottom: 1px solid #d4d4d4; user-select: none; }
    thead th { position: sticky; top: 0; z-index: 3; height: 20px; }
    .fila-h { position: sticky; left: 0; z-index: 2; text-align: center; }
    .esquina { left: 0; z-index: 4; }
    th.activa { background: #d3e9dc; color: #0f5132; font-weight: 700; }
    td { position: relative; padding: 0 3px; overflow: hidden; white-space: nowrap; vertical-align: bottom; border-right: 1px solid #e1e1e1; border-bottom: 1px solid #e1e1e1; cursor: cell; }
    td.desborda { overflow: visible; }
    .flujo { display: flex; width: 100%; }
    .flujo .txt { flex: none; position: relative; z-index: 1; white-space: nowrap; }
    td.sel { box-shadow: inset 0 0 0 2px #217346 !important; z-index: 2; }
    .contable { display: flex; justify-content: space-between; gap: 4px; }
    .editor { position: absolute; inset: 0; z-index: 5; width: 100%; height: 100%; box-sizing: border-box; padding: 0 2px; border: 2px solid #217346; outline: none; background: #fff; font: inherit; }
    .pestanas { display: flex; gap: 2px; overflow-x: auto; padding-bottom: 4px; }
    .pestanas button { flex: 0 0 auto; white-space: nowrap; cursor: pointer; padding: 6px 12px; border: 1px solid #d4d4d4; border-top: 3px solid var(--tab, #d4d4d4); border-radius: 0 0 6px 6px; background: #f3f3f3; color: #333; font: 600 13px Calibri, Carlito, Arial, sans-serif; }
    .pestanas button.activa { background: #fff; color: #217346; box-shadow: inset 0 -2px 0 #217346; }
    .aviso { position: fixed; right: 20px; bottom: 20px; z-index: 50; max-width: 340px; padding: 10px 14px; border-radius: 12px; background: #3a214e; color: #fff; font-size: 0.9rem; }
    .error { color: #991b1b; }
    .cargando { color: #7c3aed; }
  `,
})
export class BoletosLibroPage implements OnInit {
  private readonly api = inject(BoletosLibroApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rejilla = viewChild<ElementRef<HTMLDivElement>>('rejilla');
  private readonly editor = viewChild<ElementRef<HTMLInputElement>>('editor');

  protected readonly motor = signal<MotorLibro | null>(null);
  protected readonly hojaNombre = signal('');
  /** Se incrementa en cada cambio de capturas para recalcular la vista. */
  protected readonly cambios = signal(0);
  protected readonly sel = signal<Seleccion>({ fila: 0, col: 0 });
  /** Texto del editor en celda; null cuando no se edita. */
  protected readonly editando = signal<string | null>(null);
  protected readonly estado = signal<EstadoGuardado>('cargando');
  protected readonly actualizado = signal<string | null>(null);
  protected readonly aviso = signal('');
  protected readonly errorCarga = signal('');
  protected readonly confirmandoRestaurar = signal(false);
  private readonly historial = signal({ deshacer: 0, rehacer: 0 });

  protected readonly hojas = computed(() => this.motor()?.hojas ?? []);
  protected readonly hoja = computed<HojaLibro | null>(() => {
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
    return Object.keys(motor.capturas()).some((clave) => clave.startsWith(`${hoja.name}!`));
  });
  protected readonly puedeDeshacer = computed(() => this.historial().deshacer > 0);
  protected readonly puedeRehacer = computed(() => this.historial().rehacer > 0);
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
  private guardando = false;
  private repetir = false;
  private conflictos = 0;
  private timerGuardado: ReturnType<typeof setTimeout> | null = null;
  private timerAviso: ReturnType<typeof setTimeout> | null = null;
  private pilaDeshacer: Record<string, string>[] = [];
  private pilaRehacer: Record<string, string>[] = [];
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

  @HostListener('window:beforeunload', ['$event'])
  protected antesDeSalir(event: BeforeUnloadEvent): void {
    const motor = this.motor();
    if (motor && !mismasCapturas(motor.capturas(), this.base)) event.preventDefault();
  }

  protected irAHoja(nombre: string): void {
    this.confirmarEdicion();
    this.confirmarBarra();
    this.hojaNombre.set(nombre);
    this.sel.set({ fila: 0, col: 0 });
    this.confirmandoRestaurar.set(false);
    escribirLocal(CLAVE_HOJA, nombre);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { hoja: nombre.trim() }, replaceUrl: true });
    this.enfocarRejilla();
  }

  protected seleccionar(fila: number, col: number, event: MouseEvent): void {
    if (event.button !== 0) return;
    if (this.editando() !== null && fila === this.sel().fila && col === this.sel().col) return;
    // Confirmar antes de mover la selección: el blur del editor llega después del mousedown.
    this.confirmarEdicion();
    this.confirmarBarra();
    this.sel.set({ fila, col });
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
    this.bufferBarra = (event.target as HTMLInputElement).value;
    const hoja = this.hoja();
    const ref = this.refActiva();
    if (!this.objetivoBarra && hoja && ref) this.objetivoBarra = { hoja: hoja.name, ref };
  }

  protected teclaBarra(event: KeyboardEvent): void {
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
    this.pilaRehacer.push(motor.capturas());
    motor.reemplazarCapturas(previo);
    this.trasCambio();
  }

  protected rehacerCambio(): void {
    const motor = this.motor();
    const siguiente = this.pilaRehacer.pop();
    if (!motor || !siguiente) return;
    this.pilaDeshacer.push(motor.capturas());
    motor.reemplazarCapturas(siguiente);
    this.trasCambio();
  }

  protected restaurarHoja(): void {
    this.confirmandoRestaurar.set(false);
    const motor = this.motor();
    const hoja = this.hoja();
    if (!motor || !hoja) return;
    const antes = motor.capturas();
    const despues = Object.fromEntries(Object.entries(antes).filter(([clave]) => !clave.startsWith(`${hoja.name}!`)));
    if (mismasCapturas(antes, despues)) return;
    this.registrarDeshacer(antes);
    motor.reemplazarCapturas(despues);
    this.trasCambio();
    this.avisar(`${hoja.name.trim()} quedó como en el Excel original.`);
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
    const antes = motor.capturas();
    for (const cambio of cambios) {
      if (motor.protegida(cambio.hoja, cambio.ref)) continue;
      if (motor.textoEdicion(cambio.hoja, cambio.ref) === cambio.texto) continue;
      motor.establecer(cambio.hoja, cambio.ref, cambio.texto);
    }
    if (mismasCapturas(antes, motor.capturas())) return;
    this.registrarDeshacer(antes);
    this.trasCambio();
  }

  private registrarDeshacer(antes: Record<string, string>): void {
    this.pilaDeshacer.push(antes);
    if (this.pilaDeshacer.length > MAX_HISTORIAL) this.pilaDeshacer.shift();
    this.pilaRehacer = [];
  }

  private trasCambio(): void {
    this.cambios.update((n) => n + 1);
    this.historial.set({ deshacer: this.pilaDeshacer.length, rehacer: this.pilaRehacer.length });
    this.respaldar();
    this.programarGuardado();
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
          const combinadas = fusionarCapturas(estado.capturas, respaldo.base, respaldo.actual);
          if (!mismasCapturas(combinadas, estado.capturas)) {
            motor.reemplazarCapturas(combinadas);
            this.cambios.update((n) => n + 1);
            this.avisar('Se recuperaron cambios que no se habían guardado.');
            this.programarGuardado();
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
          motor.reemplazarCapturas(respaldo.actual);
          this.base = respaldo.base;
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
    this.actualizado.set(estado.actualizado);
    this.motor()?.reemplazarCapturas(this.base);
    this.cambios.update((n) => n + 1);
  }

  private programarGuardado(): void {
    if (this.estado() !== 'sin-conexion') this.estado.set('pendiente');
    if (this.timerGuardado) clearTimeout(this.timerGuardado);
    this.timerGuardado = setTimeout(() => this.guardar(), 800);
  }

  private guardar(): void {
    const motor = this.motor();
    if (!motor) return;
    if (this.guardando) {
      this.repetir = true;
      return;
    }
    const capturas = motor.capturas();
    if (mismasCapturas(capturas, this.base) && this.version !== null) {
      this.estado.set('guardado');
      borrarRespaldo();
      return;
    }
    this.guardando = true;
    this.estado.set('guardando');
    this.api.guardar(capturas, this.version).subscribe({
      next: (estado) => {
        this.guardando = false;
        this.conflictos = 0;
        this.version = estado.version;
        this.base = { ...(estado.capturas ?? {}) };
        this.actualizado.set(estado.actualizado);
        if (this.repetir || !mismasCapturas(motor.capturas(), this.base)) {
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
          const combinadas = fusionarCapturas(conflicto.capturas ?? {}, this.base, motor.capturas());
          this.version = conflicto.version;
          this.base = { ...(conflicto.capturas ?? {}) };
          motor.reemplazarCapturas(combinadas);
          this.cambios.update((n) => n + 1);
          this.avisar('Otro equipo guardó cambios: se combinaron con los tuyos.');
          this.guardar();
          return;
        }
        this.estado.set(error.status === 0 ? 'sin-conexion' : 'error');
        this.timerGuardado = setTimeout(() => this.guardar(), 5000);
      },
    });
  }

  /** Trae cambios de otros equipos cuando aquí no hay nada pendiente. */
  private sondear(): void {
    const motor = this.motor();
    if (!motor || this.guardando || this.editando() !== null) return;
    if (this.estado() === 'cargando' || !mismasCapturas(motor.capturas(), this.base)) return;
    this.api.estado().subscribe({
      next: (estado) => {
        if (estado.version === this.version || !mismasCapturas(motor.capturas(), this.base)) return;
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
    const respaldo: Respaldo = { base: this.base, actual: motor.capturas() };
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
    return parsed && typeof parsed.base === 'object' && typeof parsed.actual === 'object' ? parsed : null;
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
