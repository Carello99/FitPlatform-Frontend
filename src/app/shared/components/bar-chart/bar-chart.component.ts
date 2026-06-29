/**
 * ============================================================================
 *  FILE: bar-chart.component.ts  —  GRAFICO A BARRE animato [presentazionale]
 * ============================================================================
 *  SCOPO: disegnare un set di barre proporzionali a partire da un array di dati.
 *  COSA RAPPRESENTA: componente "dumb" — riceve [data] via @Input, non conosce
 *    servizi né stato globale, si limita a visualizzare.
 *  FLUSSO DATI: il padre (progress) passa ChartBar[] → il getter max() trova il
 *    valore massimo → ogni barra ha altezza % = (v/max)*100. Etichetta = d.l||d.m.
 *  DIPENDENZE / USATO IN: progress.component.html. Tipo ChartBar dai models.
 *  DEBUG: max() ha un floor a 1 PER EVITARE divisione per zero quando tutti i
 *    valori sono 0 (altrimenti NaN% sulle altezze → barre invisibili/rotte).
 * ============================================================================
 */
// ChangeDetectionStrategy, Component: basi di un componente Angular
// Input: decorator per le proprietà ricevute dal componente padre
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ChartBar } from '../../../core/models/workout.models';

/**
 * Grafico a barre animato — componente riusabile.
 *
 * Questo è un classico componente PRESENTAZIONALE (dumb component):
 * - Riceve dati via @Input
 * - Non conosce servizi o stato globale
 * - Si preoccupa solo di visualizzare ciò che riceve
 *
 * Usato in: progress.component.html
 */
@Component({
  selector: 'ff-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Template inline: il componente è abbastanza semplice
  template: `
    <!-- Contenitore con altezza fissa (140px) — le barre si posizionano in basso (flex-end) -->
    <div class="row between" style="align-items:flex-end;height:140px;gap:8px;margin-top:6px">
      @for (d of data; track $index) {
        <div class="col center grow" style="gap:8px;justify-content:flex-end;height:100%">
          <!-- Valore numerico sopra la barra (trasparente se 0) -->
          <div style="font-size:10px;font-weight:800" [style.color]="d.v ? 'var(--ink-2)' : 'transparent'">{{ d.v || 0 }}</div>

          <!-- La barra vera e propria -->
          <!-- [style.height.%]="(d.v / max) * 100": altezza proporzionale al valore massimo -->
          <!-- max è un getter che calcola il valore massimo dell'array -->
          <!-- [style.background]="...": colore dell'accento se ha valore, grigio se 0 -->
          <!-- [style.transition]="...": animazione con delay sfasato per ogni barra -->
          <div style="width:100%;max-width:26px;border-radius:7px"
            [style.height.%]="(d.v / max) * 100"
            [style.min-height.px]="d.v ? 6 : 3"
            [style.background]="d.v ? accent : 'var(--surface-3)'"
            [style.opacity]="d.v ? 1 : 0.5"
            [style.transition]="'height 0.7s cubic-bezier(.16,1,.3,1) ' + ($index * 0.05) + 's'"></div>

          <!-- Etichetta sotto la barra: usa d.l se presente, altrimenti d.m -->
          <!-- d.l || d.m: operatore OR — usa il primo truthy -->
          <span style="font-size:10.5px;font-weight:700;color:var(--ink-3)">{{ d.l || d.m }}</span>
        </div>
      }
    </div>
  `,
})
export class BarChartComponent {
  // @Input({ required: true }): dato obbligatorio — array di ChartBar
  @Input({ required: true }) data: ChartBar[] = [];

  // @Input(): colore opzionale delle barre (default: ambra)
  // Nota: non è un property binding nel padre, ma una stringa statica
  @Input() accent = 'var(--amber)';

  /**
   * Getter: calcola il valore massimo dell'array per normalizzare le altezze.
   * Math.max(...array): spread dell'array come argomenti separati
   * Il secondo argomento 1 evita max=0 se tutti i valori sono 0
   */
  get max(): number {
    return Math.max(...this.data.map((d) => d.v), 1);
  }
}
