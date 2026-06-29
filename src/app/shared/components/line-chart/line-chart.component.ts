/**
 * ============================================================================
 *  FILE: line-chart.component.ts  —  GRAFICO A LINEA con area (SVG)
 * ============================================================================
 *  SCOPO: mostrare un andamento (es. trend del peso) come spezzata + area
 *    sfumata + punti. Componente "dumb": solo @Input, niente servizi.
 *  FLUSSO DATI: il padre passa [data] (number[]) → i getter points/path/area
 *    normalizzano i valori nello spazio SVG (W×H con padding) e generano i
 *    path. Si ridisegna quando data cambia (OnPush via nuovo riferimento).
 *  DIPENDENZE / USATO IN: progress/profile (trend peso).
 *  DEBUG:
 *    - `gid` è un id random per il <linearGradient>: serve a non far collidere
 *      due grafici nella stessa pagina (id SVG duplicati = gradiente sbagliato).
 *    - range = max-min ha floor a 1 per evitare /0 se i valori sono identici.
 *    - Con UN SOLO dato, (length-1)=0 → divisione per zero nella x: passare
 *      sempre almeno 2 punti.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Grafico a linea con area sfumata sotto (SVG).
 * Usato per visualizzare l'andamento del peso corporeo.
 *
 * Componente presentazionale: solo @Input, nessun servizio.
 * Il grafico è disegnato con SVG inline nel template Angular.
 */
@Component({
  selector: 'ff-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- SVG scalabile: viewBox definisce il sistema di coordinate interno (300×120) -->
    <!-- preserveAspectRatio="none": si adatta alla larghezza del contenitore senza proporzioni fisse -->
    <!-- [attr.viewBox]="...": [attr.xxx] binding per gli attributi SVG (non proprietà DOM) -->
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" style="width:100%;height:130px;margin-top:8px" preserveAspectRatio="none">
      <defs>
        <!-- Gradiente verticale per l'area sotto la linea -->
        <!-- [attr.id]="gid": ID univoco per evitare conflitti se ci sono più grafici nella pagina -->
        <linearGradient [attr.id]="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [attr.stop-color]="color" stop-opacity="0.28"></stop>
          <stop offset="100%" [attr.stop-color]="color" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <!-- Area sotto la linea: riempita con il gradiente -->
      <path [attr.d]="area" [attr.fill]="'url(#' + gid + ')'"></path>
      <!-- Linea del grafico: nessun riempimento, solo tratto colorato -->
      <path [attr.d]="path" fill="none" [attr.stroke]="color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <!-- Punti: cerchi su ogni dato; l'ultimo è più grande -->
      @for (p of points; track $index) {
        <!-- [attr.r]="...": raggio del cerchio (più grande per l'ultimo punto) -->
        <!-- [attr.fill]="...": l'ultimo punto è colorato, gli altri hanno il colore di sfondo -->
        <circle [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="$index === points.length - 1 ? 4 : 2.5"
          [attr.fill]="$index === points.length - 1 ? color : 'var(--bg-app)'" [attr.stroke]="color" stroke-width="2"></circle>
      }
    </svg>
  `,
})
export class LineChartComponent {
  // Array di valori numerici (es. pesi in kg per le ultime 8 settimane)
  @Input({ required: true }) data: number[] = [];

  // Colore della linea e dei punti
  @Input() color = 'var(--cyan)';

  // Dimensioni del sistema di coordinate SVG
  readonly W = 300;
  readonly H = 120;
  private readonly pad = 8; // Padding interno per non tagliare i punti ai bordi

  // ID univoco per il gradiente: evita conflitti se ci sono più grafici nella stessa pagina
  // Math.random().toString(36).slice(2, 8): genera una stringa casuale alfanumerica
  readonly gid = 'lg-' + Math.random().toString(36).slice(2, 8);

  /**
   * Getter: calcola le coordinate SVG (x, y) per ogni punto.
   * I valori vengono normalizzati nell'intervallo [pad, W-pad] × [pad, H-pad].
   */
  get points(): [number, number][] {
    const min = Math.min(...this.data);
    const max = Math.max(...this.data);
    const range = max - min || 1; // Evita divisione per 0 se tutti i valori sono uguali

    return this.data.map((v, i) => {
      // x: distribuisce i punti orizzontalmente in modo uniforme
      const x = this.pad + (i / (this.data.length - 1)) * (this.W - this.pad * 2);
      // y: valori più alti → y più basso (SVG ha y=0 in alto)
      const y = this.pad + (1 - (v - min) / range) * (this.H - this.pad * 2);
      return [x, y];
    });
  }

  /**
   * Getter: costruisce il path SVG della linea.
   * "M" = moveto (primo punto), "L" = lineto (punti successivi)
   * .toFixed(1): arrotonda a 1 decimale per ridurre la lunghezza del path
   */
  get path(): string {
    return this.points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  }

  /**
   * Getter: costruisce il path SVG dell'area chiusa sotto la linea.
   * Aggiunge due "L" per scendere al bordo inferiore e chiudere la forma con "Z".
   */
  get area(): string {
    const pts = this.points;
    // Scende verticalmente dall'ultimo punto al bordo, poi torna al primo e chiude
    return this.path + ` L ${pts[pts.length - 1][0]} ${this.H} L ${pts[0][0]} ${this.H} Z`;
  }
}
