import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberStore } from '../data/member.store';

type CheckItem = {
  title: string;
  detail: string;
  route: string;
  status: 'listo' | 'pendiente';
};

@Component({
  standalone: true,
  selector: 'app-validation-page',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="validation-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Sprint 10</p>
          <h2>Validación de flujos críticos</h2>
          <p class="subtitle">
            Revisión final de las rutas clave para entrar a producción local sin perder trazabilidad.
          </p>
        </div>
        <a routerLink="/inicio" class="back-link">Volver al inicio</a>
      </div>

      <article class="card summary-card">
        <div class="card-head">
          <h3>Estado general</h3>
          <span>Checklist operativo</span>
        </div>
        <div class="summary-grid">
          <div>
            <span>Listos</span>
            <strong>{{ readyCount }}</strong>
          </div>
          <div>
            <span>Pendientes</span>
            <strong>{{ pendingCount }}</strong>
          </div>
          <div>
            <span>Socios en base</span>
            <strong>{{ membersCount }}</strong>
          </div>
          <div>
            <span>Catálogos base</span>
            <strong>{{ catalogCount }}</strong>
          </div>
        </div>
      </article>

      <article class="card flow-card">
        <div class="card-head">
          <h3>Flujos a revisar</h3>
          <span>Click para entrar</span>
        </div>

        <div class="flow-list">
          <a *ngFor="let item of checks" class="flow-item" [routerLink]="item.route">
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.detail }}</p>
            </div>
            <span [class.ready]="item.status === 'listo'" [class.pending]="item.status === 'pendiente'">
              {{ item.status }}
            </span>
          </a>
        </div>
      </article>

      <article class="card note-card">
        <div class="card-head">
          <h3>Resultado esperado</h3>
          <span>UX</span>
        </div>
        <p>
          La interfaz debe permitir que el operador encuentre un socio, abra su ficha, capture cambios,
          genere operación, cancele o reimprima sin perder historial ni contexto.
        </p>
      </article>
    </section>
  `,
  styles: [
    `
      .validation-page {
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
      .card {
        border-radius: 20px;
      }

      .back-link {
        text-decoration: none;
        font-weight: 700;
        padding: 10px 14px;
        color: #dbeafe;
        background: rgba(37, 99, 235, 0.18);
      }

      .card {
        border: 1px solid rgba(148, 163, 184, 0.16);
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
      .summary-grid span,
      .flow-item p,
      .note-card p {
        color: #94a3b8;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .summary-grid div {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
        display: grid;
        gap: 4px;
      }

      .summary-grid strong {
        color: #f8fafc;
      }

      .flow-list {
        display: grid;
        gap: 10px;
      }

      .flow-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        text-decoration: none;
        color: inherit;
        padding: 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.12);
      }

      .flow-item span {
        align-self: center;
        padding: 8px 12px;
        border-radius: 999px;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.78rem;
      }

      .flow-item .ready {
        color: #bbf7d0;
        background: rgba(34, 197, 94, 0.16);
      }

      .flow-item .pending {
        color: #fde68a;
        background: rgba(245, 158, 11, 0.16);
      }

      .note-card p {
        line-height: 1.6;
      }

      @media (max-width: 900px) {
        .page-header,
        .summary-grid,
        .flow-item {
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
export class ValidationPage {
  private readonly store = inject(MemberStore);

  protected readonly membersCount = this.store.membersList().length;
  protected readonly catalogCount =
    this.store.engomadoCatalog().length +
    this.store.priceCatalog().length +
    this.store.statusCatalog().length +
    this.store.cancelReasonsCatalog().length +
    this.store.memberTypesCatalog().length;

  protected readonly checks: CheckItem[] = [
    {
      title: 'Búsqueda global',
      detail: 'Encuentra socios por nombre, ID, sitio, placas o engomado.',
      route: '/buscar',
      status: 'listo',
    },
    {
      title: 'Ficha de socio',
      detail: 'Abre y revisa la información operativa principal.',
      route: '/socio/398',
      status: 'listo',
    },
    {
      title: 'Captura y edición',
      detail: 'Actualiza datos permitidos sin perder historial.',
      route: '/captura/398',
      status: 'listo',
    },
    {
      title: 'Operaciones y tickets',
      detail: 'Genera líneas, totales y ticket final.',
      route: '/operaciones/398',
      status: 'listo',
    },
    {
      title: 'Reimpresión y cancelación',
      detail: 'Recupera folios o anula una operación con motivo.',
      route: '/reimpresion-ticket',
      status: 'listo',
    },
    {
      title: 'Reportes y PDF',
      detail: 'Filtra operaciones y exporta desde el navegador.',
      route: '/reportes',
      status: 'listo',
    },
    {
      title: 'Catálogos',
      detail: 'Administra engomados, tarifas, motivos y tipos.',
      route: '/catalogos',
      status: 'listo',
    },
    {
      title: 'Auditoría',
      detail: 'Consulta el historial persistente de movimientos.',
      route: '/auditoria',
      status: 'listo',
    },
  ];

  protected get readyCount(): number {
    return this.checks.filter((item) => item.status === 'listo').length;
  }

  protected get pendingCount(): number {
    return this.checks.filter((item) => item.status === 'pendiente').length;
  }
}
