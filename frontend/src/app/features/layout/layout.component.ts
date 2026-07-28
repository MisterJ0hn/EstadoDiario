import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <!-- Notifications -->
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      @for (n of notificationService.notifications(); track n.id) {
        <div
          class="alert cursor-pointer"
          [class.alert-success]="n.type === 'success'"
          [class.alert-danger]="n.type === 'error'"
          [class.alert-warning]="n.type === 'warning'"
          [class.alert-info]="n.type === 'info'"
          (click)="notificationService.dismiss(n.id)"
        >
          <span class="flex-1">{{ n.message }}</span>
          <span class="text-current opacity-60 hover:opacity-100">&times;</span>
        </div>
      }
    </div>

    <div class="flex h-screen">
      <!-- Sidebar -->
      <aside
        class="bg-neutral-900 text-white flex flex-col transition-all duration-300 shrink-0"
        [class.w-64]="!collapsed()"
        [class.w-16]="collapsed()"
      >
        <div class="h-16 flex items-center px-4 border-b border-neutral-700">
          @if (!collapsed()) {
            <span class="text-lg font-bold tracking-tight">Estado Diario</span>
          } @else {
            <span class="text-lg font-bold mx-auto">ED</span>
          }
        </div>

        <nav class="flex-1 py-4 space-y-1 overflow-y-auto">
          <a routerLink="/estado-diario" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             [routerLinkActiveOptions]="{exact: true}"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            @if (!collapsed()) { <span>Orígenes</span> }
          </a>

          <a routerLink="/estado-diario/upload" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            @if (!collapsed()) { <span>Cargar Archivo</span> }
          </a>

          <div class="px-4 pt-4 pb-2">
            @if (!collapsed()) {
              <span class="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Movimientos</span>
            }
          </div>

          <a routerLink="/estado-diario/no-leidos" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            @if (!collapsed()) { <span>No Leídos</span> }
          </a>

          <a routerLink="/estado-diario/leidos" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            @if (!collapsed()) { <span>Leídos</span> }
          </a>

          <a routerLink="/estado-diario/pendientes" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            @if (!collapsed()) { <span>Pendientes</span> }
          </a>
        </nav>

        <div class="border-t border-neutral-700 p-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
              {{ (auth.user()?.nombre || 'U')[0] | uppercase }}
            </div>
            @if (!collapsed()) {
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ auth.user()?.nombre }} {{ auth.user()?.apellido }}</p>
                <p class="text-xs text-neutral-400 truncate">{{ auth.user()?.rol }}</p>
              </div>
              <button (click)="auth.logout()" class="text-neutral-400 hover:text-white" title="Cerrar sesión">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            }
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col overflow-hidden">
        <header class="h-16 bg-white border-b border-neutral-200 flex items-center px-6 shrink-0">
          <button (click)="collapsed.set(!collapsed())" class="text-neutral-500 hover:text-neutral-700 mr-4">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 class="text-lg font-semibold text-neutral-800">Estado Diario CRM</h2>
        </header>

        <div class="flex-1 overflow-y-auto p-6 bg-neutral-50">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class LayoutComponent {
  auth = inject(AuthService);
  notificationService = inject(NotificationService);
  collapsed = signal(false);
}
