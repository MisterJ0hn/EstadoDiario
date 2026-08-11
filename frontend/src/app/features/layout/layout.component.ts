import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';

/** Entrada del menú lateral. `icono` es el atributo `d` de un único path SVG:
 *  todos los íconos del sistema son de un solo trazo. */
interface ItemMenu {
  /** Ausente en los ítems que solo despliegan: ésos no navegan a ningún lado. */
  ruta?: string;
  etiqueta: string;
  icono: string;
  /** Solo marcar activo en coincidencia exacta (rutas que son prefijo de otras). */
  exacto?: boolean;
  /**
   * Submenú. Un ítem con hijos NO navega: pincharlo abre o cierra el grupo.
   * Es el caso de Estado Diario y Movimientos, que llegan en el mismo archivo
   * del PJUD pero en hojas distintas (materia y corte) y no comparten columnas.
   */
  hijos?: ItemMenu[];
}

/** Bloque del menú. `titulo` null = sin encabezado ni separador. */
interface GrupoMenu {
  titulo: string | null;
  items: ItemMenu[];
}

/** Íconos compartidos entre los dos menús. */
const ICONO = {
  grafico: 'M3 12h4l3 8 4-16 3 8h4',
  carpeta: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  subir: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  sobre: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  portapapeles:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  reloj: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  balanza:
    'M12 3v18m-7-5l3-7 3 7m-6 0a3 3 0 006 0m4 0l3-7 3 7m-6 0a3 3 0 006 0M5 6h14',
  calendario: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  barras: 'M9 17v-6m3 6V7m3 10v-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  bitacora:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  usuarios:
    'M17 20h5v-1a3 3 0 00-5.356-1.857M17 20H7m10 0v-1c0-.656-.126-1.283-.356-1.857M7 20H2v-1a3 3 0 015.356-1.857M7 20v-1c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  edificio:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  engranaje:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  
   perfil:
    'M6 13.5V3.75m0 9.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 9.75V10.5',
} as const;

