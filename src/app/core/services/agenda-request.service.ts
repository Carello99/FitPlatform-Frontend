/**
 * ============================================================================
 *  FILE: agenda-request.service.ts  —  LA NEGOZIAZIONE dell'agenda
 * ============================================================================
 *  SCOPO: unico posto in cui una richiesta cambia stato. I componenti non
 *    mutano nulla: emettono un'azione, lo store transiziona e applica l'effetto
 *    sulle sedute (via TrainerService).
 *
 *  LA STATE MACHINE — cinque transizioni, tutte da `pending`:
 *    accept    (controparte) → accepted   + applica il payload alla seduta
 *    decline   (controparte) → declined   + nessun effetto
 *    counter   (controparte) → countered  + nasce una richiesta con `supersedes`
 *    withdraw  (proponente)  → withdrawn  + nessun effetto
 *    scadenza  (tempo)       → expired    + nessun effetto
 *
 *  DIREZIONE DELLE DIPENDENZE: questo store conosce TrainerService, non il
 *    contrario. Aggiungere qui una dipendenza inversa creerebbe un ciclo.
 *
 *  PER LA FUSIONE CON L'APP PT: è lo stesso modello visto dall'altro lato.
 *    Cambia solo chi è `ME` (qui 'user'); le transizioni sono identiche.
 * ============================================================================
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { TrainerService } from './trainer.service';
import { DEFAULT_PLACE, PtSession, REQUESTS_MOCK } from '../data/trainer-mock';
import { AgendaRequest, RequestActor, isOpen, slotStart } from '../models/agenda-request.model';

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
/** "2026-07-18" → "18 lug" (per i messaggi generati in chat). */
function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
}

/** Chi siamo noi in questa app. Nell'app del PT questa costante vale 'pt'. */
const ME: RequestActor = 'user';

