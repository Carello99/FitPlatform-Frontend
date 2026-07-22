/**
 * ============================================================================
 *  FILE: trainer.service.ts  —  STATO del Personal Trainer (lato UTENTE)
 * ============================================================================
 *  SCOPO: unica fonte di verità (signals) condivisa da tre schermate:
 *    - Personal Trainer (scheda del PT)
 *    - Agenda (sedute)
 *    - Messaggi (chat 1:1 col PT)
 *  COSA RAPPRESENTA: sostituto client-side dell'API. Custodisce ciò che è
 *    CONCORDATO (sedute, messaggi, profilo del coach).
 *
 *  COSA NON STA QUI: la negoziazione. Proposte, spostamenti e controproposte
 *    vivono in `AgendaRequestStore`, che è l'unico a poter mutare le sedute in
 *    conseguenza di una richiesta accettata. La dipendenza va in una direzione
 *    sola (store → trainer), così non ci sono cicli: questo servizio non sa
 *    nulla delle richieste.
 * ============================================================================
 */
import { Injectable, computed, signal } from '@angular/core';
import {
  COACHES_CATALOG, CoachCard, DIETS_MOCK, DietPlan, MESSAGES_MOCK, PtMessage, PtSession, SESSIONS_MOCK,
  TRAINER_MOCK, TrainerProfile,
} from '../data/trainer-mock';
import { isoDay } from '../utils/date.utils';

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

  /** Sedute concordate in agenda. */
  private readonly _sessions = signal<PtSession[]>([...SESSIONS_MOCK]);
  readonly sessions = this._sessions.asReadonly();

  /** Messaggi della chat (signal). */
  private readonly _messages = signal<PtMessage[]>([...MESSAGES_MOCK]);
  readonly messages = this._messages.asReadonly();

  // ==========================================================================
  //  PIANO ALIMENTARE
  //  Arriva come allegato di un messaggio del coach: la chat è dove viene
  //  consegnato e resta l'archivio di tutti quelli passati. Qui si tiene solo
  //  il puntatore a quello IN VIGORE, che è l'unico che la sezione Coach mostra.
  // ==========================================================================

  /** Piani alimentari ricevuti, dal più vecchio al più recente. */
  private readonly _diets = signal<DietPlan[]>([...DIETS_MOCK]);
  readonly diets = this._diets.asReadonly();

  /** Il piano in vigore = l'ultimo arrivato (o null se il coach non ne ha mandati). */
  readonly currentDiet = computed<DietPlan | null>(() => {
    const list = [...this._diets()].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    return list.length ? list[list.length - 1] : null;
  });

  /** Trova un piano per id (serve alla chat, che cita quello di allora). */
  diet(id: string): DietPlan | undefined {
    return this._diets().find((d) => d.id === id);
  }

  /**
   * Prossime sedute in programma, ordinate per data/ora.
   * «Prossime» vuol dire **da oggi in avanti**: una seduta concordata e mai
   * chiusa resta `confirmed` per sempre, e senza il filtro sulla data sarebbe
   * lei la «prossima» — con la Home che annuncia un appuntamento di ieri.
   */
  readonly upcoming = computed(() => {
    const today = isoDay();
    return this._sessions()
      .filter((s) => s.status !== 'done' && s.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  });

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

  /** Trova una seduta per id. */
  session(id: string): PtSession | undefined {
    return this._sessions().find((s) => s.id === id);
  }

  // ==========================================================================
  //  MUTAZIONI DELLE SEDUTE
  //  Le chiama SOLO AgendaRequestStore, quando una richiesta viene accettata.
  //  Nessun componente muta direttamente l'agenda: passa sempre da una
  //  richiesta, perché in agenda nessuno impone — si propone (UX §19).
  // ==========================================================================

  /** Aggiunge una seduta concordata. */
  addSession(s: PtSession): void {
    this._sessions.update((list) => [...list, s]);
  }

  /** Sposta una seduta a un nuovo slot. */
  moveSession(id: string, date: string, time: string): void {
    this._sessions.update((list) => list.map((s) => (s.id === id ? { ...s, date, time } : s)));
  }

  /** Invia un messaggio dell'utente in chat. */
  sendMessage(text: string): void {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this._messages.update((list) => [
      ...list,
      { id: 'me-' + Date.now(), from: 'me', text, time: hhmm },
    ]);
  }
}
