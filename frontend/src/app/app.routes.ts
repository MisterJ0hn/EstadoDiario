import { inject } from '@angular/core';
import { Router, Routes, UrlTree } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { cambioClaveGuard, claveVigenteGuard } from './core/guards/clave-vigente.guard';

const redirectToTab = (tab: string): UrlTree =>
  inject(Router).createUrlTree(['/estado-diario/movimientos'], { queryParams: { tab } });

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    // "Olvidé mi contraseña", paso 1: pedir el enlace por correo. Pública, sin
    // guard: quien llega acá justamente no puede iniciar sesión.
    path: 'recuperar-clave',
    loadComponent: () =>
      import('./features/auth/recuperar-clave.component').then(
        (m) => m.RecuperarClaveComponent
      ),
  },
  {
    // Paso 2: es la URL que va dentro del correo, con `?token=`. También
    // pública, y por la misma razón: la credencial es el token del enlace.
    path: 'restablecer-clave',
    loadComponent: () =>
      import('./features/auth/restablecer-clave.component').then(
        (m) => m.RestablecerClaveComponent
      ),
  },
  {
    // Cambio de contraseña obligatorio: fuera del layout a propósito, no hay
    // menú ni navegación posible hasta que la clave provisoria se reemplace.
    path: 'cambiar-clave',
    canActivate: [cambioClaveGuard],
    loadComponent: () =>
      import('./features/auth/cambiar-clave.component').then((m) => m.CambiarClaveComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard, claveVigenteGuard],
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
            // Las causas de corte viven en otra tabla y tienen otras columnas
            // que las de materia: por eso son una pantalla aparte y no una
            // pestaña más del listado por materia.
            path: 'cortes',
            loadComponent: () =>
              import('./features/estado-diario/components/cortes-list/cortes-list.component').then(
                (m) => m.CortesListComponent
              ),
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
        // Carga del Excel de causas. Va aparte de "Cargar Archivo" porque este
        // reporte no trae fecha: es una foto de la cartera, no de un día.
        path: 'causas/cargar',
        loadComponent: () =>
          import('./features/causas/cargar-causas.component').then(
            (m) => m.CargarCausasComponent
          ),
      },
      {
        // Las causas de corte viven en otra tabla y tienen otras columnas:
        // pantalla aparte, igual que en Estado Diario y Movimientos.
        path: 'causas/cortes',
        loadComponent: () =>
          import('./features/causas/causas-cortes.component').then(
            (m) => m.CausasCortesComponent
          ),
      },
      {
        // Módulo Causas: la cartera del estudio, se haya movido o no.
        path: 'causas',
        loadComponent: () =>
          import('./features/causas/causas.component').then((m) => m.CausasComponent),
      },
      {
        // Las causas de corte del reporte viven en otra tabla y tienen otras
        // columnas: pantalla aparte, igual que en Estado Diario.
        path: 'movimientos/cortes',
        loadComponent: () =>
          import('./features/movimientos/movimientos-cortes.component').then(
            (m) => m.MovimientosCortesComponent
          ),
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
        // Sus propias facturas, de solo lectura: generar y anular viven en la
        // consola de administración.
        path: 'facturas',
        loadComponent: () =>
          import('./features/facturas/facturas.component').then((m) => m.FacturasComponent),
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
          // La casilla de ingesta la configura la plataforma, no el estudio:
          // de qué casilla se lee determina en qué base entra cada archivo.
          // Al estudio le queda la bitácora, y solo a su administrador.
          {
            // La bitácora de correo dejó de ser una pantalla propia: es una
            // pestaña de Bitácora. La ruta se conserva redirigiendo para que
            // los enlaces guardados y el historial del navegador sigan
            // llevando a donde el usuario espera.
            path: 'correo/log',
            redirectTo: '/estado-diario?tab=correo',
            pathMatch: 'full',
          },
          // SMTP, Google Calendar y WhatsApp dejaron de ser del estudio: son
          // servicios del sistema y viven en /admin/configuracion.
          { path: '', redirectTo: 'correo/log', pathMatch: 'full' },
        ],
      },
      // El dashboard es la página de inicio.
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
