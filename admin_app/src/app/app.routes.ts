import { Routes } from '@angular/router';

import { adminPlataformaGuard } from './core/guards/admin-plataforma.guard';
import { cambioClaveGuard, claveVigenteGuard } from './core/guards/clave-vigente.guard';

/**
 * Rutas de la consola de administración.
 *
 * Acá **no hay causas**: ni estado diario, ni audiencias, ni calendario. Esta
 * aplicación administra clientes, y quien la usa no tiene un estudio propio.
 * Lo operativo vive en el frontend de los estudios y en la app móvil.
 *
 * Todo cuelga de la raíz, no de `/admin`: en el sistema anterior ese prefijo
 * separaba la consola del resto de la aplicación, y ahora la consola **es** la
 * aplicación.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    // Con la clave provisoria puesta se entra, pero solo acá: el resto de la
    // consola responde 403 hasta cambiarla.
    path: 'cambiar-clave',
    canActivate: [cambioClaveGuard],
    loadComponent: () =>
      import('./features/auth/cambiar-clave.component').then((m) => m.CambiarClaveComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [adminPlataformaGuard, claveVigenteGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'clientes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/admin/clientes/clientes-list.component').then(
                (m) => m.ClientesListComponent
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/admin/clientes/cliente-detalle.component').then(
                (m) => m.ClienteDetalleComponent
              ),
          },
        ],
      },
      {
        // Facturación: qué se le cobra a cada cliente por su cartera. Va suelta
        // y no bajo /clientes porque se mira por período —todos los clientes de
        // un mes— y no cliente por cliente.
        path: 'facturacion',
        loadComponent: () =>
          import('./features/admin/facturacion/facturacion.component').then(
            (m) => m.FacturacionComponent
          ),
      },
      {
        // Las órdenes de compra son el DOCUMENTO; /facturacion es el cálculo.
        // Van en pantallas distintas porque se usan en momentos distintos: el
        // cálculo se mira todo el mes, la orden se emite una vez.
        path: 'ordenes-compra',
        loadComponent: () =>
          import('./features/admin/facturacion/ordenes-compra.component').then(
            (m) => m.OrdenesCompraComponent
          ),
      },
      {
        // Un solo módulo con paneles: se configuran juntos al montar el
        // sistema y casi nunca después.
        path: 'configuracion',
        loadComponent: () =>
          import('./features/admin/configuracion/configuracion-shell.component').then(
            (m) => m.ConfiguracionShellComponent
          ),
        children: [
          {
            path: 'sistema',
            loadComponent: () =>
              import('./features/admin/configuracion/sistema-config.component').then(
                (m) => m.SistemaConfigComponent
              ),
          },
          {
            path: 'smtp',
            loadComponent: () =>
              import(
                './features/configuracion/components/smtp-config/smtp-config.component'
              ).then((m) => m.SmtpConfigComponent),
          },
          {
            path: 'google-calendar',
            loadComponent: () =>
              import(
                './features/configuracion/components/google-config/google-config.component'
              ).then((m) => m.GoogleConfigComponent),
          },
          {
            path: 'whatsapp',
            loadComponent: () =>
              import(
                './features/configuracion/components/whatsapp-config/whatsapp-config.component'
              ).then((m) => m.WhatsappConfigComponent),
          },
          { path: '', redirectTo: 'sistema', pathMatch: 'full' },
        ],
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
