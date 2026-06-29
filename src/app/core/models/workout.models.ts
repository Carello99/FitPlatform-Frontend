/**
 * ============================================================================
 *  FILE: workout.models.ts  —  MODELLI DATI (DTO / contratto frontend-backend)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Contiene SOLO tipi e interfacce TypeScript. Non c'è codice Angular qui:
 *   è pura tipizzazione: descrive la "forma" di ogni oggetto che viaggia
 *   nell'applicazione. Per uno sviluppatore Java: pensalo come un insieme di
 *   POJO / record / DTO, ma senza implementazione — solo la struttura.
 *
 * RESPONSABILITÀ PRINCIPALI
 *   - Definire il "contratto dati" tra frontend e backend (vedi AppData in fondo).
 *   - Garantire type-safety a compile-time in tutta l'app: se il backend cambia
 *     un campo, qui esplode l'errore di compilazione invece che a runtime.
 *
 * DIPENDENZE PRINCIPALI
 *   - Nessuna dipendenza runtime. Le interfacce NON generano JavaScript:
 *     a compilazione vengono cancellate (type erasure, come i generics Java).
 *
 * FLUSSO GENERALE
 *   workout-api.service.ts scarica un JSON → lo "casta" ad AppData →
 *   workout-store.service.ts lo conserva in signals → i componenti leggono
 *   le singole interfacce (Scheda, Exercise, QuickStat, ...) per mostrarle.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - Se un campo è `?` (opzionale) può essere `undefined`: gestirlo SEMPRE,
 *     altrimenti errori "cannot read property of undefined" a runtime.
 *   - Queste interfacce devono restare allineate al JSON reale (app-data.json
 *     / risposta API). Un mismatch NON dà errore di compilazione (il JSON è
 *     `any` al confine HTTP) ma rompe la UI silenziosamente.
 * ============================================================================
 */

// Le interfacce descrivono la "forma" degli oggetti usati nell'app.

// Tipo per i colori/accenti delle schede. "type" in TypeScript crea un alias
// per un insieme fisso di stringhe (union type).
export type Accent = 'amber' | 'cyan' | 'violet' | 'green' | 'rose' | 'slate';

// "interface" descrive la struttura di un oggetto.
// Non genera codice JavaScript — serve solo per i controlli di tipo a compile-time.
export interface Exercise {
  name: string;   // Nome dell'esercizio (es. "Squat")
  sets: number;   // Numero di serie
  reps: string;   // Range di ripetizioni (es. "8-12")
  rest: number;   // Secondi di recupero tra le serie
  kg?: number;    // Carico in kg (opzionale — 0 per esercizi a corpo libero)
  muscle: string; // Gruppo muscolare principale
  icon: string;   // Classe CSS dell'icona (Tabler Icons, es. "ti-barbell")
}

// Scheda di allenamento — corrisponde a un oggetto nel file app-data.json
export interface Scheda {
  id: string;          // Identificatore univoco (es. "push", "legs")
  name: string;        // Nome visualizzato (es. "Push Day")
  focus: string;       // Breve descrizione del focus
  duration: number;    // Durata stimata in minuti
  level: number;       // Difficoltà: 1=Principiante, 2=Intermedio, 3=Avanzato
  accent: Accent;      // Colore tematico della scheda
  icon: string;        // Classe CSS icona
  tag: string;         // Etichetta breve (es. "In corso", "Veloce")
  desc: string;        // Descrizione lunga
  exercises: Exercise[]; // Lista degli esercizi contenuti
}

// Stato di un giorno nella settimana (usato nel recap settimanale della Home)
export interface WeekDay {
  d: string;                         // Iniziale del giorno (es. "L", "M", "V")
  state: 'done' | 'today' | 'rest'; // Completato / oggi / riposo
}

// Statistica rapida mostrata nella Home (es. "Allenamenti questa settimana")
export interface QuickStat {
  icon: string;   // Classe CSS icona
  tile: Accent;   // Colore del riquadro
  val: string;    // Valore numerico/testuale
  unit?: string;  // Unità opzionale (es. "kg", "min") — il ? rende il campo opzionale
  label: string;  // Etichetta (es. "Volume totale")
  trend: string;  // Variazione rispetto al periodo precedente (es. "+12%")
  up: boolean;    // true se il trend è positivo
}

