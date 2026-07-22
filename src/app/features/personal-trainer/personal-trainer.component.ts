/**
 * ============================================================================
 *  FILE: personal-trainer.component.ts  —  HUB COACH (lato UTENTE)
 * ============================================================================
 *  SCOPO: unico punto della relazione col PT. Risponde a UNA domanda —
 *    «chi mi segue, e cosa sta facendo per me adesso?» — che nessun'altra
 *    schermata copre: l'Agenda dice quando, i Progressi come vai in generale,
 *    le Schede cosa fare.
 *
 *  STRUTTURA ([D-46](../../../DECISIONS.md)):
 *    - TESTA FISSA, sempre visibile: chi è lui (foto, ruolo, bio, specialità),
 *      il pulsante per scrivergli e le sedute che restano. Sono le cose che
 *      valgono qualunque tab si stia guardando.
 *    - SEGMENTED CONTROL su tre materie che non si mescolano:
 *        Schede    — il blocco in corso e i piani che ti ha assegnato
 *        Progressi — scheda per scheda: quella che ti ha dato sta funzionando?
 *        Dieta     — le foto del piano alimentare
 *      I tab ESISTONO SOLO SE HANNO CONTENUTO: senza piano alimentare non c'è
 *      il tab Dieta, e se ne resta uno solo la barra sparisce. È ciò che rende
 *      sicuro dare una sezione a qualcosa che dipende dal coach: quando non
 *      l'ha compilata, non lascia un buco — non c'è.
 *
 *  FLUSSO: legge TrainerService (profilo, focus, piano alimentare) e
 *    WorkoutStore (schede del coach, storico per scheda). Naviga a /messaggi.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrainerService } from '../../core/services/trainer.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { ToastService } from '../../core/services/toast.service';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { ChartBar, Scheda } from '../../core/models/workout.models';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';
import { BarChartComponent } from '../../shared/components/bar-chart/bar-chart.component';
import { PhotoViewerComponent } from '../../shared/components/photo-viewer/photo-viewer.component';

type CoachTab = 'schede' | 'progressi' | 'dieta';

/** Un esercizio della scheda con quanto è cambiato il carico dall'inizio. */
interface LoadRow {
  name: string;
  kg: number;
  delta: number; // rispetto alla prima volta che l'hai fatto con questa scheda
}

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