/** Finestra entro cui una richiesta è considerata urgente (24 ore). */
const URGENT_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AgendaRequestStore {
  private readonly trainer = inject(TrainerService);

  private readonly _requests = signal<AgendaRequest[]>([...REQUESTS_MOCK]);
  readonly requests = this._requests.asReadonly();

  /** Tutte le richieste ancora aperte, dalla più imminente. */
  readonly open = computed(() =>
    this._requests()
      .filter(isOpen)
      .filter((r) => slotStart(r) > Date.now()) // le scadute non sono più aperte
      .sort((a, b) => slotStart(a) - slotStart(b)),
  );

  /** Richieste che aspettano una MIA risposta: le uniche su cui posso agire. */
  readonly toAnswer = computed(() => this.open().filter((r) => r.actor !== ME));

  /** Richieste MIE che aspettano il coach: posso solo ritirarle. */
  readonly awaiting = computed(() => this.open().filter((r) => r.actor === ME));

  /** Quante richieste attendono una mia risposta — alimenta i badge. */
  readonly toAnswerCount = computed(() => this.toAnswer().length);

  /** Quante di quelle non sono ancora state viste. */
  readonly unseenCount = computed(() => this.toAnswer().filter((r) => !r.seenAt).length);

  /** Richieste aperte che sono già scadute: restano visibili come storia, con un'uscita. */
  readonly expired = computed(() =>
    this._requests().filter((r) => isOpen(r) && slotStart(r) <= Date.now()),
  );

  /** Giorni ISO toccati da una richiesta aperta (destinazione) — per illuminare il calendario. */
  readonly proposedDays = computed(() => new Set(this.open().map((r) => r.payload.date)));

  /** Giorni ISO da cui una richiesta aperta vorrebbe spostare una seduta. */
  /**
   * Le COPPIE giorno-di-partenza / giorno-d'arrivo di ogni spostamento aperto.
   * Serve a evidenziare il legame sul calendario: selezionando uno dei due
   * giorni si accendono entrambi. Ogni elemento è `[origine, destinazione]`
   * (uguali se lo spostamento resta nello stesso giorno).
   */
  readonly reschedulePairs = computed<[string, string][]>(() => {
    const out: [string, string][] = [];
    for (const r of this.open()) {
      if (r.kind !== 'reschedule' || !r.sessionId) continue;
      const s = this.trainer.session(r.sessionId);
      if (s) out.push([s.date, r.payload.date]);
    }
    return out;
  });

  readonly vacatingDays = computed(() => {
    const set = new Set<string>();
    for (const r of this.open()) {
      if (r.kind !== 'reschedule' || !r.sessionId) continue;
      const s = this.trainer.session(r.sessionId);
      // Anche se la destinazione è lo stesso giorno: quell'ORA se ne va, e il
      // giorno mostra i due lati come li mostrerebbe se fossero separati.
      if (s) set.add(s.date);
    }
    return set;
  });

  /** Richieste aperte che riguardano un certo giorno (destinazione proposta). */
  requestsOn(iso: string): AgendaRequest[] {
    return this.open().filter((r) => r.payload.date === iso);
  }

  /** True se la richiesta scade entro 24 ore: la card passa in rosa. */
  isUrgent(r: AgendaRequest): boolean {
    return slotStart(r) - Date.now() <= URGENT_MS;
  }

  /**
   * Motivo per cui una richiesta NON è accettabile, o null se lo è.
   * Difende l'invariante "un giorno, una sessione": il rifiuto si vede PRIMA
   * dell'azione, non dopo (UX §15.9).
   */
  conflictReason(r: AgendaRequest): string | null {
    const clash = this.trainer
      .sessionsOn(r.payload.date)
      .find((s) => s.id !== r.sessionId);
    if (!clash) return null;
    return `Hai già una sessione alle ${clash.time}`;
  }

  /** Segna come viste tutte le richieste che attendono una mia risposta. */
  markSeen(): void {
    const now = Date.now();
    this._requests.update((list) =>
      list.map((r) => (isOpen(r) && r.actor !== ME && !r.seenAt ? { ...r, seenAt: now } : r)),
    );
  }

  // ==========================================================================
  //  TRANSIZIONI
  // ==========================================================================

  /** Accetta una richiesta della controparte → applica il payload alla seduta. */
  accept(id: string): void {
    const r = this.find(id);
    if (!r || r.actor === ME || this.conflictReason(r)) return;
    this.applyEffect(r);
    this.setStatus(id, 'accepted');
  }

  /** Rifiuta una richiesta della controparte: la seduta resta com'era. */
  decline(id: string): void {
    const r = this.find(id);
    if (!r || r.actor === ME) return;
    this.setStatus(id, 'declined');
  }

  /** Ritira una richiesta che avevo formulato io. */
  withdraw(id: string): void {
    const r = this.find(id);
    if (!r || r.actor !== ME) return;
    this.setStatus(id, 'withdrawn');
  }

  /**
   * Controproposta: "quel giorno no, questo sì". La richiesta della controparte
   * passa a `countered` e ne nasce una mia che la sostituisce — è la catena
   * `supersedes`, cioè il thread della trattativa.
   */
  counter(id: string, date: string, time: string, message?: string): void {
    const r = this.find(id);
    if (!r || r.actor === ME) return;
    this.setStatus(id, 'countered');
    this.push({
      kind: r.kind,
      sessionId: r.sessionId,
      payload: { ...r.payload, date, time },
      message,
      supersedes: id,
    });
    this.announce(
      `Il ${prettyDate(r.payload.date)} · ${r.payload.time} non riesco. ` +
        `Ti va il ${prettyDate(date)} · ${time}?`,
      message,
    );
  }

  /**
   * Cambio idea su una richiesta MIA ancora in sospeso: la vecchia si ritira e
   * ne nasce un'altra che la sostituisce, nella stessa catena `supersedes`.
   *
   * Serve perché nella vita reale si cambia idea prima che l'altro risponda, e
   * l'unica alternativa era ritirare e ricominciare da capo — due gesti per un
   * ripensamento, con la trattativa spezzata in mezzo.
   */
  reproposeMine(id: string, date: string, time: string, message?: string): void {
    const r = this.find(id);
    if (!r || r.actor !== ME) return;
    this.setStatus(id, 'withdrawn');
    this.push({
      kind: r.kind,
      sessionId: r.sessionId,
      payload: { ...r.payload, date, time },
      message,
      supersedes: id,
    });
    this.announce(
      `Scusa, cambio: invece del ${prettyDate(r.payload.date)} · ${r.payload.time} ` +
        `ti va il ${prettyDate(date)} · ${time}?`,
      message,
    );
  }

  /**
   * Sposta una richiesta aperta a un altro slot, da qualunque parte venga:
   * se è del coach è una **controproposta**, se è mia è un **ripensamento**.
   * Chi trascina fa lo stesso gesto e non deve sapere di chi era la richiesta.
   */
  repropose(id: string, date: string, time: string, message?: string): void {
    const r = this.find(id);
    if (!r) return;
    if (r.actor === ME) this.reproposeMine(id, date, time, message);
    else this.counter(id, date, time, message);
  }

  /**
   * L'utente chiede di spostare una seduta già concordata (drag&drop in agenda).
   *
   * Se su quella seduta c'è già una trattativa aperta **non si rifiuta il
   * gesto**: si continua quella trattativa. Un appuntamento resta spostabile
   * anche dopo che se n'è chiesto lo spostamento — chi cambia idea due volte
   * non sta facendo niente di strano, e una card che smette di rispondere al
   * trascinamento sembra rotta.
   */
  requestReschedule(sessionId: string, date: string, time: string, message?: string): void {
    const s = this.trainer.session(sessionId);
    if (!s) return;
    const pending = this.openFor(sessionId);
    if (pending) {
      this.repropose(pending.id, date, time, message);
      return;
    }
    this.push({
      kind: 'reschedule',
      sessionId,
      payload: { date, time, durationMin: s.durationMin, color: s.color, place: s.place },
      message,
    });
    this.announce(
      `Ciao ${this.trainer.trainer.name}! Vorrei spostare la sessione del ${prettyDate(s.date)} · ${s.time} ` +
        `al ${prettyDate(date)} · ${time}. Per te va bene?`,
      message,
    );
  }

  /** L'utente chiede una nuova seduta in un giorno libero. */
  requestBooking(date: string, time: string): void {
    this.push({
      kind: 'booking',
      payload: { date, time, durationMin: 60, color: 'var(--rose)', place: DEFAULT_PLACE },
    });
    this.announce(
      `Ciao ${this.trainer.trainer.name}! Ci vediamo il ${prettyDate(date)} · ${time}?`,
    );
  }

  /** La richiesta aperta che riguarda una certa seduta, se c'è. */
  openFor(sessionId: string): AgendaRequest | undefined {
    return this.open().find((r) => r.sessionId === sessionId);
  }

  // ==========================================================================
  //  INTERNI
  // ==========================================================================

  private find(id: string): AgendaRequest | undefined {
    return this._requests().find((r) => r.id === id && isOpen(r));
  }

  private setStatus(id: string, status: AgendaRequest['status']): void {
    this._requests.update((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  private push(r: Omit<AgendaRequest, 'id' | 'actor' | 'status' | 'createdAt'>): void {
    this._requests.update((list) => [
      ...list,
      { ...r, id: 'req-' + Date.now(), actor: ME, status: 'pending', createdAt: Date.now() },
    ]);
  }

  /**
   * L'effetto di una richiesta accettata sulle sedute.
   * PER AGGIUNGERE UN TIPO DI RICHIESTA: si aggiunge qui il suo `case`.
   */
  private applyEffect(r: AgendaRequest): void {
    switch (r.kind) {
      case 'booking': {
        const s: PtSession = {
          id: 'ses-' + Date.now(),
          date: r.payload.date,
          time: r.payload.time,
          durationMin: r.payload.durationMin,
          status: 'confirmed',
          color: r.payload.color,
          place: r.payload.place,
        };
        this.trainer.addSession(s);
        break;
      }
      case 'reschedule':
        if (r.sessionId) this.trainer.moveSession(r.sessionId, r.payload.date, r.payload.time);
        break;
    }
  }

  /**
   * Ogni richiesta dell'utente lascia una traccia leggibile in chat: il coach
   * non riceve un evento di sistema, riceve una persona che parla (UX §19.6).
   */
  private announce(base: string, message?: string): void {
    const extra = message?.trim();
    this.trainer.sendMessage(extra ? `${base}\n${extra}` : base);
  }
}
