import { inject } from '@angular/core';
import { Router, Routes, UrlTree } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

const redirectToTab = (tab: string): UrlTree =>
  inject(Router).createUrlTree(['/estado-diario/movimientos'], { queryParams: { tab } });

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'estado-diario',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/estado-diario/components/origenes-list/origenes-list.component').then(
                (m) => m.OrigenesListComponent
              ),
          },
          {
            path: 'upload',
            loadComponent: () =>
              import('./features/estado-diario/components/upload-form/upload-form.component').then(
                (m) => m.UploadFormComponent
              ),
          },
          {
            path: 'movimientos',
            loadComponent: () =>
              import('./features/estado-diario/components/movimientos-list/movimientos-list.component').then(
                (m) => m.MovimientosListComponent
              ),
            data: { filter: 'movimientos' },
          },
          {
            path: 'calendario',
            loadComponent: () =>
              import('./features/calendario/calendario.component').then((m) => m.CalendarioComponent),
          },
          // Rutas antiguas: redirigen a la vista unificada con pestañas
          { path: 'no-leidos', redirectTo: () => redirectToTab('no-leidos') },
          { path: 'leidos', redirectTo: () => redirectToTab('leidos') },
          { path: 'pendientes', redirectTo: () => redirectToTab('pendientes') },
          {
            path: 'origen/:id/movimientos',
            loadComponent: () =>
              import('./features/estado-diario/components/movimientos-list/movimientos-list.component').then(
                (m) => m.MovimientosListComponent
              ),
            data: { filter: 'origen' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/estado-diario/components/movimiento-detail/movimiento-detail.component').then(
                (m) => m.MovimientoDetailComponent
              ),
          },
        ],
      },
      {
        // Módulo Movimientos: reporte de estado procesal, solo consulta.
        path: 'movimientos',
        loadComponent: () =>
          import('./features/movimientos/movimientos.component').then((m) => m.MovimientosComponent),
      },
      {
        // Módulo Audiencias: lo que el tribunal ya fijó, de hoy en adelante.
        // Solo consulta, como Movimientos.
        path: 'audiencias',
        loadComponent: () =>
          import('./features/audiencias/audiencias.component').then((m) => m.AudienciasComponent),
      },
      {
        // Informes dinámicos: el usuario arma el informe, lo guarda y lo recibe
        // por correo o lo descarga. La configuración SMTP va con el resto de la
        // administración, más abajo.
        path: 'informes',
        canActivate: [authGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/reportes/reportes-list.component').then(
                (m) => m.ReportesListComponent
              ),
          },
          {
            path: 'nuevo',
            loadComponent: () =>
              import('./features/reportes/reporte-form.component').then(
                (m) => m.ReporteFormComponent
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/reportes/reporte-form.component').then(
                (m) => m.ReporteFormComponent
              ),
          },
        ],
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/perfil/perfil.component').then((m) => m.PerfilComponent),
      },
      {
        // El guard va por ruta hija: la casilla de correo es de cada usuario, el
        // resto de la configuración sigue siendo solo de administradores.
        path: 'configuracion',
        children: [
          {
            path: 'correo',
            canActivate: [authGuard],
            loadComponent: () =>
              import('./features/configuracion/components/correo-config/correo-config.component').then(
                (m) => m.CorreoConfigComponent
              ),
          },
          {
            path: 'correo/log',
            canActivate: [authGuard],
            loadComponent: () =>
              import('./features/configuracion/components/correo-log/correo-log.component').then(
                (m) => m.CorreoLogComponent
              ),
          },
          {
            path: 'usuarios',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/configuracion/components/usuarios/usuarios.component').then(
                (m) => m.UsuariosComponent
              ),
          },
          {
            path: 'google-calendar',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/configuracion/components/google-config/google-config.component').then(
                (m) => m.GoogleConfigComponent
              ),
          },
          {
            // Cuenta de salida del sistema: una sola para todos, solo admin.
            path: 'smtp',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/configuracion/components/smtp-config/smtp-config.component').then(
                (m) => m.SmtpConfigComponent
              ),
          },
          {
            path: 'whatsapp',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/configuracion/components/whatsapp-config/whatsapp-config.component').then(
                (m) => m.WhatsappConfigComponent
              ),
          },
          { path: '', redirectTo: 'correo', pathMatch: 'full' },
        ],
      },
      // El dashboard es la página de inicio.
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
