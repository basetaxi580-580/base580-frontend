import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
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
        <button type="button" class="secondary" [disabled]="busy" (click)="showList()">Lista</button>
        <button type="button" class="primary" [disabled]="busy" (click)="create()">Crear socio</button>
      </nav>
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
            <button type="button" class="secondary" [disabled]="busy" (click)="edit(member.id)">Editar</button>
            <button type="button" class="secondary" [disabled]="busy" (click)="remove(member)">Eliminar</button>
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

  constructor() {
    this.route.paramMap.subscribe((params) => {
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
    await this.persist();
  }

  protected async remove(member: MemberProfile): Promise<void> {
    if (this.sync.loadStatus() !== 'ready' || this.busy) return;
    if (!window.confirm(`¿Eliminar al socio ${member.name} (ID ${member.id})?`)) return;
    if (!this.store.deleteMember(member.id)) {
      this.message = 'El socio ya no existe.';
      return;
    }
    await this.persist();
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

  protected async retry(): Promise<void> {
    if (!this.busy && this.sync.loadStatus() === 'ready') await this.persist();
  }

  private async persist(): Promise<void> {
    this.busy = true;
    this.message = '';
    try {
      await this.sync.saveToBackend();
      this.syncError = '';
      this.message = 'Cambios guardados en el servidor.';
    } catch {
      this.syncError = 'No se pudo confirmar el guardado en el servidor. El cambio sigue en esta sesión; reintenta antes de salir.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  protected reset(): void {
    this.model = structuredClone(this.baseline);
    this.validationError = '';
    this.message = '';
  }
}
