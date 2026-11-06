import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AppStateDto, BackendSyncService } from '../data/backend-api.service';
import { MemberStore, MemberProfile } from '../data/member.store';

@Component({
  standalone: true,
  selector: 'app-capture-page',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="capture-page">
      <div class="capture-header">
        <p class="eyebrow">Captura</p>
        <h2>Socios</h2>
      </div>
      <div *ngIf="sync.loadStatus() !== 'ready'" role="alert">
        <p *ngIf="sync.loadStatus() === 'loading'">Cargando datos del servidor…</p>
        <p *ngIf="sync.loadStatus() === 'error'">No se pudo cargar el estado del servidor. La captura está bloqueada para proteger los datos.</p>
        <button type="button" *ngIf="sync.loadStatus() === 'error'" [disabled]="busy || sync.pendingChanges()" (click)="reload()">Recargar desde el servidor</button>
      </div>
      <nav *ngIf="sync.loadStatus() === 'ready'" class="action-row" aria-label="Opciones de captura">
        <button type="button" class="secondary" [disabled]="busy" (click)="showList()">Lista</button>
        <button type="button" class="primary" [disabled]="busy || (viewingCurrent && !!draft)" (click)="create()">Crear socio</button>
        <button type="button" class="secondary" [disabled]="busy" (click)="compareCurrent()">Ver versión actual</button>
        <button type="button" class="secondary" *ngIf="draft" [disabled]="busy" (click)="showDraft()">Ver mi borrador</button>
        <button type="button" class="primary" *ngIf="draft" [disabled]="busy" (click)="publish()">Publicar mi borrador</button>
      </nav>
      <article class="capture-card" *ngIf="remoteState">
        <h3>Cambios en la versión actual</h3>
        <p>Si abres la versión actual, cambiará lo que ves en esta página. El borrador guardado se conservará; los cambios del formulario que aún no hayas guardado se perderán.</p>
        <ul><li *ngFor="let change of remoteChanges">{{ change }}</li></ul>
        <div class="action-row">
          <button type="button" class="primary" (click)="showCurrent()">Sí, ver versión actual</button>
          <button type="button" class="secondary" *ngIf="draft" (click)="rebaseDraft()">Actualizar mi borrador con la versión actual</button>
          <button type="button" class="secondary" (click)="remoteState = null">Cancelar</button>
        </div>
      </article>
      <p class="save-note" role="status" *ngIf="message">{{ message }}</p>
      <div *ngIf="syncError" role="alert">
        <p>{{ syncError }}</p>
        <button type="button" [disabled]="busy" (click)="retry()">Reintentar sincronización</button>
      </div>

      <article class="capture-card" *ngIf="sync.loadStatus() === 'ready' && view === 'list'">
        <div class="card-head"><h3>Lista de socios</h3></div>
        <p *ngIf="members.length === 0">No hay socios capturados.</p>
        <div class="member-row" *ngFor="let member of members">
          <div><strong>{{ member.name }}</strong><p>ID {{ member.id }} · {{ member.status }}</p></div>
          <div class="action-row">
            <button type="button" class="secondary" [disabled]="busy || (viewingCurrent && !!draft)" (click)="edit(member.id)">Editar</button>
            <button type="button" class="secondary" [disabled]="busy || (viewingCurrent && !!draft)" (click)="remove(member)">Eliminar</button>
          </div>
        </div>
      </article>

      <article class="capture-card" *ngIf="sync.loadStatus() === 'ready' && view === 'form'">
        <div class="card-head"><h3>{{ editingId ? 'Editar socio' : 'Crear socio' }}</h3></div>
        <div class="form-grid">
          <label><span>ID *</span><input [(ngModel)]="model.id" name="id" type="text" [readonly]="!!editingId" maxlength="100" /></label>
          <label><span>Nombre *</span><input [(ngModel)]="model.name" name="name" type="text" maxlength="200" /></label>
          <label><span>Sitio</span><input [(ngModel)]="model.site" name="site" type="text" /></label>
          <label><span>Placas</span><input [(ngModel)]="model.plate" name="plate" type="text" /></label>
          <label><span>Engomado</span><input [(ngModel)]="model.sticker" name="sticker" type="text" /></label>
          <label><span>Fecha de vencimiento</span><input [(ngModel)]="model.expiry" name="expiry" type="text" /></label>
          <label><span>Estatus</span><select [(ngModel)]="model.status" name="status">
            <option value="OK">OK</option><option value="PENDIENTE">PENDIENTE</option><option value="INACTIVO">INACTIVO</option>
          </select></label>
        </div>
        <label class="notes-field"><span>Observaciones</span><textarea [(ngModel)]="model.notes" name="notes" rows="4"></textarea></label>
        <p *ngIf="validationError" role="alert">{{ validationError }}</p>
        <div class="action-row">
          <button type="button" class="primary" [disabled]="busy" (click)="save()">Guardar</button>
          <button type="button" class="secondary" [disabled]="busy" (click)="reset()">Restaurar</button>
          <button type="button" class="secondary" [disabled]="busy" (click)="showList()">Cancelar</button>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .member-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 0; border-bottom: 1px solid #eee; }
      .member-row .action-row { margin-top: 0; }
      .capture-page {
        display: grid;
        gap: 18px;
        max-width: 760px;
        color: #463255;
      }

      .eyebrow {
        margin: 0 0 8px;
        color: #c02686;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        font-weight: 700;
      }

      h2,
      h3,
      p {
        margin: 0;
      }

      .subtitle {
        margin-top: 8px;
        color: #7d6792;
      }

      .capture-card {
        border: 1px solid rgba(236, 72, 153, 0.12);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.72);
        padding: 18px;
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .card-head span {
        color: #8f7aa8;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      label {
        display: grid;
        gap: 8px;
      }

      label span {
        font-size: 0.92rem;
        color: #7d6792;
        font-weight: 600;
      }

      input,
      select,
      textarea {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(168, 85, 247, 0.18);
        background: rgba(255, 255, 255, 0.9);
        color: #3a214e;
        padding: 12px 14px;
        outline: none;
      }

      textarea {
        resize: vertical;
      }

      .notes-field {
        margin-top: 14px;
      }

      .action-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 16px;
      }

      .action-row button {
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 700;
      }

      .action-row .primary {
        background: linear-gradient(135deg, #ec4899, #a855f7);
        color: white;
      }

      .action-row .secondary {
        background: rgba(37, 99, 235, 0.18);
        color: #1d4ed8;
      }

      .save-note {
        margin-top: 12px;
        color: #166534;
        font-weight: 600;
      }

      @media (max-width: 768px) {
        .card-head,
        .action-row {
          flex-direction: column;
          align-items: stretch;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }

        .action-row button {
          width: 100%;
        }
      }
    `,
  ],
})
export class CapturePage implements OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MemberStore);
  protected readonly sync = inject(BackendSyncService);

  protected view: 'list' | 'form' = 'list';
  protected editingId: string | null = null;
  protected model: MemberProfile = this.emptyMember();
  private baseline: MemberProfile = structuredClone(this.model);
  protected message = '';
  protected validationError = '';
  protected syncError = '';
  protected busy = false;
  protected draft: { base: AppStateDto; state: AppStateDto } | null = null;
  protected remoteState: AppStateDto | null = null;
  protected remoteChanges: string[] = [];
  private readonly draftKey = 'base580-captura-borrador-v1';
  protected viewingCurrent = false;

  constructor() {
    try {
      const saved = localStorage.getItem(this.draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft?.base && Array.isArray(draft?.state?.members)) {
          this.draft = draft;
          this.store.applyState(draft.state);
        }
      }
    } catch { this.syncError = 'No se pudo recuperar el borrador local.'; }
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id && this.sync.loadStatus() === 'ready') this.edit(id);
      else this.showList();
      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    const shared = this.sync.currentServerState();
    if (this.draft && shared) this.store.applyState(shared);
  }

  protected get members(): MemberProfile[] { return this.store.membersList(); }

  private emptyMember(): MemberProfile {
    return { id: '', name: '', memberType: '', employee: '', site: '', plate: '', sticker: '', expiry: '',
      status: 'PENDIENTE', dayTickets: 0, nightTickets: 0, totalTickets: 0,
      nightSaving: 'N/A', personalSaving: 'N/A', cardPayment: 'N/A', history: [], notes: '' };
  }

  protected showList(): void {
    this.view = 'list';
    this.validationError = '';
    this.message = '';
  }

  protected create(): void {
    if (this.sync.loadStatus() !== 'ready') return;
    this.editingId = null;
    this.baseline = this.emptyMember();
    this.reset();
    this.view = 'form';
  }

  protected edit(id: string): void {
    if (this.sync.loadStatus() !== 'ready') return;
    const member = this.store.member(id);
    if (!member) {
      this.showList();
      this.validationError = `No se encontró el socio con ID ${id}.`;
      this.message = this.validationError;
      return;
    }
    this.editingId = id;
    this.baseline = structuredClone(member);
    this.reset();
    this.view = 'form';
  }

  protected async save(): Promise<void> {
    if (this.sync.loadStatus() !== 'ready' || this.busy) return;
    const id = this.model.id.trim();
    const name = this.model.name.trim();
    if (!id || !name) {
      this.validationError = 'El ID y el nombre son obligatorios.';
      return;
    }
    if (!this.editingId && this.store.member(id)) {
      this.validationError = 'Ya existe un socio con ese ID.';
      return;
    }
    if (this.editingId) {
      if (!this.store.member(this.editingId)) {
        this.validationError = 'El socio ya no existe. Vuelve a la lista.';
        return;
      }
      this.store.updateMember(this.editingId, { name, site: this.model.site, plate: this.model.plate,
        sticker: this.model.sticker, expiry: this.model.expiry, status: this.model.status, notes: this.model.notes });
    } else if (!this.store.createMember({ ...this.model, id, name })) {
      this.validationError = 'No se pudo crear el socio; verifica el ID y el nombre.';
      return;
    }
    this.editingId = id;
    this.baseline = structuredClone(this.store.member(id)!);
    this.model = structuredClone(this.baseline);
    this.validationError = '';
    this.saveDraft();
  }

  protected async remove(member: MemberProfile): Promise<void> {
    if (this.sync.loadStatus() !== 'ready' || this.busy) return;
    if (!window.confirm(`¿Eliminar al socio ${member.name} (ID ${member.id})?`)) return;
    if (!this.store.deleteMember(member.id)) {
      this.message = 'El socio ya no existe.';
      return;
    }
    this.saveDraft();
  }

  protected async reload(): Promise<void> {
    if (this.busy || this.sync.pendingChanges()) return;
    this.busy = true;
    try {
      await this.sync.reloadFromBackend();
      const id = this.route.snapshot?.paramMap.get('id');
      if (id) this.edit(id);
      else this.showList();
    } catch {
      // El estado de carga muestra el error y permite otro intento.
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  protected async retry(): Promise<void> { await this.publish(); }

  private saveDraft(): void {
    const base = this.draft?.base ?? this.sync.currentServerState();
    if (!base) { this.syncError = 'No se conoce la versión original del servidor.'; return; }
    const draft = { base, state: this.store.snapshot() };
    try {
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
      this.draft = draft;
      this.viewingCurrent = false;
      this.syncError = '';
      this.message = 'Borrador guardado en este navegador. Aún no está publicado.';
    } catch { this.syncError = 'No se pudo guardar el borrador en este navegador.'; }
  }

  protected async compareCurrent(): Promise<void> {
    this.busy = true;
    try {
      const current = await this.sync.readCurrent();
      const base = this.draft?.base ?? this.sync.currentServerState();
      this.remoteChanges = this.describeChanges(base, current);
      this.remoteState = current;
      this.syncError = '';
    } catch { this.syncError = 'No se pudo consultar la versión actual.'; }
    finally { this.busy = false; this.changeDetector.markForCheck(); }
  }

  private describeChanges(base: AppStateDto | null, current: AppStateDto): string[] {
    if (!base) return ['No hay una versión anterior para comparar.'];
    const labels: Record<string, string> = { name: 'Nombre', memberType: 'Tipo de socio', employee: 'Empleado', site: 'Sitio', plate: 'Placas', sticker: 'Engomado', expiry: 'Vencimiento', status: 'Estatus', notes: 'Observaciones', dayTickets: 'Boletos diurnos', nightTickets: 'Boletos nocturnos', totalTickets: 'Boletos totales', nightSaving: 'Ahorro nocturno', personalSaving: 'Ahorro personal', cardPayment: 'Pago con tarjeta' };
    const before = new Map(base.members.map(m => [m.id, m]));
    const after = new Map(current.members.map(m => [m.id, m]));
    const changes: string[] = [];
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const a = before.get(id), b = after.get(id);
      if (!a) { changes.push(`Socio ${id} agregado: ${b?.name}`); continue; }
      if (!b) { changes.push(`Socio ${id} eliminado: ${a.name}`); continue; }
      for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
        const field = key as keyof typeof a;
        if (a[field] !== b[field]) changes.push(`Socio ${id}, ${labels[key]}: ${a[field] || '—'} → ${b[field] || '—'}`);
      }
      if (JSON.stringify(a) !== JSON.stringify(b) && !changes.some(change => change.startsWith(`Socio ${id},`))) changes.push(`Socio ${id}: otros datos cambiaron.`);
    }
    if (JSON.stringify(base.catalogs) !== JSON.stringify(current.catalogs)) changes.push('Los catálogos cambiaron.');
    if (JSON.stringify(base.auditTrail) !== JSON.stringify(current.auditTrail)) changes.push('La auditoría cambió.');
    return changes.length ? changes : ['No hay cambios en los datos respecto de tu versión inicial.'];
  }

  protected showCurrent(): void {
    if (!this.remoteState) return;
    if (this.draft) this.store.applyState(this.remoteState);
    else this.sync.syncLocalState(this.remoteState);
    this.viewingCurrent = true;
    this.remoteState = null;
    this.showList();
    this.message = this.draft ? 'Ves la versión actual. Tu borrador sigue guardado en este navegador.' : 'Ves la versión actual.';
  }

  protected showDraft(): void {
    if (!this.draft) return;
    this.store.applyState(this.draft.state);
    this.viewingCurrent = false;
    this.showList();
    this.message = 'Ves tu borrador local.';
  }

  protected rebaseDraft(): void {
    if (!this.draft || !this.remoteState) return;
    const { base, state: local } = this.draft;
    const remote = this.remoteState;
    const merged = structuredClone(remote);
    const original = new Map(base.members.map(member => [member.id, member]));
    const edits = new Map(local.members.map(member => [member.id, member]));
    const current = new Map(merged.members.map(member => [member.id, member]));
    const conflicts: string[] = [];
    const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    for (const id of new Set([...original.keys(), ...edits.keys()])) {
      const prior = original.get(id), edited = edits.get(id), actual = current.get(id);
      if (equal(prior, edited)) continue;
      if (!prior || !edited || !actual) {
        if (!equal(prior, actual) && !equal(edited, actual)) conflicts.push(`Socio ${id}: creación o eliminación`);
        if (edited) current.set(id, structuredClone(edited)); else current.delete(id);
        continue;
      }
      const result = structuredClone(actual) as unknown as Record<string, unknown>;
      const oldFields = prior as unknown as Record<string, unknown>;
      const newFields = edited as unknown as Record<string, unknown>;
      const actualFields = actual as unknown as Record<string, unknown>;
      for (const key of Object.keys(newFields)) {
        if (equal(oldFields[key], newFields[key])) continue;
        if (!equal(oldFields[key], actualFields[key]) && !equal(newFields[key], actualFields[key])) conflicts.push(`Socio ${id}: ${key}`);
        result[key] = structuredClone(newFields[key]);
      }
      current.set(id, result as unknown as MemberProfile);
    }
    merged.members = [...current.values()];
    for (const id of new Set([...Object.keys(base.auditTrail), ...Object.keys(local.auditTrail)])) {
      if (equal(base.auditTrail[id], local.auditTrail[id])) continue;
      if (!equal(base.auditTrail[id], remote.auditTrail[id]) && !equal(local.auditTrail[id], remote.auditTrail[id])) conflicts.push(`Socio ${id}: auditoría`);
      if (local.auditTrail[id]) merged.auditTrail[id] = structuredClone(local.auditTrail[id]);
      else delete merged.auditTrail[id];
    }
    const warning = conflicts.length ? `Hay cambios en los mismos datos: ${conflicts.join(', ')}. Se conservarán tus valores locales en esos campos.` : 'Se incorporarán los cambios actuales y se conservarán tus cambios locales.';
    if (!window.confirm(`${warning}\n\nEsto actualiza tu borrador local; aún tendrás que publicarlo. ¿Continuar?`)) return;
    const draft = { base: structuredClone(remote), state: merged };
    try {
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
      this.draft = draft;
      this.remoteState = null;
      this.showDraft();
      this.message = 'Borrador actualizado con la versión actual. Revísalo antes de publicarlo.';
    } catch { this.syncError = 'No se pudo actualizar el borrador en este navegador.'; }
  }

  protected async publish(): Promise<void> {
    if (!this.draft || this.busy) return;
    const draft = this.draft;
    this.busy = true;
    try {
      const result = await this.sync.publishDraft(draft.state, draft.base);
      localStorage.removeItem(this.draftKey);
      this.draft = null;
      this.remoteState = null;
      this.viewingCurrent = false;
      this.message = `Borrador publicado correctamente.`;
      this.syncError = '';
      this.store.applyState(result);
    } catch (error: any) {
      this.syncError = error?.status === 409 ? 'La versión actual cambió. Tu borrador sigue guardado; consulta los cambios antes de continuar.' : 'No se pudo publicar. Tu borrador sigue guardado en este navegador.';
      if (error?.status === 409) {
        try { const current = await this.sync.readCurrent(); this.remoteChanges = this.describeChanges(draft.base, current); this.remoteState = current; } catch { /* el borrador sigue disponible */ }
      }
    } finally { this.busy = false; this.changeDetector.markForCheck(); }
  }

  protected reset(): void {
    this.model = structuredClone(this.baseline);
    this.validationError = '';
    this.message = '';
  }
}
