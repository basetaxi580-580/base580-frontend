import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { defer, firstValueFrom, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { MemberStore, CatalogItem, PriceItem } from './member.store';

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

  readonly loadStatus = signal<'loading' | 'ready' | 'error'>('loading');
  readonly pendingChanges = signal(false);

  loadFromBackend() {
    return defer(() => {
      if (this.pendingChanges()) throw new Error('Hay cambios locales pendientes de guardar.');
      this.loadStatus.set('loading');
      return this.api.getState().pipe(tap({ error: () => this.loadStatus.set('error') }));
    });
  }

  async reloadFromBackend(): Promise<void> {
    const state = await firstValueFrom(this.loadFromBackend());
    this.syncLocalState(state);
  }

  async saveToBackend() {
    if (this.loadStatus() !== 'ready') {
      throw new Error('El estado del servidor no se ha cargado.');
    }
    this.pendingChanges.set(true);
    const response = await firstValueFrom(this.api.saveState(this.store.snapshot()));
    this.pendingChanges.set(false);
    return response;
  }

  syncLocalState(state: AppStateDto): void {
    if (this.pendingChanges()) throw new Error('Hay cambios locales pendientes de guardar.');
    if (!state || !Array.isArray(state.members)) {
      this.loadStatus.set('error');
      throw new Error('El servidor devolvió un estado inválido.');
    }
    this.store.applyState(state);
    this.loadStatus.set('ready');
  }
}
