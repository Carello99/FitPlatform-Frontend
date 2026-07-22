/**
 * ============================================================================
 *  FILE: agenda-calendar.component.ts  —  CALENDARIO AGENDA riusabile
 * ============================================================================
 *  SCOPO: calendario mensile + timeline del giorno + negoziazione delle sedute.
 *    Estratto dalla pagina Agenda così da poter essere incorporato altrove
 *    (es. nel tab "Sedute" dell'hub Coach) senza duplicare la logica.
 *
 *  L'IDEA PORTANTE: una richiesta del coach non è una notifica da leggere in
 *    una lista, è un EVENTO IN PROVA. Si disegna dov'è il suo significato — nel
 *    giorno che propone — con il bordo tratteggiato del "ghost". La strip sopra
 *    la timeline conta e richiama; sparisce quando non c'è nulla in sospeso.
 *
 *  UNO SPOSTAMENTO STA IN DUE GIORNI: quello che lascia e quello che riceve.
 *    Compare per intero in entrambi, con la stessa domanda e le stesse
 *    risposte — è la stessa richiesta, e rispondere da un lato chiude l'altro.
 *    Nessuno dei due giorni rimanda all'altro: dal punto di vista di chi legge
 *    non esiste un giorno "giusto" dove decidere.
 *
 *  I TRE GESTI:
 *    - tap su ✓ nella strip           → accetta (1 tap)
 *    - tap sul corpo della card       → porta al giorno, decidi nel contesto
 *    - trascina un evento (o "Sposta")→ proponi un altro giorno
 *      Su una seduta concordata è una richiesta di spostamento; su una proposta
 *      del coach è una CONTROPROPOSTA. Stesso gesto, stesso sheet.
 *
 *  COSA NON FA: non muta nulla. Ogni azione passa da AgendaRequestStore, perché
 *    in agenda nessuno impone — si propone (UX §19).
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrainerService } from '../../core/services/trainer.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { ToastService } from '../../core/services/toast.service';
import { AgendaRequestStore } from '../../core/services/agenda-request.service';
import { AgendaRequest } from '../../core/models/agenda-request.model';
import { PtSession, SLOT_OPTIONS } from '../../core/data/trainer-mock';
import { Accent, HistoryItem } from '../../core/models/workout.models';
import { ACCENT_VAR, TILE_CLASS } from '../../core/constants/ui.constants';
import { isoDay } from '../../core/utils/date.utils';
import { RequestCardComponent, RequestSide } from '../../shared/components/request-card/request-card.component';
import { RequestStripComponent } from './request-strip.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

/** Badge quadrato di un allenamento svolto (colore+icona della scheda eseguita). */
interface WorkoutBadge { accent: Accent; icon: string; }

/** Una cella del calendario mensile: diario di allenamenti + sedute col coach. */
interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  past: boolean;
  workouts: WorkoutBadge[]; // allenamenti svolti quel giorno (badge quadrati)
  coach: boolean;           // true se c'è una sessione col coach quel giorno (badge tondo)
  coachDone: boolean;       // true se quella sessione col coach è stata svolta (anello verde)
  ghost: boolean;           // giorno proposto da una richiesta aperta (badge tratteggiato)
  vacating: boolean;        // giorno che una richiesta aperta vorrebbe liberare (badge spento)
}

/** Voce della timeline del giorno: allenamento, seduta concordata o richiesta aperta. */
interface DayEntry {
  kind: 'workout' | 'coach' | 'request';
  time: string;
  workout?: HistoryItem;
  session?: PtSession;
  request?: AgendaRequest;
  /** Per uno spostamento: se questo giorno è quello che lascia o quello che riceve. */
  side?: RequestSide | null;
}

/** Cosa si sta spostando e dove: alimenta lo sheet di scelta orario. */
interface MoveTarget {
  /** Una seduta concordata (richiesta di spostamento) o una proposta del coach (controproposta). */
  source: { type: 'session' | 'request'; id: string };
  /** Lo slot di partenza, per ricordare cosa si sta spostando ("mar 21 lug · 18:00"). */
  from: string;
  /** Il giorno di partenza, in ISO: serve a riconoscere lo spostamento di solo orario. */
  fromDate: string;
  date: string;
  times: string[];
}

/** Cosa si sta spostando, in attesa che si scelga il giorno di destinazione. */
interface PickDay {
  type: 'session' | 'request';
  id: string;
  from: string;
  fromDate: string;
}

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

