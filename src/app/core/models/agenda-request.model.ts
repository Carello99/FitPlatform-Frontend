/**
 * ============================================================================
 *  FILE: agenda-request.model.ts  —  LA NEGOZIAZIONE dell'agenda
 * ============================================================================
 *  SCOPO: modellare ciò che utente e coach si CHIEDONO a vicenda, separato da
 *    ciò che hanno già CONCORDATO (`PtSession`). Una sessione è la verità; una
 *    richiesta è una proposta in attesa di risposta.
 *
 *  PERCHÉ ESISTE: prima lo stato della negoziazione viveva come tre flag
 *    paralleli su `PtSession` (`proposedBy`, `movingTo`, `pendingMove`). La
 *    stessa cosa — "propongo di spostare" — era modellata in due modi opposti a
 *    seconda di chi la faceva, e ogni nuovo tipo di richiesta avrebbe aggiunto
 *    altri campi opzionali moltiplicando le combinazioni illegali.
 *
 *  L'INVARIANTE: una richiesta ha sempre un ATTORE esplicito. Non si deduce
 *    "chi ha proposto" guardando quale campo è valorizzato: sta scritto.
 *    È anche ciò che rende questo modello condivisibile con l'app del PT — è
 *    lo stesso identico tipo, con `actor` invertito.
 *
 *  COME SI AGGIUNGE UN TIPO: si aggiunge un `kind`, si gestisce il suo effetto
 *    in `AgendaRequestStore.applyEffect()` e si dà un'etichetta in `KIND_LABEL`.
 *    Nessun campo nuovo su `PtSession`, nessuna schermata nuova: la richiesta sa
 *    già disegnarsi come riga di strip e come evento "in prova" nel calendario.
 * ============================================================================
 */

/** Cosa si sta chiedendo. */
export type RequestKind =
  | 'booking'     // "prenotiamo una nuova seduta"
  | 'reschedule'; // "spostiamo una seduta già concordata"

/** Chi ha formulato la richiesta. Mai dedotto: sempre esplicito. */
export type RequestActor = 'user' | 'pt';

/** Dove si trova la richiesta nel suo ciclo di vita. */
export type RequestStatus =
  | 'pending'    // in attesa di risposta della controparte
  | 'accepted'   // accettata → l'effetto è stato applicato alla sessione
  | 'declined'   // rifiutata dalla controparte
  | 'countered'  // superata da una controproposta (vedi `supersedes`)
  | 'withdrawn'  // ritirata da chi l'aveva formulata
  | 'expired';   // scaduta senza risposta

/** Lo slot proposto. Per 'booking' descrive la seduta da creare.
 *  Niente titolo: si propone un APPUNTAMENTO, non un programma (vedi `PtSession`). */
export interface RequestPayload {
  date: string;         // ISO 'YYYY-MM-DD'
  time: string;         // 'HH:MM'
  durationMin: number;
  color: string;        // var(--accent) per il pallino di timeline
  place: string;        // dove ci si vede, vedi `PtSession.place`
}

/** Una richiesta in agenda: la sola cosa che utente e coach si scambiano. */
export interface AgendaRequest {
  id: string;
  kind: RequestKind;
  actor: RequestActor;
  status: RequestStatus;
  /** Sessione interessata. Assente per 'booking': la sessione non esiste ancora. */
  sessionId?: string;
  payload: RequestPayload;
  /** Messaggio allegato dall'autore della richiesta. */
  message?: string;
  /** Id della richiesta che questa sostituisce: è la catena delle controproposte. */
  supersedes?: string;
  /** Timestamp di creazione (ms). */
  createdAt: number;
  /** Timestamp di prima visione da parte del destinatario: se assente, è "non letta". */
  seenAt?: number;
}

/** Cosa sta chiedendo la richiesta — è il titolo della card. */
export const KIND_LABEL: Record<RequestKind, string> = {
  booking: 'Nuova sessione',
  reschedule: 'Spostamento di una sessione',
};

/** Lo stesso concetto in forma breve, per le righe compatte. */
export const KIND_SHORT: Record<RequestKind, string> = {
  booking: 'Nuova sessione',
  reschedule: 'Spostamento',
};

/** Icona Tabler della richiesta, per tipo. */
export const KIND_ICON: Record<RequestKind, string> = {
  booking: 'ti-calendar-plus',
  reschedule: 'ti-arrows-exchange',
};

/**
 * Una richiesta è "aperta" finché attende una risposta: è l'unico stato che
 * occupa spazio nell'interfaccia. Tutti gli altri sono storia.
 */
export function isOpen(r: AgendaRequest): boolean {
  return r.status === 'pending';
}

/** Istante di inizio dello slot proposto (è anche la scadenza della richiesta). */
export function slotStart(r: AgendaRequest): number {
  return new Date(`${r.payload.date}T${r.payload.time}:00`).getTime();
}
