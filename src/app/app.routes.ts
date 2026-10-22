import { Routes } from '@angular/router';

const placeholder = (title: string, description: string) => ({
  title,
  description,
});

export const routes: Routes = [
  {
    path: '',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Inicio', 'Resumen operativo y accesos rápidos.'),
  },
  { path: 'inicio', redirectTo: '', pathMatch: 'full' },
  {
    path: 'captura',
    loadComponent: async () => (await import('./pages/capture.page')).CapturePage,
  },
  {
    path: 'captura/:id',
    loadComponent: async () => (await import('./pages/capture.page')).CapturePage,
  },
  {
    path: 'boletos',
    loadComponent: async () => (await import('./pages/boletos.page')).BoletosPage,
  },
  {
    path: 'operaciones',
    loadComponent: async () => (await import('./pages/operations.page')).OperationsPage,
  },
  {
    path: 'operaciones/:id',
    loadComponent: async () => (await import('./pages/operations.page')).OperationsPage,
  },
  {
    path: 'reimpresion-ticket',
    loadComponent: async () => (await import('./pages/reprint-ticket.page')).ReprintTicketPage,
  },
  {
    path: 'cancelacion',
    loadComponent: async () => (await import('./pages/cancel.page')).CancelPage,
  },
  {
    path: 'reportes',
    loadComponent: async () => (await import('./pages/reports.page')).ReportsPage,
  },
  {
    path: 'auditoria',
    loadComponent: async () => (await import('./pages/audit.page')).AuditPage,
  },
  {
    path: 'catalogos',
    loadComponent: async () => (await import('./pages/catalogs.page')).CatalogsPage,
  },
  {
    path: 'credenciales',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Credenciales', 'Administración de credenciales.'),
  },
  {
    path: 'engomados',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Engomados', 'Asignación y control de engomados.'),
  },
  {
    path: 'lista-precios',
    loadComponent: async () => (await import('./pages/boletos.page')).BoletosPage,
  },
  {
    path: 'buscar',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Búsqueda', 'Resultados de la búsqueda global.'),
  },
  {
    path: 'validacion',
    loadComponent: async () => (await import('./pages/validation.page')).ValidationPage,
  },
  {
    path: 'socio/:id',
    loadComponent: async () => (await import('./pages/member-profile.page')).MemberProfilePage,
  },
  { path: '**', redirectTo: 'inicio' },
];
