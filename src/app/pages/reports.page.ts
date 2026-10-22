import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

type ReportRow = {
  no: number;
  date: string;
  id: string;
  name: string;
  folioOperacion: string;
  numCred: string;
  numBoletos: number;
  subtotal: number;
  descuentos: number;
  abonoRecurrente: number;
  abonoPrincipal: number;
  comision: number;
  pagoTarjeta: number;
  formaPago: string;
  usuario: string;
};

@Component({
  standalone: true,
  selector: 'app-reports-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="reports-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Reportes</p>
          <h2>Reporte de Operaciones por ID</h2>
          <p class="subtitle">Filtra por ID y rango de fechas, luego exporta a PDF.</p>
        </div>
        <a routerLink="/inicio" class="back-link">Volver al inicio</a>
      </div>

      <article class="card filters-card">
        <div class="card-head">
          <h3>Filtros</h3>
          <span>Operativo</span>
        </div>

        <div class="filters-grid">
          <label>
            <span>ID</span>
            <input [(ngModel)]="filterId" name="filterId" type="text" placeholder="35" />
          </label>
          <label>
            <span>Fecha inicial</span>
            <input [(ngModel)]="startDate" name="startDate" type="date" />
          </label>
          <label>
            <span>Fecha final</span>
            <input [(ngModel)]="endDate" name="endDate" type="date" />
          </label>
        </div>

        <div class="action-row">
          <button type="button" class="primary" (click)="generate()">Generar reporte</button>
          <button type="button" class="secondary" (click)="exportPdf()">Exportar PDF</button>
        </div>
      </article>

      <article class="card summary-card">
        <div class="card-head">
          <h3>{{ reportTitle }}</h3>
          <span>{{ filteredRows.length }} registros</span>
        </div>

        <div class="summary-grid">
          <div><span>Boletos</span><strong>{{ totalBoletos }}</strong></div>
          <div><span>Subtotal</span><strong>{{ subtotal | currency:'MXN':'symbol':'1.2-2' }}</strong></div>
          <div><span>Descuentos</span><strong>{{ descuentos | currency:'MXN':'symbol':'1.2-2' }}</strong></div>
          <div><span>Abono principal</span><strong>{{ abonoPrincipal | currency:'MXN':'symbol':'1.2-2' }}</strong></div>
          <div><span>Comisión</span><strong>{{ comision | currency:'MXN':'symbol':'1.2-2' }}</strong></div>
          <div><span>Pago tarjeta</span><strong>{{ pagoTarjeta | currency:'MXN':'symbol':'1.2-2' }}</strong></div>
        </div>
      </article>

      <article class="card table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Folio Operación</th>
                <th>Num. de Cred.</th>
                <th>Num. Boletos</th>
                <th>Subtotal</th>
                <th>Descuentos</th>
                <th>Abono Recurrente</th>
                <th>Abono Principal</th>
                <th>Comisión</th>
                <th>Pago de Tarjeta</th>
                <th>Forma de Pago</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of filteredRows">
                <td>{{ row.no }}</td>
                <td class="folio-cell">{{ row.folioOperacion }}</td>
                <td>{{ row.numCred }}</td>
                <td>{{ row.numBoletos }}</td>
                <td>{{ row.subtotal | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>{{ row.descuentos | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>{{ row.abonoRecurrente | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>{{ row.abonoPrincipal | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>{{ row.comision | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>{{ row.pagoTarjeta | currency:'MXN':'symbol':'1.2-2' }}</td>
                <td>{{ row.formaPago }}</td>
                <td>{{ row.usuario }}</td>
              </tr>
              <tr *ngIf="!filteredRows.length">
                <td colspan="12" class="empty-state">No hay registros para los filtros seleccionados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card audit-card">
        <div class="card-head">
          <h3>Bitácora del reporte</h3>
          <span>PDF listo</span>
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
      .reports-page {
        display: grid;
        gap: 18px;
        color: #43324f;
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
        border: 1px solid rgba(236, 72, 153, 0.12);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.88);
        padding: 18px;
        box-shadow: 0 14px 30px rgba(176, 89, 152, 0.08);
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .card-head span,
      .summary-grid span,
      .audit-item p,
      .audit-item small,
      .empty-state,
      .folio-cell {
        color: #8b6f96;
      }

      .filters-grid {
        display: grid;
        grid-template-columns: 0.6fr 0.7fr 0.7fr;
        gap: 14px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 10px;
      }

      .summary-grid div {
        padding: 12px 14px;
        border-radius: 14px;
        background: #fff7fb;
        border: 1px solid rgba(236, 72, 153, 0.1);
        display: grid;
        gap: 4px;
      }

      .summary-grid strong {
        color: #f8fafc;
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
        border: 1px solid rgba(216, 180, 208, 0.8);
        background: #fff;
        color: #3a214e;
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
        background: rgba(236, 72, 153, 0.08);
        color: #a21caf;
      }

      .table-wrap {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1500px;
      }

      th,
      td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        white-space: nowrap;
      }

      th {
        color: #6b4f82;
        font-size: 0.9rem;
      }

      td {
        color: #3a214e;
      }

      .empty-state {
        text-align: center;
        padding: 22px 0;
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
        background: #fff7fb;
        border: 1px solid rgba(236, 72, 153, 0.1);
        display: grid;
        gap: 6px;
      }

      @media (max-width: 1200px) {
        .filters-grid,
        .summary-grid {
          grid-template-columns: 1fr;
        }

        .page-header {
          display: flex;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ReportsPage {
  private readonly route = inject(ActivatedRoute);

  protected filterId = this.route.snapshot.queryParamMap.get('id') ?? '35';
  protected startDate = this.route.snapshot.queryParamMap.get('start') ?? '2024-01-11';
  protected endDate = this.route.snapshot.queryParamMap.get('end') ?? '2024-06-01';

  private readonly rows: ReportRow[] = [
    {
      no: 1,
      date: '2024-01-11',
      id: '35',
      name: 'DAVID GONZALEZ GARCIA',
      folioOperacion: '1791310700000398',
      numCred: '398',
      numBoletos: 11,
      subtotal: 1423.8,
      descuentos: 0,
      abonoRecurrente: 0,
      abonoPrincipal: 0,
      comision: 0,
      pagoTarjeta: 1423.8,
      formaPago: 'Tarjeta',
      usuario: 'Miguel Rios Bravo',
    },
    {
      no: 2,
      date: '2024-02-13',
      id: '35',
      name: 'DAVID GONZALEZ GARCIA',
      folioOperacion: '1791310700000402',
      numCred: '398',
      numBoletos: 9,
      subtotal: 1161,
      descuentos: 0,
      abonoRecurrente: 0,
      abonoPrincipal: 0,
      comision: 0,
      pagoTarjeta: 1161,
      formaPago: 'Efectivo',
      usuario: 'Miguel Rios Bravo',
    },
    {
      no: 3,
      date: '2024-03-22',
      id: '35',
      name: 'DAVID GONZALEZ GARCIA',
      folioOperacion: '1791310700000440',
      numCred: '398',
      numBoletos: 10,
      subtotal: 1291.5,
      descuentos: 0,
      abonoRecurrente: 0,
      abonoPrincipal: 0,
      comision: 0,
      pagoTarjeta: 1291.5,
      formaPago: 'Tarjeta',
      usuario: 'Miguel Rios Bravo',
    },
    {
      no: 4,
      date: '2024-05-18',
      id: '35',
      name: 'DAVID GONZALEZ GARCIA',
      folioOperacion: '1791310700000511',
      numCred: '398',
      numBoletos: 8,
      subtotal: 1033.2,
      descuentos: 0,
      abonoRecurrente: 0,
      abonoPrincipal: 0,
      comision: 0,
      pagoTarjeta: 1033.2,
      formaPago: 'Tarjeta',
      usuario: 'Miguel Rios Bravo',
    },
  ];

  protected filteredRows: ReportRow[] = [...this.rows];
  protected reportTitle = this.makeTitle();
  protected auditTrail = [
    {
      title: 'Pantalla preparada',
      detail: 'Se cargó el reporte de operaciones por ID con un conjunto de ejemplo para validar el flujo.',
      date: 'Hoy',
    },
  ];

  protected get totalBoletos(): number {
    return this.filteredRows.reduce((sum, row) => sum + row.numBoletos, 0);
  }

  protected get subtotal(): number {
    return this.filteredRows.reduce((sum, row) => sum + row.subtotal, 0);
  }

  protected get descuentos(): number {
    return this.filteredRows.reduce((sum, row) => sum + row.descuentos, 0);
  }

  protected get abonoPrincipal(): number {
    return this.filteredRows.reduce((sum, row) => sum + row.abonoPrincipal, 0);
  }

  protected get comision(): number {
    return this.filteredRows.reduce((sum, row) => sum + row.comision, 0);
  }

  protected get pagoTarjeta(): number {
    return this.filteredRows.reduce((sum, row) => sum + row.pagoTarjeta, 0);
  }

  protected generate(): void {
    const start = this.startDate ? new Date(this.startDate) : null;
    const end = this.endDate ? new Date(this.endDate) : null;
    const id = this.filterId.trim();

    this.filteredRows = this.rows.filter((row) => {
      const rowDate = new Date(row.date);
      const matchesId = !id || row.id === id;
      const matchesStart = !start || rowDate >= start;
      const matchesEnd = !end || rowDate <= end;
      return matchesId && matchesStart && matchesEnd;
    });

    this.reportTitle = this.makeTitle();
    this.auditTrail = [
      {
        title: 'Reporte generado',
        detail: `ID ${this.filterId || 'todos'} · ${this.filteredRows.length} registros listos para exportación PDF.`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  protected exportPdf(): void {
    this.generate();
    globalThis.window?.print();
    this.auditTrail = [
      {
        title: 'Exportación solicitada',
        detail: 'Se abrió la impresión del navegador para guardar el reporte como PDF.',
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);
  }

  private makeTitle(): string {
    return `Reporte de Operaciones por ID ${this.filterId || 'todos'} del ${this.startDate} al ${this.endDate}`;
  }
}