@Component({
  selector: 'ff-personal-trainer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeaderComponent, BarChartComponent, PhotoViewerComponent],
  template: `
    <div class="screen-pad screen-anim">
      <ff-app-header></ff-app-header>

      <!-- ===================================================================
           TESTA: chi è lui. Non è dentro un tab perché non è una materia tra
           le altre — è il soggetto della schermata.
           =================================================================== -->
      <section class="hero">
        <span class="avatar" [style.background]="t.trainer.photoUrl ? 'transparent' : t.trainer.color">
          @if (t.trainer.photoUrl) { <img [src]="t.trainer.photoUrl" [alt]="t.trainer.name" /> }
          @else { {{ t.trainer.initials }} }
        </span>
        <h1 class="name">{{ t.trainer.name }}</h1>
        <div class="sub">
          <span class="ff-badge">{{ t.trainer.role }}</span>
          <span class="rating"><i class="ti ti-star-filled" aria-hidden="true"></i>{{ t.trainer.rating }}</span>
        </div>
        <!-- La storia vostra, non una statistica: dice da quanto vi conoscete. -->
        <div class="rel">{{ together() }} · {{ t.trainer.sessionsDone }} sedute insieme</div>
        <p class="bio">{{ t.trainer.bio }}</p>
        <div class="tags">@for (sp of t.trainer.specialties; track sp) { <span class="tag">{{ sp }}</span> }</div>

        <div class="hero-actions">
          <button class="ff-btn ff-btn--primary press" (click)="go('messaggi')">
            <i class="ti ti-message-circle" aria-hidden="true"></i>Messaggia il coach
            @if (t.unread()) { <span class="ha-badge">{{ t.unread() }}</span> }
          </button>
        </div>
      </section>

      <!-- ===== SEDUTE RESIDUE: una striscia, non una sezione =====
           Quante ne restano è un dato di stato: si legge di sfuggita, sotto la
           CTA. Il rinnovo è la sua unica azione. -->
      <section class="pkg">
        <div class="pkg-top">
          <span class="pkg-l">Sedute del pacchetto</span>
          <span class="pkg-n">{{ t.trainer.sessionsLeft }} di {{ t.trainer.packageTotal }}</span>
        </div>
        <div class="track"><div class="fill" [style.width.%]="pkgPct()"></div></div>
        <button class="pkg-cta press" (click)="toast.show('Richiesta di rinnovo inviata', 'ti-refresh')">
          <i class="ti ti-refresh" aria-hidden="true"></i>Rinnova
        </button>
      </section>

      <!-- ===== SEGMENTED CONTROL: solo i tab che hanno qualcosa dentro ===== -->
      @if (tabs().length > 1) {
        <nav class="segment" role="tablist" aria-label="Sezioni coach">
          @for (tb of tabs(); track tb.key) {
            <button class="seg press" [class.on]="tab() === tb.key" role="tab"
                    [attr.aria-selected]="tab() === tb.key" (click)="setTab(tb.key)">{{ tb.label }}</button>
          }
        </nav>
      }

      @switch (tab()) {

        <!-- ---------- SCHEDE: il blocco in corso e i piani assegnati ---------- -->
        @case ('schede') {
          <!-- Il blocco che stai facendo adesso: lo scrive lui dalla sua app.
               Se non l'ha scritto, non c'è — e il tab resta comunque sensato. -->
          @if (t.trainer.focus; as f) {
            <div class="ff-card block fk">
              <div class="fk-top">
                <span class="fk-t">{{ f.title }}</span>
                <span class="fk-w">Settimana {{ f.weekCurrent }} di {{ f.weeks }}</span>
              </div>
              <div class="track"><div class="fill" [style.width.%]="focusPct()"></div></div>
              @if (f.note) { <p class="fk-note">{{ f.note }}</p> }
            </div>
          }

          <div class="sk-list">
            @for (s of coachSchede(); track s.id) {
              <button class="sked press" (click)="openScheda(s.id)">
                <span class="sk-ic" [class]="TILE_CLASS[s.accent]"><i class="ti" [class]="s.icon" aria-hidden="true"></i></span>
                <span class="sk-txt">
                  <span class="sk-name">{{ s.name }}</span>
                  <span class="sk-meta">{{ s.focus }} · {{ s.duration }} min · {{ s.exercises.length }} eserc.</span>
                </span>
                <i class="ti ti-player-play-filled sk-go" aria-hidden="true"></i>
              </button>
            }
          </div>
        }

        <!-- ---------- PROGRESSI: una scheda alla volta ----------
             La domanda è «la scheda che mi ha dato sta funzionando?», e si
             risponde su UNA scheda per volta: le chips scelgono, sotto ci sono
             i numeri di quella. Niente seconda lista di card: l'elenco delle
             schede esiste già nel tab accanto. -->
        @case ('progressi') {
          <div class="scroll-x chips">
            @for (s of coachSchede(); track s.id) {
              <button class="chip press" [class.active]="progId() === s.id" (click)="picked.set(s.id)">{{ s.name }}</button>
            }
          </div>

          @if (progScheda(); as s) {
            @if (progHistory().length) {
              <!-- Tre numeri, ognuno con la sua etichetta: un numero da solo
                   non vuol dire niente (PRODUCT §4.4). -->
              <div class="ff-card block">
                <div class="prog3">
                  <div class="pg"><span class="pg-v">{{ progHistory().length }}</span><span class="pg-l">volte fatta</span></div>
                  <div class="pg"><span class="pg-v">{{ volTotK() }}</span><span class="pg-l">volume (k kg)</span></div>
                  <div class="pg"><span class="pg-v">{{ prTot() }}</span><span class="pg-l">record</span></div>
                </div>
                <div class="prog-sub">Ultima volta {{ short(lastDate()) }}</div>
              </div>

              <div class="ff-card block">
                <div class="block-hd"><i class="ti ti-chart-bar" aria-hidden="true"></i><span>Volume per seduta</span></div>
                <ff-bar-chart [data]="volBars()" [accent]="accentVar(s)" />
                <div class="prog-sub">In migliaia di kg, dalla più vecchia alla più recente.</div>
              </div>

              @if (loads().length) {
                <div class="ff-card block">
                  <div class="block-hd"><i class="ti ti-barbell" aria-hidden="true"></i><span>Carichi</span></div>
                  <div class="loads">
                    @for (l of loads(); track l.name) {
                      <div class="ld">
                        <span class="ld-n">{{ l.name }}</span>
                        <span class="ld-v">{{ l.kg }} kg</span>
                        <span class="ld-d" [class.up]="l.delta > 0">
                          {{ l.delta > 0 ? '+' + l.delta + ' kg' : 'di partenza' }}
                        </span>
                      </div>
                    }
                  </div>
                  <div class="prog-sub">Il carico più alto che hai fatto, e quanto è cresciuto dalla prima volta.</div>
                </div>
              }
            } @else {
              <!-- Non è un vuoto da riempire: è un'informazione. Il coach ti ha
                   dato una scheda che non hai ancora usato. -->
              <div class="ff-card block empty">
                <i class="ti ti-hourglass-low" aria-hidden="true"></i>
                <div class="em-t">Non l'hai ancora fatta</div>
                <div class="em-s">I progressi di «{{ s.name }}» compaiono dopo il primo allenamento.</div>
                <button class="ff-btn ff-btn--primary press" (click)="openScheda(s.id)">
                  <i class="ti ti-player-play-filled" aria-hidden="true"></i>Apri la scheda
                </button>
              </div>
            }
          }
        }

        <!-- ---------- DIETA: delle foto, ed è tutto ciò che è ---------- -->
        @case ('dieta') {
          @if (t.currentDiet(); as d) {
            <div class="ff-card block">
              <div class="block-hd"><i class="ti ti-salad" aria-hidden="true"></i><span>Piano alimentare</span></div>
              <div class="pages">
                @for (p of d.photos; track p; let i = $index) {
                  <button class="page press" (click)="openViewer(i)" [attr.aria-label]="'Apri la pagina ' + (i + 1)">
                    <img [src]="p" alt="" />
                    <span class="page-n">{{ i + 1 }}</span>
                  </button>
                }
              </div>
              <!-- Chi firma e quando: in Italia la dieta non la prescrive il PT,
                   e una foto senza data non dice se è quella valida. -->
              <div class="sign">{{ d.author }} · {{ short(d.sentAt) }}</div>
              <div class="prog-sub">Tocca una pagina per leggerla ingrandita.</div>
            </div>
          }
        }
      }

      <!-- Footer discreto: scoperta occasionale, in fondo alla sezione per non
           competere con il coach attuale (come le azioni "gestione account"). -->
      <div class="mkt-foot">
        <span class="mkt-q">Vuoi valutare altre opzioni?</span>
        <button class="mkt-link press" (click)="go('coach-marketplace')"><i class="ti ti-compass" aria-hidden="true"></i>Esplora altri coach</button>
      </div>
    </div>

    <!-- Visore del piano: le foto si aprono subito a tutto schermo, senza una
         pagina intermedia. La foto È il contenuto. -->
    @if (t.currentDiet(); as d) {
      <ff-photo-viewer
        [open]="viewer()"
        [photos]="d.photos"
        [startIndex]="viewerAt()"
        title="Piano alimentare"
        [subtitle]="d.author + ' · ' + short(d.sentAt)"
        (close)="viewer.set(false)"
      />
    }
  `,
  styles: [`
    /* ---- TESTA: foto centrata, chi è, azioni immediate ---- */
    .hero { text-align: center; padding: 6px 0 2px; }
    .avatar { width: 72px; height: 72px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--amber-ink); font-size: 24px; font-weight: 800; box-shadow: var(--shadow-amber); overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .name { font-size: 22px; font-weight: 800; letter-spacing: -.5px; margin-top: 12px; }
    .sub { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; }
    .rating { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); }
    .rating .ti { font-size: 13px; color: var(--amber); }
    .rel { font-size: 12px; font-weight: 600; color: var(--ink-3); margin-top: 9px; }
    .bio { font-size: 13px; font-weight: 500; color: var(--ink-2); line-height: 1.55; margin-top: 11px; }
    .tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 10px; }
    .tag { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: var(--r-pill); background: var(--surface-3); color: var(--ink-2); }
    .hero-actions { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
    .hero-actions .ff-btn { position: relative; flex: none; padding: 11px 30px; font-size: 14.5px; }
    .hero-actions .ff-btn .ti { font-size: 18px; }
    .ha-badge { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--rose); color: var(--on-accent); font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; border: 2px solid var(--surface-0); }

    /* ---- Sedute residue: striscia sottile, senza superficie di card ---- */
    .pkg { margin-top: 20px; padding: 0 2px; }
    .pkg-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .pkg-l { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-3); }
    .pkg-n { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .pkg-cta { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 7px 13px; border-radius: var(--r-pill); background: var(--surface-2); border: 1px solid var(--hairline); color: var(--ink-2); font-family: inherit; font-size: 11.5px; font-weight: 800; cursor: pointer; }
    .pkg-cta .ti { font-size: 14px; }

    /* ---- Segmented control ---- */
    .segment { display: flex; gap: 3px; background: var(--surface-2); border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); padding: 5px; margin: 18px 0 6px; box-shadow: 0 8px 22px -12px rgba(0,0,0,.65); }
    .seg { flex: 1; padding: 10px 0; border-radius: var(--r-pill); background: none; border: none; color: var(--ink-3); font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: background .16s, color .16s; }
    .seg.on { background: var(--surface-4); color: var(--ink); box-shadow: var(--shadow-card); }

    /* ---- Blocco card (base + spaziatura) ---- */
    .ff-card { background: var(--surface-2); border: 1px solid var(--hairline); border-radius: var(--r-lg); box-shadow: var(--shadow-card); }
    .block { padding: 15px; margin-top: 12px; }
    .block-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; }
    .block-hd > .ti { font-size: 17px; color: var(--ink-2); }
    .block-hd > span { font-size: 13.5px; font-weight: 800; letter-spacing: -.2px; }

    /* ---- Blocco in corso ---- */
    .fk-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
    .fk-t { font-size: 15px; font-weight: 800; letter-spacing: -.2px; }
    .fk-w { flex: none; font-size: 11px; font-weight: 800; color: var(--amber); font-variant-numeric: tabular-nums; }
    .fk-note { font-size: 12.5px; font-weight: 500; color: var(--ink-2); line-height: 1.5; margin-top: 10px; }

    /* ---- Righe scheda ---- */
    .sk-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .sked { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 13px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--hairline); font-family: inherit; color: inherit; text-align: left; cursor: pointer; }
    .sk-ic { width: 44px; height: 44px; flex: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 21px; }
    .sk-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .sk-name { font-size: 14.5px; font-weight: 800; letter-spacing: -.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sk-meta { font-size: 11.5px; font-weight: 600; color: var(--ink-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sk-go { font-size: 20px; color: var(--amber); flex: none; }
    /* Accenti tessere (set completo per le schede) */
    .t-amber { background: var(--amber-soft); color: var(--amber); }
    .t-violet { background: var(--violet-soft); color: var(--violet); }
    .t-rose { background: var(--rose-soft); color: var(--rose); }
    .t-blue { background: var(--blue-soft); color: var(--blue); }
    .t-teal { background: var(--teal-soft); color: var(--teal); }
    .t-magenta { background: var(--magenta-soft); color: var(--magenta); }
    .t-orange { background: var(--orange-soft); color: var(--orange); }

    /* ---- Progressi per scheda ---- */
    /* Stessa riga di chip del marketplace: scroll-x + .chip globale. */
    .chips { margin-top: 14px; }
    .prog3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .pg { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px; }
    .pg-v { font-size: 21px; font-weight: 800; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
    .pg-l { font-size: 10px; font-weight: 800; color: var(--ink-3); text-transform: uppercase; letter-spacing: .2px; text-align: center; }
    .prog-sub { font-size: 11.5px; font-weight: 600; color: var(--ink-3); margin-top: 10px; }

    .loads { display: flex; flex-direction: column; gap: 9px; }
    .ld { display: flex; align-items: center; gap: 10px; }
    .ld-n { flex: 1; min-width: 0; font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ld-v { flex: none; font-size: 13.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .ld-d { flex: none; min-width: 66px; text-align: right; font-size: 11px; font-weight: 800; color: var(--ink-4); }
    .ld-d.up { color: var(--green); }

    .empty { text-align: center; }
    .empty > .ti { font-size: 30px; color: var(--ink-4); }
    .em-t { font-size: 15px; font-weight: 800; letter-spacing: -.2px; margin-top: 8px; }
    .em-s { font-size: 12.5px; font-weight: 600; color: var(--ink-3); line-height: 1.5; margin: 5px 0 14px; }

    /* ---- Dieta: le pagine, in griglia ---- */
    .pages { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
    .page { position: relative; aspect-ratio: 3 / 4; padding: 0; border-radius: 12px; overflow: hidden; background: var(--surface-3); border: 1px solid var(--hairline-strong); cursor: pointer; }
    .page img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
    .page-n { position: absolute; left: 6px; bottom: 6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: rgba(8,8,12,.72); color: #F2F1EA; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
    .sign { font-size: 12px; font-weight: 700; color: var(--ink-2); margin-top: 12px; }

    /* ---- Footer marketplace: discreto, in fondo, non compete col coach ---- */
    .mkt-foot { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--hairline); }
    .mkt-q { font-size: 12px; font-weight: 600; color: var(--ink-4); }
    .mkt-link { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--r-pill); background: none; border: 1px solid var(--hairline); color: var(--ink-2); font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; }
    .mkt-link .ti { font-size: 15px; color: var(--ink-3); }

    /* ---- Bottoni e badge ---- */
    .ff-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 12px 18px; border-radius: 13px; font-family: inherit; font-size: 13.5px; font-weight: 800; border: 1px solid transparent; cursor: pointer; }
    .ff-btn .ti { font-size: 17px; }
    .ff-btn--primary { background: var(--amber); color: var(--amber-ink); box-shadow: var(--shadow-amber); }
    .ff-badge { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; padding: 4px 10px; border-radius: var(--r-pill); background: var(--surface-3); color: var(--ink-2); }
  `],
})
export class PersonalTrainerComponent {
  private readonly router = inject(Router);
  readonly t = inject(TrainerService);
  readonly toast = inject(ToastService);
  readonly w = inject(WorkoutStore);

