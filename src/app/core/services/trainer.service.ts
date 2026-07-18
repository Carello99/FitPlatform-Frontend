/**
 * ============================================================================
 *  FILE: trainer.service.ts  —  STATO del Personal Trainer (lato UTENTE)
 * ============================================================================
 *  SCOPO: unica fonte di verità (signals) condivisa da tre schermate:
 *    - Personal Trainer (scheda del PT)
 *    - Agenda (sedute)
 *    - Messaggi (chat 1:1 col PT)
 *  COSA RAPPRESENTA: sostituto client-side dell'API. Espone stato reattivo e
 *    poche azioni (richiedi seduta, invia messaggio) che aggiornano i signal.
 * ============================================================================
 */
import { Injectable, computed, signal } from '@angular/core';
import {
  COACHES_CATALOG, CoachCard, MESSAGES_MOCK, PtMessage, PtSession, SESSIONS_MOCK, TRAINER_MOCK, TrainerProfile,
} from '../data/trainer-mock';

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
/** "2026-07-18" → "18 lug" (per i messaggi di spostamento). */
function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
}

@Injectable({ providedIn: 'root' })
export class TrainerService {
  /** Profilo del PT (statico in questa demo). */
  readonly trainer: TrainerProfile = TRAINER_MOCK;

  /** true se l'utente ha già un coach assegnato (altrimenti la sezione parte dal marketplace). */
  readonly hasCoach = signal(true);

  /** Catalogo coach del marketplace. */
  readonly catalog: CoachCard[] = COACHES_CATALOG;

  /** Trova un coach del catalogo per id. */
  coach(id: string): CoachCard | undefined {
    return this.catalog.find((c) => c.id === id);
  }

  /** Sedute in agenda (signal: si aggiorna quando l'utente richiede una seduta). */
  private readonly _sessions = signal<PtSession[]>([...SESSIONS_MOCK]);
  readonly sessions = this._sessions.asReadonly();

  /** Messaggi della chat (signal). */
  private readonly _messages = signal<PtMessage[]>([...MESSAGES_MOCK]);
  readonly messages = this._messages.asReadonly();

  /** Prossime sedute (confermate o in attesa) ordinate per data/ora. */
  readonly upcoming = computed(() =>
    this._sessions()
      .filter((s) => s.status !== 'done')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  );

  /** Sedute svolte, dalla più recente. */
  readonly pastSessions = computed(() =>
    this._sessions()
      .filter((s) => s.status === 'done')
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
  );

  /** La prossima seduta in programma (o null). */
  readonly nextSession = computed(() => this.upcoming()[0] ?? null);

  /** Ultimo messaggio della conversazione (o null). */
  readonly lastMessage = computed(() => {
    const m = this._messages();
    return m.length ? m[m.length - 1] : null;
  });

  /** Messaggi non letti = coda finale di messaggi del PT (dopo l'ultimo dell'utente). */
  readonly unread = computed(() => {
    const m = this._messages();
    let n = 0;
    for (let i = m.length - 1; i >= 0 && m[i].from === 'pt'; i--) n++;
    return n;
  });

  /** Sedute di uno specifico giorno ISO, ordinate per ora. */
  sessionsOn(isoDate: string): PtSession[] {
    return this._sessions()
      .filter((s) => s.date === isoDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  /** Proposte di seduta del coach da accettare (pending, proposte dal coach). */
  readonly proposals = computed(() =>
    this._sessions()
      .filter((s) => s.status === 'pending' && s.proposedBy === 'coach')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  );

  /** Spostamenti proposti dal coach, in attesa di conferma dell'utente. */
  readonly reschedules = computed(() =>
    this._sessions()
      .filter((s) => !!s.movingTo)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  );

  /** Totale cose da confermare (proposte + spostamenti) — per i badge. */
  readonly toConfirm = computed(() => this.proposals().length + this.reschedules().length);

  /** Accetta una proposta di seduta del coach → confermata. */
  acceptSession(id: string): void {
    this._sessions.update((list) =>
      list.map((s) => (s.id === id ? { ...s, status: 'confirmed', proposedBy: undefined } : s)),
    );
  }

  /** Rifiuta una proposta di seduta del coach → rimossa. */
  declineSession(id: string): void {
    this._sessions.update((list) => list.filter((s) => s.id !== id));
  }

  /** Conferma lo spostamento proposto → la seduta si sposta al nuovo slot. */
  confirmMove(id: string): void {
    this._sessions.update((list) =>
      list.map((s) =>
        s.id === id && s.movingTo
          ? { ...s, date: s.movingTo.date, time: s.movingTo.time, status: 'confirmed', movingTo: undefined }
          : s,
      ),
    );
  }

  /** Rifiuta lo spostamento → la seduta resta dov'è. */
  rejectMove(id: string): void {
    this._sessions.update((list) =>
      list.map((s) => (s.id === id ? { ...s, movingTo: undefined } : s)),
    );
  }

  /** Sedute con uno spostamento richiesto dall'utente, in attesa del PT. */
  readonly pendingMoves = computed(() => this._sessions().filter((s) => !!s.pendingMove));

  /**
   * L'UTENTE richiede di spostare una propria seduta a un altro giorno/orario
   * (drag&drop in agenda). La seduta viene già mostrata al NUOVO slot, marcata
   * "in attesa del PT" e con memoria dello slot originale (per l'annullamento);
   * parte un messaggio-notifica in chat al PT con l'eventuale testo allegato.
   */
  requestMove(sid: string, toDate: string, toTime: string, message?: string): void {
    const orig = this._sessions().find((s) => s.id === sid);
    if (!orig || orig.pendingMove) return;
    const msg = message?.trim() || undefined;
    const fromDate = orig.date;
    const fromTime = orig.time;
    this._sessions.update((list) =>
      list.map((s) =>
        s.id === sid ? { ...s, date: toDate, time: toTime, pendingMove: { fromDate, fromTime, message: msg } } : s,
      ),
    );
    const base = `Ciao ${this.trainer.name}! Vorrei spostare "${orig.title}" dal ${prettyDate(fromDate)} · ${fromTime} al ${prettyDate(toDate)} · ${toTime}. Per te va bene?`;
    this.sendMessage(msg ? `${base}\n${msg}` : base);
  }

  /** Annulla la richiesta: la seduta torna allo slot originale e sparisce il "da confermare". */
  cancelMove(sid: string): void {
    this._sessions.update((list) =>
      list.map((s) =>
        s.id === sid && s.pendingMove
          ? { ...s, date: s.pendingMove.fromDate, time: s.pendingMove.fromTime, pendingMove: undefined }
          : s,
      ),
    );
  }

  /** Richiede una nuova seduta: la aggiunge come 'pending' (proposta dall'utente). */
  requestSession(date: string, time: string, title = 'Seduta'): void {
    const s: PtSession = {
      id: 'req-' + Date.now(),
      date, time, title,
      durationMin: 60,
      status: 'pending',
      color: 'var(--rose)',
      proposedBy: 'me',
    };
    this._sessions.update((list) => [...list, s]);
  }

  /** Invia un messaggio dell'utente (e simula una breve risposta del PT). */
  sendMessage(text: string): void {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this._messages.update((list) => [
      ...list,
      { id: 'me-' + Date.now(), from: 'me', text, time: hhmm },
    ]);
  }
}
