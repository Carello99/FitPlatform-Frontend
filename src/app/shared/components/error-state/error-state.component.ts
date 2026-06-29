/**
 * ============================================================================
 *  FILE: error-state.component.ts  —  SCHERMATA ERRORE GLOBALE + "Riprova"
 * ============================================================================
 *  SCOPO: vista mostrata dalla shell quando il caricamento dati fallisce.
 *    Comunica all'utente il problema e offre un retry.
 *  COSA RAPPRESENTA: componente "dumb" controllato dal padre via @Input/@Output
 *    (pattern presentational): [message] in ingresso, (retry) in uscita.
 *  FLUSSO DATI: store.error() → la shell passa [message] → click "Riprova" →
 *    retry.emit() → la shell richiama store.load(). Il componente NON conosce
 *    lo store: è riusabile e disaccoppiato.
 *  DIPENDENZE / USATO IN: phone-shell.component.ts.
 *  DEBUG: se "Riprova" non fa nulla, verificare il binding (retry) nel padre;
 *    qui l'evento è solo emesso, l'azione vera è del genitore.
 * ============================================================================
 */
// EventEmitter: classe per emettere eventi verso il componente padre
// Input, Output: decoratori per input/output del componente
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Schermata di errore globale con pulsante "Riprova".
 * Mostrata dalla shell quando il caricamento dei dati fallisce.
 *
 * Comunica con il padre tramite:
 * - @Input message: il messaggio di errore da mostrare
 * - @Output retry: emette un evento void quando l'utente clicca "Riprova"
 *
 * Il padre usa questo componente così:
 *   <ff-error-state [message]="err" (retry)="store.load()"></ff-error-state>
 * Quando l'utente clicca Riprova → retry emette → il padre chiama store.load()
 */
@Component({
  selector: 'ff-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ff-error">
      <div class="itile t-rose" style="width:64px;height:64px;border-radius:20px">
        <i class="ti ti-plug-connected-x" style="font-size:32px" aria-hidden="true"></i>
      </div>
      <div class="ff-error__title">Qualcosa è andato storto</div>
      <!-- message: input passato dal padre (messaggio di errore dall'API) -->
      <p class="ff-error__msg">{{ message }}</p>
      <!-- (click)="retry.emit()": al click emette l'evento @Output senza payload (void) -->
      <button class="btn btn-primary" (click)="retry.emit()">
        <i class="ti ti-refresh" style="font-size:18px" aria-hidden="true"></i> Riprova
      </button>
    </div>
  `,
  styles: [
    `
      .ff-error {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 0 32px;
        text-align: center;
      }
      .ff-error__title {
        font-size: 19px;
        font-weight: 800;
        letter-spacing: -0.3px;
        margin-top: 6px;
      }
      .ff-error__msg {
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink-3);
        line-height: 1.5;
        margin-bottom: 6px;
      }
    `,
  ],
})
export class ErrorStateComponent {
  // @Input(): messaggio di errore ricevuto dal padre
  @Input() message = 'Impossibile caricare i dati.';

  // @Output(): evento emesso quando l'utente vuole riprovare
  // EventEmitter<void>: void = nessun payload (il padre sa solo che è stato cliccato)
  @Output() retry = new EventEmitter<void>();
}
