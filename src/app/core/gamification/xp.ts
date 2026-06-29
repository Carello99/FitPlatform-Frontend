/**
 * ============================================================================
 *  FILE: xp.ts  —  CALCOLO XP DI UN ALLENAMENTO (logica pura, no Angular)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Implementa la formula di assegnazione punti del documento di design:
 *   premia la COMPLETEZZA (finire la sessione) e il SOVRACCARICO PROGRESSIVO
 *   (battere il proprio record), con cap anti-abuso. Costanza > intensità.
 *
 * FORMULA (docs/gamification-punti §2, gamification-system §B)
 *   XP_allenamento = round(100 × Completezza) + 40 × min(esercizi_migliorati, 3)
 *   - Completezza = serie fatte / serie pianificate, clamp [0,5 … 1,0]
 *     (finire vale di più; serie extra NON danno XP → no farming di volume).
 *   - Overload: solo i primi 3 esercizi migliorati → no micro-gaming (+0,5 kg ovunque).
 *
 * CAP GIORNALIERO (gestito dal chiamante, qui esposto come costante)
 *   Un solo allenamento "pieno" conta al giorno; un secondo dà XP simbolico.
 * ============================================================================
 */

/** Punti base di un allenamento completato (prima dei moltiplicatori). */
export const XP_BASE = 100;
/** Bonus per ogni esercizio migliorato (record personale battuto). */
export const XP_PER_IMPROVED = 40;
/** Numero massimo di esercizi migliorati che danno bonus in una sessione. */
export const MAX_IMPROVED = 3;
/** Limiti della completezza: sotto 0,5 non si scende, sopra 1,0 non si sale. */
export const COMPLETENESS_MIN = 0.5;
export const COMPLETENESS_MAX = 1.0;
/** XP simbolici per un 2º allenamento "pieno" nello stesso giorno (anti-grinding). */
export const XP_SECOND_WORKOUT = 20;

/** Input minimo per calcolare l'XP di una sessione. */
export interface WorkoutXpInput {
  /** Serie effettivamente completate. */
  doneSets: number;
  /** Serie pianificate dalla scheda. */
  plannedSets: number;
  /** Numero di esercizi in cui l'utente ha battuto il proprio record. */
  improvedCount: number;
}

/** Dettaglio dell'XP di una sessione (per mostrarne la composizione nel recap). */
export interface WorkoutXpBreakdown {
  /** Completezza usata (già clampata in [0,5 … 1,0]). */
  completeness: number;
  /** XP dalla parte base × completezza. */
  base: number;
  /** XP dal bonus sovraccarico progressivo. */
  overload: number;
  /** Esercizi migliorati effettivamente premiati (cap a MAX_IMPROVED). */
  improvedRewarded: number;
  /** Totale XP della sessione (base + overload). */
  total: number;
}

/** Completezza clampata in [COMPLETENESS_MIN … COMPLETENESS_MAX]. */
export function completenessOf(doneSets: number, plannedSets: number): number {
  if (plannedSets <= 0) return COMPLETENESS_MIN;
  const raw = doneSets / plannedSets;
  return Math.max(COMPLETENESS_MIN, Math.min(COMPLETENESS_MAX, raw));
}

/** Calcola l'XP (con dettaglio) di un singolo allenamento. */
export function workoutXp(input: WorkoutXpInput): WorkoutXpBreakdown {
  const completeness = completenessOf(input.doneSets, input.plannedSets);
  const base = Math.round(XP_BASE * completeness);
  const improvedRewarded = Math.max(0, Math.min(MAX_IMPROVED, Math.floor(input.improvedCount)));
  const overload = XP_PER_IMPROVED * improvedRewarded;
  return { completeness, base, overload, improvedRewarded, total: base + overload };
}

/**
 * Fattore costanza settimanale: parte da 1,0 e sale fino a 1,5 dopo 8 settimane
 * consecutive consistenti (poi satura). `weeksStreak` = settimane già completate.
 */
export function consistencyFactor(weeksStreak: number): number {
  const weeks = Math.max(0, Math.floor(weeksStreak));
  return Math.min(1.5, 1 + 0.0625 * weeks); // +0,0625/sett → 1,5 a 8 settimane
}

/**
 * Bonus di costanza settimanale: +50% dell'XP allenamenti della settimana,
 * scalato dal fattore costanza. Assegnato quando si completa la frequenza.
 */
export function weeklyConsistencyBonus(weekWorkoutXp: number, weeksStreak: number): number {
  return Math.round(0.5 * weekWorkoutXp * consistencyFactor(weeksStreak));
}