  constructor() {
    // Adattivo: senza un coach assegnato, l'hub non ha senso → vai al marketplace.
    if (!this.t.hasCoach()) {
      void this.router.navigate(['/coach-marketplace']);
    }
  }

  readonly TILE_CLASS = TILE_CLASS;

  // --- Piano alimentare a tutto schermo ---
  readonly viewer = signal(false);
  readonly viewerAt = signal(0);

  openViewer(i: number): void {
    this.viewerAt.set(i);
    this.viewer.set(true);
  }

  /**
   * Le schede DEL COACH. `author` esiste sul modello proprio per questo: in una
   * sezione che parla di lui, mostrare anche le schede che ti sei fatto da solo
   * gliele attribuirebbe.
   */
  readonly coachSchede = computed<Scheda[]>(() => this.w.schede.filter((s) => s.author === 'coach'));

  // ==========================================================================
  //  TAB — esistono solo se hanno contenuto
  // ==========================================================================

  private readonly wanted = signal<CoachTab | null>(null);

  readonly tabs = computed<{ key: CoachTab; label: string }[]>(() => {
    const list: { key: CoachTab; label: string }[] = [];
    if (this.coachSchede().length) list.push({ key: 'schede', label: 'Schede' }, { key: 'progressi', label: 'Progressi' });
    if (this.t.currentDiet()) list.push({ key: 'dieta', label: 'Dieta' });
    return list;
  });

