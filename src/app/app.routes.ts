import { Routes } from '@angular/router';

const placeholder = (title: string, description: string) => ({
  title,
  description,
});

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  {
    path: 'inicio',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Inicio', 'Resumen operativo y accesos rápidos.'),
  },
  {
    path: 'captura',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Captura', 'Pantalla para registro y edición operativa.'),
  },
  {
    path: 'boletos',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Boletos', 'Gestión de boletos y movimientos.'),
  },
  {
    path: 'operaciones',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Operaciones', 'Flujos de ticketing y transacciones.'),
  },
  {
    path: 'reimpresion-ticket',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Reimpresión Ticket', 'Búsqueda y reimpresión por folio.'),
  },
  {
    path: 'cancelacion',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Cancelación', 'Anulación con motivo y trazabilidad.'),
  },
  {
    path: 'reportes',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Reportes', 'Filtros, consulta y exportación PDF.'),
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
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Lista de precios', 'Catálogo de tarifas y precios.'),
  },
  {
    path: 'buscar',
    loadComponent: async () => (await import('./pages/placeholder.page')).PlaceholderPage,
    data: placeholder('Búsqueda', 'Resultados de la búsqueda global.'),
  },
  {
    path: 'socio/:id',
    loadComponent: async () => (await import('./pages/member-profile.page')).MemberProfilePage,
  },
  { path: '**', redirectTo: 'inicio' },
];
