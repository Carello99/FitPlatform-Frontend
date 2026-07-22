/**
 * ============================================================================
 *  FILE: trainer-mock.ts  —  DATI DEMO del Personal Trainer (lato UTENTE)
 * ============================================================================
 *  SCOPO: profilo del PT assegnato all'utente, sedute in agenda e messaggi
 *    iniziali della chat. In un'app reale arriverebbero dall'API; qui sono
 *    dati statici che alimentano TrainerService.
 *  NOTA: le date delle sedute sono calcolate RELATIVE a oggi (offset in giorni)
 *    così l'agenda appare sempre popolata nel mese corrente.
 * ============================================================================
 */

import { AgendaRequest } from '../models/agenda-request.model';

/** Stato di una seduta in agenda. */
export type SessionStatus = 'confirmed' | 'done';

/**
 * Una seduta col personal trainer: ciò che utente e coach hanno GIÀ CONCORDATO.
 * Tutto ciò che è ancora in trattativa non sta qui — sta in `AgendaRequest`
 * (`core/models/agenda-request.model.ts`), che ha un attore esplicito.
 * Una sessione in agenda è quindi sempre reale: l'agenda non mente mai su un
 * appuntamento che non è stato accettato da entrambi.
 */
export interface PtSession {
  id: string;
  date: string;        // ISO 'YYYY-MM-DD'
  time: string;        // 'HH:MM'
  durationMin: number;
  status: SessionStatus;
  color: string;       // var(--accent) per il pallino/timeline
  place: string;       // dove ci si vede: 'FitFlow Gym · Sala pesi', 'Online'
  /* --- Resoconto: che cosa si è FATTO. Solo su una seduta 'done'. ---
   * Non contraddice D-45 (vedi sotto): quella regola vieta di ANNUNCIARE il
   * programma di una seduta futura, perché sarebbe una promessa che il coach
   * non ha fatto. A cose fatte non c'è più niente da promettere: è storia, ed
   * è la stessa cosa che lo Storico racconta di un allenamento svolto.
   * Il nome dei campi porta il vincolo con sé: `done*` su una seduta che non
   * è `done` si legge come un errore. */
  doneWorkout?: string;   // "Full body · forza", il lavoro effettivamente svolto
  doneExercises?: number; // quanti esercizi
}

/** Dove ci si vede, quando non è specificato altro. */
export const DEFAULT_PLACE = 'FitFlow Gym · Sala pesi';

/* NON aggiungere qui `title` né `note`.
 * Una seduta col coach è un APPUNTAMENTO: quando, quanto dura, DOVE, con chi,
 * in che stato. MAI cosa allenerai. Il programma è mestiere del coach e vive nella sua
 * testa fino alla sessione; annunciarlo in agenda crea un'aspettativa che lui
 * non ha promesso, e lo fa sembrare inaffidabile quando cambia idea guardando
 * come ti muovi quel giorno ([D-45](../../../DECISIONS.md)).
 * Il campo esisteva e conteneva nomi di scheda («Gambe», «Pull», «Upper body»):
 * è stato tolto perché finché il campo c'è, qualcuno ce li rimette. */

/**
 * Un allegato di un messaggio. `kind` è un insieme CHIUSO, non testo libero:
 * stessa scelta di `AgendaRequest.kind` ([D-45](../../../DECISIONS.md)). Un
 * allegato generico «file» diventerebbe in fretta il posto dove finisce tutto.
 */
export type PtAttachment = { kind: 'diet'; dietId: string };

/** Un messaggio in chat. */
export interface PtMessage {
  id: string;
  from: 'me' | 'pt';
  text: string;
  time: string;        // 'HH:MM'
  attachment?: PtAttachment;
}

