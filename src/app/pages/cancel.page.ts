import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberStore } from '../data/member.store';

@Component({
  standalone: true,
  selector: 'app-cancel-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="cancel-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Cancelación</p>
          <h2>Anular una operación sin borrar historial</h2>
          <p class="subtitle">La cancelación queda guardada con motivo y evidencia.</p>
        </div>
        <a routerLink="/operaciones" class="back-link">Ir a operaciones</a>
      </div>

      <div class="cancel-grid">
        <article class="card search-card">
          <div class="card-head">
            <h3>Localizar operación</h3>
            <span>Folio, ID o fecha</span>
          </div>

          <div class="search-grid">
            <label>
              <span>Folio</span>
              <input [(ngModel)]="folio" name="folio" type="text" />
            </label>
            <label>
              <span>ID</span>
              <input [(ngModel)]="id" name="id" type="text" />
            </label>
            <label>
              <span>Motivo</span>
              <select [(ngModel)]="reason" name="reason">
                <option value="Error de captura">Error de captura</option>
                <option value="Operación duplicada">Operación duplicada</option>
                <option value="Solicitud del usuario">Solicitud del usuario</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
          </div>

          <label class="notes-field">
            <span>Observaciones</span>
            <textarea [(ngModel)]="notes" name="notes" rows="4"></textarea>
          </label>

          <div class="action-row">
            <button type="button" class="danger" (click)="cancel()">Cancelar operación</button>
          </div>
        </article>

        <article class="card detail-card">
          <div class="card-head">
            <h3>Detalle encontrado</h3>
            <span>{{ canceled ? 'Cancelada' : 'Activa' }}</span>
          </div>

          <div class="detail-list">
            <div><span>Folio</span><strong>{{ folio }}</strong></div>
            <div><span>ID</span><strong>{{ id }}</strong></div>
            <div><span>Usuario</span><strong>{{ member.name }}</strong></div>
            <div><span>Importe</span><strong>{{ amount | currency:'MXN':'symbol':'1.2-2' }}</strong></div>
            <div><span>Razón</span><strong>{{ reason }}</strong></div>
            <div><span>Estatus</span><strong>{{ canceled ? 'CANCELADA' : 'PENDIENTE' }}</strong></div>
          </div>
        </article>
      </div>

      <article class="card audit-card">
        <div class="card-head">
          <h3>Bitácora de cancelación</h3>
          <span>Persistente</span>
        </div>

        <div class="audit-list">
          <div class="audit-item" *ngFor="let item of auditTrail">
            <strong>{{ item.title }}</strong>
            <p>{{ item.detail }}</p>
            <small>{{ item.date }}</small>
          </div>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .cancel-page {
        display: grid;
        gap: 18px;
        color: #e2e8f0;
      }

      .page-header {
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
      p {
        margin: 0;
      }

      .subtitle {
        margin-top: 8px;
        color: #cbd5e1;
      }

      .back-link,
      .danger {
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 700;
        border: 0;
      }

      .back-link {
        text-decoration: none;
        color: #dbeafe;
        background: rgba(37, 99, 235, 0.18);
      }

      .card {
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
      .detail-list span,
      .audit-item p,
      .audit-item small {
        color: #94a3b8;
      }

      .cancel-grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
      }

      .search-grid,
      .detail-list,
      .audit-list {
        display: grid;
        gap: 12px;
      }

      label {
        display: grid;
        gap: 8px;
      }

      label span {
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

      .action-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 16px;
      }

      .danger {
        background: rgba(239, 68, 68, 0.22);
        color: #fecaca;
      }

      .detail-list div,
      .audit-item {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
      }

      .detail-list div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .audit-card {
        display: grid;
        gap: 14px;
      }

      .audit-item {
        display: grid;
        gap: 6px;
      }

      .notes-field {
        margin-top: 14px;
      }

      @media (max-width: 1100px) {
        .page-header,
        .cancel-grid {
          grid-template-columns: 1fr;
          flex-direction: column;
        }

        .page-header {
          display: flex;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class CancelPage {
  private readonly store = inject(MemberStore);
  private readonly route = inject(ActivatedRoute);

  protected folio = this.route.snapshot.queryParamMap.get('folio') ?? 'OP-398-2026-10-001';
  protected id = this.route.snapshot.queryParamMap.get('id') ?? '398';
  protected reason = 'Error de captura';
  protected notes = '';
  protected amount = 1423.8;
  protected canceled = false;
  protected member = this.store.member(this.id) ?? this.store.member('398')!;
  protected auditTrail = [
    {
      title: 'Cancelación preparada',
      detail: 'Se cargó el formulario de anulación para validar el motivo antes de ejecutar la acción.',
      date: 'Hoy',
    },
  ];

  protected cancel(): void {
    this.canceled = true;
    this.member = this.store.member(this.id) ?? this.store.member('398')!;
    this.store.addAudit(this.id, {
      title: 'Operación cancelada',
      detail: `Folio ${this.folio} anulado por ${this.reason}.`,
      date: 'Ahora',
    }, 'cancelacion');

    this.auditTrail = [
      {
        title: 'Operación cancelada',
        detail: `${this.folio} anulado por ${this.reason}. ${this.notes || 'Sin observaciones adicionales.'}`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }
}
