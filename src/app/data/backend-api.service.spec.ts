import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppStateDto, BackendSyncService } from './backend-api.service';
import { MemberStore } from './member.store';

describe('Backend state synchronization', () => {
  let sync: BackendSyncService;
  let store: MemberStore;
  let http: HttpTestingController;
  let state: AppStateDto;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    sync = TestBed.inject(BackendSyncService);
    store = TestBed.inject(MemberStore);
    http = TestBed.inject(HttpTestingController);
    const member = store.snapshot().members[0];
    state = {
      id: 'default',
      members: [{ ...member, id: '100', name: 'Socio A' }, { ...member, id: '200', name: 'Socio B' }],
      catalogs: {
        engomados: [{ code: 'SERVER', label: 'Servidor', active: true }],
        priceList: [], statuses: [], cancelReasons: [], memberTypes: [],
      },
      auditTrail: {
        '100': [{ type: 'socio', title: 'Creado A', detail: '', date: '2026-10-15' }],
        '200': [{ type: 'socio', title: 'Creado B', detail: '', date: '2026-10-15' }],
      },
    };
  });

  afterEach(() => http.verify());

  it('loads all members, catalogs and audit without creating edit events', () => {
    sync.loadFromBackend().subscribe((response) => sync.syncLocalState(response));
    http.expectOne('/api/state').flush(state);
    const snapshot = store.snapshot();
    expect(snapshot.members).toEqual(state.members);
    expect(snapshot.catalogs).toEqual(state.catalogs);
    expect(snapshot.auditTrail).toEqual(state.auditTrail);
  });

  it('saves all members and audit entries after editing one member', async () => {
    sync.syncLocalState(state);
    store.updateMember('200', { name: 'Socio B actualizado' });
    const saved = sync.saveToBackend();
    const request = http.expectOne('/api/state');
    expect(request.request.method).toBe('PUT');
    const body = request.request.body as AppStateDto;
    expect(body.members.map((member) => member.id)).toEqual(['100', '200']);
    expect(body.members[1].name).toBe('Socio B actualizado');
    expect(body.auditTrail['100']).toEqual(state.auditTrail['100']);
    expect(body.auditTrail['200'].some((entry) => entry.title === 'Creado B')).toBe(true);
    request.flush(body);
    await saved;
  });

  it('accepts an empty server state instead of restoring demo records', () => {
    sync.syncLocalState({ ...state, members: [], auditTrail: {} });
    expect(store.membersList()).toEqual([]);
    expect(store.snapshot().auditTrail).toEqual({});
    expect(store.engomadoCatalog()).toEqual(state.catalogs.engomados);
  });
});
