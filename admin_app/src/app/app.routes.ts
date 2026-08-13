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
            // Antes de `:id`: con la ruta dinámica primero, `tarifas` entraría
            // como id de cliente y la ficha intentaría cargar un cliente que no
            // existe.
            path: ':id/tarifas',
            loadComponent: () =>
              import('./features/admin/facturacion/tarifas-cliente.component').then(
                (m) => m.TarifasClienteComponent
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
        // Bitácora de actividad de un cliente. Va suelta y no bajo /clientes
        // porque se entra a mirar actividad, no a administrar un estudio; se
        // llega con el cliente puesto (`?cliente=12`) desde su ficha.
        path: 'bitacora',
        loadComponent: () =>
          import('./features/admin/bitacora/bitacora.component').then(
            (m) => m.BitacoraComponent
          ),
      },
      {
        // El enlace del perfil estaba en la barra lateral desde siempre, pero
        // sin esta ruta caía en el comodín `**` y volvía al dashboard: parecía
        // que no hacía nada.
        path: 'perfil',
        loadComponent: () =>
          import('./features/perfil/perfil.component').then((m) => m.PerfilComponent),
      },
      {
        // Facturación. El listado es la pantalla principal: lo que se busca acá
        // es una factura concreta —la de tal cliente, la de tal mes, la que el
        // cliente reclama por su número—, y eso es una búsqueda.
        //
        // `/facturacion?cliente=12` es el mismo listado acotado a un cliente, a
        // donde lleva el botón "Facturas" de su ficha. No hay una pantalla
        // aparte para eso: sería la misma duplicada.
        path: 'facturacion',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/admin/facturacion/facturas-list.component').then(
                (m) => m.FacturasListComponent
              ),
          },
          {
            // Antes de `:id` por lo mismo que las tarifas del cliente.
            path: 'estimacion',
            loadComponent: () =>
              import('./features/admin/facturacion/estimacion.component').then(
                (m) => m.EstimacionComponent
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/admin/facturacion/factura-detalle.component').then(
                (m) => m.FacturaDetalleComponent
              ),
          },
        ],
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
          {
            path: 'transbank',
            loadComponent: () =>
              import(
                './features/configuracion/components/transbank-config/transbank-config.component'
              ).then((m) => m.TransbankConfigComponent),
          },
          { path: '', redirectTo: 'sistema', pathMatch: 'full' },
        ],
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
