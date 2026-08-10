import { Component, inject } from '@angular/core';
import { RecaptchaService } from '@core/services/recaptcha.service';

/**
 * Aviso de atribución de reCAPTCHA.
 *
 * No es decorativo: los términos de Google permiten **ocultar el badge
 * flotante solo si** se muestra este texto con los enlaces a su Política de
 * Privacidad y sus Términos. La regla que esconde el badge está en
 * `styles.css`; si este componente se borra de una pantalla, hay que devolver
 * el badge ahí.
 *
 * El badge se oculta por dos razones de esta aplicación, no de estética: en una
 * SPA su iframe queda en el DOM después de navegar, así que quedaría flotando
 * sobre el dashboard y los listados toda la sesión sin ningún hook que lo
 * saque; y en la vista móvil choca con el armazón de Ionic.
 *
 * El `@if` es lo que mantiene la promesa de "apagado por defecto" también en la
 * interfaz: sin llaves configuradas en el servidor, acá no aparece nada.
 */
@Component({
  selector: 'app-recaptcha-aviso',
  standalone: true,
  template: `
    @if (recaptcha.activo()) {
      <p class="text-xs text-neutral-400 text-center mt-4 leading-relaxed">
        Este sitio está protegido por reCAPTCHA; se aplican la
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener"
          class="underline hover:text-neutral-600"
          >Política de Privacidad</a
        >
        y los
        <a
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener"
          class="underline hover:text-neutral-600"
          >Términos del Servicio</a
        >
        de Google.
      </p>
    }
  `,
})
export class RecaptchaAvisoComponent {
  readonly recaptcha = inject(RecaptchaService);
}
