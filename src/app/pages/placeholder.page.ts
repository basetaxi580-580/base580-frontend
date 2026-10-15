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

      <div class="placeholder-boxes">
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

      .placeholder-boxes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .placeholder-box {
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 18px;
        background: rgba(30, 41, 59, 0.55);
        padding: 16px;
      }

      .placeholder-box h3 {
        margin: 0;
      }

      @media (max-width: 900px) {
        .placeholder-header,
        .placeholder-boxes {
          grid-template-columns: 1fr;
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
}