/**
 * Il piano alimentare così come esiste davvero oggi: delle FOTO che il coach
 * manda in chat dalla sua app. Non è nutrizione — è un documento suo che noi
 * mostriamo ([PRODUCT §12](../../../PRODUCT.md)): niente pasti da spuntare,
 * niente calorie, niente conteggi. Solo carta da leggere.
 *
 * NON aggiungere qui campi strutturati (pasti, grammature, macro): il giorno in
 * cui servissero non è più un allegato, è un'altra funzionalità — e finché il
 * campo c'è, qualcuno prova a riempirlo a mano.
 */
export interface DietPlan {
  id: string;
  photos: string[];    // una o più pagine, nell'ordine in cui vanno lette
  sentAt: string;      // ISO 'YYYY-MM-DD': quando il coach l'ha mandato
  /** Chi lo firma. In Italia la dieta non la prescrive il PT: spesso è di una
   *  nutrizionista con cui lavora, e il nome dev'essere il suo. */
  author: string;
}

/** Il blocco di lavoro che il coach sta facendo fare adesso. Lo scrive LUI dalla
 *  sua app: se non l'ha scritto, `focus` non c'è e la riga non si disegna.
 *  Nessun empty state — un vuoto che si annuncia è rumore (D-42). */
export interface CoachFocus {
  title: string;       // 'Blocco forza'
  weekCurrent: number; // 3
  weeks: number;       // 6
  note?: string;       // la frase sua, quella che dà il senso al resto
}

/** Profilo del personal trainer assegnato. */
export interface TrainerProfile {
  name: string;
  initials: string;
  photoUrl?: string;   // Foto profilo; se assente si mostrano le iniziali
  color: string;       // colore avatar di fallback (var(--accent))
  role: string;
  specialties: string[];
  bio: string;
  rating: number;
  sessionsDone: number;
  sessionsLeft: number;   // Sedute residue nel pacchetto
  packageTotal: number;   // Sedute totali del pacchetto acquistato
  since: string;          // ISO 'YYYY-MM-DD': da quando vi allenate insieme
  focus?: CoachFocus;     // cosa state facendo adesso (opzionale, vedi sopra)
}

/** Data ISO di un giorno di luglio 2026 (mese "diario" della demo). */
function jul(day: number): string {
  return `2026-07-${String(day).padStart(2, '0')}`;
}

export const TRAINER_MOCK: TrainerProfile = {
  name: 'Alessandro Mormile',
  initials: 'AM',
  photoUrl: 'assets/avatars/alessandro-mormile.jpg',
  color: 'var(--amber)',
  role: 'Personal Trainer',
  specialties: ['Forza', 'Ipertrofia', 'Ricomposizione'],
  bio: 'Coach certificato con 8 anni di esperienza. Programmo il tuo mese di allenamenti e ti seguo seduta dopo seduta.',
  rating: 4.9,
  sessionsDone: 32,
  sessionsLeft: 6,
  packageTotal: 10,
  since: '2026-03-09',
  focus: {
    title: 'Blocco forza',
    weekCurrent: 3,
    weeks: 6,
    note: 'Alziamo panca e stacco: poche ripetizioni, carichi alti. A metà agosto cambiamo.',
  },
};

/**
 * I piani alimentari ricevuti, dal più vecchio al più recente. L'ultimo è quello
 * in vigore; i precedenti non si cancellano ma non hanno una schermata: restano
 * dove sono stati mandati, cioè in chat. La chat è l'archivio, la sezione Coach
 * inchioda quello valido — così non c'è mai da indovinare quale foto fosse buona.
 */
export const DIETS_MOCK: DietPlan[] = [
  {
    id: 'd0',
    sentAt: jul(1),
    photos: ['assets/mock/dieta/dieta-1.svg'],
    author: 'Dott.ssa Chiara Bianchi',
  },
  {
    id: 'd1',
    sentAt: jul(12),
    photos: [
      'assets/mock/dieta/dieta-1.svg',
      'assets/mock/dieta/dieta-2.svg',
      'assets/mock/dieta/dieta-3.svg',
    ],
    author: 'Dott.ssa Chiara Bianchi',
  },
];