// Badge (trofeo) guadagnato dall'utente
export interface Badge {
  icon: string;  // Classe CSS icona
  tile: Accent;  // Colore del riquadro
  name: string;  // Nome del badge
  got: boolean;  // true se l'utente lo ha già sbloccato
}

// Voce nello storico degli allenamenti
export interface HistoryItem {
  name: string;   // Nome della scheda eseguita
  date: string;   // Data formattata (es. "3 Giu 2026")
  dur: string;    // Durata (es. "45 min")
  vol: string;    // Volume totale sollevato
  ex: number;     // Numero di esercizi completati
  accent: Accent; // Colore tematico
  icon: string;   // Classe CSS icona
}

// Barra di un grafico a barre
export interface ChartBar {
  l?: string;  // Etichetta breve opzionale (es. "Lun")
  m?: string;  // Etichetta media opzionale (es. "Gen")
  v: number;   // Valore numerico della barra
}

// Coppia domanda/risposta per la sezione FAQ
export interface FaqItem {
  q: string; // Domanda
  a: string; // Risposta
}

// Elemento nella sezione "Guide rapide" dell'Help Desk
export interface GuideItem {
  icon: string; // Classe CSS icona
  tile: Accent; // Colore del riquadro
  t: string;   // Titolo della guida
  s: string;   // Sottotitolo/descrizione breve
}

// Profilo dell'utente
export interface UserProfile {
  name: string;       // Nome
  level: number;      // Livello attuale
  levelTitle: string; // Titolo del livello (es. "Guerriero")
  xp: number;         // XP attuali
  xpNext: number;     // XP necessari per il livello successivo
  streak: number;     // Giorni consecutivi di allenamento
  weight: number;     // Peso corporeo in kg
}

/** Achievement sbloccato, in forma minima per il recap. */
export interface UnlockedAchievement {
  name: string; // Nome del traguardo
  icon: string; // Classe CSS icona
}

/** Riepilogo prodotto al termine di una sessione di allenamento attiva. */
export interface WorkoutSummary {
  schedaName: string; // Nome della scheda eseguita
  accent: Accent;     // Colore tematico
  icon: string;       // Classe CSS icona
  seconds: number;    // Durata totale in secondi
  exTotal: number;    // Numero totale di esercizi
  exDone: number;     // Esercizi completati
  setsDone: number;   // Serie completate
  setsTotal: number;  // Serie totali
  volume: number;     // Volume sollevato (kg)
  xp: number;         // XP totali guadagnati nella sessione (base + overload + bonus settimana)

  // ---- Dettaglio gamification (opzionale: prodotto da GamificationService) ----
  xpBase?: number;          // XP dalla parte base × completezza
  xpOverload?: number;      // XP dal sovraccarico progressivo
  xpWeeklyBonus?: number;   // Bonus costanza settimanale (se la settimana è stata completata)
  improvedCount?: number;   // Esercizi migliorati premiati in questa sessione
  leveledUp?: boolean;      // true se la sessione ha fatto salire di livello
  levelBefore?: number;     // Livello prima della sessione
  levelAfter?: number;      // Livello dopo la sessione
  levelTitle?: string;      // Titolo/tier del livello raggiunto
  tierEmoji?: string;       // Emoji del tier raggiunto
  weekCompleted?: boolean;  // true se questa sessione ha completato la settimana
  weeksStreak?: number;     // Settimane di costanza consecutive (Ritmo) aggiornate
  unlocked?: UnlockedAchievement[]; // Achievement sbloccati in questa sessione
}

/** Esercizio "bozza" usato nel wizard di creazione nuova scheda. */
export interface DraftExercise {
  name: string;
  sets: number | string;  // number | string perché viene editato in un <input>
  reps: string;
  rest: number | string;
}

/**
 * Payload completo restituito dall'API (o dal file mock).
 * Questo è il "contratto" tra frontend e backend.
 */
export interface AppData {
  user: UserProfile;
  schede: Scheda[];
  week: WeekDay[];
  weekGoal: number;
  weekDone: number;
  stats: QuickStat[];
  volumeWeeks: ChartBar[];
  weightTrend: number[];
  perfMonths: ChartBar[];
  badges: Badge[];
  history: HistoryItem[];
  faq: FaqItem[];
  guides: GuideItem[];
  muscleGroups: string[];
  exerciseLib: string[];
  exercisesByMuscle: Record<string, string[]>;
}
