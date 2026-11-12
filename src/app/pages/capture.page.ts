import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BackendSyncService } from '../data/backend-api.service';
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
        <button type="button" [class.primary]="view === 'list'" [class.secondary]="view !== 'list'" [disabled]="busy" (click)="showList()">Lista</button>
        <button type="button" [class.primary]="view === 'form'" [class.secondary]="view !== 'form'" [disabled]="busy" (click)="create()">Crear socio</button>
      </nav>
      <p class="save-note" role="status" *ngIf="message">{{ message }}</p>
      <div *ngIf="syncError" role="alert">
        <p>{{ syncError }}</p>
        <button type="button" [disabled]="busy" (click)="reload()">Recargar desde el servidor</button>
      </div>

      <article class="capture-card" *ngIf="sync.loadStatus() === 'ready' && view === 'list'">
        <div class="card-head"><h3>Lista de socios</h3></div>
        <p *ngIf="members.length === 0">No hay socios capturados.</p>
        <div class="member-row" *ngFor="let member of members">
          <div class="member-main" role="button" tabindex="0" (click)="toggle(member.id)">
            <strong>{{ member.name }}</strong>
            <p>ID {{ member.id }} · {{ member.status }}<span class="chevron">{{ expandedId === member.id ? '▲' : '▼' }}</span></p>
          </div>
          <div class="member-detail" *ngIf="expandedId === member.id">
            <dl class="detail-grid">
              <div><dt>Sitio</dt><dd>{{ member.site || '—' }}</dd></div>
              <div><dt>Placas</dt><dd>{{ member.plate || '—' }}</dd></div>
              <div><dt>Engomado</dt><dd>{{ member.sticker || '—' }}</dd></div>
              <div><dt>Fecha de alta</dt><dd>{{ member.expiry || '—' }}</dd></div>
              <div><dt>Venc. Licencia</dt><dd>{{ member.licenseExpiry || '—' }}</dd></div>
              <div><dt>Venc. Seguro</dt><dd>{{ member.insuranceExpiry || '—' }}</dd></div>
              <div><dt>Celular</dt><dd>{{ member.phone || '—' }}</dd></div>
              <div><dt>Modelo</dt><dd>{{ member.vehicleYear || '—' }}</dd></div>
              <div><dt>Marca</dt><dd>{{ member.vehicleBrand || '—' }}</dd></div>
              <div><dt>Estatus</dt><dd>{{ member.status }}</dd></div>
              <div class="detail-full"><dt>Observaciones</dt><dd>{{ member.notes || '—' }}</dd></div>
            </dl>
            <div class="action-row">
              <button type="button" class="primary" [disabled]="busy" (click)="edit(member.id)">Editar</button>
              <button type="button" class="secondary" [disabled]="busy" (click)="remove(member)">Eliminar</button>
            </div>
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
          <label><span>Fecha de alta</span>
            <input [(ngModel)]="model.expiry" name="expiry" type="text"
              placeholder="aaaammdd" maxlength="8" pattern="\\d{8}"
              [title]="'Formato: AAAAMMDD (ej. 20261231)'" /></label>
          <label><span>Venc. Licencia</span>
            <input [(ngModel)]="model.licenseExpiry" name="licenseExpiry" type="text"
              placeholder="aaaammdd" maxlength="8" pattern="\\d{8}"
              [title]="'Formato: AAAAMMDD (ej. 20261231)'" /></label>
          <label><span>Venc. Seguro</span>
            <input [(ngModel)]="model.insuranceExpiry" name="insuranceExpiry" type="text"
              placeholder="aaaammdd" maxlength="8" pattern="\\d{8}"
              [title]="'Formato: AAAAMMDD (ej. 20261231)'" /></label>
          <label><span>Celular</span>
            <input [(ngModel)]="model.phone" name="phone" type="text" maxlength="20" /></label>
          <label><span>Modelo (año)</span>
            <select [(ngModel)]="model.vehicleYear" name="vehicleYear">
              <option value="">— Seleccionar —</option>
              <option *ngFor="let yr of vehicleYears" [value]="yr">{{ yr }}</option>
            </select></label>
          <label><span>Marca</span>
            <input [(ngModel)]="model.vehicleBrand" name="vehicleBrand" type="text" maxlength="60" /></label>
          <label><span>Estatus</span><select [(ngModel)]="model.status" name="status">
            <option value="OK">OK</option><option value="PENDIENTE">PENDIENTE</option><option value="INACTIVO">INACTIVO</option>
          </select></label>
        </div>
        <label class="notes-field"><span>Observaciones</span><textarea [(ngModel)]="model.notes" name="notes" rows="4"></textarea></label>
        <p *ngIf="validationError" role="alert">{{ validationError }}</p>
        <div class="action-row">
          <button type="button" class="primary" [disabled]="busy" (click)="save()">Guardar</button>
          <button type="button" class="secondary" [disabled]="busy" (click)="showList()">Cancelar</button>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      :host { display: block; width: 100%; }
      .member-row { padding: 14px 16px; border: 1px solid #eadff2; border-radius: 14px; background: #fbf9fd; transition: border-color .2s ease, background .2s ease; }
      .member-row + .member-row { margin-top: 10px; }
      .member-row:hover { border-color: #cfa9e2; background: #fff; }
      .member-main { cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
      .member-main p { display: flex; align-items: center; gap: 8px; color: #624779; }
      .member-main .chevron { font-size: 0.7rem; color: #8b3dba; }
      .member-detail { margin-top: 14px; padding-top: 14px; border-top: 1px solid #eadff2; }
      .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 18px; margin: 0 0 16px; }
      .detail-grid dt { font-size: 0.78rem; color: #765b8b; font-weight: 700; }
      .detail-grid dd { margin: 2px 0 0; color: #32223f; font-weight: 600; }
      .detail-full { grid-column: 1 / -1; }
      .member-row .action-row { margin-top: 0; }
      .capture-page {
        display: grid;
        gap: 18px;
        max-width: 880px;
        width: 100%;
        margin: 0 auto;
        color: #32223f;
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
        border: 1px solid #ddcce8;
        border-radius: 20px;
        background: #ffffff;
        padding: 22px;
        box-shadow: 0 14px 32px rgba(76, 37, 99, 0.08);
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
        padding-bottom: 14px;
        border-bottom: 1px solid #eee5f3;
      }

      .card-head span {
        color: #765b8b;
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
        color: #604473;
        font-weight: 600;
      }

      input,
      select,
      textarea {
        width: 100%;
        border-radius: 12px;
        border: 1px solid #cdb9dd;
        background: #fbf9fd;
        color: #32223f;
        padding: 12px 14px;
        outline: none;
        transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
      }

      input:hover,
      select:hover,
      textarea:hover { border-color: #b58bc9; background: #fff; }

      input:focus,
      select:focus,
      textarea:focus { border-color: #9b46bd; background: #fff; box-shadow: 0 0 0 3px rgba(155, 70, 189, 0.16); }

      input::placeholder,
      textarea::placeholder { color: #806b8d; }

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
        background: #f1eafa;
        color: #5b2b79;
        border: 1px solid #d9c5e8;
      }

      .save-note {
        margin-top: 12px;
        color: #166534;
        font-weight: 600;
      }

      [role='alert'] {
        padding: 12px 14px;
        border: 1px solid #efb7c7;
        border-radius: 12px;
        background: #fff5f7;
        color: #8c2342;
      }

      [role='status'] {
        padding: 12px 14px;
        border: 1px solid #b8dec7;
        border-radius: 12px;
        background: #f2fbf5;
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

        .capture-card { padding: 16px; }
      }
    `,
  ],
})
export class CapturePage {
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
  protected expandedId: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id && this.sync.loadStatus() === 'ready') this.edit(id);
      else this.showList();
      this.changeDetector.markForCheck();
    });
  }

  protected get members(): MemberProfile[] { return this.store.membersList(); }

  private emptyMember(): MemberProfile {
    return { id: '', name: '', memberType: '', employee: '', site: '', plate: '', sticker: '', expiry: '',
      status: 'PENDIENTE', dayTickets: 0, nightTickets: 0, totalTickets: 0,
      nightSaving: 'N/A', personalSaving: 'N/A', cardPayment: 'N/A', history: [], notes: '',
      licenseExpiry: '', insuranceExpiry: '', phone: '', vehicleYear: '', vehicleBrand: '' };
  }

  protected toggle(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
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
    const isEdit = !!this.editingId;
    if (isEdit && !this.store.member(this.editingId!)) {
      this.validationError = 'El socio ya no existe. Vuelve a la lista.';
      return;
    }
    if (isEdit) {
      this.store.updateMember(this.editingId!, { name, site: this.model.site, plate: this.model.plate,
        sticker: this.model.sticker, expiry: this.model.expiry, status: this.model.status, notes: this.model.notes,
        licenseExpiry: this.model.licenseExpiry, insuranceExpiry: this.model.insuranceExpiry,
        phone: this.model.phone, vehicleYear: this.model.vehicleYear, vehicleBrand: this.model.vehicleBrand });
    } else if (!this.store.createMember({ ...this.model, id, name })) {
      this.validationError = 'No se pudo crear el socio; verifica el ID y el nombre.';
      return;
    }
    this.validationError = '';
    this.busy = true;
    try {
      const result = await this.sync.saveToBackend();
      this.store.applyState(result);
      this.editingId = id;
      this.baseline = structuredClone(this.store.member(id)!);
      this.model = structuredClone(this.baseline);
      this.syncError = '';
      this.message = isEdit ? 'Socio actualizado y guardado en el servidor.' : 'Socio creado y guardado en el servidor.';
    } catch (error: any) {
      this.syncError = error?.status === 409
        ? 'La versión del servidor cambió. Recarga desde el servidor e inténtalo de nuevo.'
        : 'No se pudo guardar en el servidor. Revisa la conexión e inténtalo de nuevo.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  protected async remove(member: MemberProfile): Promise<void> {
    if (this.sync.loadStatus() !== 'ready' || this.busy) return;
    if (!window.confirm(`¿Eliminar al socio ${member.name} (ID ${member.id})?`)) return;
    if (!this.store.deleteMember(member.id)) {
      this.message = 'El socio ya no existe.';
      return;
    }
    this.busy = true;
    try {
      const result = await this.sync.saveToBackend();
      this.store.applyState(result);
      this.syncError = '';
      this.message = `Socio ${member.id} eliminado.`;
      this.showList();
    } catch (error: any) {
      this.syncError = error?.status === 409
        ? 'La versión del servidor cambió. Recarga desde el servidor e inténtalo de nuevo.'
        : 'No se pudo eliminar en el servidor. Recarga e inténtalo de nuevo.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  protected async reload(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.sync.reloadFromBackend();
      const id = this.route.snapshot?.paramMap.get('id');
      if (id) this.edit(id);
      else this.showList();
      this.syncError = '';
    } catch {
      // El estado de carga muestra el error y permite otro intento.
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  protected readonly vehicleYears: string[] = (() => {
    const yr = new Date().getFullYear();
    return Array.from({ length: yr - 1979 }, (_, i) => String(yr - i));
  })();

  protected reset(): void {
    this.model = structuredClone(this.baseline);
    this.validationError = '';
    this.message = '';
  }
}
