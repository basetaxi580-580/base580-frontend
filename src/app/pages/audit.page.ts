import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberStore } from '../data/member.store';

@Component({
  standalone: true,
  selector: 'app-audit-page',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="audit-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Auditoría e historial</p>
          <h2>Eventos críticos y trazabilidad</h2>
          <p class="subtitle">Nada se depura por ahora; todo queda guardado en la bitácora.</p>
        </div>
        <a routerLink="/socio/398" class="back-link">Volver al socio</a>
      </div>

      <article class="card summary-card">
        <div class="card-head">
          <h3>Resumen del historial</h3>
          <span>Persistente</span>
        </div>
        <div class="summary-grid">
          <div>
            <span>Altas/ediciones</span>
            <strong>{{ counts.memberChanges }}</strong>
          </div>
          <div>
            <span>Operaciones</span>
            <strong>{{ counts.operations }}</strong>
          </div>
          <div>
            <span>Reimpresiones</span>
            <strong>{{ counts.reprints }}</strong>
          </div>
          <div>
            <span>Cancelaciones</span>
            <strong>{{ counts.cancellations }}</strong>
          </div>
        </div>
      </article>

      <article class="card timeline-card">
        <div class="card-head">
          <h3>Línea de tiempo del socio</h3>
          <span>ID 398</span>
        </div>

        <div class="timeline">
          <div class="timeline-item" *ngFor="let event of timeline">
            <div class="timeline-dot" [class.alt]="event.type !== 'socio'"></div>
            <div>
              <strong>{{ event.title }}</strong>
              <p>{{ event.detail }}</p>
            </div>
            <time>{{ event.date }}</time>
          </div>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .audit-page {
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
      .timeline time,
      .timeline p {
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

      .timeline {
        display: grid;
        gap: 12px;
      }

      .timeline-item {
        display: grid;
        grid-template-columns: 16px 1fr auto;
        gap: 12px;
        align-items: start;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(248, 231, 244, 0.7);
      }

      .timeline-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-top: 6px;
        background: linear-gradient(135deg, #ec4899, #a855f7);
      }

      .timeline-dot.alt {
        background: linear-gradient(135deg, #f59e0b, #ef4444);
      }

      .timeline p {
        margin-top: 4px;
      }

      @media (max-width: 1100px) {
        .page-header,
        .summary-grid {
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
export class AuditPage {
  private readonly store = inject(MemberStore);
  protected readonly timeline = this.store.timeline('398');
  protected readonly counts = {
    memberChanges: this.timeline.filter((item) => item.type === 'socio').length,
    operations: this.timeline.filter((item) => item.type === 'operacion').length,
    reprints: this.timeline.filter((item) => item.type === 'reimpresion').length,
    cancellations: this.timeline.filter((item) => item.type === 'cancelacion').length,
  };
}
