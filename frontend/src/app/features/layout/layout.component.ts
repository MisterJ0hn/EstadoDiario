import { Component, computed, inject, signal } from '@angular/core';
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
    <div class="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
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

    <!-- Backdrop (solo móvil) -->
    @if (mobileOpen()) {
      <div class="fixed inset-0 bg-black/50 z-30 md:hidden" (click)="mobileOpen.set(false)"></div>
    }

    <div class="flex flex-col md:flex-row h-screen">
      <!-- Sidebar: en móvil se despliega desde la parte superior -->
      <aside
        class="bg-neutral-900 text-white flex flex-col transition-all duration-300 shrink-0
               fixed inset-x-0 top-0 z-40 w-full max-h-[90vh] overflow-y-auto shadow-xl
               md:static md:z-auto md:max-h-none md:h-auto md:overflow-visible md:shadow-none md:flex"
        [class.hidden]="!mobileOpen()"
        [ngClass]="collapsed() ? 'md:w-16' : 'md:w-64'"
      >
        <div class="h-16 flex items-center justify-between px-4 border-b border-neutral-700 shrink-0">
          @if (showLabels()) {
            <span class="text-lg font-bold tracking-tight">Estado Diario</span>
          } @else {
            <span class="text-lg font-bold mx-auto">ED</span>
          }
          <button (click)="mobileOpen.set(false)" class="text-neutral-400 hover:text-white md:hidden" title="Cerrar menú">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav class="flex-1 py-4 space-y-1 overflow-y-auto">
          <a routerLink="/dashboard" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             (click)="mobileOpen.set(false)"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h4l3 8 4-16 3 8h4" />
            </svg>
            @if (showLabels()) { <span>Dashboard</span> }
          </a>

          <a routerLink="/estado-diario" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             [routerLinkActiveOptions]="{exact: true}" (click)="mobileOpen.set(false)"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            @if (showLabels()) { <span>Archivos</span> }
          </a>

          <a routerLink="/estado-diario/upload" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             (click)="mobileOpen.set(false)"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            @if (showLabels()) { <span>Cargar Archivo</span> }
          </a>

          <a routerLink="/estado-diario/movimientos" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             (click)="mobileOpen.set(false)"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            @if (showLabels()) { <span>Estado Diario</span> }
          </a>

          <a routerLink="/movimientos" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             (click)="mobileOpen.set(false)"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            @if (showLabels()) { <span>Movimientos</span> }
          </a>

          <a routerLink="/estado-diario/calendario" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             (click)="mobileOpen.set(false)"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            @if (showLabels()) { <span>Calendario</span> }
          </a>

          <a routerLink="/informes" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
             (click)="mobileOpen.set(false)"
             class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6m3 6V7m3 10v-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            @if (showLabels()) { <span>Informes</span> }
          </a>

          <!-- Cada usuario configura su propia casilla IMAP: de ahí salen los
               estados diarios que se le importan. No es una opción de admin. -->
          <div class="pt-4 mt-2 border-t border-neutral-700">
            @if (showLabels()) {
              <p class="px-4 pb-1 text-xs uppercase tracking-wide text-neutral-500">Mi casilla de correo</p>
            }
            <a routerLink="/configuracion/correo" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
               [routerLinkActiveOptions]="{exact: true}" (click)="mobileOpen.set(false)"
               class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
              <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              @if (showLabels()) { <span>Importar por Correo</span> }
            </a>

            <a routerLink="/configuracion/correo/log" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
               (click)="mobileOpen.set(false)"
               class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
              <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              @if (showLabels()) { <span>Bitácora de Correo</span> }
            </a>
          </div>

          @if (auth.isAdmin()) {
            <div class="pt-4 mt-2 border-t border-neutral-700">
              @if (showLabels()) {
                <p class="px-4 pb-1 text-xs uppercase tracking-wide text-neutral-500">Administración</p>
              }
              <a routerLink="/configuracion/usuarios" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                 (click)="mobileOpen.set(false)"
                 class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-1a3 3 0 00-5.356-1.857M17 20H7m10 0v-1c0-.656-.126-1.283-.356-1.857M7 20H2v-1a3 3 0 015.356-1.857M7 20v-1c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                @if (showLabels()) { <span>Usuarios</span> }
              </a>

              <a routerLink="/configuracion/google-calendar" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                 (click)="mobileOpen.set(false)"
                 class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                @if (showLabels()) { <span>Google Calendar</span> }
              </a>

              <a routerLink="/configuracion/smtp" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                 (click)="mobileOpen.set(false)"
                 class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                @if (showLabels()) { <span>Correo de Salida</span> }
              </a>

              <a routerLink="/configuracion/whatsapp" routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                 (click)="mobileOpen.set(false)"
                 class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                @if (showLabels()) { <span>WhatsApp</span> }
              </a>
            </div>
          }
        </nav>

        <div class="border-t border-neutral-700 p-4 shrink-0">
          <a routerLink="/perfil" (click)="mobileOpen.set(false)" class="flex items-center gap-3 group">
            <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
              {{ (auth.user()?.nombre || 'U')[0] | uppercase }}
            </div>
            @if (showLabels()) {
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate group-hover:underline">{{ auth.user()?.nombre }} {{ auth.user()?.apellido }}</p>
                <p class="text-xs text-neutral-400 truncate">{{ auth.user()?.rol }}</p>
              </div>
            }
          </a>
          <div class="flex items-center gap-3 mt-1">
            @if (showLabels()) {
              <div class="flex-1"></div>
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
      <main class="flex-1 flex flex-col overflow-hidden min-h-0">
        <header class="h-16 bg-white border-b border-neutral-200 flex items-center px-4 md:px-6 shrink-0">
          <!-- Toggle móvil -->
          <button (click)="mobileOpen.set(!mobileOpen())" class="text-neutral-500 hover:text-neutral-700 mr-4 md:hidden"
                  title="Abrir menú">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <!-- Toggle escritorio -->
          <button (click)="collapsed.set(!collapsed())" class="text-neutral-500 hover:text-neutral-700 mr-4 hidden md:block"
                  title="Contraer menú">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 class="text-base md:text-lg font-semibold text-neutral-800">Estado Diario CRM</h2>
          <button (click)="auth.logout()" class="ml-auto text-neutral-500 hover:text-neutral-700 md:hidden" title="Cerrar sesión">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-neutral-50">
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
  mobileOpen = signal(false);

  /** En móvil el menú siempre muestra los textos; en escritorio depende de si está contraído. */
  showLabels = computed(() => !this.collapsed() || this.mobileOpen());
}
