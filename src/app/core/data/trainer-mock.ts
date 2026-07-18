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

/** Stato di una seduta in agenda. */
export type SessionStatus = 'confirmed' | 'pending' | 'done';

/** Una seduta col personal trainer. */
export interface PtSession {
  id: string;
  date: string;        // ISO 'YYYY-MM-DD'
  time: string;        // 'HH:MM'
  title: string;       // Es. "Upper body", "Valutazione"
  durationMin: number;
  status: SessionStatus;
  color: string;       // var(--accent) per il pallino/timeline
  /** Chi ha originato la seduta: 'coach' = proposta da accettare; 'me' = richiesta dall'utente. */
  proposedBy?: 'coach' | 'me';
  /** Se presente: spostamento proposto dal coach, in attesa di conferma dell'utente. */
  movingTo?: { date: string; time: string };
  /** Se presente: spostamento richiesto dall'UTENTE (drag&drop), in attesa che il PT
   *  confermi. La seduta è già mostrata al nuovo slot (date/time); qui si ricorda
   *  lo slot ORIGINALE così da poterla ripristinare se la richiesta viene annullata. */
  pendingMove?: { fromDate: string; fromTime: string; message?: string };
  /** Nota/obiettivo della seduta col coach (mostrata nella card del giorno). */
  note?: string;
}

/** Un messaggio in chat. */
export interface PtMessage {
  id: string;
  from: 'me' | 'pt';
  text: string;
  time: string;        // 'HH:MM'
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
};

/**
 * Sedute col coach di LUGLIO 2026: 2 a settimana (martedì + giovedì).
 * Luglio 2026 → mar: 7,14,21,28 · gio: 2,9,16,23,30. "Oggi" della demo = 15 lug.
 * Le sedute prima del 15 sono svolte (done), quelle dopo sono in programma.
 * Sono mantenuti i due casi demo per Messaggi/Agenda: una proposta del coach da
 * accettare e uno spostamento proposto dal coach da confermare.
 */
export const SESSIONS_MOCK: PtSession[] = [
  // ---- Sedute svolte (prima del 15 lug) ----
  { id: 's1', date: jul(2),  time: '18:00', title: 'Upper body',  durationMin: 60, status: 'done',      color: 'var(--violet)', note: 'Focus panca e trazioni' },
  { id: 's2', date: jul(7),  time: '18:30', title: 'Lower body',  durationMin: 60, status: 'done',      color: 'var(--cyan)',   note: 'Squat pesante + accessori' },
  { id: 's3', date: jul(9),  time: '18:00', title: 'Full body',   durationMin: 55, status: 'done',      color: 'var(--green)',  note: 'Circuito total-body' },
  { id: 's4', date: jul(14), time: '18:30', title: 'Push',        durationMin: 60, status: 'done',      color: 'var(--amber)',  note: 'Spinte + core' },
  // ---- Sedute in programma (dal 16 lug) ----
  { id: 's5', date: jul(16), time: '18:30', title: 'Pull',        durationMin: 60, status: 'confirmed', color: 'var(--cyan)',   note: 'Dorso e bicipiti' },
  // Spostamento proposto dal coach: martedì 21 → mercoledì 22, da confermare dall'utente.
  { id: 's6', date: jul(21), time: '18:00', title: 'Gambe',       durationMin: 60, status: 'confirmed', color: 'var(--violet)', movingTo: { date: jul(22), time: '18:00' }, note: 'Quadricipiti e glutei' },
  // Proposta di seduta dal coach: da accettare.
  { id: 's7', date: jul(23), time: '19:00', title: 'Valutazione', durationMin: 45, status: 'pending',   color: 'var(--rose)',   proposedBy: 'coach', note: 'Check misure e progressi' },
  { id: 's8', date: jul(28), time: '18:30', title: 'Full body',   durationMin: 55, status: 'confirmed', color: 'var(--green)',  note: 'Total-body + mobilità' },
  { id: 's9', date: jul(30), time: '18:00', title: 'Push',        durationMin: 60, status: 'confirmed', color: 'var(--amber)',  note: 'Spinte pesanti' },
];

export const MESSAGES_MOCK: PtMessage[] = [
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
