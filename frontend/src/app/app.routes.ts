import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
            path: 'no-leidos',
            loadComponent: () =>
              import('./features/estado-diario/components/movimientos-list/movimientos-list.component').then(
                (m) => m.MovimientosListComponent
              ),
            data: { filter: 'no-leidos' },
          },
          {
            path: 'leidos',
            loadComponent: () =>
              import('./features/estado-diario/components/movimientos-list/movimientos-list.component').then(
                (m) => m.MovimientosListComponent
              ),
            data: { filter: 'leidos' },
          },
          {
            path: 'pendientes',
            loadComponent: () =>
              import('./features/estado-diario/components/movimientos-list/movimientos-list.component').then(
                (m) => m.MovimientosListComponent
              ),
            data: { filter: 'pendientes' },
          },
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
      { path: '', redirectTo: 'estado-diario', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
