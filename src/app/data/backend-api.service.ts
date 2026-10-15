import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MemberStore, MemberProfile, CatalogItem, PriceItem } from '../data/member.store';

export type MemberHistoryEntry = {
  title: string;
  detail: string;
  date: string;
};

export type MemberAuditEntry = {
  type: string;
  title: string;
  detail: string;
  date: string;
};

export type MemberDocumentDto = {
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
  notes: string;
  history: MemberHistoryEntry[];
};

export type CatalogsDto = {
  engomados: CatalogItem[];
  priceList: PriceItem[];
  statuses: CatalogItem[];
  cancelReasons: CatalogItem[];
  memberTypes: CatalogItem[];
};

export type AppStateDto = {
  id: string;
  members: MemberDocumentDto[];
  catalogs: CatalogsDto;
  auditTrail: Record<string, MemberAuditEntry[]>;
  updatedAt?: string;
};

@Injectable({ providedIn: 'root' })
export class BackendApiService {
  private readonly http = inject(HttpClient);

  getState() {
    return this.http.get<AppStateDto>(`${environment.apiUrl}/state`);
  }

  saveState(state: AppStateDto) {
    return this.http.put<AppStateDto>(`${environment.apiUrl}/state`, state);
  }
}

@Injectable({ providedIn: 'root' })
export class BackendSyncService {
  private readonly api = inject(BackendApiService);
  private readonly store = inject(MemberStore);

  loadFromBackend() {
    return this.api.getState();
  }

  saveToBackend() {
    return firstValueFrom(this.api.saveState(this.store.snapshot()));
  }

  syncLocalState(state: AppStateDto): void {
    if (!state?.members?.length) return;

    const member = state.members[0];
    this.store.updateMember(member.id, {
      name: member.name,
      memberType: member.memberType,
      employee: member.employee,
      site: member.site,
      plate: member.plate,
      sticker: member.sticker,
      expiry: member.expiry,
      status: member.status,
      dayTickets: member.dayTickets,
      nightTickets: member.nightTickets,
      totalTickets: member.totalTickets,
      nightSaving: member.nightSaving,
      personalSaving: member.personalSaving,
      cardPayment: member.cardPayment,
      notes: member.notes,
      history: member.history ?? [],
    } as Partial<MemberProfile>);
  }
}
