import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

type NavItem = {
  label: string;
  path: string;
  icon: string;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly userName = 'Gonzalo Carreto Perez';
  protected readonly currentDate = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected readonly navItems: NavItem[] = [
    { label: 'Inicio', path: '/inicio', icon: '⌂' },
    { label: 'Captura', path: '/captura', icon: '⌁' },
    { label: 'Boletos', path: '/boletos', icon: '⌘' },
    { label: 'Operaciones', path: '/operaciones', icon: '◫' },
    { label: 'Reimpresión Ticket', path: '/reimpresion-ticket', icon: '⎘' },
    { label: 'Cancelación', path: '/cancelacion', icon: '✕' },
    { label: 'Reportes', path: '/reportes', icon: '▤' },
    { label: 'Auditoría', path: '/auditoria', icon: '☰' },
    { label: 'Catálogos', path: '/catalogos', icon: '⚙' },
    { label: 'Búsqueda', path: '/buscar', icon: '⌕' },
    { label: 'Credenciales', path: '/credenciales', icon: '◉' },
    { label: 'Engomados', path: '/engomados', icon: '▣' },
    { label: 'Lista de precios', path: '/lista-precios', icon: '$' },
    { label: 'Validación', path: '/validacion', icon: '✓' },
  ];

  constructor(private readonly router: Router) {}

  protected submitSearch(query: string): void {
    const normalized = query.trim();
    this.router.navigate(['/buscar'], {
      queryParams: normalized ? { q: normalized } : {},
    });
  }
}
