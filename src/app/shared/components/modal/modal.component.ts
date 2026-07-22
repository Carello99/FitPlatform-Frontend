/**
 * ============================================================================
 *  FILE: modal.component.ts  —  L'UNICO MODALE DELL'APP
 * ============================================================================
 *  SCOPO: sheet e dialoghi non si disegnano più a mano con uno scrim in
 *    `position: absolute`. Si avvolge il contenuto in `<ff-modal>` e si dice
 *    quando è aperto.
 *
 *  PERCHÉ UN <dialog> NATIVO: `.screen` — il contenitore che scorre — ha
 *    `contain: paint` (indispensabile al coverflow, vedi `_layout.scss`). La
 *    paint containment rende quell'elemento il BLOCCO CONTENITORE dei
 *    discendenti `absolute` e `fixed`: un velo `inset: 0` dichiarato lì dentro
 *    non copre lo schermo, copre il primo schermo di CONTENUTO, e scorre con
 *    esso. Aprendo un foglio dopo aver scrollato restava un buco in fondo,
 *    dalla nav bar in giù, con la pagina che si vedeva sotto.
 *    Il TOP LAYER del dialog nativo sta fuori da ogni contenimento, da ogni
 *    `overflow` e da ogni z-index: il problema non si può ripresentare.
 *
 *  IN REGALO, rispetto al velo fatto a mano: Esc chiude, il focus resta dentro
 *    il foglio, il resto della pagina diventa inerte per mouse e screen reader.
 *
 *  COSA PROIETTA: il contenuto è quello di chi lo usa — `.sheet` (foglio dal
 *    basso) o `.dialog` (riquadro al centro, con `center`). Gli stili di quel
 *    contenuto restano di chi lo scrive: qui dentro c'è solo il contenitore.
 * ============================================================================
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'ff-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="ff-dlg"
      [class.center]="center()"
      [class.full]="full()"
      (close)="closed.emit()"
      (click)="onBackdrop($event, dlg)"
    >
      <ng-content />
    </dialog>
  `,
  styles: [
    `
      /* Il componente non deve occupare spazio: esiste solo il dialog. */
      :host { display: contents; }

      .ff-dlg {
        width: 100%; max-width: 100%; height: 100%; max-height: 100%;
        margin: 0; padding: 0; border: 0; background: none; overflow: visible;
        display: flex; align-items: flex-end;
        /* Il foglio di stile del browser dà a <dialog> color: CanvasText —
           nero, e non segue il tema dell'app. */
        color: var(--ink);
      }
      /* Riquadro centrato invece che foglio dal basso. */
      .ff-dlg.center { align-items: center; justify-content: center; padding: 24px; }
      /* Pannello pieno: il contenuto prende tutto lo schermo. */
      .ff-dlg.full { align-items: stretch; }
      .ff-dlg.full > * { flex: 1; min-height: 0; }
      .ff-dlg:not([open]) { display: none; }

      /* Il velo lo disegna il browser, nel top layer: niente z-index da
         inseguire e niente contenimento che possa spostarlo. */
      .ff-dlg::backdrop {
        background: rgba(4, 4, 8, 0.62);
        backdrop-filter: blur(3px);
        animation: ff-dlg-in 0.22s ease;
      }
      @keyframes ff-dlg-in { from { opacity: 0; } to { opacity: 1; } }
    `,
  ],
})
export class ModalComponent {
  /** Aperto o chiuso: lo stato resta di chi usa il modale. */
  readonly open = input(false);
  /** True per un riquadro al centro; default è il foglio che sale dal basso. */
  readonly center = input(false);
  /** True per un pannello a tutto schermo (es. un editor). */
  readonly full = input(false);
  /** Emesso a chiusura avvenuta, comunque sia stata chiesta: tap fuori, Esc, codice. */
  readonly closed = output<void>();

  private readonly dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    // Lo stato vive nel signal di chi ci sta sopra; qui lo si riversa sul DOM.
    // Le guardie su `el.open` evitano la doppia chiamata, che il browser
    // punirebbe con un errore.
    effect(() => {
      const el = this.dlg()?.nativeElement;
      if (!el) return;
      if (this.open() && !el.open) el.showModal();
      else if (!this.open() && el.open) el.close();
    });
  }

  /**
   * Tap fuori dal contenuto = chiudi. Il dialog occupa tutto lo schermo ed è
   * trasparente: se il bersaglio del click è il dialog stesso, il dito è
   * finito sul velo e non sul foglio. Vale anche il gesto di trascinamento che
   * finisce fuori, che con lo `stopPropagation` a mano invece chiudeva.
   */
  onBackdrop(ev: MouseEvent, el: HTMLDialogElement): void {
    if (ev.target === el) el.close();
  }
}