/** Menú del usuario de un estudio: su trabajo diario. */
const MENU_CLIENTE: GrupoMenu[] = [
  {
    titulo: null,
    items: [
      { ruta: '/dashboard', etiqueta: 'Dashboard', icono: ICONO.grafico },
      { ruta: '/estado-diario', etiqueta: 'Bitácora', icono: ICONO.carpeta, exacto: true },
      { ruta: '/estado-diario/upload', etiqueta: 'Cargar Archivo', icono: ICONO.subir },
      {
        etiqueta: 'Estado Diario',
        icono: ICONO.sobre,
        hijos: [
          { ruta: '/estado-diario/movimientos', etiqueta: 'Materia', icono: ICONO.sobre },
          { ruta: '/estado-diario/cortes', etiqueta: 'Corte', icono: ICONO.balanza },
        ],
      },
      {
        etiqueta: 'Movimientos',
        icono: ICONO.portapapeles,
        hijos: [
          { ruta: '/movimientos', etiqueta: 'Materia', icono: ICONO.portapapeles, exacto: true },
          { ruta: '/movimientos/cortes', etiqueta: 'Corte', icono: ICONO.balanza },
        ],
      },
      { ruta: '/causas/cargar', etiqueta: 'Cargar Causas', icono: ICONO.subir },
      {
        etiqueta: 'Mis Causas',
        icono: ICONO.carpeta,
        hijos: [
          { ruta: '/causas', etiqueta: 'Materia', icono: ICONO.carpeta, exacto: true },
          { ruta: '/causas/cortes', etiqueta: 'Corte', icono: ICONO.balanza },
        ],
      },
      { ruta: '/audiencias', etiqueta: 'Audiencias', icono: ICONO.reloj },
      { ruta: '/estado-diario/calendario', etiqueta: 'Calendario', icono: ICONO.calendario },
      { ruta: '/informes', etiqueta: 'Reportes', icono: ICONO.barras },
      { ruta: '/facturas', etiqueta: 'Mis Facturas', icono: ICONO.bitacora },
      { ruta: '/perfil', etiqueta: 'Mi Perfil', icono: ICONO.perfil },
    ],
  },
];

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
          <!-- El logo del estudio reemplaza al nombre del producto: el
               sistema es de ellos y así se ve. Sin logo, el texto de siempre.
               El alto va acotado porque la imagen la sube el administrador y
               no hay forma de exigirle una proporción. -->
          @if (logo(); as src) {
            <img
              [src]="src"
              [alt]="auth.user()?.cliente_nombre || marca.largo"
              class="object-contain"
              [class]="showLabels() ? 'max-h-10 max-w-[11rem]' : 'max-h-8 max-w-8 mx-auto'"
            />
          } @else if (showLabels()) {
            <span class="text-lg font-bold tracking-tight">{{ marca.largo }}</span>
          } @else {
            <span class="text-lg font-bold mx-auto">{{ marca.corto }}</span>
          }
          <button (click)="mobileOpen.set(false)" class="text-neutral-400 hover:text-white md:hidden"
                  aria-label="Cerrar menú">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav class="flex-1 py-4 space-y-1 overflow-y-auto">
          @for (grupo of menu(); track grupo.titulo; let primero = $first) {
            <div [class]="primero ? '' : 'pt-4 mt-2 border-t border-neutral-700'">
              @if (grupo.titulo && showLabels()) {
                <p class="px-4 pb-1 text-xs uppercase tracking-wide text-neutral-500">
                  {{ grupo.titulo }}
                </p>
              }
              @for (item of grupo.items; track item.etiqueta) {
                @if (item.hijos) {
                  <!-- Ítem con submenú: no navega, abre y cierra el grupo. -->
                  <button
                    type="button"
                    (click)="alternarGrupo(item.etiqueta)"
                    [attr.aria-expanded]="estaAbierto(item)"
                    [attr.title]="showLabels() ? null : item.etiqueta"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                           hover:text-white hover:bg-neutral-800"
                    [class]="hayHijoActivo(item) ? 'text-primary-400' : 'text-neutral-300'"
                  >
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="item.icono" />
                    </svg>
                    @if (showLabels()) {
                      <span class="flex-1 text-left">{{ item.etiqueta }}</span>
                      <svg class="w-4 h-4 shrink-0 transition-transform"
                           [class.rotate-90]="estaAbierto(item)"
                           fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  </button>

                  @if (estaAbierto(item) && showLabels()) {
                    @for (hijo of item.hijos; track hijo.ruta) {
                      <a
                        [routerLink]="hijo.ruta"
                        routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                        [routerLinkActiveOptions]="{ exact: !!hijo.exacto }"
                        (click)="mobileOpen.set(false)"
                        class="flex items-center gap-3 py-2 pr-4 text-sm text-neutral-400
                               hover:text-white hover:bg-neutral-800 transition-colors"
                        style="padding-left: 3.25rem"
                      >
                        <span>{{ hijo.etiqueta }}</span>
                      </a>
                    }
                  }
                } @else {
                  <a
                    [routerLink]="item.ruta"
                    routerLinkActive="bg-primary-600/20 text-primary-400 border-r-2 border-primary-400"
                    [routerLinkActiveOptions]="{ exact: !!item.exacto }"
                    (click)="mobileOpen.set(false)"
                    [attr.title]="showLabels() ? null : item.etiqueta"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="item.icono" />
                    </svg>
                    @if (showLabels()) {
                      <span>{{ item.etiqueta }}</span>
                    }
                  </a>
                }
              }
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
                <p class="text-xs text-neutral-400 truncate">{{ etiquetaRol() }}</p>
              </div>
            }
          </a>
          <div class="flex items-center gap-3 mt-1">
            @if (showLabels()) {
              <div class="flex-1"></div>
              <button (click)="auth.logout()" class="text-neutral-400 hover:text-white" aria-label="Cerrar sesión">
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
        <header class="h-16 bg-white border-b border-neutral-200 flex items-center gap-3 px-4 md:px-6 shrink-0">
          <!-- Toggle móvil -->
          <button (click)="mobileOpen.set(!mobileOpen())" class="text-neutral-500 hover:text-neutral-700 md:hidden"
                  aria-label="Abrir menú">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <!-- Toggle escritorio -->
          <button (click)="collapsed.set(!collapsed())" class="text-neutral-500 hover:text-neutral-700 hidden md:block"
                  aria-label="Contraer menú">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 class="text-base md:text-lg font-semibold text-neutral-800 truncate">Movimientos PJUD</h2>

          <!-- Con varios estudios en la misma plataforma, saber en cuál se está
               parado deja de ser un adorno: va fijo en la barra superior. -->
          @if (nombreCliente()) {
            <span class="badge-neutral shrink-0 max-w-[12rem] truncate" [title]="nombreCliente()">
              {{ nombreCliente() }}
            </span>
          }

          <button (click)="auth.logout()" class="ml-auto text-neutral-500 hover:text-neutral-700 md:hidden"
                  aria-label="Cerrar sesión">
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

  private router = inject(Router);

  /** URL actual, para saber qué grupo del menú corresponde al lugar donde uno
   *  está parado. Se sigue con una señal y no leyendo `router.url` en el
   *  template: eso no se reevalúa al navegar. */
  private urlActual = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  /**
   * Grupos que el usuario abrió o cerró a mano. Lo que NO está acá sigue la
   * regla por defecto: un grupo se ve abierto si la ruta actual es de alguno
   * de sus hijos, para que al entrar por un enlace directo el menú muestre
   * dónde está uno parado.
   */
  private gruposAlternados = signal<Record<string, boolean>>({});

  alternarGrupo(etiqueta: string): void {
    // Si el usuario contrajo la barra, desplegar un submenú no se vería:
    // primero se expande.
    if (this.collapsed()) this.collapsed.set(false);

    const item = this.buscarGrupo(etiqueta);
    const abiertoAhora = item ? this.estaAbierto(item) : false;
    this.gruposAlternados.update((estado) => ({ ...estado, [etiqueta]: !abiertoAhora }));
  }

  estaAbierto(item: ItemMenu): boolean {
    const decidido = this.gruposAlternados()[item.etiqueta];
    return decidido ?? this.hayHijoActivo(item);
  }

  /** true si la ruta actual pertenece a alguno de los hijos del grupo. */
  hayHijoActivo(item: ItemMenu): boolean {
    const url = this.urlActual();
    return (item.hijos ?? []).some((h) =>
      h.exacto ? url === h.ruta : !!h.ruta && url.startsWith(h.ruta)
    );
  }

  private buscarGrupo(etiqueta: string): ItemMenu | undefined {
    for (const grupo of this.menu()) {
      const encontrado = grupo.items.find((i) => i.etiqueta === etiqueta);
      if (encontrado) return encontrado;
    }
    return undefined;
  }

  /**
   * El armazón es el mismo para las dos sesiones; lo que cambia es el menú.
   * Duplicar el layout habría duplicado también el riesgo de que la consola
   * se fuera separando visualmente del resto del sistema.
   */
  /** El administrador del estudio suma su bloque. La consola de la plataforma
   *  es otra aplicación (`admin_app/`) y no aparece acá. */
  menu = computed<GrupoMenu[]>(() =>
    [...MENU_CLIENTE]
  );

  /** Nombre del estudio de la sesión actual, para la barra superior. */
  nombreCliente = computed(() => this.auth.user()?.cliente_nombre ?? '');

  marca = { largo: 'Movimientos PJUD', corto: 'MP' } as const;

  /** Logo del estudio, como `data:` URI. Viene en la sesión (ver
   *  `cliente_logo` en el backend): un <img> no puede mandar el header
   *  Authorization, así que no puede salir de un endpoint protegido. */
  logo = computed(() => this.auth.user()?.cliente_logo || null);

  etiquetaRol = computed(() =>
    'Usuario'
  );
}
