import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberStore, MemberProfile } from '../data/member.store';

@Component({
  standalone: true,
  selector: 'app-capture-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="capture-page">
      <div class="capture-header">
        <div>
          <p class="eyebrow">Captura y edición operativa</p>
          <h2>{{ model.name }}</h2>
          <p class="subtitle">ID {{ model.id }} · {{ model.memberType }}</p>
        </div>

        <div class="header-actions">
          <span class="status-pill" [class.ok]="model.status === 'OK'" [class.warn]="model.status === 'PENDIENTE'" [class.bad]="model.status === 'INACTIVO'">
            {{ model.status }}
          </span>
          <a routerLink="/socio/{{ model.id }}" class="back-link">Ver ficha</a>
        </div>
      </div>

      <div class="capture-grid">
        <article class="capture-card form-card">
          <div class="card-head">
            <h3>Datos editables</h3>
            <span>Guardar y dejar historial</span>
          </div>

          <div class="form-grid">
            <label>
              <span>Nombre</span>
              <input [(ngModel)]="model.name" name="name" type="text" />
            </label>
            <label>
              <span>Tipo de socio</span>
              <input [(ngModel)]="model.memberType" name="memberType" type="text" />
            </label>
            <label>
              <span>Empleado</span>
              <input [(ngModel)]="model.employee" name="employee" type="text" />
            </label>
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
        </article>

        <article class="capture-card summary-card">
          <div class="card-head">
            <h3>Resumen operativo</h3>
            <span>Lectura rápida</span>
          </div>

          <div class="summary-list">
            <div><span>ID</span><strong>{{ model.id }}</strong></div>
            <div><span>Nombre</span><strong>{{ model.name }}</strong></div>
            <div><span>Placas</span><strong>{{ model.plate }}</strong></div>
            <div><span>Engomado</span><strong>{{ model.sticker }}</strong></div>
            <div><span>Sitio</span><strong>{{ model.site }}</strong></div>
            <div><span>Vencimiento</span><strong>{{ model.expiry }}</strong></div>
          </div>

          <div class="mini-history">
            <h4>Últimos cambios</h4>
            <div *ngFor="let item of model.history" class="history-item">
              <strong>{{ item.title }}</strong>
              <p>{{ item.detail }}</p>
              <small>{{ item.date }}</small>
            </div>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .capture-page {
        display: grid;
        gap: 18px;
        color: #e2e8f0;
      }

      .capture-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
      }

      .eyebrow {
        margin: 0 0 8px;
        color: #93c5fd;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        font-weight: 700;
      }

      h2,
      h3,
      h4,
      p {
        margin: 0;
      }

      .subtitle {
        margin-top: 8px;
        color: #cbd5e1;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .status-pill,
      .back-link,
      .action-row button {
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 700;
      }

      .status-pill {
        background: rgba(148, 163, 184, 0.16);
        color: #e2e8f0;
      }

      .status-pill.ok {
        background: rgba(34, 197, 94, 0.16);
        color: #86efac;
      }

      .status-pill.warn {
        background: rgba(245, 158, 11, 0.18);
        color: #fde68a;
      }

      .status-pill.bad {
        background: rgba(239, 68, 68, 0.18);
        color: #fecaca;
      }

      .back-link {
        text-decoration: none;
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
      }

      .capture-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 16px;
      }

      .capture-card {
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 20px;
        background: rgba(30, 41, 59, 0.56);
        padding: 18px;
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .card-head span,
      .history-item small,
      .history-item p,
      .summary-list span {
        color: #94a3b8;
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
        color: #cbd5e1;
        font-weight: 600;
      }

      input,
      select,
      textarea {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.72);
        color: #f8fafc;
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
      }

      .action-row .primary {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
      }

      .action-row .secondary {
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
      }

      .summary-card {
        display: grid;
        gap: 14px;
      }

      .summary-list {
        display: grid;
        gap: 10px;
      }

      .summary-list div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 11px 12px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
      }

      .mini-history {
        display: grid;
        gap: 12px;
      }

      .history-item {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
        display: grid;
        gap: 6px;
      }

      @media (max-width: 1100px) {
        .capture-grid,
        .form-grid {
          grid-template-columns: 1fr;
        }

        .capture-header {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class CapturePage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MemberStore);

  private readonly memberId = this.route.snapshot.paramMap.get('id') ?? '398';
  private readonly original = this.store.member(this.memberId) ?? this.store.member('398')!;

  protected model: MemberProfile = structuredClone(this.original);

  protected save(): void {
    this.store.updateMember(this.memberId, structuredClone(this.model));
    this.store.addHistory(this.memberId, {
      title: 'Cambios guardados',
      detail: 'Se actualizó la ficha operativa del socio desde la pantalla de captura.',
      date: 'Ahora',
    });
  }

  protected reset(): void {
    this.model = structuredClone(this.original);
  }
}