/**
 * Sedute col coach di LUGLIO 2026: 2 a settimana (martedì + giovedì).
 * Luglio 2026 → mar: 7,14,21,28 · gio: 2,9,16,23,30. "Oggi" della demo = 15 lug.
 * Le sedute prima del 15 sono svolte (done), quelle dopo sono in programma.
 * Qui ci sono SOLO sedute concordate: le due proposte del coach della demo
 * vivono in `REQUESTS_MOCK`, perché sono trattative, non appuntamenti.
 */
export const SESSIONS_MOCK: PtSession[] = [
  // ---- Sedute svolte (prima del 15 lug) ----
  { id: 's1', date: jul(2),  time: '18:00', durationMin: 60, status: 'done',      color: 'var(--violet)', place: DEFAULT_PLACE, doneWorkout: 'Full body · forza',      doneExercises: 7 },
  { id: 's2', date: jul(7),  time: '18:30', durationMin: 60, status: 'done',      color: 'var(--cyan)',   place: DEFAULT_PLACE, doneWorkout: 'Spinta · petto e spalle', doneExercises: 6 },
  { id: 's3', date: jul(9),  time: '18:00', durationMin: 55, status: 'done',      color: 'var(--green)',  place: 'Online · videochiamata', doneWorkout: 'Mobilità e core', doneExercises: 8 },
  { id: 's4', date: jul(14), time: '18:30', durationMin: 60, status: 'done',      color: 'var(--amber)',  place: DEFAULT_PLACE, doneWorkout: 'Trazione · dorso',      doneExercises: 6 },
  // ---- Sedute in programma (dal 16 lug) ----
  { id: 's5', date: jul(16), time: '18:30', durationMin: 60, status: 'confirmed', color: 'var(--cyan)',   place: DEFAULT_PLACE },
  // s6 è concordata il 21: il coach ne propone lo spostamento al 22 (vedi REQUESTS_MOCK).
  { id: 's6', date: jul(21), time: '18:00', durationMin: 60, status: 'confirmed', color: 'var(--violet)', place: DEFAULT_PLACE },
  { id: 's8', date: jul(28), time: '18:30', durationMin: 55, status: 'confirmed', color: 'var(--green)',  place: 'Online · videochiamata' },
  { id: 's9', date: jul(30), time: '18:00', durationMin: 60, status: 'confirmed', color: 'var(--amber)',  place: DEFAULT_PLACE },
];

/**
 * Richieste aperte all'avvio della demo — è il "lato PT" simulato: due cose che
 * il coach ha chiesto e che l'utente deve ancora decidere.
 *   1. una nuova seduta giovedì 23 (booking)
 *   2. lo spostamento della seduta del 21 a mercoledì 22 (reschedule)
 * Entrambe hanno `actor: 'pt'`: è il coach che propone, l'utente decide.
 */
export const REQUESTS_MOCK: AgendaRequest[] = [
  {
    id: 'r1', kind: 'booking', actor: 'pt', status: 'pending',
    payload: { date: jul(23), time: '19:00', durationMin: 45, color: 'var(--rose)', place: DEFAULT_PLACE },
    message: 'Ti va se ci vediamo giovedì per il check misure?',
    createdAt: Date.now() - 3_600_000,
  },
  {
    id: 'r2', kind: 'reschedule', actor: 'pt', status: 'pending', sessionId: 's6',
    payload: { date: jul(22), time: '18:00', durationMin: 60, color: 'var(--violet)', place: DEFAULT_PLACE },
    message: 'Martedì ho un imprevisto, ce la fai mercoledì stessa ora?',
    createdAt: Date.now() - 7_200_000,
  },
];

