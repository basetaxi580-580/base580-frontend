import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should expose links to the operational modules', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a[href="/captura"]')).toBeTruthy();
    expect(compiled.querySelector('a[href="/operaciones"]')).toBeTruthy();
    expect(compiled.textContent).not.toContain('Accesos rápidos');
    expect(compiled.textContent).not.toContain('Estado del sistema');
  });

  it('no registra las rutas heredadas de boletos', () => {
    expect(routes.find((route) => route.path === 'boletos/anterior')).toBeUndefined();
    expect(routes.find((route) => route.path === 'lista-precios')).toBeUndefined();
  });
});
