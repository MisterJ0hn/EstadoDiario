import { Component, inject } from '@angular/core';
import { RecaptchaService } from '@core/services/recaptcha.service';

/**
 * Aviso de atribución de reCAPTCHA.
 *
 * Los términos de Google dan a elegir: se muestra el badge flotante, o se
 * muestra este texto con los enlaces a su Política de Privacidad y sus
 * Términos. Acá se hacen **las dos cosas** —el badge queda visible (ver
 * `styles.css`) y este aviso también—, que es de más pero nunca es una
 * infracción, y deja el aviso en su lugar por si el badge se acota o se
 * esconde más adelante.
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
