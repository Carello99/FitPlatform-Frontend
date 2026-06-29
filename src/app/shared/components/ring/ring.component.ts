/**
 * ============================================================================
 *  FILE: ring.component.ts  —  ANELLO DI PROGRESSO CIRCOLARE (SVG)
 * ============================================================================
 *  SCOPO: mostrare una percentuale (0..1) come anello che si riempie. Riusabile
 *    con dimensione/spessore/colore configurabili e contenuto centrale libero.
 *  COSA RAPPRESENTA: componente "dumb" SVG. Usa <ng-content> per proiettare al
 *    centro dell'anello ciò che il padre mette tra i tag (es. una percentuale).
 *  FLUSSO DATI: il padre passa [value] (e opz. size/stroke/color) → i getter
 *    r/circ/offset calcolano la geometria → la CSS transition anima il
 *    riempimento al cambio di value.
 *  COME FUNZIONA (trucco): stroke-dasharray = circonferenza, stroke-dashoffset
 *    = parte nascosta. offset = circ*(1-value): value 0 → tutto nascosto,
 *    value 1 → anello pieno. L'SVG è ruotato -90° per partire da "ore 12".
 *  DIPENDENZE / USATO IN: home, active-workout, profile.
 *  DEBUG: value deve stare in [0,1]; valori >1 o <0 disegnano un anello
 *    "oltre i bordi" (offset negativo) — normalizzarlo a monte se serve.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Anello di progressione circolare (SVG).
 *
 * Tecnica: "stroke-dasharray" + "stroke-dashoffset".
 * - stroke-dasharray = circonferenza totale: rende l'intero tratto un "dash" lungo quanto il cerchio
 * - stroke-dashoffset = quanto nascondere: 0 = cerchio pieno, circonferenza = cerchio vuoto
 *
 * <ng-content>: proietta il contenuto passato tra i tag del componente al centro dell'anello.
 * Esempio d'uso:
 *   <ff-ring [value]="0.75" [size]="72" [stroke]="7" color="var(--amber)">
 *     <span>75%</span>  ← proiettato al centro
 *   </ff-ring>
 *
 * Usato in: home.component.html, active-workout.component.html, profile.component.html
 */
@Component({
  selector: 'ff-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Contenitore con dimensioni dinamiche -->
    <div [style.position]="'relative'" [style.width.px]="size" [style.height.px]="size" style="flex-shrink:0">
      <!-- SVG ruotato di -90°: così il punto di partenza è in alto (nord) invece che a destra (est) -->
      <svg [attr.width]="size" [attr.height]="size" style="transform:rotate(-90deg)">
        <!-- Cerchio "track" (sfondo): mostra la traccia grigia completa -->
        <circle [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="r" fill="none" [attr.stroke]="track" [attr.stroke-width]="stroke"></circle>

        <!-- Cerchio "progress" (barra di avanzamento): usa stroke-dashoffset per mostrare solo la parte rilevante -->
        <!-- [attr.stroke-dasharray]="circ": lunghezza totale del tratteggio = circonferenza -->
        <!-- [style.stroke-dashoffset]="offset": quanto nascondere del tratteggio -->
        <!-- La transizione CSS anima lo spostamento dell'offset quando value cambia -->
        <circle [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="r" fill="none" [attr.stroke]="color" [attr.stroke-width]="stroke"
          stroke-linecap="round" [attr.stroke-dasharray]="circ"
          [style.stroke-dashoffset]="offset" style="transition:stroke-dashoffset 0.9s cubic-bezier(.16,1,.3,1)"></circle>
      </svg>

      <!-- Contenitore per il contenuto proiettato al centro dell'anello -->
      <!-- ng-content: "buco" dove Angular inserisce il contenuto passato dal padre -->
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class RingComponent {
  @Input() value = 0;              // Valore da 0 a 1 (es. 0.75 = 75%)
  @Input() size = 72;              // Dimensione in pixel
  @Input() stroke = 7;             // Spessore del tratto in pixel
  @Input() color = 'var(--amber)'; // Colore della barra di avanzamento
  @Input() track = 'var(--surface-3)'; // Colore della traccia di sfondo

  /** Raggio del cerchio (tenendo conto dello spessore del tratto). */
  get r(): number {
    // (size - stroke) / 2: il raggio deve tenere conto della metà del tratto per lato
    return (this.size - this.stroke) / 2;
  }

  /** Circonferenza del cerchio = 2πr. */
  get circ(): number {
    return 2 * Math.PI * this.r;
  }

  /**
   * Offset: quanto "nascondere" del tratteggio.
   * - value=0: offset=circ → nessun progresso visibile
   * - value=1: offset=0 → cerchio completo visibile
   * - value=0.75: offset=circ*0.25 → 75% visibile
   */
  get offset(): number {
    return this.circ * (1 - this.value);
  }
}