@Component({
  selector: 'ff-agenda-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RequestCardComponent, RequestStripComponent, ModalComponent],
  templateUrl: './agenda-calendar.component.html',
  styleUrl: './agenda.component.scss',
})
export class AgendaCalendarComponent {
  readonly trainer = inject(TrainerService);
  readonly store = inject(AgendaRequestStore);
  private readonly workouts = inject(WorkoutStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS = TILE_CLASS;

  private readonly today = new Date();
  private readonly todayIso = isoDay(this.today);

  constructor() {
    // Deep-link ?day=YYYY-MM-DD: la chat manda qui quando l'utente vuole
    // controproporre, così si arriva già sul giorno della proposta.
    const day = inject(ActivatedRoute).snapshot.queryParamMap.get('day');
    if (day) this.focusDay(day);
  }

  readonly viewYear = signal(this.today.getFullYear());
  readonly viewMonth = signal(this.today.getMonth());
  readonly selected = signal<string>(isoDay(this.today));

  /** Bottom-sheet "Richiedi seduta": aperto/chiuso. */
  readonly requestOpen = signal(false);
  readonly slotOptions = SLOT_OPTIONS;

  readonly weekdays = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

  /** Intestazione del giorno: è il punto in cui si porta la vista (vedi goToDay). */
  private readonly dayAnchor = viewChild<ElementRef<HTMLElement>>('dayAnchor');

  /** Swipe orizzontale sul calendario → cambio mese. */
  private touchX = 0;

  // --- Spostamento: drag&drop oppure "Sposta" (il percorso da tastiera) ---
  /** id dell'elemento trascinato (seduta o richiesta), per lo stile. */
  readonly draggingId = signal<string | null>(null);
  /** giorno del calendario sotto il puntatore durante il drag. */
  readonly dragOverIso = signal<string | null>(null);
  /** dopo il drop (o dopo la scelta del giorno): destinazione + slot liberi. */
  readonly moveTarget = signal<MoveTarget | null>(null);
  /** orario scelto nello sheet di spostamento. */
  readonly moveTime = signal<string | null>(null);
  /** messaggio allegato alla richiesta. */
  readonly moveMsg = signal('');
  /**
   * Modalità "scegli un giorno": attivata dal pulsante Sposta. È il percorso
   * alternativo al trascinamento — obbligatorio, perché il drag&drop HTML5 non
   * è raggiungibile da tastiera né da screen reader.
   */
  readonly pickDayFor = signal<PickDay | null>(null);

  readonly monthName = computed(() => MESI[this.viewMonth()]);
  readonly isCurrentMonth = computed(
    () => this.viewYear() === this.today.getFullYear() && this.viewMonth() === this.today.getMonth(),
  );

  /** Allenamenti svolti indicizzati per data ISO (per collocarli nel calendario). */
  private readonly workoutsByDay = computed(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const h of this.workouts.history) {
      if (!h.dateIso) continue;
      const list = map.get(h.dateIso) ?? [];
      list.push(h);
      map.set(h.dateIso, list);
    }
    return map;
  });

  /**
   * Griglia 6×7 del mese: ogni giorno diventa una voce di diario con i badge
   * quadrati degli allenamenti svolti, il badge tondo della seduta col coach e
   * il badge tratteggiato di ciò che è solo proposto.
   */
  /**
   * I giorni la cui cornice va accesa ADESSO. Il bordo di uno spostamento non
   * è uno stato permanente del calendario — sarebbe rumore su ogni schermata —
   * ma un evidenziatore del legame: si accende solo quando il giorno
   * selezionato fa parte di uno spostamento, e allora accende **tutti e due**
   * i suoi giorni, così l'occhio salta dall'uno all'altro. Selezionando un
   * giorno che non c'entra, nessuna cornice.
   */
  readonly linkedDays = computed<Set<string>>(() => {
    const sel = this.selected();
    const set = new Set<string>();
    for (const [from, to] of this.store.reschedulePairs()) {
      if (from === sel || to === sel) { set.add(from); set.add(to); }
    }
    return set;
  });

  readonly grid = computed<DayCell[]>(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const sessions = this.trainer.sessions();
    const workouts = this.workoutsByDay();
    const ghosts = this.store.proposedDays();
    const vacating = this.store.vacatingDays();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // lun = 0
    const start = new Date(y, m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = isoDay(d);
      const dayWk = workouts.get(iso) ?? [];
      const daySess = sessions.filter((s) => s.date === iso);
      return {
        iso,
        day: d.getDate(),
        inMonth: d.getMonth() === m,
        today: iso === this.todayIso,
        past: this.isPast(iso),
        workouts: dayWk.map((h) => ({ accent: h.accent, icon: h.icon })),
        coach: daySess.length > 0,
        coachDone: daySess.some((s) => s.status === 'done'),
        ghost: ghosts.has(iso),
        vacating: vacating.has(iso),
      };
    });
  });

  readonly selectedLabel = computed(() => this.dowShort(this.selected()));

  /** Le tre parti del giorno selezionato, per accentare il numero in amber. */
  readonly selectedParts = computed(() => {
    const d = new Date(this.selected() + 'T00:00:00');
    return {
      dow: GIORNI_BREVI[d.getDay()],
      num: String(d.getDate()),
      mon: MESI_BREVI[d.getMonth()],
    };
  });

  /** Sedute concordate del giorno selezionato. */
  readonly daySessions = computed<PtSession[]>(() => this.trainer.sessionsOn(this.selected()));

  /** Richieste aperte che propongono il giorno selezionato. */
  readonly dayRequests = computed<AgendaRequest[]>(() => this.store.requestsOn(this.selected()));

  /** Allenamenti svolti nel giorno selezionato. */
  readonly dayWorkouts = computed<HistoryItem[]>(() =>
    (this.workoutsByDay().get(this.selected()) ?? []).slice().sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
  );

  /** Timeline unificata del giorno (allenamenti + sedute + proposte), per orario. */
  readonly dayTimeline = computed<DayEntry[]>(() => {
    // Uno spostamento vive in DUE giorni, e non si può sapere quale dei due
    // l'utente aprirà: chi ha sentito il coach al telefono cerca il giorno
    // NUOVO, chi guarda la propria settimana trova il VECCHIO. Quindi la
    // richiesta compare per intero in tutti e due, con la stessa domanda e le
    // stesse risposte — è la stessa richiesta, stesso `id`: rispondere da un
    // lato chiude anche l'altro. Cambia solo il racconto (`side`).
    //
    // Rimandare («decidi nell'altro giorno») aggiungeva un passo su una
    // decisione che era già lì tutta intera, e chiedeva all'utente di sapere
    // qual è il giorno "giusto" — cosa che dal suo punto di vista non esiste.
    const sessions: DayEntry[] = [];
    for (const s of this.daySessions()) {
      const moving = this.store.openFor(s.id);
      if (moving && moving.kind === 'reschedule') {
        // Anche quando il nuovo orario è nello stesso giorno: la seduta è
        // comunque in uscita da quell'ora, e chiamarla ancora «sessione»
        // nasconderebbe che è dentro una trattativa. I due lati si vedono
        // impilati nella stessa giornata invece che in due giorni diversi.
        sessions.push({ kind: 'request', time: s.time, request: moving, side: 'origin' });
      } else {
        sessions.push({ kind: 'coach', time: s.time, session: s });
      }
    }

    const proposals: DayEntry[] = this.dayRequests().map((r) => ({
      kind: 'request' as const,
      time: r.payload.time,
      request: r,
      // Una prenotazione non ha un giorno di partenza: non ha due lati.
      side: r.kind === 'reschedule' && r.sessionId ? ('destination' as const) : null,
    }));

    const entries: DayEntry[] = [
      ...this.dayWorkouts().map((w) => ({ kind: 'workout' as const, time: w.time ?? '', workout: w })),
      ...sessions,
      ...proposals,
    ];
    return entries.sort((a, b) => a.time.localeCompare(b.time));
  });

  /** Riepilogo del giorno selezionato (per l'intestazione). */
  // Contato sulla timeline, non sulle liste di partenza: una seduta in corso di
  // spostamento è già diventata una proposta, e il conteggio deve dire quello
  // che si vede davvero sotto.
  readonly dayCount = computed(() => {
    const tl = this.dayTimeline();
    return {
      workouts: tl.filter((e) => e.kind === 'workout').length,
      coach: tl.filter((e) => e.kind === 'coach').length,
      requests: tl.filter((e) => e.kind === 'request').length,
    };
  });

  /**
   * Si può chiedere una sessione nel giorno selezionato solo se è libero da
   * sedute e da proposte, e non è passato: un appuntamento è una promessa, e
   * non si promette all'indietro.
   */
  readonly canRequest = computed(
    () => !this.dayOccupied(this.selected()) && !this.isPast(this.selected()),
  );

  /** Il passato non si prenota e non si sposta. Regola unica, usata da tutte le porte. */
  private isPast(iso: string): boolean {
    return iso < this.todayIso;
  }

  /**
   * Un giorno è occupato se ospita già una seduta o una proposta aperta.
   * È l'invariante "un giorno, una sessione", difesa su drag-over, drop e
   * calcolo degli slot liberi.
   */
  private dayOccupied(iso: string, ...exclude: (string | undefined)[]): boolean {
    const skip = new Set(exclude.filter((x): x is string => !!x));
    const hasSession = this.trainer.sessions().some((s) => s.date === iso && !skip.has(s.id));
    const hasRequest = this.store.open().some((r) => r.payload.date === iso && !skip.has(r.id));
    return hasSession || hasRequest;
  }

  /**
   * Stato della sessione concordata, o null se non c'è niente da dire.
   * «Programmata» era lo stato di default di ogni sessione futura: una pill che
   * compare sempre non informa, arreda. Resta l'unico caso che cambia qualcosa
   * per chi legge: è oggi. Le sedute già fatte non passano di qui — hanno una
   * card tutta loro (vedi `concluded`), e lì «completata» è la card stessa.
   */
  sessionState(s: PtSession): { label: string; cls: string } | null {
    return s.date === this.todayIso ? { label: 'Oggi', cls: 'soon' } : null;
  }

  /**
   * Una seduta CONCLUSA si racconta al passato, non in agenda: non c'è più
   * niente da decidere, da spostare o da confermare. Prende quindi la forma
   * della card di un allenamento svolto — cos'hai fatto, quanto è durato,
   * quanti esercizi — perché è esattamente la stessa cosa, fatta in compagnia.
   */
  concluded(s: PtSession): boolean {
    return s.status === 'done' || this.isPast(s.date);
  }

  /** Deep-link: apre il dettaglio dell'allenamento nello Storico. */
  openWorkout(h: HistoryItem): void {
    void this.router.navigate(['/history'], { queryParams: { focus: h.id } });
  }

  // ==========================================================================
  //  NAVIGAZIONE
  // ==========================================================================
  prevMonth(): void { this.shiftMonth(-1); }
  nextMonth(): void { this.shiftMonth(1); }
  private shiftMonth(delta: number): void {
    const d = new Date(this.viewYear(), this.viewMonth() + delta, 1);
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
    const sameMonth = this.today.getFullYear() === d.getFullYear() && this.today.getMonth() === d.getMonth();
    this.selected.set(sameMonth ? isoDay(this.today) : isoDay(d));
  }
  goToday(): void {
    this.viewYear.set(this.today.getFullYear());
    this.viewMonth.set(this.today.getMonth());
    this.selected.set(isoDay(this.today));
  }

  select(cell: DayCell): void {
    // In modalità "scegli un giorno" il tap sceglie la destinazione, non naviga.
    const pick = this.pickDayFor();
    if (pick) {
      if (!this.canDropOn(cell.iso, pick.id)) return;
      this.openMoveSheet(pick, cell.iso);
      return;
    }
    this.focusDay(cell.iso);
  }

  /**
   * Come `focusDay`, ma porta anche l'occhio. Il calendario sta in alto e la
   * timeline in fondo: senza scroll, chi tocca una riga della strip vede solo
   * un giorno che si illumina fuori schermo e crede che non sia successo nulla.
   * Lo scroll dopo il tick: la timeline si ridisegna col nuovo giorno e solo
   * allora l'ancora è al posto definitivo.
   */
  goToDay(iso: string): void {
    this.focusDay(iso);
    setTimeout(() =>
      this.dayAnchor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  /** Porta il calendario su un giorno (anche fuori dal mese in vista). */
  focusDay(iso: string): void {
    const d = new Date(iso + 'T00:00:00');
    if (d.getMonth() !== this.viewMonth() || d.getFullYear() !== this.viewYear()) {
      this.viewYear.set(d.getFullYear());
      this.viewMonth.set(d.getMonth());
    }
    this.selected.set(iso);
  }

  // --- Swipe mese ---
  onTouchStart(ev: TouchEvent): void { this.touchX = ev.changedTouches[0].clientX; }
  onTouchEnd(ev: TouchEvent): void {
    const dx = ev.changedTouches[0].clientX - this.touchX;
    if (dx <= -50) this.nextMonth();
    else if (dx >= 50) this.prevMonth();
  }

  // ==========================================================================
  //  RICHIESTA DI UNA NUOVA SEDUTA
  // ==========================================================================
  openRequest(): void { if (this.canRequest()) this.requestOpen.set(true); }
  closeRequest(): void { this.requestOpen.set(false); }
  confirmRequest(time: string): void {
    this.store.requestBooking(this.selected(), time);
    this.requestOpen.set(false);
    this.toast.show('Richiesta inviata al coach', 'ti-send');
  }

  /** Orari già occupati nel giorno selezionato (per disabilitarli nello sheet). */
  takenTimes(): Set<string> {
    return new Set(this.daySessions().map((s) => s.time));
  }

  // ==========================================================================
  //  DECISIONI SULLE RICHIESTE
  // ==========================================================================
  accept(id: string): void {
    this.store.accept(id);
    this.toast.show('Seduta confermata', 'ti-calendar-check');
  }
  decline(id: string): void {
    this.store.decline(id);
    this.toast.show('Proposta rifiutata', 'ti-x');
  }
  withdraw(id: string): void {
    this.store.withdraw(id);
    this.toast.show('Richiesta annullata', 'ti-arrow-back-up');
  }

  /**
   * "Sposta": entra in modalità scelta del giorno. È lo stesso esito del
   * trascinamento, raggiungibile da tastiera e da screen reader.
   */
  startCounter(id: string): void {
    const r = this.store.open().find((x) => x.id === id);
    if (!r) return;
    this.pickDayFor.set({ type: 'request', id, from: this.whenOf(r.payload.date, r.payload.time), fromDate: r.payload.date });
  }

  /* NON c'è più un "Sposta" sulla seduta concordata: lo spostamento si chiede
     trascinando la card. La modalità "scegli un giorno" resta viva per le
     richieste aperte, che il pulsante ce l'hanno ancora. */

  cancelPick(): void { this.pickDayFor.set(null); }

  // ==========================================================================
  //  DRAG & DROP — non muove niente: chiede
  // ==========================================================================

  /**
   * Una seduta si trascina se non è passata e non è già stata svolta. Basta
   * questo: avere una trattativa aperta **non** la blocca, perché un
   * appuntamento resta spostabile anche dopo che se n'è chiesto lo
   * spostamento. Il secondo trascinamento continua la stessa trattativa
   * invece di aprirne un'altra (`requestReschedule`).
   */
  canDrag(s: PtSession): boolean {
    return !this.isPast(s.date) && s.status !== 'done';
  }

  /**
   * Una proposta si trascina, chiunque l'abbia fatta: quella del coach diventa
   * una controproposta, la mia un ripensamento. Mai dal passato.
   */
  canDragRequest(r: AgendaRequest): boolean {
    return !this.isPast(r.payload.date);
  }

  onDragStart(id: string, ev: DragEvent): void {
    this.draggingId.set(id);
    ev.dataTransfer?.setData('text/plain', id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }
  onDragEnd(): void { this.draggingId.set(null); this.dragOverIso.set(null); }

  /**
   * Un giorno accetta il rilascio se non è passato e non è già occupato.
   * Se si sta trascinando una seduta che ha già una trattativa aperta, il
   * giorno proposto da quella trattativa **non** conta come occupato: è la
   * stessa negoziazione, non un secondo appuntamento, e senza questa esclusione
   * l'unica cosa che non si potrebbe fare è cambiare l'ora restando nel giorno
   * che si era appena chiesto.
   */
  canDropOn(iso: string, excludeId: string): boolean {
    return !this.isPast(iso) && !this.dayOccupied(iso, excludeId, this.store.openFor(excludeId)?.id);
  }

  onDragOver(cell: DayCell, ev: DragEvent): void {
    const id = this.draggingId();
    if (!id) return;
    ev.preventDefault();
    // Il rifiuto si vede PRIMA dell'azione: un giorno non valido non si illumina.
    if (!this.canDropOn(cell.iso, id)) {
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
    const id = this.draggingId();
    this.onDragEnd();
    if (!id || !this.canDropOn(cell.iso, id)) return;

    // Anche sul PROPRIO giorno: lasciar cadere dov'era vuol dire «lo stesso
    // giorno, a un'altra ora», che è metà degli spostamenti veri. Prima il drop
    // finiva in un `return` muto, e un gesto che non risponde sembra rotto.
    const session = this.trainer.session(id);
    if (session) {
      this.openMoveSheet(
        { type: 'session', id, from: this.whenOf(session.date, session.time), fromDate: session.date },
        cell.iso,
      );
      return;
    }
    const req = this.store.open().find((r) => r.id === id);
    if (req) {
      this.openMoveSheet(
        { type: 'request', id, from: this.whenOf(req.payload.date, req.payload.time), fromDate: req.payload.date },
        cell.iso,
      );
    }
  }

  /** Apre lo sheet di scelta orario per la destinazione scelta. */
  private openMoveSheet(src: PickDay, date: string): void {
    this.pickDayFor.set(null);
    this.moveTarget.set({
      source: { type: src.type, id: src.id },
      from: src.from,
      fromDate: src.fromDate,
      date,
      times: this.freeTimesFor(date),
    });
    this.moveTime.set(null);
    this.moveMsg.set('');
  }

  /** Orari liberi in una data = SLOT_OPTIONS meno quelli già impegnati. */
  private freeTimesFor(date: string): string[] {
    const taken = new Set([
      ...this.trainer.sessionsOn(date).map((s) => s.time),
      ...this.store.requestsOn(date).map((r) => r.payload.time),
    ]);
    return SLOT_OPTIONS.filter((t) => !taken.has(t));
  }

  /** Data destinazione formattata per l'header dello sheet. */
  readonly moveDateLabel = computed(() => {
    const t = this.moveTarget();
    return t ? this.dowShort(t.date) : '';
  });

  /**
   * True se lo sheet aperto è una controproposta a una richiesta DEL COACH.
   * Spostare una richiesta mia non è controproporre a nessuno: è cambiare idea,
   * e lo sheet deve dire le parole giuste.
   */
  readonly isCounter = computed(() => {
    const t = this.moveTarget();
    if (t?.source.type !== 'request') return false;
    return this.store.open().find((r) => r.id === t.source.id)?.actor !== 'user';
  });

  /**
   * True quando si resta nello stesso giorno e cambia solo l'ora. Lo sheet deve
   * dirlo con le sue parole: «mar 21 lug · 18:00 → mar 21 lug» sarebbe una
   * freccia che non porta da nessuna parte.
   */
  readonly sameDay = computed(() => {
    const t = this.moveTarget();
    return !!t && t.fromDate === t.date;
  });

  pickTime(t: string): void { this.moveTime.set(t); }
  onMoveMsg(ev: Event): void { this.moveMsg.set((ev.target as HTMLTextAreaElement).value); }

  /** Invia la richiesta al PT (spostamento o controproposta). */
  confirmMove(): void {
    const t = this.moveTarget();
    const time = this.moveTime();
    if (!t || !time) return;
    if (t.source.type === 'session') {
      this.store.requestReschedule(t.source.id, t.date, time, this.moveMsg());
      this.toast.show('Richiesta inviata al coach', 'ti-send');
    } else {
      // Trascinare una richiesta è lo stesso gesto per tutti e due i versi:
      // controproposta se era del coach, ripensamento se era mia.
      const mine = this.store.open().find((x) => x.id === t.source.id)?.actor === 'user';
      this.store.repropose(t.source.id, t.date, time, this.moveMsg());
      this.toast.show(mine ? 'Richiesta aggiornata' : 'Controproposta inviata', 'ti-send');
    }
    this.cancelMove();
  }
  cancelMove(): void { this.moveTarget.set(null); this.moveTime.set(null); this.moveMsg.set(''); }

  /** "18:00 – 19:00": la fine è l'unica cosa che la timeline non dice già. */
  spanOf(s: PtSession): string {
    const [h, m] = s.time.split(':').map(Number);
    const end = new Date(2000, 0, 1, h, m + s.durationMin);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${s.time} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }

  /** "mar 21 lug · 18:00" — un appuntamento si nomina con quando, non con cosa. */
  whenOf(iso: string, time: string): string {
    return `${this.dowShort(iso)} · ${time}`;
  }

  dowShort(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }

}
