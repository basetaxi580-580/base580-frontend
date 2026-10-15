import { Routes } from '@angular/router';

const placeholder = (title: string, description: string) => ({
  title,
  description,
});

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  {
    path: 'inicio',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Inicio', 'Resumen operativo y accesos rápidos.'),
  },
  {
    path: 'captura',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Captura', 'Pantalla para registro y edición operativa.'),
  },
  {
    path: 'boletos',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Boletos', 'Gestión de boletos y movimientos.'),
  },
  {
    path: 'operaciones',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Operaciones', 'Flujos de ticketing y transacciones.'),
  },
  {
    path: 'reimpresion-ticket',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Reimpresión Ticket', 'Búsqueda y reimpresión por folio.'),
  },
  {
    path: 'cancelacion',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Cancelación', 'Anulación con motivo y trazabilidad.'),
  },
  {
    path: 'reportes',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Reportes', 'Filtros, consulta y exportación PDF.'),
  },
  {
    path: 'credenciales',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Credenciales', 'Administración de credenciales.'),
  },
  {
    path: 'engomados',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Engomados', 'Asignación y control de engomados.'),
  },
  {
    path: 'lista-precios',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Lista de precios', 'Catálogo de tarifas y precios.'),
  },
  {
    path: 'buscar',
    loadComponent: async () => {
      const mod = await import('./pages/placeholder.page');
      return mod.PlaceholderPage;
    },
    data: placeholder('Búsqueda', 'Resultados de la búsqueda global.'),
  },
  { path: '**', redirectTo: 'inicio' },
];
