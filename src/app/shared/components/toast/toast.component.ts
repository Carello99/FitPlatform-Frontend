/**
 * ============================================================================
 *  FILE: toast.component.ts  —  VISTA della notifica toast globale
 * ============================================================================
 *  SCOPO: disegnare il toast. È la metà "VISTA" del pattern: ToastService tiene
 *    i DATI (quale messaggio), questo componente la PRESENTAZIONE.
 *  COSA RAPPRESENTA: componente sempre montato nella shell; legge il signal
 *    toastService.toast() e si mostra solo quando non è null (@if). Niente
 *    @Input/@Output: si collega direttamente al servizio globale.
 *  FLUSSO DATI: qualcuno chiama toastService.show() → il signal cambia → questo
 *    template reagisce e appare → dopo 2.4s il servizio lo azzera → sparisce.
 *  DIPENDENZE / USATO IN: ToastService; montato in phone-shell.component.ts.
 *    Animazioni entrata/uscita: classe .toast in _components.scss.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Componente che visualizza la notifica toast globale.
 *
 * Questo componente è sempre presente nel DOM (montato in phone-shell.component.ts),
 * ma è visibile solo quando il signal toast() del ToastService non è null.
 *
 * Dimostra il pattern "componente wrapper per signal":
 * - ToastService gestisce i DATI (quale messaggio mostrare)
 * - ToastComponent gestisce la VISTA (come mostrarlo)
 *
 * Il componente non ha input né output — legge direttamente dal servizio globale.
 */
@Component({
  selector: 'ff-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- @if (toastService.toast(); as t): mostrato solo se il signal non è null -->
    <!-- "as t": assegna il valore del signal alla variabile locale t -->
    @if (toastService.toast(); as t) {
      <!-- La classe CSS "toast" contiene le animazioni di entrata/uscita definite in _components.scss -->
      <div class="toast">
        <!-- t.icon: classe CSS dell'icona (es. "ti-circle-check-filled") -->
        <i class="ti" [class]="t.icon" aria-hidden="true"></i>
        <span>{{ t.msg }}</span>
      </div>
    }
  `,
})
export class ToastComponent {
  // "readonly" perché il campo non viene mai riassegnato dopo l'inizializzazione
  // Non è "private" perché il template deve accedervi
  readonly toastService = inject(ToastService);
}
