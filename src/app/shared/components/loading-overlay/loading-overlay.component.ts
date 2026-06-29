/**
 * ============================================================================
 *  FILE: loading-overlay.component.ts  —  SCHERMATA DI CARICAMENTO (spinner)
 * ============================================================================
 *  SCOPO: vista mostrata dalla shell mentre i dati si caricano (store.loading()).
 *  COSA RAPPRESENTA: componente "dumb" con un solo @Input (label) e stili
 *    INCAPSULATI (campo `styles`): le classi qui non escono dal componente
 *    (View Encapsulation), quindi non collidono con CSS globali omonimi.
 *  FLUSSO DATI: la shell lo mostra in base a store.loading(); il padre può
 *    passare un testo via [label].
 *  DIPENDENZE / USATO IN: phone-shell.component.ts.
 *  DEBUG: se resta visibile "per sempre", il problema NON è qui ma nello store
 *    (loading() non torna mai false → load() non ha completato).
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Schermata di caricamento globale.
 * Mostrata dalla shell (phone-shell.component.ts) mentre i dati vengono caricati.
 *
 * Ha uno stile CSS incapsulato tramite il campo `styles` del decoratore @Component.
 * In Angular, ogni componente può avere stili propri che non "escono" fuori
 * dal componente (View Encapsulation). Le classi CSS definite qui non conflittano
 * con classi CSS globali dallo stesso nome.
 *
 * Vantaggio: componenti riutilizzabili con stili isolati.
 */
@Component({
  selector: 'ff-loading-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ff-loading">
      <div class="ff-spinner"></div>
      <!-- [label] è passato dal padre come: <ff-loading-overlay label="Caricamento…"> -->
      <span class="ff-loading__label">{{ label }}</span>
    </div>
  `,
  // styles: array di stringhe CSS — incapsulati in questo componente
  // Nota: si usa "styles" (array) per CSS inline, "styleUrl" per file .scss separato
  styles: [
    `
      /* Contenitore che riempie lo spazio disponibile (flex: 1) */
      .ff-loading {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
      }
      /* Cerchio spinner animato: border-top colorato che ruota */
      .ff-spinner {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        border: 3px solid var(--surface-3);  /* Tratto grigio base */
        border-top-color: var(--amber);       /* Solo il lato superiore è colorato → effetto spinner */
        animation: ff-spin 0.8s linear infinite;
      }
      .ff-loading__label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-3);
        letter-spacing: 0.2px;
      }
      /* Keyframe dell'animazione: ruota di 360° */
      @keyframes ff-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoadingOverlayComponent {
  // @Input() con valore di default: se il padre non passa nulla, usa "Caricamento…"
  @Input() label = 'Caricamento…';
}
