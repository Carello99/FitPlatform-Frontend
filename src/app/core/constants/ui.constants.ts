/**
 * ============================================================================
 *  FILE: ui.constants.ts  —  MAPPE/TABELLE DI PRESENTAZIONE CONDIVISE
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Raccoglie in un punto solo i "dizionari" che traducono valori di dominio
 *   (accento, gruppo muscolare, livello) in dettagli di presentazione
 *   (variabili CSS, classi, etichette, icone). Per uno sviluppatore Java:
 *   pensalo come un insieme di costanti/enum + lookup table statiche.
 *
 * PERCHÉ ESISTE / QUALE PROBLEMA RISOLVE
 *   Evita di sparpagliare gli stessi if/switch "accento → colore" in decine di
 *   template. Single source of truth: cambi il colore di un gruppo QUI e cambia
 *   ovunque, restando coerente in tutta l'app.
 *
 * COSA CONTIENE (in breve)
 *   - ACCENT_VAR / TILE_CLASS: accento → variabile CSS / classe tile.
 *   - MUSCLE_META: identità visiva di ogni gruppo muscolare (colore/soft/tile).
 *   - MUSCLE_CATEGORIES / MACRO_SECTIONS / CATEGORY_MACRO + macroForMuscle():
 *     logica di raggruppamento Upper/Lower usata da TUTTE le liste di esercizi.
 *   - LEVEL_LABEL: numero livello → etichetta. MOTIVATION: frasi della Home.
 *
 * DIPENDENZE / CHI LO USA
 *   - Importa solo il tipo Accent. NESSUN servizio (è solo dati/funzioni pure).
 *   - CHI LO USA: WorkoutStore (groupByMacro), ExerciseCardComponent,
 *     scheda-detail, new-scheda, home, ... Modifiche qui hanno effetto AMPIO.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - I valori 'var(--x)' devono corrispondere a token CSS reali definiti in
 *     _tokens.scss: un nome sbagliato = colore mancante (nessun errore JS).
 *   - CATEGORY_MACRO mappa 'core' → 'lower' DI PROPOSITO (Core va in Lower Body):
 *     se un esercizio core appare nella sezione sbagliata, la regola è qui.
 *   - MUSCLE_META è la chiave di volta dei colori: una voce mancante per un
 *     gruppo fa ricadere la card sul colore di default (var(--ink-3)).
 * ============================================================================
 */

// Centralizzare questi mapping evita di ripetere la stessa logica in ogni componente.
import { Accent } from '../models/workout.models';

/**
 * Mappa il nome di un accento alla sua variabile CSS corrispondente.
 * Record<K, V> è un tipo TypeScript per un oggetto con chiavi di tipo K e valori di tipo V.
 * Es: ACCENT_VAR['amber'] → 'var(--amber)'
 * Usato nei template per impostare colori inline: [style.color]="ACCENT_VAR[s.accent]"
 */
export const ACCENT_VAR: Record<Accent, string> = {
  amber: 'var(--amber)',
  cyan: 'var(--cyan)',
  violet: 'var(--violet)',
  green: 'var(--green)',
  rose: 'var(--rose)',
  slate: 'var(--ink-2)',
};

/**
 * Mappa il nome di un accento alla classe CSS del riquadro icona.
 * Usato nei template: [class]="TILE_CLASS[s.accent]"
 * Le classi t-amber, t-cyan, ecc. sono definite in _utilities.scss.
 */
export const TILE_CLASS: Record<Accent, string> = {
  amber: 't-amber',
  cyan: 't-cyan',
  violet: 't-violet',
  green: 't-green',
  rose: 't-rose',
  slate: 't-slate',
};

/** Categoria macro di un gruppo muscolare, usata per raggruppare nel recap. */
export type MuscleCategoryId = 'upper' | 'lower' | 'core';

/** Metadati identificativi di un gruppo muscolare (colore = identità visiva). */
export interface MuscleInfo {
  id: string;               // id usato in exercisesByMuscle (es. "petto")
  label: string;            // etichetta IT (es. "Petto")
  desc: string;             // sottotitolo EN (es. "Chest")
  category: MuscleCategoryId;
  color: string;            // var(--x) — colore identificativo
  soft: string;             // var(--x-soft) — sfondo leggero
  tile: string;             // classe tile (es. "t-cyan")
}

/**
 * Singola fonte di verità per il colore di ogni gruppo muscolare.
 * Usa solo colori del design system. Ogni gruppo ha sempre lo stesso colore
 * in tutta l'app; all'interno della stessa sezione (upper/lower/core) i colori
 * sono distinti per evitare confusione.
 */
