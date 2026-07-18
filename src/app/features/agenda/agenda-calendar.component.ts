/**
 * ============================================================================
 *  FILE: agenda-calendar.component.ts  —  CALENDARIO AGENDA riusabile
 * ============================================================================
 *  SCOPO: calendario mensile + timeline del giorno + richiesta seduta. Estratto
 *    dalla pagina Agenda così da poter essere incorporato altrove (es. dentro il
 *    tab "Sedute" dell'hub Coach) senza duplicare la logica.
 *  COSA RAPPRESENTA: componente presentazionale-ish; legge/scrive TrainerService.
 *    NON include header di sezione né screen-pad (li mette il contenitore).
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrainerService } from '../../core/services/trainer.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { PtSession, SLOT_OPTIONS } from '../../core/data/trainer-mock';
import { Accent, HistoryItem } from '../../core/models/workout.models';
import { ACCENT_VAR, TILE_CLASS } from '../../core/constants/ui.constants';

/** Badge quadrato di un allenamento svolto (colore+icona della scheda eseguita). */
interface WorkoutBadge { accent: Accent; icon: string; }

/** Una cella del calendario mensile: diario di allenamenti + sedute col coach. */
interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  workouts: WorkoutBadge[]; // allenamenti svolti quel giorno (badge quadrati)
  coach: boolean;           // true se c'è una sessione col coach quel giorno (badge tondo)
  coachDone: boolean;       // true se quella sessione col coach è stata svolta (anello verde)
  proposed: boolean;        // giorno con una proposta/spostamento del coach da confermare
}

/** Voce della timeline del giorno: allenamento svolto o seduta col coach. */
interface DayEntry { kind: 'workout' | 'coach'; time: string; workout?: HistoryItem; session?: PtSession; }

/** Stato del drop: seduta trascinata + giorno di destinazione + slot liberi. */
interface MoveTarget { sid: string; title: string; date: string; times: string[]; }

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

@Component({
  selector: 'ff-agenda-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-calendar.component.html',
  styleUrl: './agenda.component.scss',
})
export class AgendaCalendarComponent {
  readonly trainer = inject(TrainerService);
  private readonly store = inject(WorkoutStore);
  private readonly router = inject(Router);

  readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS = TILE_CLASS;

  private readonly today = new Date();

  readonly viewYear = signal(this.today.getFullYear());
  readonly viewMonth = signal(this.today.getMonth());
  readonly selected = signal<string>(this.isoOf(this.today));

  /** Bottom-sheet "Richiedi seduta": aperto/chiuso. */
  readonly requestOpen = signal(false);
  readonly slotOptions = SLOT_OPTIONS;

  /** Swipe orizzontale sul calendario → cambio mese. */
  private touchX = 0;

  // --- Drag & drop: sposta una seduta su un altro giorno ---
  /** id della seduta attualmente trascinata (per lo stile). */
  readonly draggingSid = signal<string | null>(null);
  /** giorno del calendario sotto il puntatore durante il drag. */
  readonly dragOverIso = signal<string | null>(null);
  /** dopo il drop: seduta + giorno destinazione + slot liberi. */
  readonly moveTarget = signal<MoveTarget | null>(null);
  /** orario scelto nello sheet di spostamento. */
  readonly moveTime = signal<string | null>(null);
  /** messaggio allegato alla richiesta di spostamento. */
  readonly moveMsg = signal('');

  readonly weekdays = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

  readonly monthName = computed(() => MESI[this.viewMonth()]);
  readonly isCurrentMonth = computed(
    () => this.viewYear() === this.today.getFullYear() && this.viewMonth() === this.today.getMonth(),
  );

  /** Date con una proposta/spostamento del coach da confermare (per illuminarle). */
  private readonly proposedDays = computed(() => {
    const set = new Set<string>();
    for (const s of this.trainer.proposals()) set.add(s.date);
    for (const s of this.trainer.reschedules()) if (s.movingTo) set.add(s.movingTo.date);
    return set;
  });

  private readonly todayIso = this.isoOf(this.today);