  /**
   * Il tab attivo. Non è un signal libero ma il tab scelto **se esiste ancora**:
   * se il coach ritira il piano alimentare mentre lo stai guardando, si torna al
   * primo tab invece di restare su una vista che non c'è più.
   */
  readonly tab = computed<CoachTab | null>(() => {
    const list = this.tabs();
    const want = this.wanted();
    return list.find((x) => x.key === want)?.key ?? list[0]?.key ?? null;
  });

  /** Il segmented control scrive qui: `tab` resta derivato. */
  setTab(k: CoachTab): void { this.wanted.set(k); }

  // ==========================================================================
  //  PROGRESSI DI UNA SCHEDA
  //  «La scheda che mi ha dato sta funzionando?» — si risponde su una scheda
  //  per volta, con i numeri veri dello storico.
  // ==========================================================================

  /** La scheda scelta con le chips (null = la prima del coach). */
  readonly picked = signal<string | null>(null);

  /** La scheda scelta con le chips, o la prima del coach. */
  readonly progId = computed(() => {
    const list = this.coachSchede();
    const p = this.picked();
    return list.some((s) => s.id === p) ? p! : (list[0]?.id ?? null);
  });

  readonly progScheda = computed<Scheda | null>(
    () => this.coachSchede().find((s) => s.id === this.progId()) ?? null,
  );

