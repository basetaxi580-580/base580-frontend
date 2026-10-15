import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberStore, MemberProfile } from '../data/member.store';

type OperationLine = {
  terminal: string;
  folio: string;
  zone: string;
  tickets: number;
  price: number;
  total: number;
};

@Component({
  standalone: true,
  selector: 'app-operations-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="operations-page">
      <div class="operations-header">
        <div>
          <p class="eyebrow">Operaciones y tickets</p>
          <h2>{{ member.name }}</h2>
          <p class="subtitle">ID {{ member.id }} · {{ member.memberType }}</p>
        </div>
        <div class="header-actions">
          <a routerLink="/socio/{{ member.id }}" class="back-link">Ver socio</a>
          <span class="folio-pill">Folio {{ operationFolio }}</span>
        </div>
      </div>

      <div class="operations-grid">
        <article class="operations-card member-card">
          <div class="card-head">
            <h3>Datos de referencia</h3>
            <span>{{ member.status }}</span>
          </div>

          <div class="member-summary">
            <div>
              <span>Placas</span>
              <strong>{{ member.plate }}</strong>
            </div>
            <div>
              <span>Engomado</span>
              <strong>{{ member.sticker }}</strong>
            </div>
            <div>
              <span>Sitio</span>
              <strong>{{ member.site }}</strong>
            </div>
            <div>
              <span>Vencimiento</span>
              <strong>{{ member.expiry }}</strong>
            </div>
          </div>

          <div class="member-stats">
            <div>
              <span>Boletos</span>
              <strong>{{ member.totalTickets }}</strong>
            </div>
            <div>
              <span>Ahorro personal</span>
              <strong>{{ member.personalSaving }}</strong>
            </div>
            <div>
              <span>Pago tarjeta</span>
              <strong>{{ member.cardPayment }}</strong>
            </div>
          </div>
        </article>

        <article class="operations-card form-card">
          <div class="card-head">
            <h3>Captura de línea</h3>
            <span>Terminal, zona y boletos</span>
          </div>

          <div class="line-form">
            <label>
              <span>Terminal</span>
              <select [(ngModel)]="draftTerminal" name="terminal">
                <option *ngFor="let option of terminalOptions" [value]="option.code">
                  {{ option.code }} · {{ option.label }}
                </option>
              </select>
            </label>
            <label>
              <span>Zona</span>
              <input [(ngModel)]="draftZone" name="zone" type="text" placeholder="8" />
            </label>
            <label>
              <span>Num. Boletos</span>
              <input [(ngModel)]="draftTickets" name="tickets" type="number" min="1" />
            </label>
            <div class="preview-box">
              <span>Precio calculado</span>
              <strong>{{ priceForTerminal(draftTerminal) | currency:'MXN':'symbol':'1.2-2' }}</strong>
            </div>
          </div>

          <div class="action-row">
            <button type="button" class="primary" (click)="addLine()">Agregar línea</button>
            <button type="button" class="secondary" (click)="clearDraft()">Limpiar</button>
          </div>
        </article>
      </div>

      <article class="operations-card table-card">
        <div class="card-head">
          <h3>Detalle de operación</h3>
          <span>{{ lines.length }} líneas</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Terminal</th>
                <th>Folio</th>
                <th>Zona</th>
                <th>Num. Boletos</th>
                <th>Precio</th>
                <th>Total</th>
                <th>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let line of lines; let i = index">
                <td>{{ line.terminal }}</td>
                <td>{{ line.folio }}</td>
                <td>{{ line.zone }}</td>
                <td>{{ line.tickets }}</td>
                <td>{{ line.price | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>{{ line.total | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>
                  <button type="button" class="link-danger" (click)="removeLine(i)">Eliminar</button>
                </td>
              </tr>
              <tr *ngIf="!lines.length">
                <td colspan="7" class="empty-state">Sin líneas capturadas.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="totals-row">
          <div>
            <span>Totales</span>
            <strong>{{ totalTickets }}</strong>
          </div>
          <div>
            <span>Importe total</span>
            <strong>{{ grandTotal | currency:'MXN':'symbol':'1.2-2' }}</strong>
          </div>
        </div>
      </article>

      <div class="footer-actions">
        <button type="button" class="primary" (click)="updateOperation()">Actualizar</button>
        <button type="button" class="secondary" (click)="cancelOperation()">Cancelar</button>
        <button type="button" class="success" (click)="generateTicket()">Generar ticket</button>
      </div>

      <article class="operations-card audit-card">
        <div class="card-head">
          <h3>Historial de la operación</h3>
          <span>Persistente</span>
        </div>

        <div class="audit-list">
          <div class="audit-item" *ngFor="let entry of auditTrail">
            <strong>{{ entry.title }}</strong>
            <p>{{ entry.detail }}</p>
            <small>{{ entry.date }}</small>
          </div>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .operations-page {
        display: grid;
        gap: 18px;
        color: #e2e8f0;
      }

      .operations-header {
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

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .back-link,
      .folio-pill,
      .action-row button,
      .footer-actions button,
      .link-danger {
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 700;
      }

      .back-link {
        text-decoration: none;
        color: #dbeafe;
        background: rgba(37, 99, 235, 0.18);
      }

      .folio-pill {
        background: rgba(245, 158, 11, 0.16);
        color: #fde68a;
      }

      .operations-grid {
        display: grid;
        grid-template-columns: 0.8fr 1.2fr;
        gap: 16px;
      }

      .operations-card {
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
      .member-summary span,
      .member-stats span,
      .audit-item p,
      .audit-item small,
      .empty-state {
        color: #94a3b8;
      }

      .member-summary,
      .member-stats {
        display: grid;
        gap: 10px;
      }

      .member-summary div,
      .member-stats div,
      .preview-box {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
      }

      .member-stats {
        margin-top: 14px;
      }

      .line-form {
        display: grid;
        grid-template-columns: 1fr 0.8fr 0.9fr 1fr;
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
      select {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.72);
        color: #f8fafc;
        padding: 12px 14px;
        outline: none;
      }

      .preview-box {
        align-self: end;
        flex-direction: column;
        justify-content: center;
      }

      .action-row,
      .footer-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .action-row {
        margin-top: 16px;
      }

      .action-row button,
      .footer-actions button,
      .link-danger {
        border: 0;
      }

      .primary {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
      }

      .secondary {
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
      }

      .success {
        background: rgba(34, 197, 94, 0.18);
        color: #bbf7d0;
      }

      .table-wrap {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 780px;
      }

      th,
      td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      }

      th {
        color: #cbd5e1;
        font-size: 0.9rem;
      }

      td {
        color: #f8fafc;
      }

      .empty-state {
        text-align: center;
        padding: 22px 0;
      }

      .link-danger {
        background: rgba(239, 68, 68, 0.18);
        color: #fecaca;
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
      }

      .totals-row div {
        display: flex;
        gap: 10px;
      }

      .audit-card {
        display: grid;
        gap: 14px;
      }

      .audit-list {
        display: grid;
        gap: 12px;
      }

      .audit-item {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
        display: grid;
        gap: 6px;
      }

      @media (max-width: 1100px) {
        .operations-grid,
        .line-form {
          grid-template-columns: 1fr;
        }

        .operations-header {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class OperationsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MemberStore);

  private readonly memberId = this.route.snapshot.paramMap.get('id') ?? '398';
  protected readonly member: MemberProfile = this.store.member(this.memberId) ?? this.store.member('398')!;

  protected readonly operationFolio = `OP-${this.member.id}-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  protected readonly terminalOptions = [
    { code: 'P', label: 'Primera' },
    { code: 'T', label: 'Terminal' },
  ];

  protected draftTerminal = 'P';
  protected draftZone = '8';
  protected draftTickets = 1;
  protected lines: OperationLine[] = [
    this.buildLine('P', '8', 1),
    this.buildLine('T', '8', 10),
  ];
  protected auditTrail = [
    {
      title: 'Operación abierta',
      detail: 'Se cargó la ficha del socio y se preparó una nueva operación de ticketing.',
      date: 'Hoy',
    },
  ];

  protected get totalTickets(): number {
    return this.lines.reduce((sum, line) => sum + line.tickets, 0);
  }

  protected get grandTotal(): number {
    return this.lines.reduce((sum, line) => sum + line.total, 0);
  }

  protected priceForTerminal(code: string): number {
    switch (code) {
      case 'T':
        return 145;
      case 'P':
      default:
        return 173;
    }
  }

  protected addLine(): void {
    const line = this.buildLine(this.draftTerminal, this.draftZone, this.draftTickets);
    this.lines = [...this.lines, line];
    this.auditTrail = [
      {
        title: 'Línea agregada',
        detail: `${line.terminal} · zona ${line.zone} · ${line.tickets} boletos`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  protected removeLine(index: number): void {
    const removed = this.lines[index];
    this.lines = this.lines.filter((_, i) => i !== index);
    this.auditTrail = [
      {
        title: 'Línea eliminada',
        detail: `${removed.terminal} · zona ${removed.zone} · ${removed.tickets} boletos`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  protected clearDraft(): void {
    this.draftTerminal = 'P';
    this.draftZone = '8';
    this.draftTickets = 1;
  }

  protected updateOperation(): void {
    this.auditTrail = [
      {
        title: 'Operación actualizada',
        detail: `Totales recalculados para ${this.totalTickets} boletos y ${this.grandTotal.toFixed(2)} MXN.`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  protected cancelOperation(): void {
    this.lines = [];
    this.auditTrail = [
      {
        title: 'Operación cancelada',
        detail: 'La captura actual fue anulada sin eliminar historial.',
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  protected generateTicket(): void {
    this.store.addHistory(this.member.id, {
      title: 'Ticket generado',
      detail: `Se generó una operación por ${this.totalTickets} boletos con importe de ${this.grandTotal.toFixed(2)} MXN.`,
      date: 'Ahora',
    });

    this.auditTrail = [
      {
        title: 'Ticket generado',
        detail: `Folio ${this.operationFolio} listo para impresión/exportación.`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  private buildLine(terminal: string, zone: string, tickets: number): OperationLine {
    const price = this.priceForTerminal(terminal);
    const count = Math.max(1, Number(tickets) || 1);
    return {
      terminal,
      folio: `${this.operationFolio}-${this.lines.length + 1}`,
      zone,
      tickets: count,
      price,
      total: price * count,
    };
  }
}