  /** Allenamenti svolti indicizzati per data ISO (per collocarli nel calendario). */
  private readonly workoutsByDay = computed(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const h of this.store.history) {
      if (!h.dateIso) continue;
      const list = map.get(h.dateIso) ?? [];
      list.push(h);
      map.set(h.dateIso, list);
    }
    return map;
  });

  /**
   * Griglia 6×7 del mese: ogni giorno diventa una voce di diario con i badge
   * quadrati degli allenamenti svolti + il badge tondo della seduta col coach.
   */
  readonly grid = computed<DayCell[]>(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const sessions = this.trainer.sessions();
    const workouts = this.workoutsByDay();
    const proposed = this.proposedDays();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // lun = 0
    const start = new Date(y, m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = this.isoOf(d);
      const dayWk = workouts.get(iso) ?? [];
      const daySess = sessions.filter((s) => s.date === iso);
      return {
        iso,
        day: d.getDate(),
        inMonth: d.getMonth() === m,
        today: iso === this.todayIso,
        workouts: dayWk.map((h) => ({ accent: h.accent, icon: h.icon })),
        coach: daySess.length > 0,
        coachDone: daySess.some((s) => s.status === 'done'),
        proposed: proposed.has(iso),
      };
    });
  });

  readonly selectedLabel = computed(() => {
    const d = new Date(this.selected() + 'T00:00:00');
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  });

  /** Sedute del giorno selezionato. */
  readonly daySessions = computed<PtSession[]>(() => this.trainer.sessionsOn(this.selected()));

  /** Si può richiedere una sessione nel giorno selezionato solo se non ce n'è già una
   *  (max 1 sessione col trainer per giorno). */
  readonly canRequest = computed(() => this.daySessions().length === 0);

  /** True se un giorno ha già una sessione col trainer (esclusa quella eventualmente trascinata). */
  private dayOccupied(iso: string, excludeSid?: string): boolean {
    return this.trainer.sessions().some((s) => s.date === iso && s.id !== excludeSid);
  }

  /** Allenamenti svolti nel giorno selezionato. */
  readonly dayWorkouts = computed<HistoryItem[]>(() =>
    (this.workoutsByDay().get(this.selected()) ?? []).slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
  );

  /** Timeline unificata del giorno (allenamenti + sedute), ordinata per orario. */
  readonly dayTimeline = computed<DayEntry[]>(() => {
    const entries: DayEntry[] = [
      ...this.dayWorkouts().map((w) => ({ kind: 'workout' as const, time: w.time ?? '', workout: w })),
      ...this.daySessions().map((s) => ({ kind: 'coach' as const, time: s.time, session: s })),
    ];
    return entries.sort((a, b) => a.time.localeCompare(b.time));
  });

  /** Riepilogo del giorno selezionato (per l'intestazione). */
  readonly dayCount = computed(() => ({ workouts: this.dayWorkouts().length, coach: this.daySessions().length }));

  statusLabel(status: string): string {
    return status === 'done' ? 'Svolta' : status === 'pending' ? 'Da confermare' : 'Confermata';
  }

  /** Stato della sessione col coach per la card del giorno (etichetta + classe colore). */
  sessionState(s: PtSession): { label: string; cls: string } {
    if (s.pendingMove) return { label: 'Da confermare', cls: 'pending' };
    if (s.status === 'done') return { label: 'Completata', cls: 'done' };
    if (s.status === 'pending') return { label: 'Da confermare', cls: 'pending' };
    if (s.date === this.todayIso) return { label: 'Imminente', cls: 'soon' };
    return { label: 'Programmata', cls: 'planned' };
  }

  /** Deep-link: apre il dettaglio dell'allenamento nello Storico. */
  openWorkout(h: HistoryItem): void {
    void this.router.navigate(['/history'], { queryParams: { focus: h.id } });
  }

  // --- Navigazione mese ---
  prevMonth(): void { this.shiftMonth(-1); }
  nextMonth(): void { this.shiftMonth(1); }
  private shiftMonth(delta: number): void {
    const d = new Date(this.viewYear(), this.viewMonth() + delta, 1);
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
    const sameMonth = this.today.getFullYear() === d.getFullYear() && this.today.getMonth() === d.getMonth();
    this.selected.set(sameMonth ? this.isoOf(this.today) : this.isoOf(d));
  }
  goToday(): void {
    this.viewYear.set(this.today.getFullYear());
    this.viewMonth.set(this.today.getMonth());
    this.selected.set(this.isoOf(this.today));
  }

  select(cell: DayCell): void {
    if (!cell.inMonth) {
      const d = new Date(cell.iso + 'T00:00:00');
      this.viewYear.set(d.getFullYear());
      this.viewMonth.set(d.getMonth());
    }
    this.selected.set(cell.iso);
  }

  // --- Swipe mese ---
  onTouchStart(ev: TouchEvent): void { this.touchX = ev.changedTouches[0].clientX; }
  onTouchEnd(ev: TouchEvent): void {
    const dx = ev.changedTouches[0].clientX - this.touchX;
    if (dx <= -50) this.nextMonth();
    else if (dx >= 50) this.prevMonth();
  }

  // --- Richiesta sessione ---
  openRequest(): void { if (!this.canRequest()) return; this.requestOpen.set(true); }
  closeRequest(): void { this.requestOpen.set(false); }
  confirmRequest(time: string): void {
    this.trainer.requestSession(this.selected(), time);
    this.requestOpen.set(false);
  }

  /** Orari già occupati nel giorno selezionato (per disabilitarli nello sheet). */
  takenTimes(): Set<string> {
    return new Set(this.daySessions().map((s) => s.time));
  }

  // --- Drag & drop ---
  /** Una sessione è trascinabile se è nel FUTURO (dopo oggi) e non è già dentro un
   *  flusso di spostamento (né richiesto dall'utente, né proposto dal coach). */
  canDrag(s: PtSession): boolean {
    return s.date > this.todayIso && !s.pendingMove && !s.movingTo;
  }
  onDragStart(s: PtSession, ev: DragEvent): void {
    if (!this.canDrag(s)) { ev.preventDefault(); return; }
    this.draggingSid.set(s.id);
    ev.dataTransfer?.setData('text/plain', s.id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }
  onDragEnd(): void { this.draggingSid.set(null); this.dragOverIso.set(null); }
  onDragOver(cell: DayCell, ev: DragEvent): void {
    const sid = this.draggingSid();
    if (!sid) return;
    ev.preventDefault();
    // Giorno già occupato da una sessione → non è un drop-target valido.
    if (this.dayOccupied(cell.iso, sid)) {
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'none';
      if (this.dragOverIso() === cell.iso) this.dragOverIso.set(null);
      return;
    }
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.dragOverIso.set(cell.iso);
  }
  onDragLeave(cell: DayCell): void { if (this.dragOverIso() === cell.iso) this.dragOverIso.set(null); }
  onDrop(cell: DayCell, ev: DragEvent): void {
    ev.preventDefault();
    const sid = this.draggingSid();
    this.onDragEnd();
    if (!sid) return;
    const orig = this.trainer.sessions().find((s) => s.id === sid);
    if (!orig) return;
    // Stesso giorno di partenza → nessuno spostamento.
    if (orig.date === cell.iso) return;
    // Giorno già occupato da un'altra sessione → non si può avere 2 sessioni lo stesso giorno.
    if (this.dayOccupied(cell.iso, sid)) return;
    // Apre lo sheet: orari liberi nel giorno di destinazione + campo messaggio.
    this.moveTarget.set({ sid, title: orig.title, date: cell.iso, times: this.freeTimesFor(cell.iso, sid) });
    this.moveTime.set(null);
    this.moveMsg.set('');
  }

  /** Orari liberi in una data = SLOT_OPTIONS meno quelli già occupati (esclusa la seduta trascinata). */
  private freeTimesFor(date: string, excludeSid: string): string[] {
    const taken = new Set(
      this.trainer.sessions().filter((s) => s.date === date && s.id !== excludeSid).map((s) => s.time),
    );
    return SLOT_OPTIONS.filter((t) => !taken.has(t));
  }

  /** Data destinazione formattata per l'header dello sheet. */
  readonly moveDateLabel = computed(() => {
    const t = this.moveTarget();
    if (!t) return '';
    const d = new Date(t.date + 'T00:00:00');
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  });

  pickTime(t: string): void { this.moveTime.set(t); }
  onMoveMsg(ev: Event): void { this.moveMsg.set((ev.target as HTMLTextAreaElement).value); }

  /** Invia la richiesta di spostamento al PT (con orario scelto + messaggio).
   *  Il focus resta sul giorno corrente: non si salta al giorno di destinazione. */
  confirmMove(): void {
    const t = this.moveTarget();
    const time = this.moveTime();
    if (!t || !time) return;
    this.trainer.requestMove(t.sid, t.date, time, this.moveMsg());
    this.cancelMove();
  }
  cancelMove(): void { this.moveTarget.set(null); this.moveTime.set(null); this.moveMsg.set(''); }

  /** Annulla una richiesta di spostamento già inviata: la seduta torna allo slot originale. */
  undoPending(sid: string): void { this.trainer.cancelMove(sid); }

  dowShort(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }

  private isoOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