  /** Gli allenamenti fatti con quella scheda, dal più vecchio al più recente. */
  readonly progHistory = computed(() => {
    const s = this.progScheda();
    return s ? this.w.historyOf(s.id, s.name) : [];
  });

  readonly volTotK = computed(() => {
    const kg = this.progHistory().reduce((sum, h) => sum + h.volKg, 0);
    return Math.round(kg / 100) / 10;
  });

  readonly prTot = computed(() => this.progHistory().reduce((sum, h) => sum + (h.prs ?? 0), 0));

  readonly lastDate = computed(() => this.progHistory().at(-1)?.dateIso ?? '');

  /** Volume di ogni seduta, in migliaia di kg. Le ultime sei: oltre non si legge. */
  readonly volBars = computed<ChartBar[]>(() =>
    this.progHistory()
      .slice(-6)
      .map((h) => {
        const d = new Date(h.dateIso + 'T00:00:00');
        return { v: Math.round(h.volKg / 100) / 10, l: `${d.getDate()}/${d.getMonth() + 1}` };
      }),
  );

  /**
   * Per ogni esercizio della scheda: il carico più alto che hai fatto, e quanto
   * è cresciuto dalla prima volta. È la risposta più concreta a «sta
   * funzionando?» — «Panca 60 kg, +5» dice più di qualunque percentuale.
   *
   * Si confronta il MASSIMO, non l'ultima seduta: un giorno più leggero è
   * normale e non è un peggioramento. Prendere l'ultimo valore farebbe
   * comparire dei «-7 kg» che raccontano il rumore, non il progresso — e il
   * livello, in questa app, non scende mai ([PRODUCT §4.2](../../../PRODUCT.md)).
   */
  readonly loads = computed<LoadRow[]>(() => {
    const hist = this.progHistory();
    if (!hist.length) return [];
    const first = new Map((hist[0].exercises ?? []).map((e) => [e.name, e.topKg]));
    const best = new Map<string, number>();
    for (const h of hist) {
      for (const e of h.exercises ?? []) {
        if (e.topKg > 0) best.set(e.name, Math.max(best.get(e.name) ?? 0, e.topKg));
      }
    }
    return [...best.entries()]
      .map(([name, kg]) => ({ name, kg, delta: kg - (first.get(name) ?? kg) }))
      .sort((a, b) => b.delta - a.delta || b.kg - a.kg)
      .slice(0, 5);
  });

