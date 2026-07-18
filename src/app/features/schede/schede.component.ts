/**
 * ============================================================================
 *  FILE: schede.component.ts  —  SCHEDE + ALLENAMENTI (feature, 2 sezioni)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   La sezione "Schede" dell'app, divisa in due tab:
 *     • SCHEDE      — i piani di allenamento (attivi + archiviati): cosa PUOI fare.
 *     • ALLENAMENTI — lo storico completo delle sessioni svolte: cosa HAI fatto.
 *
 * PERCHÉ ESISTE / QUALE PROBLEMA RISOLVE
 *   Lo storico viveva in DUE posti: questo tab (versione povera) e una rotta
 *   /history separata (versione ricca, ma con statistiche finte e filtri che non
 *   filtravano). Due schermate sullo stesso dato divergono sempre. Ora lo storico
 *   sta qui e basta: /history reindirizza a questa pagina (vedi DECISIONS D-38).
 *
 * COSA RAPPRESENTA IN ANGULAR
 *   Componente di feature sulla rotta /schede. Legge il tab e il focus dai query
 *   param, così l'Agenda può fare deep-link a un singolo allenamento.
 *
 * FLUSSO DEI DATI
 *   SCHEDE      → store.schede + q() + filter()  → computed `list` / `archived`
 *   ALLENAMENTI → store.history + range()        → computed `workouts`
 *                 → `totals` (aggregati del periodo) + `groups` (per settimana)
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - I totali sono CALCOLATI da store.history: se un numero sembra sbagliato,
 *     la causa è nei dati, non qui. Prima erano hardcoded e mentivano sempre.
 *   - `repeat()` ritrova la scheda per NOME (lo storico non conserva l'id della
 *     scheda): se una scheda è stata rinominata o eliminata, il tasto "Rifai"
 *     non compare. È voluto: meglio nessun tasto che un tasto che sbaglia scheda.
 *   - Il raggruppamento usa le settimane ISO (lunedì→domenica), coerente con il
 *     resto dell'app (Ritmo, recap settimanale, Agenda).
 * ============================================================================
 */
import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ACCENT_VAR, LEVEL_LABEL, TILE_CLASS } from '../../core/constants/ui.constants';
import { HistoryItem, Scheda } from '../../core/models/workout.models';
import { SessionService } from '../../core/services/session.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { DiffComponent } from '../../shared/components/diff/diff.component';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';

type Tab = 'schede' | 'allenamenti';

/** Finestra temporale dello storico. */
type Range = 'tutti' | 'settimana' | 'mese';

/** Un gruppo di allenamenti sotto un'intestazione temporale. */
interface WorkoutGroup {
  key: string;
  label: string;      // "Questa settimana", "Settimana scorsa", "Luglio 2026"
  items: HistoryItem[];
}

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