export const MUSCLE_META: Record<string, MuscleInfo> = {
  petto:        { id: 'petto',        label: 'Petto',        desc: 'Chest',      category: 'upper', color: 'var(--cyan)',    soft: 'var(--cyan-soft)',    tile: 't-cyan'    },
  dorsali:      { id: 'dorsali',      label: 'Schiena',      desc: 'Back',       category: 'upper', color: 'var(--green)',   soft: 'var(--green-soft)',   tile: 't-green'   },
  spalle:       { id: 'spalle',       label: 'Spalle',       desc: 'Shoulders',  category: 'upper', color: 'var(--rose)',    soft: 'var(--rose-soft)',    tile: 't-rose'    },
  bicipiti:     { id: 'bicipiti',     label: 'Bicipiti',     desc: 'Biceps',     category: 'upper', color: 'var(--violet)',  soft: 'var(--violet-soft)',  tile: 't-violet'  },
  tricipiti:    { id: 'tricipiti',    label: 'Tricipiti',    desc: 'Triceps',    category: 'upper', color: 'var(--amber)',   soft: 'var(--amber-soft)',   tile: 't-amber'   },
  quadricipiti: { id: 'quadricipiti', label: 'Quadricipiti', desc: 'Quads',      category: 'lower', color: 'var(--blue)',    soft: 'var(--blue-soft)',    tile: 't-blue'    },
  femorali:     { id: 'femorali',     label: 'Femorali',     desc: 'Hamstrings', category: 'lower', color: 'var(--teal)',    soft: 'var(--teal-soft)',    tile: 't-teal'    },
  glutei:       { id: 'glutei',       label: 'Glutei',       desc: 'Glutes',     category: 'lower', color: 'var(--magenta)', soft: 'var(--magenta-soft)', tile: 't-magenta' },
  polpacci:     { id: 'polpacci',     label: 'Polpacci',     desc: 'Calves',     category: 'lower', color: 'var(--orange)',  soft: 'var(--orange-soft)',  tile: 't-orange'  },
  core:         { id: 'core',         label: 'Core',         desc: 'Abs & Core', category: 'core',  color: 'var(--ink-2)',   soft: 'var(--surface-3)',    tile: 't-slate'   },
};

/** Sezioni del recap/selezione, nell'ordine in cui devono apparire. */
export const MUSCLE_CATEGORIES: { id: MuscleCategoryId; label: string; icon: string }[] = [
  { id: 'upper', label: 'Upper Body', icon: 'ti-arm'      },
  { id: 'lower', label: 'Lower Body', icon: 'ti-run'      },
  { id: 'core',  label: 'Core',       icon: 'ti-activity' },
];

/* ============================================================
   Macro-suddivisione UNICA delle liste esercizi: Upper / Lower.
   Standard usato da OGNI lista di ExerciseCard nell'app.
   ============================================================ */
export type MacroSectionId = 'upper' | 'lower';

/** Le due sezioni, nell'ordine in cui devono apparire. */
export const MACRO_SECTIONS: { id: MacroSectionId; label: string; icon: string }[] = [
  { id: 'upper', label: 'Upper Body', icon: 'ti-arm' },
  { id: 'lower', label: 'Lower Body', icon: 'ti-run' },
];

/** Da categoria muscolare → macro-sezione. Addome/Core → Lower Body. */
export const CATEGORY_MACRO: Record<MuscleCategoryId, MacroSectionId> = {
  upper: 'upper',
  lower: 'lower',
  core:  'lower',
};

/** Macro-sezione di un gruppo muscolare (per id). null se sconosciuto. */
export function macroForMuscle(muscleId: string | null): MacroSectionId | null {
  if (!muscleId) return null;
  const cat = MUSCLE_META[muscleId]?.category;
  return cat ? CATEGORY_MACRO[cat] : null;
}

/**
 * Preset di programmazione di un esercizio (serie × ripetizioni + recupero).
 * `desc` è l'obiettivo di allenamento che il preset esprime, `tile` la classe
 * colore con cui è reso: la coppia label→colore deve restare stabile in tutta
 * l'app, così "4×8 ambra = Forza & Massa" è riconoscibile ovunque appaia.
 */
export interface SetPreset {
  label: string; // testo principale, es. "3×12"
  sets: number;
  reps: string;
  rest: number;  // secondi di recupero
  desc: string;  // obiettivo, es. "Ipertrofia"
  tile: string;  // classe tile del colore, es. "t-cyan"
}

/**
 * I preset offerti ovunque si programmi un esercizio (creazione scheda,
 * modifica scheda, picker muscolare). Fonte unica: erano tre copie identiche
 * nei rispettivi componenti e potevano divergere a ogni ritocco.
 */
export const SET_PRESETS: readonly SetPreset[] = [
  { label: '3×12', sets: 3, reps: '12', rest: 60,  desc: 'Ipertrofia',    tile: 't-cyan'   },
  { label: '3×10', sets: 3, reps: '10', rest: 75,  desc: 'Ipertrofia',    tile: 't-violet' },
  { label: '4×8',  sets: 4, reps: '8',  rest: 90,  desc: 'Forza & Massa', tile: 't-amber'  },
  { label: '3×6',  sets: 3, reps: '6',  rest: 120, desc: 'Forza',         tile: 't-rose'   },
  { label: '5×5',  sets: 5, reps: '5',  rest: 180, desc: 'Forza Max',     tile: 't-green'  },
  { label: '2×15', sets: 2, reps: '15', rest: 45,  desc: 'Tonific.',      tile: 't-slate'  },
];

/** Carichi rapidi (kg) offerti negli editor di esercizio. */
export const KG_QUICK: readonly number[] = [0, 5, 10, 20, 30, 40, 60, 80];

/** Tempi di recupero rapidi (secondi) offerti negli editor di esercizio. */
export const REST_QUICK: readonly number[] = [45, 60, 75, 90, 120, 180];

/**
 * Mappa il numero di livello alla sua etichetta testuale.
 * Es: LEVEL_LABEL[2] → 'Intermedio'
 */
export const LEVEL_LABEL: Record<number, string> = {
  1: 'Principiante',
  2: 'Intermedio',
  3: 'Avanzato',
};

/**
 * Array di frasi motivazionali mostrate nella Home.
 * "readonly" garantisce che l'array non venga modificato accidentalmente.
 */
export const MOTIVATION: readonly string[] = [
  'Il corpo ottiene ciò che la mente crede.',
  'Un allenamento alla volta. Oggi tocca a te.',
  "La costanza batte l'intensità. Sempre.",
  'Non devi essere il migliore, solo meglio di ieri.',
];
