/**
 * ============================================================================
 *  FILE: diff.component.ts  —  INDICATORE DIFFICOLTÀ (3 pallini) [presentazionale]
 * ============================================================================
 *  SCOPO: mostrare il livello 1-3 come ●●○. Componente "dumb" (di sola
 *    presentazione): nessun servizio, nessuno stato, un solo @Input.
 *  FLUSSO DATI: il padre passa [level]; il template accende N pallini.
 *  DIPENDENZE: classe CSS .diff/.on in _components.scss. USATO IN: home,
 *    schede, scheda-detail, new-scheda, summary.
 *  DEBUG: level fuori da 1-3 non rompe nulla (semplici confronti <=), ma
 *    valori >3 mostreranno comunque al massimo 3 pallini.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Indicatore di difficoltà a tre pallini.
 *
 * Mostra 1, 2 o 3 pallini pieni in base al livello (1-3).
 * Esempio: livello 2 → ●●○
 *
 * È il componente più semplice del progetto:
 * - Un solo @Input
 * - Nessun servizio
 * - Template minimale
 *
 * Usato in: home.component.html, schede.component.html,
 *           scheda-detail.component.html, new-scheda.component.html, summary.component.html
 */
@Component({
  selector: 'ff-diff',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="diff">
      <!-- [class.on]="1 <= level": aggiunge la classe "on" al primo pallino se level >= 1 -->
      <!-- [class.on]="2 <= level": aggiunge "on" al secondo se level >= 2 -->
      <!-- [class.on]="3 <= level": aggiunge "on" al terzo solo se level == 3 -->
      <!-- La classe "on" è definita in _components.scss: rende il pallino pieno/colorato -->
      <i [class.on]="1 <= level"></i>
      <i [class.on]="2 <= level"></i>
      <i [class.on]="3 <= level"></i>
    </span>
  `,
})
export class DiffComponent {
  // @Input() senza required: ha un valore di default (1 = principiante)
  @Input() level = 1;
}