export const MESSAGES_MOCK: PtMessage[] = [
  {
    id: 'm0', from: 'pt', time: '08:40',
    text: 'Ecco il piano aggiornato di Chiara. Le pagine sono tre, la terza sono le sostituzioni.',
    attachment: { kind: 'diet', dietId: 'd1' },
  },
  { id: 'm1', from: 'pt', text: 'Ciao! Come è andato l’allenamento di ieri?', time: '09:12' },
  { id: 'm2', from: 'me', text: 'Bene! Solo la panca un po’ pesante sull’ultima serie.', time: '09:20' },
  { id: 'm3', from: 'pt', text: 'Perfetto, la prossima settimana caliamo il carico e alziamo le ripetizioni. Ci vediamo oggi alle 18:30 💪', time: '09:22' },
];

/** Slot orari proponibili quando l'utente richiede una nuova seduta. */
export const SLOT_OPTIONS = ['08:00', '09:00', '10:00', '17:00', '18:00', '18:30', '19:00', '20:00'];

/** Una scheda coach nel marketplace (vetrina + profilo). */
export interface CoachCard {
  id: string;
  name: string;
  initials: string;
  photoUrl?: string;
  color: string;
  headline: string;        // Specialità in una riga (per la card)
  specialties: string[];
  rating: number;
  reviews: number;
  priceFrom: number;       // €/seduta
  bio: string;
  online: boolean;         // offre coaching online
}

/** Catalogo coach del marketplace (mock). */
export const COACHES_CATALOG: CoachCard[] = [
  {
    id: 'giulia-ferri', name: 'Giulia Ferri', initials: 'GF', photoUrl: 'assets/avatars/giulia-ferri.jpg',
    color: 'var(--rose)', headline: 'Dimagrimento & Cardio', specialties: ['Dimagrimento', 'Cardio', 'HIIT'],
    rating: 5.0, reviews: 214, priceFrom: 40, online: true,
    bio: 'Ti aiuto a rimetterti in forma con programmi sostenibili e tanta energia. Focus su costanza e abitudini, non su diete estreme.',
  },
  {
    id: 'davide-re', name: 'Davide Re', initials: 'DR', photoUrl: 'assets/avatars/davide-re.jpg',
    color: 'var(--cyan)', headline: 'Forza & Powerlifting', specialties: ['Forza', 'Powerlifting', 'Tecnica'],
    rating: 4.8, reviews: 176, priceFrom: 45, online: true,
    bio: 'Coach di forza: squat, panca, stacco. Programmazione a blocchi e cura maniacale della tecnica per alzare in sicurezza.',
  },
  {
    id: 'sara-conti', name: 'Sara Conti', initials: 'SC', photoUrl: 'assets/avatars/sara-conti.jpg',
    color: 'var(--violet)', headline: 'Yoga & Mobilità', specialties: ['Yoga', 'Mobilità', 'Postura'],
    rating: 4.9, reviews: 132, priceFrom: 35, online: true,
    bio: 'Mobilità, respiro e postura per muoverti meglio ogni giorno. Ideale se parti da fermo o vuoi recuperare da sedentarietà.',
  },
  {
    id: 'marco-tosi', name: 'Marco Tosi', initials: 'MT', photoUrl: 'assets/avatars/marco-tosi.jpg',
    color: 'var(--amber)', headline: 'Bodybuilding & Ipertrofia', specialties: ['Ipertrofia', 'Bodybuilding', 'Definizione'],
    rating: 4.7, reviews: 98, priceFrom: 42, online: false,
    bio: 'Costruiamo massa e definizione con schede su misura e gestione dei carichi settimana per settimana.',
  },
  {
    id: 'elisa-mora', name: 'Elisa Mora', initials: 'EM', photoUrl: 'assets/avatars/elisa-mora.jpg',
    color: 'var(--teal)', headline: 'Functional & Pilates', specialties: ['Functional', 'Pilates', 'Core'],
    rating: 4.9, reviews: 151, priceFrom: 38, online: true,
    bio: 'Allenamento funzionale e Pilates per un corpo forte ed equilibrato. Ottimo per chi cerca varietà e zero noia.',
  },
];
