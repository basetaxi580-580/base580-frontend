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
  protected readonly userName = 'Miguel Rios Bravo';
  protected readonly currentDate = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected isSidebarOpen = typeof window !== 'undefined' && window.innerWidth > 900;
  private sidebarTouchStart: { x: number; y: number } | null = null;

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

  protected toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  protected closeSidebar(): void {
    if (window.innerWidth <= 900) {
      this.isSidebarOpen = false;
    }
  }

  protected startSidebarSwipe(event: TouchEvent): void {
    this.sidebarTouchStart = null;
    if (window.innerWidth > 900 || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (this.isSidebarOpen || touch.clientX <= 24) {
      this.sidebarTouchStart = { x: touch.clientX, y: touch.clientY };
    }
  }

  protected endSidebarSwipe(event: TouchEvent): void {
    const start = this.sidebarTouchStart;
    this.sidebarTouchStart = null;
    if (!start || window.innerWidth > 900 || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    this.isSidebarOpen = dx > 0;
  }

  protected submitSearch(query: string): void {
    const normalized = query.trim();
    this.closeSidebar();
    void this.router.navigate(['/buscar'], {
      queryParams: normalized ? { q: normalized } : {},
    });
  }
}
