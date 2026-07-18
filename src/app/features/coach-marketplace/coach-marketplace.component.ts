/**
 * ============================================================================
 *  FILE: coach-marketplace.component.ts  —  MARKETPLACE COACH (lato UTENTE)
 * ============================================================================
 *  SCOPO: scoprire e scegliere un coach. Due viste in un solo componente:
 *    - LISTA: ricerca + filtri per specialità + card coach.
 *    - PROFILO: dettaglio del coach selezionato con azioni "Scegli"/"Messaggia".
 *  COSA RAPPRESENTA: pagina dedicata raggiunta dall'hub Coach ("Esplora coach").
 *    Se l'utente non ha ancora un coach, la sezione Coach reindirizza qui.
 *  FLUSSO: TrainerService.catalog alimenta la lista; selezione via signal locale.
 *    "Scegli" invia una richiesta (toast) e torna all'hub; "Messaggia" → chat.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrainerService } from '../../core/services/trainer.service';
import { ToastService } from '../../core/services/toast.service';
import { CoachCard } from '../../core/data/trainer-mock';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';

@Component({
  selector: 'ff-coach-marketplace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeaderComponent],
  template: `
    <div class="screen-pad screen-anim">
      <ff-app-header></ff-app-header>

      @if (selected(); as c) {
        <!-- ============ PROFILO COACH ============ -->
        <div class="appbar">
          <button class="iconbtn" (click)="selected.set(null)" aria-label="Indietro"><i class="ti ti-chevron-left" style="font-size:22px" aria-hidden="true"></i></button>
          <div class="grow"><h1>Profilo coach</h1></div>
        </div>

        <section class="hero">
          <span class="avatar big" [style.background]="c.photoUrl ? 'transparent' : c.color">
            @if (c.photoUrl) { <img [src]="c.photoUrl" [alt]="c.name" /> } @else { {{ c.initials }} }
          </span>
          <h2 class="p-name">{{ c.name }}</h2>
          <div class="p-head">{{ c.headline }}</div>
          <div class="p-meta">
            <span class="pm"><i class="ti ti-star-filled" aria-hidden="true"></i>{{ c.rating }} <span class="rev">({{ c.reviews }})</span></span>
            <span class="pm-sep"></span>
            <span class="pm price">da €{{ c.priceFrom }}<span class="per">/sessione</span></span>
            @if (c.online) { <span class="pm-sep"></span><span class="pm online"><i class="ti ti-world" aria-hidden="true"></i>online</span> }
          </div>
          <div class="tags">@for (s of c.specialties; track s) { <span class="tag">{{ s }}</span> }</div>
        </section>

        <div class="ff-card block">
          <div class="block-hd"><i class="ti ti-user-heart" aria-hidden="true"></i><span>Chi è {{ firstName(c) }}</span></div>
          <p class="notes">{{ c.bio }}</p>
        </div>

        <div class="actions">
          <button class="ff-btn ff-btn--primary press" (click)="choose(c)"><i class="ti ti-user-check" aria-hidden="true"></i>Scegli come coach</button>
          <button class="ff-btn ff-btn--ghost press" (click)="message(c)"><i class="ti ti-message-circle" aria-hidden="true"></i>Messaggia</button>
        </div>
      } @else {
        <!-- ============ LISTA / VETRINA ============ -->
        <div class="appbar">
          <div class="grow">
            <h1>Esplora coach</h1>
            <div class="sub">Trova il professionista giusto per te</div>
          </div>
        </div>

        <!-- Ricerca -->
        <div class="search">
          <i class="ti ti-search" aria-hidden="true"></i>
          <input type="text" placeholder="Cerca per nome o specialità" [value]="query()" (input)="onQuery($event)" />
        </div>

        <!-- Filtri specialità -->
        <div class="scroll-x chips">
          <button class="chip" [class.active]="filter() === 'Tutti'" (click)="filter.set('Tutti')">Tutti</button>
          @for (s of specialties(); track s) {
            <button class="chip" [class.active]="filter() === s" (click)="filter.set(s)">{{ s }}</button>
          }
        </div>

        <!-- Card coach -->
        @if (results().length) {
          <div class="col">
            @for (c of results(); track c.id) {
              <button class="coach press" (click)="selected.set(c)">
                <span class="avatar" [style.background]="c.photoUrl ? 'transparent' : c.color">
                  @if (c.photoUrl) { <img [src]="c.photoUrl" [alt]="c.name" /> } @else { {{ c.initials }} }
                </span>
                <span class="c-info">
                  <span class="c-top"><span class="c-name">{{ c.name }}</span><span class="c-rate"><i class="ti ti-star-filled" aria-hidden="true"></i>{{ c.rating }}</span></span>
                  <span class="c-head">{{ c.headline }}</span>
                  <span class="c-foot">da €{{ c.priceFrom }}/sessione · {{ c.reviews }} recensioni</span>
                </span>
                <i class="ti ti-chevron-right c-go" aria-hidden="true"></i>
              </button>
            }
          </div>
        } @else {
          <p class="empty"><i class="ti ti-search-off" aria-hidden="true"></i> Nessun coach trovato.</p>
        }
      }
    </div>
  `,
  styles: [`
    .search { display: flex; align-items: center; gap: 9px; margin-top: 16px; padding: 11px 14px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--hairline); }
    .search .ti { font-size: 19px; color: var(--ink-3); }
    .search input { flex: 1; background: none; border: none; outline: none; color: var(--ink); font-family: inherit; font-size: 14px; font-weight: 600; }
    .search input::placeholder { color: var(--ink-4); }

    .chips { margin-top: 12px; }
    .col { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }

    /* ---- Card coach (lista) ---- */
    .coach { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 13px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--hairline); font-family: inherit; color: inherit; text-align: left; cursor: pointer; }
    .avatar { width: 52px; height: 52px; flex: none; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; color: var(--amber-ink); font-size: 17px; font-weight: 800; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .c-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .c-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .c-name { font-size: 15px; font-weight: 800; letter-spacing: -.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .c-rate { flex: none; display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 800; color: var(--amber); }
    .c-rate .ti { font-size: 13px; }
    .c-head { font-size: 12.5px; font-weight: 600; color: var(--ink-2); margin-top: 1px; }
    .c-foot { font-size: 11px; font-weight: 600; color: var(--ink-4); margin-top: 3px; }
    .c-go { font-size: 20px; color: var(--ink-4); flex: none; }

    .empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px 10px; font-size: 13px; font-weight: 600; color: var(--ink-3); }
    .empty .ti { font-size: 20px; }

    /* ---- Profilo coach ---- */
    .hero { text-align: center; padding: 6px 0 2px; }
    .avatar.big { width: 84px; height: 84px; font-size: 28px; box-shadow: var(--shadow-amber); display: inline-flex; }
    .p-name { font-size: 22px; font-weight: 800; letter-spacing: -.5px; margin-top: 12px; }
    .p-head { font-size: 13px; font-weight: 700; color: var(--amber); margin-top: 3px; text-transform: uppercase; letter-spacing: .4px; }
    .p-meta { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); }
    .pm { display: inline-flex; align-items: center; gap: 4px; }
    .pm .ti { font-size: 14px; color: var(--amber); }
    .pm .rev { color: var(--ink-4); font-weight: 700; }
    .pm.price { color: var(--ink); font-weight: 800; }
    .pm .per { color: var(--ink-4); font-weight: 600; font-size: 11px; }
    .pm.online { color: var(--green); }
    .pm.online .ti { color: var(--green); }
    .pm-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--ink-4); }
    .tags { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 14px; }
    .tag { font-size: 11.5px; font-weight: 700; color: var(--ink-2); background: var(--surface-3); border: 1px solid var(--hairline); padding: 5px 12px; border-radius: var(--r-pill); }

    .ff-card { background: var(--surface-2); border: 1px solid var(--hairline); border-radius: var(--r-lg); box-shadow: var(--shadow-card); }
    .block { padding: 15px; margin-top: 16px; }
    .block-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .block-hd > .ti { font-size: 17px; color: var(--ink-2); }
    .block-hd > span { font-size: 13.5px; font-weight: 800; letter-spacing: -.2px; }
    .notes { font-size: 13px; font-weight: 500; color: var(--ink-2); line-height: 1.55; }

    .actions { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 16px; }
    .ff-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 14px; font-family: inherit; font-size: 14.5px; font-weight: 800; border: 1px solid transparent; cursor: pointer; }
    .ff-btn .ti { font-size: 18px; }
    .ff-btn--primary { background: var(--amber); color: var(--amber-ink); box-shadow: var(--shadow-amber); }
    .ff-btn--ghost { background: var(--surface-2); color: var(--ink); border-color: var(--hairline); }
  `],
})
export class CoachMarketplaceComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly t = inject(TrainerService);

  readonly query = signal('');
  readonly filter = signal('Tutti');
  readonly selected = signal<CoachCard | null>(null);

  /** Elenco unico di specialità presenti nel catalogo (per i chip filtro). */
  readonly specialties = computed(() => {
    const set = new Set<string>();
    this.t.catalog.forEach((c) => c.specialties.forEach((s) => set.add(s)));
    return [...set];
  });

  /** Coach filtrati per testo di ricerca e specialità. */
  readonly results = computed<CoachCard[]>(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.t.catalog.filter((c) => {
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.headline.toLowerCase().includes(q) || c.specialties.some((s) => s.toLowerCase().includes(q));
      const matchF = f === 'Tutti' || c.specialties.includes(f);
      return matchQ && matchF;
    });
  });

  firstName(c: CoachCard): string { return c.name.split(' ')[0]; }

  onQuery(ev: Event): void { this.query.set((ev.target as HTMLInputElement).value); }

  choose(c: CoachCard): void {
    this.toast.show(`Richiesta inviata a ${this.firstName(c)}`, 'ti-user-check');
    this.selected.set(null);
    void this.router.navigate(['/personal-trainer']);
  }

  message(c: CoachCard): void {
    this.toast.show(`Chat con ${this.firstName(c)}`, 'ti-message-circle');
    void this.router.navigate(['/messaggi']);
  }
}
