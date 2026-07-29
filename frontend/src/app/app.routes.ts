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
        path: 'perfil',
        loadComponent: () =>
          import('./features/perfil/perfil.component').then((m) => m.PerfilComponent),
      },
      {
        path: 'configuracion',
        canActivate: [adminGuard],
        children: [
          {
            path: 'correo',
            loadComponent: () =>
              import('./features/configuracion/components/correo-config/correo-config.component').then(
                (m) => m.CorreoConfigComponent
              ),
          },
          {
            path: 'correo/log',
            loadComponent: () =>
              import('./features/configuracion/components/correo-log/correo-log.component').then(
                (m) => m.CorreoLogComponent
              ),
          },
          {
            path: 'usuarios',
            loadComponent: () =>
              import('./features/configuracion/components/usuarios/usuarios.component').then(
                (m) => m.UsuariosComponent
              ),
          },
          {
            path: 'google-calendar',
            loadComponent: () =>
              import('./features/configuracion/components/google-config/google-config.component').then(
                (m) => m.GoogleConfigComponent
              ),
          },
          {
            path: 'whatsapp',
            loadComponent: () =>
              import('./features/configuracion/components/whatsapp-config/whatsapp-config.component').then(
                (m) => m.WhatsappConfigComponent
              ),
          },
          { path: '', redirectTo: 'correo', pathMatch: 'full' },
        ],
      },
      { path: '', redirectTo: 'estado-diario', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
