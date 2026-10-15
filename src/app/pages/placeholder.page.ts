import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberStore } from '../data/member.store';

@Component({
  standalone: true,
  selector: 'app-placeholder-page',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="placeholder-page">
      <div class="placeholder-header">
        <div>
          <p class="eyebrow">{{ eyebrow }}</p>
          <h2>{{ title }}</h2>
          <p>{{ description }}</p>
        </div>
        <a routerLink="/inicio" class="back-link">Volver al inicio</a>
      </div>

      <div class="placeholder-boxes" *ngIf="mode !== 'search'">
        <article class="placeholder-box">
          <h3>Próximo paso</h3>
          <p>
            Esta pantalla será sustituida por la implementación real en el sprint
            correspondiente.
          </p>
        </article>
        <article class="placeholder-box">
          <h3>Estado</h3>
          <p>Base de navegación lista para continuar con el resto del CRM.</p>
        </article>
      </div>

      <div class="search-results" *ngIf="mode === 'search'">
        <article class="result-summary">
          <strong>{{ results.length }}</strong>
          <span>resultados para “{{ query }}”</span>
        </article>

        <div class="result-list">
          <a *ngFor="let member of results" class="result-item" [routerLink]="'/socio/' + member.id">
            <div>
              <strong>{{ member.name }}</strong>
              <p>ID {{ member.id }} · {{ member.memberType }} · {{ member.site }}</p>
            </div>
            <span>{{ member.status }}</span>
          </a>

          <div class="empty-search" *ngIf="!results.length">
            No se encontraron coincidencias.
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .placeholder-page {
        display: grid;
        gap: 18px;
      }

      .placeholder-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 18px;
      }

      .eyebrow {
        margin: 0 0 8px;
        color: #93c5fd;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        font-weight: 700;
      }

      h2 {
        margin: 0;
        font-size: 1.55rem;
      }

      p {
        margin: 8px 0 0;
        color: #cbd5e1;
      }

      .back-link {
        color: #dbeafe;
        text-decoration: none;
        background: rgba(37, 99, 235, 0.18);
        padding: 10px 14px;
        border-radius: 12px;
      }

      .placeholder-boxes,
      .result-list {
        display: grid;
        gap: 16px;
      }

      .placeholder-box,
      .result-summary,
      .result-item,
      .empty-search {
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 18px;
        background: rgba(30, 41, 59, 0.55);
        padding: 16px;
      }

      .placeholder-box h3 {
        margin: 0;
      }

      .result-summary {
        display: flex;
        gap: 12px;
        align-items: baseline;
      }

      .result-summary strong {
        font-size: 2rem;
        color: #f8fafc;
      }

      .result-item {
        text-decoration: none;
        color: inherit;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .result-item span {
        color: #93c5fd;
        align-self: center;
      }

      .empty-search {
        color: #94a3b8;
      }

      @media (max-width: 900px) {
        .placeholder-header,
        .placeholder-boxes {
          grid-template-columns: 1fr;
          flex-direction: column;
        }

        .result-item {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MemberStore);

  protected readonly title = this.route.snapshot.data['title'] ?? 'Pantalla';
  protected readonly description = this.route.snapshot.data['description'] ?? '';
  protected readonly eyebrow = this.route.snapshot.routeConfig?.path === 'inicio' ? 'Sprint 1' : 'Configuración';
  protected readonly mode = this.route.snapshot.routeConfig?.path === 'buscar' ? 'search' : 'default';
  protected readonly query = this.route.snapshot.queryParamMap.get('q') ?? '';
  protected readonly results = this.store.searchMembers(this.query);
}
