import { Injectable, signal } from '@angular/core';

export type MemberHistoryEvent = {
  title: string;
  detail: string;
  date: string;
};

export type MemberProfile = {
  id: string;
  name: string;
  memberType: string;
  employee: string;
  site: string;
  plate: string;
  sticker: string;
  expiry: string;
  status: 'OK' | 'PENDIENTE' | 'INACTIVO';
  dayTickets: number;
  nightTickets: number;
  totalTickets: number;
  nightSaving: string;
  personalSaving: string;
  cardPayment: string;
  history: MemberHistoryEvent[];
  notes: string;
};

@Injectable({ providedIn: 'root' })
export class MemberStore {
  private readonly members = signal<Record<string, MemberProfile>>({
    '398': {
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
      notes: 'Perfil operativo base para demostración del CRM moderno.',
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
    },
  });

  member(id: string): MemberProfile | undefined {
    return this.members()[id];
  }

  updateMember(id: string, patch: Partial<MemberProfile>): void {
    const current = this.members()[id];
    if (!current) return;

    const updated = {
      ...current,
      ...patch,
    };

    this.members.update((store) => ({
      ...store,
      [id]: updated,
    }));
  }

  addHistory(id: string, event: MemberHistoryEvent): void {
    const current = this.members()[id];
    if (!current) return;

    this.members.update((store) => ({
      ...store,
      [id]: {
        ...current,
        history: [event, ...current.history].slice(0, 10),
      },
    }));
  }
}
