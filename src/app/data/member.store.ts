import { Injectable, signal } from '@angular/core';
import type { AppStateDto } from './backend-api.service';

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

export type AuditEvent = {
  title: string;
  detail: string;
  date: string;
};

export type TimelineEntry = AuditEvent & { type: string };

export type CatalogItem = {
  code: string;
  label: string;
  active: boolean;
};

export type PriceItem = {
  code: string;
  label: string;
  zone: string;
  terminal: string;
  price: number;
  active: boolean;
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

  private readonly audit = signal<Record<string, TimelineEntry[]>>({
    '398': [
      {
        type: 'socio',
        title: 'Ficha cargada',
        detail: 'Se abrió la información principal del socio desde la búsqueda global.',
        date: 'Hoy',
      },
      {
        type: 'socio',
        title: 'Vigencia verificada',
        detail: 'Se confirmó la fecha de vencimiento y la asignación actual de engomado.',
        date: 'Reciente',
      },
      {
        type: 'socio',
        title: 'Sin movimientos pendientes',
        detail: 'Los boletos y balances están en cero para este perfil.',
        date: 'Histórico',
      },
    ],
  });

  private readonly engomados = signal<CatalogItem[]>([
    { code: '1018', label: 'Engomado 1018', active: true },
    { code: '1042', label: 'Engomado 1042', active: true },
    { code: '1099', label: 'Engomado 1099', active: false },
  ]);

  private readonly priceList = signal<PriceItem[]>([
    { code: 'P-8', label: 'Primera / Zona 8', zone: '8', terminal: 'P', price: 173, active: true },
    { code: 'T-8', label: 'Terminal / Zona 8', zone: '8', terminal: 'T', price: 145, active: true },
    { code: 'P-9', label: 'Primera / Zona 9', zone: '9', terminal: 'P', price: 180, active: false },
  ]);

  private readonly statuses = signal<CatalogItem[]>([
    { code: 'OK', label: 'Operativo', active: true },
    { code: 'PENDIENTE', label: 'Pendiente', active: true },
    { code: 'INACTIVO', label: 'Inactivo', active: true },
    { code: 'VENCIDO', label: 'Vencido', active: true },
  ]);

  private readonly cancelReasons = signal<CatalogItem[]>([
    { code: 'CAPTURA', label: 'Error de captura', active: true },
    { code: 'DUPLICADA', label: 'Operación duplicada', active: true },
    { code: 'USUARIO', label: 'Solicitud del usuario', active: true },
  ]);

  private readonly memberTypes = signal<CatalogItem[]>([
    { code: 'EMP', label: 'Empleado', active: true },
    { code: 'SOC', label: 'Socio', active: true },
    { code: 'VIS', label: 'Visitante', active: false },
  ]);

  member(id: string): MemberProfile | undefined {
    return this.members()[id];
  }

  membersList(): MemberProfile[] {
    return Object.values(this.members());
  }

  searchMembers(query: string): MemberProfile[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return this.membersList();

    return this.membersList().filter((member) => {
      return [member.id, member.name, member.memberType, member.employee, member.site, member.plate, member.sticker, member.status]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
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

    this.addHistory(
      id,
      {
        title: 'Ficha actualizada',
        detail: 'Se actualizaron datos permitidos del socio desde captura.',
        date: 'Ahora',
      },
      'socio',
    );
  }

  addHistory(id: string, event: MemberHistoryEvent, type = 'general'): void {
    const current = this.members()[id];
    if (!current) return;

    this.members.update((store) => ({
      ...store,
      [id]: {
        ...current,
        history: [event, ...current.history].slice(0, 10),
      },
    }));

    this.addAudit(id, event, type);
  }

  addAudit(id: string, event: AuditEvent, type = 'general'): void {
    this.audit.update((store) => ({
      ...store,
      [id]: [{ type, ...event }, ...(store[id] ?? [])].slice(0, 20),
    }));
  }

  timeline(id: string): TimelineEntry[] {
    return this.audit()[id] ?? [];
  }

  snapshot(): AppStateDto {
    const member = this.membersList()[0] ?? this.members()["398"];
    return {
      id: 'default',
      members: this.membersList().map((item) => ({
        id: item.id,
        name: item.name,
        memberType: item.memberType,
        employee: item.employee,
        site: item.site,
        plate: item.plate,
        sticker: item.sticker,
        expiry: item.expiry,
        status: item.status,
        dayTickets: item.dayTickets,
        nightTickets: item.nightTickets,
        totalTickets: item.totalTickets,
        nightSaving: item.nightSaving,
        personalSaving: item.personalSaving,
        cardPayment: item.cardPayment,
        notes: item.notes,
        history: item.history.map((historyItem) => ({ ...historyItem })),
      })),
      catalogs: {
        engomados: this.engomadoCatalog().map((item) => ({ ...item })),
        priceList: this.priceCatalog().map((item) => ({ ...item })),
        statuses: this.statusCatalog().map((item) => ({ ...item })),
        cancelReasons: this.cancelReasonsCatalog().map((item) => ({ ...item })),
        memberTypes: this.memberTypesCatalog().map((item) => ({ ...item })),
      },
      auditTrail: {
        [member?.id ?? '398']: this.timeline(member?.id ?? '398').map((entry) => ({ ...entry })),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  applyState(state: AppStateDto): void {
    if (!state?.members?.length) return;

    const first = state.members[0];
    this.members.set({
      [first.id]: {
        id: first.id,
        name: first.name,
        memberType: first.memberType,
        employee: first.employee,
        site: first.site,
        plate: first.plate,
        sticker: first.sticker,
        expiry: first.expiry,
        status: first.status,
        dayTickets: first.dayTickets,
        nightTickets: first.nightTickets,
        totalTickets: first.totalTickets,
        nightSaving: first.nightSaving,
        personalSaving: first.personalSaving,
        cardPayment: first.cardPayment,
        notes: first.notes,
        history: first.history ?? [],
      },
    });

    this.engomados.set(state.catalogs?.engomados ?? []);
    this.priceList.set(state.catalogs?.priceList ?? []);
    this.statuses.set(state.catalogs?.statuses ?? []);
    this.cancelReasons.set(state.catalogs?.cancelReasons ?? []);
    this.memberTypes.set(state.catalogs?.memberTypes ?? []);

    this.audit.set(state.auditTrail ?? {});
  }

  engomadoCatalog(): CatalogItem[] {
    return this.engomados();
  }

  priceCatalog(): PriceItem[] {
    return this.priceList();
  }

  statusCatalog(): CatalogItem[] {
    return this.statuses();
  }

  cancelReasonsCatalog(): CatalogItem[] {
    return this.cancelReasons();
  }

  memberTypesCatalog(): CatalogItem[] {
    return this.memberTypes();
  }

  addEngomado(item: CatalogItem): void {
    this.engomados.update((items) => [item, ...items]);
    this.addAudit('398', { title: 'Engomado agregado', detail: `${item.code} · ${item.label}`, date: 'Ahora' }, 'catálogo');
  }

  addPrice(item: PriceItem): void {
    this.priceList.update((items) => [item, ...items]);
    this.addAudit('398', { title: 'Precio agregado', detail: `${item.code} · ${item.price.toFixed(2)} MXN`, date: 'Ahora' }, 'catálogo');
  }

  addStatus(item: CatalogItem): void {
    this.statuses.update((items) => [item, ...items]);
    this.addAudit('398', { title: 'Estatus agregado', detail: `${item.code} · ${item.label}`, date: 'Ahora' }, 'catálogo');
  }

  addCancelReason(item: CatalogItem): void {
    this.cancelReasons.update((items) => [item, ...items]);
    this.addAudit('398', { title: 'Motivo agregado', detail: `${item.code} · ${item.label}`, date: 'Ahora' }, 'catálogo');
  }

  addMemberType(item: CatalogItem): void {
    this.memberTypes.update((items) => [item, ...items]);
    this.addAudit('398', { title: 'Tipo agregado', detail: `${item.code} · ${item.label}`, date: 'Ahora' }, 'catálogo');
  }
}
