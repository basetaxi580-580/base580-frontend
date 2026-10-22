import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackendSyncService } from '../data/backend-api.service';
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
        <div class="note-actions">
          <button type="button" class="primary" (click)="syncNow()">Sincronizar con Mongo</button>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .validation-page {
        display: grid;
        gap: 18px;
        color: #463255;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
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

      .back-link,
      .card {
        border-radius: 20px;
      }

      .back-link {
        text-decoration: none;
        font-weight: 700;
        padding: 10px 14px;
        color: #7c3aed;
        background: rgba(244, 114, 182, 0.14);
      }

      .card {
        border: 1px solid rgba(236, 72, 153, 0.12);
        background: rgba(255, 255, 255, 0.72);
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
        color: #8f7aa8;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .summary-grid div {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(248, 231, 244, 0.8);
        display: grid;
        gap: 4px;
      }

      .summary-grid strong {
        color: #3a214e;
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
        background: rgba(248, 231, 244, 0.7);
        border: 1px solid rgba(236, 72, 153, 0.12);
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
        color: #8a1c5c;
        background: rgba(236, 72, 153, 0.14);
      }

      .flow-item .pending {
        color: #7c3aed;
        background: rgba(168, 85, 247, 0.14);
      }

      .note-card p {
        line-height: 1.6;
      }

      .note-actions {
        margin-top: 14px;
        display: flex;
        gap: 10px;
      }

      .primary {
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 700;
        background: linear-gradient(135deg, #ec4899, #a855f7);
        color: white;
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

      @media (max-width: 768px) {
        .page-header,
        .card-head,
        .flow-item {
          flex-direction: column;
          align-items: stretch;
        }

        .summary-grid {
          grid-template-columns: 1fr 1fr;
        }

        .back-link {
          width: 100%;
          text-align: center;
        }
      }

      @media (max-width: 520px) {
        .summary-grid {
          grid-template-columns: 1fr;
        }

        .card {
          padding: 16px;
        }
      }
    `,
  ],
})
export class ValidationPage {
  private readonly store = inject(MemberStore);
  private readonly sync = inject(BackendSyncService);

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

  protected syncNow(): void {
    void this.sync.saveToBackend();
  }
}