  /** Il colore della scheda, per le barre: lo stesso con cui la riconosci ovunque. */
  accentVar(s: Scheda): string {
    return `var(--${s.accent})`;
  }

  // ==========================================================================
  //  VARIE
  // ==========================================================================

  readonly pkgPct = computed(() =>
    Math.round((this.t.trainer.sessionsLeft / Math.max(this.t.trainer.packageTotal, 1)) * 100),
  );

  readonly focusPct = computed(() => {
    const f = this.t.trainer.focus;
    return f ? Math.round((f.weekCurrent / Math.max(f.weeks, 1)) * 100) : 0;
  });

  /** Da quanto vi allenate insieme, in parole. */
  readonly together = computed(() => {
    const from = new Date(this.t.trainer.since + 'T00:00:00');
    const months = Math.floor((Date.now() - from.getTime()) / (30 * 24 * 3_600_000));
    if (months < 1) return 'Insieme da poche settimane';
    if (months === 1) return 'Insieme da un mese';
    if (months < 12) return `Insieme da ${months} mesi`;
    const years = Math.floor(months / 12);
    return years === 1 ? 'Insieme da un anno' : `Insieme da ${years} anni`;
  });

  openScheda(id: string): void {
    void this.router.navigate(['/scheda', id]);
  }

  /** '12 lug' — data breve. */
  short(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }

  go(route: string): void { void this.router.navigate(['/' + route]); }
}
