/**
 * ============================================================================
 *  FILE: request-strip.component.ts  —  LA STRIP "DA CONFERMARE"
 * ============================================================================
 *  SCOPO: dire quante richieste attendono una risposta e portare al giorno che
 *    le riguarda. Sta sotto al mese, in testa alla pagina: è la prima cosa che
 *    si legge entrando, e da lì si scende al giorno.
 *
 *  LA REGOLA CHE LA GIUSTIFICA: costo zero a riposo. Se non c'è niente da
 *    confermare la strip non esiste — niente tab permanente, niente empty state
 *    che si annuncia. Un vuoto che occupa spazio è rumore.
 *
 *  COSA NON FA: non decide. Emette solo `focusDay`: ogni riga ha un tasto solo,
 *    la freccia, che seleziona quel giorno e ci porta la vista. Accettare o
 *    rifiutare da una lista vuol dire decidere senza vedere il calendario —
 *    e senza vedere cosa c'era in quel giorno prima.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { AgendaRequestStore } from '../../core/services/agenda-request.service';
import { RequestCardComponent } from '../../shared/components/request-card/request-card.component';

@Component({
  selector: 'ff-request-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RequestCardComponent],
  template: `
    @if (items().length) {
      <div class="rs" [class.open]="open()">
        <button
          class="rs-hd press"
          (click)="toggle()"
          [attr.aria-expanded]="open()"
          aria-controls="rs-body"
        >
          <span class="rs-dot" [class.urgent]="hasUrgent()"></span>
          <span class="rs-t">{{ label() }}</span>
          @if (store.unseenCount(); as n) { <span class="rs-new">{{ n }} nuove</span> }
          <i class="ti ti-chevron-down rs-chev" aria-hidden="true"></i>
        </button>

        @if (open()) {
          <div class="rs-body" id="rs-body">
            <!-- Le richieste hanno DUE versi, e mescolarle costringeva a leggere
                 ogni card per capire chi aspetta chi. La barra li separa: le due
                 esistono già nello store (toAnswer / awaiting), qui si sceglie
                 quale guardare. Un lato senza richieste è comunque un fatto —
                 «niente in attesa dal coach» — quindi il segmento resta, non
                 sparisce, e il conteggio lo dice. -->
            <nav class="rs-seg" role="tablist" aria-label="Direzione delle richieste">
              <button class="rs-seg-b press" [class.on]="tab() === 'from'" role="tab"
                      [attr.aria-selected]="tab() === 'from'" (click)="tab.set('from')">
                Dal coach
                @if (store.toAnswerCount(); as n) { <span class="rs-seg-n">{{ n }}</span> }
              </button>
              <button class="rs-seg-b press" [class.on]="tab() === 'to'" role="tab"
                      [attr.aria-selected]="tab() === 'to'" (click)="tab.set('to')">
                Al coach
                @if (awaitingCount(); as n) { <span class="rs-seg-n">{{ n }}</span> }
              </button>
            </nav>

            <div class="rs-list" role="list" aria-live="polite">
              @for (r of shown(); track r.id) {
                <div role="listitem">
                  <ff-request-card
                    [req]="r"
                    variant="strip"
                    [bodyTappable]="true"
                    actions="open"
                    (openDay)="focusDay.emit($event)"
                  />
                </div>
              } @empty {
                <p class="rs-empty">{{ tab() === 'from' ? 'Nessuna proposta dal coach da confermare.' : 'Non hai richieste in attesa dal coach.' }}</p>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .rs {
      margin: 2px 0 12px; border-radius: var(--r-md);
      border: 1px solid rgba(245, 166, 35, .30);
      background: color-mix(in srgb, var(--amber) 6%, transparent);
      overflow: hidden;
    }

    .rs-hd {
      width: 100%; display: flex; align-items: center; gap: 9px;
      padding: 12px 14px; background: none; border: none;
      color: var(--ink); font-family: inherit; cursor: pointer; text-align: left;
    }
    .rs-dot {
      width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--amber);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--amber) 18%, transparent);
    }
    .rs-dot.urgent {
      background: var(--rose);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--rose) 18%, transparent);
    }
    .rs-t { flex: 1; font-size: 13.5px; font-weight: 800; letter-spacing: -.2px; }
    .rs-new {
      flex: none; font-size: 9.5px; font-weight: 800; text-transform: uppercase;
      letter-spacing: .3px; color: var(--amber-ink); background: var(--amber);
      padding: 3px 8px; border-radius: var(--r-pill);
    }
    .rs-chev { flex: none; font-size: 17px; color: var(--amber); transition: transform .18s; }
    .rs.open .rs-chev { transform: rotate(180deg); }

    .rs-body { padding: 0 10px 10px; }

    /* Segmented control — gli STESSI token della barra di Schede e Coach
       (.segment/.seg/.seg.on): fondo surface-2, bordo hairline-strong, voce
       attiva surface-4. Non si tinge d'ambra per "intonarsi" alla strip: una
       barra che cambia colore a seconda della sezione insegna all'utente una
       mappa che poi non vale. Unica aggiunta, il contapallino, neutro. */
    .rs-seg { display: flex; gap: 3px; margin: 2px 0 10px; padding: 5px;
      background: var(--surface-2); border: 1px solid var(--hairline-strong);
      border-radius: var(--r-pill); }
    .rs-seg-b { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 0; border-radius: var(--r-pill); background: none; border: none;
      color: var(--ink-3); font-family: inherit; font-size: 12.5px; font-weight: 800;
      cursor: pointer; transition: background .16s, color .16s; }
    .rs-seg-b.on { background: var(--surface-4); color: var(--ink); box-shadow: var(--shadow-card); }
    .rs-seg-n { min-width: 17px; height: 17px; padding: 0 5px; border-radius: 999px;
      background: var(--surface-3); color: var(--ink-2); font-size: 10px; font-weight: 800;
      display: inline-flex; align-items: center; justify-content: center; }
    .rs-seg-b.on .rs-seg-n { background: var(--surface-2); color: var(--ink); }

    .rs-list { display: flex; flex-direction: column; gap: 8px; }
    .rs-empty { font-size: 12px; font-weight: 600; color: var(--ink-3); text-align: center; padding: 12px 8px; }
  `],
})
export class RequestStripComponent {
  readonly store = inject(AgendaRequestStore);

  /** Il giorno da mettere a fuoco nel calendario: unica cosa che la strip fa. */
  readonly focusDay = output<string>();

  readonly open = signal(false);

  /** Quale verso si sta guardando: 'from' = dal coach, 'to' = al coach. */
  readonly tab = signal<'from' | 'to'>('from');

  /** Serve solo a decidere se la strip esiste (item totali, senza filtro). */
  readonly items = computed(() => [...this.store.toAnswer(), ...this.store.awaiting()]);

  readonly awaitingCount = computed(() => this.store.awaiting().length);

  /** Le richieste del verso scelto. */
  readonly shown = computed(() =>
    this.tab() === 'from' ? this.store.toAnswer() : this.store.awaiting(),
  );

  readonly hasUrgent = computed(() => this.store.toAnswer().some((r) => this.store.isUrgent(r)));

  readonly label = computed(() => {
    const mine = this.store.toAnswerCount();
    const wait = this.store.awaiting().length;
    if (mine && wait) return `${mine} da confermare · ${wait} in attesa`;
    if (mine) return mine === 1 ? '1 da confermare' : `${mine} da confermare`;
    return wait === 1 ? '1 richiesta in attesa' : `${wait} richieste in attesa`;
  });

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      // Aprendo, parti dal verso che chiede una TUA decisione — «dal coach» —
      // e cadi su «al coach» solo se lì non c'è niente da fare. Un vuoto non è
      // il primo posto dove far atterrare l'occhio.
      this.tab.set(this.store.toAnswerCount() ? 'from' : 'to');
      // Aprire la strip è l'atto con cui l'utente "legge" le richieste.
      this.store.markSeen();
    }
  }
}
