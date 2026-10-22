import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
        <div>
          <p class="eyebrow">Captura</p>
          <h2>{{ model.name }}</h2>
          <p class="subtitle">ID {{ model.id }}</p>
        </div>
      </div>

      <article class="capture-card">
        <div class="card-head">
          <h3>Datos operativos</h3>
          <span>Sitio, placas, engomado y vigencia</span>
        </div>

        <div class="form-grid">
          <label>
            <span>Sitio</span>
            <input [(ngModel)]="model.site" name="site" type="text" />
          </label>
          <label>
            <span>Placas</span>
            <input [(ngModel)]="model.plate" name="plate" type="text" />
          </label>
          <label>
            <span>Engomado</span>
            <input [(ngModel)]="model.sticker" name="sticker" type="text" />
          </label>
          <label>
            <span>Fecha de vencimiento</span>
            <input [(ngModel)]="model.expiry" name="expiry" type="text" />
          </label>
          <label>
            <span>Estatus</span>
            <select [(ngModel)]="model.status" name="status">
              <option value="OK">OK</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </label>
        </div>

        <label class="notes-field">
          <span>Observaciones</span>
          <textarea [(ngModel)]="model.notes" name="notes" rows="4"></textarea>
        </label>

        <div class="action-row">
          <button type="button" class="primary" (click)="save()">Guardar cambios</button>
          <button type="button" class="secondary" (click)="reset()">Restaurar</button>
        </div>
        <p class="save-note" *ngIf="saved">Cambios guardados.</p>
      </article>
    </section>
  `,
  styles: [
    `
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
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MemberStore);
  private readonly sync = inject(BackendSyncService);

  private readonly memberId = this.route.snapshot.paramMap.get('id') ?? '398';
  private baseline = structuredClone(this.store.member(this.memberId) ?? this.store.member('398')!);

  protected model: MemberProfile = structuredClone(this.baseline);
  protected saved = false;

  protected save(): void {
    this.store.updateMember(this.memberId, {
      site: this.model.site,
      plate: this.model.plate,
      sticker: this.model.sticker,
      expiry: this.model.expiry,
      status: this.model.status,
      notes: this.model.notes,
    });
    const stored = this.store.member(this.memberId);
    this.baseline = structuredClone(stored ?? this.model);
    this.model = structuredClone(this.baseline);
    void this.sync.saveToBackend();
    this.saved = true;
  }

  protected reset(): void {
    this.model = structuredClone(this.baseline);
    this.saved = false;
  }
}
