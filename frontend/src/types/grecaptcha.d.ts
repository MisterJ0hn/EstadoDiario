/**
 * Tipado mínimo de la API de reCAPTCHA v3, la parte que usa la app.
 *
 * Se escribe a mano porque no hay paquete `@types` instalado y no vale la pena
 * agregar una dependencia para dos métodos. `tsconfig.app.json` incluye
 * `src/**\/*.d.ts`, así que este archivo se toma solo, sin tocar `angular.json`.
 *
 * `grecaptcha` va declarado sobre `Window` y **opcional** a propósito: el
 * script se carga de forma perezosa, así que `window.grecaptcha` es `undefined`
 * hasta que termina de bajar —y se queda así para siempre si un bloqueador de
 * contenido lo corta—. Un `declare const grecaptcha` global mentiría sobre eso
 * y el compilador no avisaría del único caso que de verdad ocurre.
 */

interface GreCaptcha {
  /** Corre el callback cuando la librería terminó de inicializarse. */
  ready(callback: () => void): void;
  /** Acuña un token para esa acción. Vive 2 minutos y sirve UNA vez. */
  execute(siteKey: string, opciones: { action: string }): Promise<string>;
}

interface Window {
  grecaptcha?: GreCaptcha;
}