@Component({
  selector: 'ff-schede',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DiffComponent, AppHeaderComponent],
  templateUrl: './schede.component.html',
  styleUrl: './schede.component.scss',
})
export class SchedeComponent implements AfterViewInit {
  readonly w = inject(WorkoutStore);
  readonly state = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);

  /**
   * Deep-link dall'Agenda (?focus=<id>): porta l'allenamento sotto gli occhi.
   * Un deep-link che atterra in cima a una lista lunga non è un deep-link
   * (UX_GUIDELINES §2). Il ritardo lascia completare l'animazione d'entrata.
   */
  ngAfterViewInit(): void {
    const id = this.focusId();
    if (!id || this.tab() !== 'allenamenti') return;
    setTimeout(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector(`#wk-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 140);
  }

  readonly TILE_CLASS = TILE_CLASS;
  readonly ACCENT_VAR = ACCENT_VAR;
  readonly LEVEL_LABEL = LEVEL_LABEL;

  // --- Tab: leggibile dai query param, così l'Agenda può fare deep-link ---
  readonly tab = signal<Tab>(
    this.route.snapshot.queryParamMap.get('tab') === 'allenamenti' ? 'allenamenti' : 'schede',
  );

  /** Allenamento evidenziato via deep-link (?focus=<id>), dal calendario. */
  readonly focusId = signal<string | null>(this.route.snapshot.queryParamMap.get('focus'));

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'schede') this.focusId.set(null);
  }

  // ===========================================================================
  //  TAB 1 — SCHEDE
  // ===========================================================================

  readonly filters = ['Tutti', 'Veloce', 'Principiante', 'Intermedio', 'Avanzato'];
  readonly q = signal('');
  readonly filter = signal('Tutti');

  private matches(s: Scheda): boolean {
    const q = this.q().toLowerCase();
    const f = this.filter();
    const matchQ = s.name.toLowerCase().includes(q) || s.focus.toLowerCase().includes(q);
    const matchF =
      f === 'Tutti' ? true :
      f === 'Veloce' ? s.duration <= 35 :
      LEVEL_LABEL[s.level] === f;
    return matchQ && matchF;
  }

  readonly list = computed<Scheda[]>(() =>
    this.w.schede.filter((s) => !s.archived && this.matches(s)),
  );

  readonly archived = computed<Scheda[]>(() =>
    this.w.schede.filter((s) => !!s.archived && this.matches(s)),
  );

  onSearch(e: Event): void {
    this.q.set((e.target as HTMLInputElement).value);
  }

  badgeClass(tag: string): string {
    return tag === 'In corso' ? 'badge-amber' : tag === 'Veloce' ? 'badge-green' : 'badge-violet';
  }

  // ===========================================================================
  //  TAB 2 — ALLENAMENTI (storico)
  // ===========================================================================

  readonly ranges: { v: Range; l: string }[] = [
    { v: 'tutti',     l: 'Sempre' },
    { v: 'settimana', l: 'Questa sett.' },
    { v: 'mese',      l: 'Questo mese' },
  ];
  readonly range = signal<Range>('tutti');

  /** Lunedì della settimana corrente, a mezzanotte. */
  private mondayOfThisWeek(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  /** Storico filtrato per periodo, dal più recente. */
  readonly workouts = computed<HistoryItem[]>(() => {
    const r = this.range();
    const all = [...this.w.history].sort((a, b) =>
      (b.dateIso + b.time).localeCompare(a.dateIso + a.time),
    );
    if (r === 'tutti') return all;

    const from = r === 'settimana' ? this.mondayOfThisWeek() : new Date();
    if (r === 'mese') {
      from.setHours(0, 0, 0, 0);
      from.setDate(1);
    }
    const fromIso = this.isoOf(from);
    return all.filter((h) => h.dateIso >= fromIso);
  });

  /** Vero se nel periodo c'è almeno un allenamento. */
  readonly hasWorkouts = computed(() => this.workouts().length > 0);

  /** Vero se lo storico è vuoto in assoluto (≠ vuoto per il filtro scelto). */
  readonly historyEmpty = computed(() => this.w.history.length === 0);

  /**
   * Allenamenti raggruppati per settimana, dal più recente.
   * Il raggruppamento dà allo storico la forma di una storia: "questa settimana"
   * è un'unità che l'utente riconosce, una lista piatta di 40 righe no.
   */
  readonly groups = computed<WorkoutGroup[]>(() => {
    const monday = this.mondayOfThisWeek();
    const thisWeek = this.isoOf(monday);
    const lastWeekDate = new Date(monday);
    lastWeekDate.setDate(monday.getDate() - 7);
    const lastWeek = this.isoOf(lastWeekDate);

    const map = new Map<string, WorkoutGroup>();
    for (const h of this.workouts()) {
      const d = new Date(h.dateIso + 'T00:00:00');
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunedì della sua settimana
      const key = this.isoOf(d);
      const label =
        key === thisWeek ? 'Questa settimana' :
        key === lastWeek ? 'Settimana scorsa' :
        `${MESI[d.getMonth()]} ${d.getFullYear()}`;
      const g = map.get(key) ?? { key, label, items: [] };
      g.items.push(h);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  });

  // --- Formattazione (la vista formatta, il dato resta numerico) ---

  /** "mer 15 lug · 07:40" */
  when(h: HistoryItem): string {
    const d = new Date(h.dateIso + 'T00:00:00');
    const today = this.isoOf(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (h.dateIso === today) return `Oggi · ${h.time}`;
    if (h.dateIso === this.isoOf(y)) return `Ieri · ${h.time}`;
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]} · ${h.time}`;
  }

  private isoOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // --- Azioni ---

  /** Apre il riepilogo di quell'allenamento (/allenamento/:id). */
  openWorkout(h: HistoryItem): void {
    void this.router.navigate(['/allenamento', h.id]);
  }

  go(route: string): void {
    void this.router.navigate(['/' + route]);
  }
}
