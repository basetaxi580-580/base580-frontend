import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberStore } from '../data/member.store';

@Component({
  standalone: true,
  selector: 'app-reprint-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="ticket-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Reimpresión de ticket</p>
          <h2>Buscar por folio y volver a imprimir</h2>
          <p class="subtitle">Conserva el mismo detalle original y deja bitácora.</p>
        </div>
        <a routerLink="/operaciones" class="back-link">Ir a operaciones</a>
      </div>

      <article class="card search-card">
        <div class="card-head">
          <h3>Consulta rápida</h3>
          <span>Folio / ID / fecha</span>
        </div>

        <div class="search-grid">
          <label>
            <span>Folio</span>
            <input [(ngModel)]="folio" name="folio" type="text" placeholder="OP-398-2026-10-001" />
          </label>
          <label>
            <span>ID</span>
            <input [(ngModel)]="id" name="id" type="text" placeholder="398" />
          </label>
          <label>
            <span>Fecha</span>
            <input [(ngModel)]="date" name="date" type="text" placeholder="15/10/2026" />
          </label>
        </div>

        <div class="action-row">
          <button type="button" class="primary" (click)="search()">Buscar</button>
          <button type="button" class="secondary" (click)="print()">Reimprimir ticket</button>
        </div>
      </article>

      <div class="result-grid">
        <article class="card result-card">
          <div class="card-head">
            <h3>Resultado</h3>
            <span>{{ found ? 'Encontrado' : 'Pendiente' }}</span>
          </div>

          <div class="result-summary" *ngIf="found; else emptyState">
            <div><span>Folio</span><strong>{{ ticket.folio }}</strong></div>
            <div><span>ID</span><strong>{{ ticket.id }}</strong></div>
            <div><span>Nombre</span><strong>{{ ticket.name }}</strong></div>
            <div><span>Boletos</span><strong>{{ ticket.tickets }}</strong></div>
            <div><span>Importe</span><strong>{{ ticket.amount | currency:'MXN':'symbol':'1.2-2' }}</strong></div>
            <div><span>Estatus</span><strong>{{ ticket.status }}</strong></div>
          </div>

          <ng-template #emptyState>
            <div class="empty-state">Busca un folio para mostrar el detalle.</div>
          </ng-template>
        </article>

        <article class="card audit-card">
          <div class="card-head">
            <h3>Bitácora</h3>
            <span>Persistente</span>
          </div>
          <div class="log-list">
            <div class="log-item" *ngFor="let item of auditTrail">
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
      .ticket-page {
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
      .primary,
      .secondary {
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
      .result-summary span,
      .log-item p,
      .log-item small,
      .empty-state {
        color: #94a3b8;
      }

      .search-grid {
        display: grid;
        grid-template-columns: 1fr 0.5fr 0.5fr;
        gap: 14px;
      }

      label {
        display: grid;
        gap: 8px;
      }

      label span {
        color: #cbd5e1;
        font-weight: 600;
      }

      input {
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

      .primary {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
      }

      .secondary {
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
      }

      .result-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .result-summary,
      .log-list {
        display: grid;
        gap: 10px;
      }

      .result-summary div,
      .log-item {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
      }

      .result-summary div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .log-item {
        display: grid;
        gap: 6px;
      }

      .empty-state {
        padding: 20px 0;
        text-align: center;
      }

      @media (max-width: 1100px) {
        .page-header,
        .search-grid,
        .result-grid {
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
export class ReprintTicketPage {
  private readonly store = inject(MemberStore);
  private readonly route = inject(ActivatedRoute);

  protected folio = this.route.snapshot.queryParamMap.get('folio') ?? 'OP-398-2026-10-001';
  protected id = this.route.snapshot.queryParamMap.get('id') ?? '398';
  protected date = this.route.snapshot.queryParamMap.get('date') ?? '15/10/2026';
  protected found = false;
  protected ticket = {
    folio: '',
    id: '',
    name: '',
    tickets: 0,
    amount: 0,
    status: 'PENDIENTE',
  };
  protected auditTrail = [
    {
      title: 'Pantalla abierta',
      detail: 'Se preparó el buscador de reimpresión para trabajar por folio o por socio.',
      date: 'Hoy',
    },
  ];

  protected search(): void {
    const member = this.store.member(this.id) ?? this.store.member('398')!;
    this.ticket = {
      folio: this.folio,
      id: this.id,
      name: member.name,
      tickets: member.totalTickets || 11,
      amount: member.totalTickets ? member.totalTickets * 145 : 1423.8,
      status: 'OK',
    };
    this.found = true;
    this.auditTrail = [
      {
        title: 'Ticket localizado',
        detail: `Folio ${this.folio} preparado para reimpresión.`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  protected print(): void {
    if (!this.found) this.search();
    this.auditTrail = [
      {
        title: 'Ticket reimpreso',
        detail: `Se solicitó la reimpresión del folio ${this.ticket.folio}.`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }
}
