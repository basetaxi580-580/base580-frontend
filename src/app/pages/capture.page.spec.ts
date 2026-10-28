import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationInitStatus } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../app.config';
import { AppStateDto, BackendSyncService } from '../data/backend-api.service';
import { MemberStore } from '../data/member.store';
import { CapturePage } from './capture.page';

describe('Captura de socios', () => {
  let fixture: ComponentFixture<CapturePage>;
  let store: MemberStore;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const render = () => { fixture.changeDetectorRef.markForCheck(); fixture.detectChanges(); };
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const click = (label: string) => {
    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((item) => item.textContent?.trim() === label);
    expect(button, `Falta botón ${label}`).toBeTruthy();
    button!.click();
    render();
  };
  const input = (name: string, value: string) => {
    const field = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    render();
  };
  const settle = async () => { await new Promise((resolve) => setTimeout(resolve, 0)); render(); };
  const saveResponse = () => {
    const request = http.expectOne('/api/state');
    expect(request.request.method).toBe('PUT');
    const body = request.request.body as AppStateDto;
    request.flush(body);
    return body;
  };

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [CapturePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { paramMap: params } }],
    });
    store = TestBed.inject(MemberStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(BackendSyncService).syncLocalState(store.snapshot());
    fixture = TestBed.createComponent(CapturePage);
    render();
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('crea, lista y edita un socio sin modificar su ID ni sus datos ajenos al formulario', async () => {
    click('Crear socio');
    input('id', ' 710 '); input('name', ' Ana Pérez '); input('plate', 'ABC');
    click('Guardar');
    const created = saveResponse();
    expect(created.members.find((m) => m.id === '710')).toMatchObject({ name: 'Ana Pérez', plate: 'ABC' });
    await settle();
    expect(text()).toContain('Cambios guardados en el servidor');
    click('Lista');
    expect(text()).toContain('Ana Pérez');
    store.updateMember('710', { dayTickets: 5 });
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.member-row'));
    const row = rows.find((item) => item.textContent?.includes('Ana Pérez'))!;
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Editar')!.click();
    render();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[name="id"]')!.readOnly).toBe(true);
    input('name', 'Ana Actualizada');
    click('Guardar');
    const updated = saveResponse();
    expect(updated.members.find((m) => m.id === '710')).toMatchObject({ name: 'Ana Actualizada', plate: 'ABC', dayTickets: 5 });
    await settle();
  });

  it('rechaza ID o nombre vacíos y un ID duplicado sin enviar cambios', () => {
    click('Crear socio');
    input('id', '   '); input('name', 'Ana'); click('Guardar');
    expect(text()).toContain('El ID y el nombre son obligatorios');
    input('id', '398'); input('name', '   '); click('Guardar');
    expect(text()).toContain('El ID y el nombre son obligatorios');
    input('name', 'Otra persona'); click('Guardar');
    expect(text()).toContain('Ya existe un socio con ese ID');
    expect(store.member('398')!.name).toBe('MARIO GONZALEZ RAMIREZ');
    http.expectNone('/api/state');
  });

  it('respeta la cancelación y elimina solo tras confirmar, incluyendo auditoría', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    click('Eliminar');
    expect(store.member('398')).toBeDefined();
    http.expectNone('/api/state');
    click('Eliminar');
    expect(confirm).toHaveBeenCalledTimes(2);
    const body = saveResponse();
    expect(body.members).toHaveLength(0);
    expect(body.auditTrail['398']).toBeUndefined();
    await settle();
    expect(text()).toContain('No hay socios capturados');
  });

  it('informa fallo de guardado y reintenta la misma modificación local', async () => {
    click('Crear socio'); input('id', '901'); input('name', 'Socio remoto'); click('Guardar');
    const failed = http.expectOne('/api/state');
    failed.flush('error', { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(text()).toContain('No se pudo confirmar el guardado');
    expect(text()).not.toContain('Cambios guardados en el servidor');
    expect(store.member('901')?.name).toBe('Socio remoto');
    click('Reintentar sincronización');
    expect(saveResponse().members.find((m) => m.id === '901')?.name).toBe('Socio remoto');
    await settle();
    expect(text()).toContain('Cambios guardados en el servidor');
    expect(text()).not.toContain('No se pudo confirmar el guardado');
  });

  it('no recarga el servidor cuando hay una modificación que falló al guardar', async () => {
    click('Crear socio'); input('id', '902'); input('name', 'Pendiente'); click('Guardar');
    http.expectOne('/api/state').flush('error', { status: 503, statusText: 'Unavailable' });
    await settle();
    const sync = TestBed.inject(BackendSyncService);
    await expect(sync.reloadFromBackend()).rejects.toThrow('cambios locales pendientes');
    http.expectNone('/api/state');
    expect(store.member('902')?.name).toBe('Pendiente');
    click('Reintentar sincronización');
    expect(saveResponse().members.some((m) => m.id === '902')).toBe(true);
    await settle();
  });

  it('abre el ID de la ruta y avisa cuando no existe', async () => {
    params.next(convertToParamMap({ id: '398' })); await settle();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('MARIO GONZALEZ RAMIREZ');
    params.next(convertToParamMap({ id: 'ausente' })); render();
    expect(text()).toContain('No se encontró el socio con ID ausente');
  });
});

describe('Inicialización remota de captura', () => {
  it('espera el estado remoto antes de abrir el socio de la ruta inicial', async () => {
    TestBed.configureTestingModule({
      imports: [CapturePage],
      providers: [...appConfig.providers, provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: '900' })) } }],
    });
    const http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(MemberStore);
    const initial = TestBed.inject(ApplicationInitStatus);
    const response = store.snapshot();
    response.members = [{ ...response.members[0], id: '900', name: 'Socio del servidor' }];
    (initial as unknown as { runInitializers(): void }).runInitializers();
    expect(initial.done).toBe(false);
    expect(store.member('900')).toBeUndefined();
    http.expectOne('/api/state').flush(response);
    await initial.donePromise;
    expect(initial.done).toBe(true);
    const fixture = TestBed.createComponent(CapturePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('Socio del servidor');
    http.verify();
  });

  it('bloquea captura tras fallar la carga inicial y recupera el socio real al recargar', async () => {
    const params = new BehaviorSubject(convertToParamMap({ id: '900' }));
    TestBed.configureTestingModule({
      imports: [CapturePage],
      providers: [...appConfig.providers, provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { paramMap: params.value } } }],
    });
    const http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(MemberStore);
    const sync = TestBed.inject(BackendSyncService);
    const initial = TestBed.inject(ApplicationInitStatus);
    const response = store.snapshot();
    response.members = [{ ...response.members[0], id: '900', name: 'Socio real' }];
    (initial as unknown as { runInitializers(): void }).runInitializers();
    http.expectOne('/api/state').flush('error', { status: 503, statusText: 'Unavailable' });
    await initial.donePromise;
    expect(sync.loadStatus()).toBe('error');
    await expect(sync.saveToBackend()).rejects.toThrow('no se ha cargado');
    http.expectNone('/api/state');
    const fixture = TestBed.createComponent(CapturePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('captura está bloqueada');
    expect(element.textContent).not.toContain('MARIO GONZALEZ');
    expect(element.textContent).not.toContain('Crear socio');
    const retry = Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.includes('Recargar desde el servidor'))!;
    retry.click();
    const request = http.expectOne('/api/state');
    expect(request.request.method).toBe('GET');
    request.flush(response);
    await fixture.whenStable();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(sync.loadStatus()).toBe('ready');
    expect(element.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe('Socio real');
    expect(store.member('398')).toBeUndefined();
    http.verify();
  });

});
