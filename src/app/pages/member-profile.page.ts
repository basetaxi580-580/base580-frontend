import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-member-profile-page',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="profile-page">
      <div class="profile-header">
        <div>
          <p class="eyebrow">Información de socio</p>
          <h2>{{ member.name }}</h2>
          <p class="subtitle">ID {{ member.id }} · {{ member.memberType }}</p>
        </div>
        <div class="profile-actions">
          <span class="status-pill" [class.ok]="member.status === 'OK'">{{ member.status }}</span>
          <a routerLink="/inicio" class="back-link">Volver</a>
        </div>
      </div>

      <div class="profile-grid">
        <article class="profile-card photo-card">
          <div class="photo-frame">
            <div class="photo-initials">{{ initials }}</div>
          </div>
          <div class="photo-meta">
            <h3>{{ member.name }}</h3>
            <p>{{ member.plate }} · Engomado {{ member.sticker }}</p>
          </div>
        </article>

        <article class="profile-card summary-card">
          <div class="summary-row">
            <span>ID</span><strong>{{ member.id }}</strong>
          </div>
          <div class="summary-row">
            <span>Empleado</span><strong>{{ member.employee }}</strong>
          </div>
          <div class="summary-row">
            <span>Sitio</span><strong>{{ member.site }}</strong>
          </div>
          <div class="summary-row">
            <span>Placas</span><strong>{{ member.plate }}</strong>
          </div>
          <div class="summary-row">
            <span>Engomado</span><strong>{{ member.sticker }}</strong>
          </div>
          <div class="summary-row">
            <span>Fecha de Venc.</span><strong>{{ member.expiry }}</strong>
          </div>
        </article>

        <article class="profile-card stats-card">
          <div class="stat">
            <span>Boletos Diurnos</span>
            <strong>{{ member.dayTickets }}</strong>
          </div>
          <div class="stat">
            <span>Boletos Nocturnos</span>
            <strong>{{ member.nightTickets }}</strong>
          </div>
          <div class="stat">
            <span>Totales</span>
            <strong>{{ member.totalTickets }}</strong>
          </div>
          <div class="stat subtle">
            <span>Ahorro Nocturno</span>
            <strong>{{ member.nightSaving }}</strong>
          </div>
          <div class="stat subtle">
            <span>Ahorro Personal</span>
            <strong>{{ member.personalSaving }}</strong>
          </div>
          <div class="stat subtle">
            <span>Pago de tarjeta</span>
            <strong>{{ member.cardPayment }}</strong>
          </div>
        </article>
      </div>

      <article class="profile-card history-card">
        <div class="panel-head">
          <h3>Historial reciente</h3>
          <span>Persistente</span>
        </div>
        <div class="timeline">
          <div class="timeline-item" *ngFor="let event of member.history">
            <div class="timeline-dot"></div>
            <div>
              <strong>{{ event.title }}</strong>
              <p>{{ event.detail }}</p>
            </div>
            <time>{{ event.date }}</time>
          </div>
        </div>
      </article>

      <div class="actions-row">
        <button type="button">Cancelar</button>
        <button type="button" class="secondary">Cambiar Engomado</button>
        <button type="button" class="secondary">Captura de boletos</button>
        <button type="button" class="secondary">Datos Personales</button>
      </div>
    </section>
  `,
  styles: [
    `
      .profile-page {
        display: grid;
        gap: 18px;
        color: #e2e8f0;
      }

      .profile-header {
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

      h2,
      h3,
      p {
        margin: 0;
      }

      h2 {
        font-size: 1.6rem;
      }

      .subtitle {
        margin-top: 8px;
        color: #cbd5e1;
      }

      .profile-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .status-pill,
      .back-link,
      .actions-row button {
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 700;
      }

      .status-pill {
        background: rgba(148, 163, 184, 0.16);
        color: #e2e8f0;
      }

      .status-pill.ok {
        background: rgba(34, 197, 94, 0.16);
        color: #86efac;
      }

      .back-link {
        color: #dbeafe;
        text-decoration: none;
        background: rgba(37, 99, 235, 0.18);
      }

      .profile-grid {
        display: grid;
        grid-template-columns: 280px 1fr 1fr;
        gap: 16px;
      }

      .profile-card {
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 20px;
        background: rgba(30, 41, 59, 0.56);
        padding: 18px;
      }

      .photo-card {
        display: grid;
        gap: 16px;
        place-items: center;
        text-align: center;
      }

      .photo-frame {
        width: 168px;
        height: 168px;
        border-radius: 28px;
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(34, 197, 94, 0.18));
        border: 1px solid rgba(148, 163, 184, 0.18);
        display: grid;
        place-items: center;
      }

      .photo-initials {
        width: 112px;
        height: 112px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(15, 23, 42, 0.92);
        color: #93c5fd;
        font-size: 2.4rem;
        font-weight: 800;
      }

      .photo-meta p {
        color: #cbd5e1;
        margin-top: 6px;
      }

      .summary-card,
      .stats-card {
        display: grid;
        gap: 12px;
      }

      .summary-row,
      .stat {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.55);
      }

      .summary-row span,
      .stat span,
      .panel-head span,
      .timeline time,
      .timeline p {
        color: #94a3b8;
      }

      .stat strong,
      .summary-row strong {
        color: #f8fafc;
      }

      .stat.subtle {
        background: rgba(37, 99, 235, 0.1);
      }

      .history-card {
        display: grid;
        gap: 14px;
      }

      .panel-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .timeline {
        display: grid;
        gap: 14px;
      }

      .timeline-item {
        display: grid;
        grid-template-columns: 16px 1fr auto;
        gap: 12px;
        align-items: start;
      }

      .timeline-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-top: 6px;
        background: linear-gradient(135deg, #22c55e, #2563eb);
      }

      .timeline p {
        margin-top: 4px;
      }

      .actions-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .actions-row button {
        border: 0;
        background: rgba(239, 68, 68, 0.2);
        color: #fecaca;
      }

      .actions-row .secondary {
        background: rgba(37, 99, 235, 0.18);
        color: #dbeafe;
      }

      @media (max-width: 1100px) {
        .profile-grid {
          grid-template-columns: 1fr;
        }

        .profile-header {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class MemberProfilePage {
  protected readonly member = {
    id: '398',
    name: 'MARIO GONZALEZ RAMIREZ',
    memberType: 'Empleado 1155',
    employee: '1155',
    site: '192',
    plate: 'A8119L',
    sticker: '1018',
    expiry: '28/10/2025',
    status: 'OK',
    dayTickets: 0,
    nightTickets: 0,
    totalTickets: 0,
    nightSaving: 'N/A',
    personalSaving: 'N/A',
    cardPayment: 'N/A',
    history: [
      {
        title: 'Ficha cargada',
        detail: 'El sistema abrió la información principal del socio desde la búsqueda global.',
        date: 'Hoy',
      },
      {
        title: 'Vigencia verificada',
        detail: 'Se confirmó la fecha de vencimiento y la asignación actual de engomado.',
        date: 'Reciente',
      },
      {
        title: 'Sin movimientos pendientes',
        detail: 'Los boletos y balances están en cero para este perfil.',
        date: 'Histórico',
      },
    ],
  };

  protected readonly initials = 'MG';
}
