import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackendSyncService } from '../data/backend-api.service';
import { MemberStore, CatalogItem, PriceItem } from '../data/member.store';

type SectionKey = 'engomados' | 'precios' | 'estatus' | 'motivos' | 'tipos';

@Component({
  standalone: true,
  selector: 'app-catalogs-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="catalogs-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Catálogos y configuración</p>
          <h2>Administrar datos base del sistema</h2>
          <p class="subtitle">Engomados, tarifas, estatus, motivos y tipos de socio.</p>
        </div>
        <a routerLink="/inicio" class="back-link">Volver al inicio</a>
      </div>

      <div class="tabs">
        <button type="button" [class.active]="activeSection === 'engomados'" (click)="activeSection = 'engomados'">Engomados</button>
        <button type="button" [class.active]="activeSection === 'precios'" (click)="activeSection = 'precios'">Lista de precios</button>
        <button type="button" [class.active]="activeSection === 'estatus'" (click)="activeSection = 'estatus'">Estatus</button>
        <button type="button" [class.active]="activeSection === 'motivos'" (click)="activeSection = 'motivos'">Motivos de cancelación</button>
        <button type="button" [class.active]="activeSection === 'tipos'" (click)="activeSection = 'tipos'">Tipos de socio</button>
      </div>

      <article class="card form-card">
        <div class="card-head">
          <h3>Agregar elemento</h3>
          <span>Persistente</span>
        </div>

        <div class="form-grid" [ngSwitch]="activeSection">
          <ng-container *ngSwitchCase="'engomados'">
            <label><span>Código</span><input [(ngModel)]="form.code" name="code" /></label>
            <label><span>Etiqueta</span><input [(ngModel)]="form.label" name="label" /></label>
            <label><span>Activo</span><select [(ngModel)]="form.active" name="active"><option [ngValue]="true">Sí</option><option [ngValue]="false">No</option></select></label>
          </ng-container>

          <ng-container *ngSwitchCase="'precios'">
            <label><span>Código</span><input [(ngModel)]="priceForm.code" name="pcode" /></label>
            <label><span>Etiqueta</span><input [(ngModel)]="priceForm.label" name="plabel" /></label>
            <label><span>Zona</span><input [(ngModel)]="priceForm.zone" name="zone" /></label>
            <label><span>Terminal</span><input [(ngModel)]="priceForm.terminal" name="terminal" /></label>
            <label><span>Precio</span><input [(ngModel)]="priceForm.price" name="price" type="number" /></label>
            <label><span>Activo</span><select [(ngModel)]="priceForm.active" name="pactive"><option [ngValue]="true">Sí</option><option [ngValue]="false">No</option></select></label>
          </ng-container>

          <ng-container *ngSwitchDefault>
            <label><span>Código</span><input [(ngModel)]="form.code" name="code" /></label>
            <label><span>Etiqueta</span><input [(ngModel)]="form.label" name="label" /></label>
            <label><span>Activo</span><select [(ngModel)]="form.active" name="active"><option [ngValue]="true">Sí</option><option [ngValue]="false">No</option></select></label>
          </ng-container>
        </div>

        <div class="action-row">
          <button type="button" class="primary" (click)="addCurrent()">Agregar</button>
          <button type="button" class="secondary" (click)="syncToBackend()">Guardar en Mongo</button>
        </div>
      </article>

      <div class="catalog-grid">
        <article class="card list-card">
          <div class="card-head">
            <h3>Lista actual</h3>
            <span>{{ currentList.length }} elementos</span>
          </div>

          <div class="items-list">
            <div *ngFor="let item of currentList" class="item-row" [class.inactive]="!item.active">
              <div>
                <strong>{{ item.code }}</strong>
                <p>{{ item.label }}</p>
              </div>
              <span>{{ item.active ? 'Activo' : 'Inactivo' }}</span>
            </div>
          </div>
        </article>

        <article class="card audit-card">
          <div class="card-head">
            <h3>Historial de cambios</h3>
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
      </div>
    </section>
  `,
  styles: [
    `
      .catalogs-page {
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
      .tabs button,
      .primary,
      .secondary {
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 700;
        border: 0;
      }

      .back-link {
        text-decoration: none;
        color: #7c3aed;
        background: rgba(244, 114, 182, 0.14);
      }

      .tabs {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .tabs button {
        background: rgba(244, 114, 182, 0.14);
        color: #7c3aed;
      }

      .tabs button.active {
        background: linear-gradient(135deg, #ec4899, #a855f7);
        color: white;
      }

      .card {
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

      .card-head span,
      .items-list p,
      .audit-item p,
      .audit-item small {
        color: #8f7aa8;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      label {
        display: grid;
        gap: 8px;
      }

      label span {
        color: #7d6792;
        font-weight: 600;
      }

      input,
      select {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(168, 85, 247, 0.18);
        background: rgba(255, 255, 255, 0.9);
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
        background: linear-gradient(135deg, #ec4899, #a855f7);
        color: white;
      }

      .secondary {
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
      }

      .secondary {
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
      }

      .catalog-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .items-list,
      .audit-list {
        display: grid;
        gap: 10px;
      }

      .item-row,
      .audit-item {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(248, 231, 244, 0.72);
      }

      .item-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .item-row.inactive {
        opacity: 0.55;
      }

      @media (max-width: 1100px) {
        .page-header,
        .catalog-grid,
        .form-grid {
          grid-template-columns: 1fr;
          flex-direction: column;
        }

        .page-header {
          display: flex;
          flex-direction: column;
        }
      }

      @media (max-width: 768px) {
        .tabs,
        .action-row,
        .card-head,
        .item-row {
          flex-direction: column;
        }

        .tabs button,
        .back-link,
        .primary {
          width: 100%;
        }

        .card,
        .catalog-grid {
          padding-left: 16px;
          padding-right: 16px;
        }
      }
    `,
  ],
})
export class CatalogsPage {
  private readonly store = inject(MemberStore);
  private readonly sync = inject(BackendSyncService);

  protected activeSection: SectionKey = 'engomados';
  protected form = { code: '', label: '', active: true };
  protected priceForm = { code: '', label: '', zone: '', terminal: '', price: 0, active: true };
  protected auditTrail = [
    {
      title: 'Catálogos listos',
      detail: 'Se cargaron datos base para engomados, tarifas y estatus del sistema.',
      date: 'Hoy',
    },
  ];

  protected get currentList(): CatalogItem[] | PriceItem[] {
    switch (this.activeSection) {
      case 'precios':
        return this.store.priceCatalog();
      case 'estatus':
        return this.store.statusCatalog();
      case 'motivos':
        return this.store.cancelReasonsCatalog();
      case 'tipos':
        return this.store.memberTypesCatalog();
      case 'engomados':
      default:
        return this.store.engomadoCatalog();
    }
  }

  protected addCurrent(): void {
    if (this.activeSection === 'precios') {
      this.store.addPrice({ ...this.priceForm });
      this.auditTrail = [
        {
          title: 'Precio agregado',
          detail: `${this.priceForm.code} · ${this.priceForm.price} MXN`,
          date: 'Ahora',
        },
        ...this.auditTrail,
      ].slice(0, 6);
      this.priceForm = { code: '', label: '', zone: '', terminal: '', price: 0, active: true };
      return;
    }

    const item = { ...this.form };
    switch (this.activeSection) {
      case 'engomados':
        this.store.addEngomado(item);
        break;
      case 'estatus':
        this.store.addStatus(item);
        break;
      case 'motivos':
        this.store.addCancelReason(item);
        break;
      case 'tipos':
        this.store.addMemberType(item);
        break;
    }

    this.auditTrail = [
      {
        title: 'Elemento agregado',
        detail: `${item.code} · ${item.label}`,
        date: 'Ahora',
      },
      ...this.auditTrail,
    ].slice(0, 6);

    this.form = { code: '', label: '', active: true };
  }

  protected syncToBackend(): void {
    void this.sync.saveToBackend();
  }
}

