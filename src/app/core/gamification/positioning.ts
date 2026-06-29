/**
 * ============================================================================
 *  FILE: positioning.ts  —  POSIZIONAMENTO INIZIALE (logica pura, no Angular)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Implementa la sezione K dei documenti: dal questionario di primo accesso
 *   (esperienza × frequenza) calcola **livello e XP di partenza**, così un
 *   esperto non parte da zero e un principiante non finisce tra gli avanzati.
 *
 * PRINCIPIO (docs/gamification-system §K, gamification-punti §5-bis)
 *   - È CALIBRAZIONE, non ricompensa: nessun punto extra, solo il punto giusto
 *     sulla scala. L'XP di partenza = soglia cumulativa del livello assegnato.
 *   - TETTO: inizio "Guerriero Interiore" (~livello 41). Versione 2.0 e Leggenda
 *     di Te Stesso si conquistano solo allenandosi.
 *   - I dati corporei servono a MOSTRARE i progressi, mai a dare punti.
 * ============================================================================
 */

import { Tier, tierForLevel, xpToReachLevel } from './level-curve';

/** Esperienza di allenamento dichiarata. */
export type Experience = 'never' | 'lt1' | '1to3' | '3plus';
/** Frequenza settimanale attuale. */
export type Frequency = '0' | '1-2' | '3-4' | '5plus';
/** Obiettivo principale (personalizza tono/categoria). */
export type Goal = 'dimagrimento' | 'forza' | 'benessere' | 'performance';
/** Sesso (per normalizzazione metriche). */
export type Sex = 'm' | 'f' | 'na';

/** Tetto al posizionamento: nessuno parte oltre l'inizio di Guerriero Interiore. */
export const POSITIONING_CAP_LEVEL = 41;

/**
 * Mappa esperienza × frequenza → livello iniziale, dai range del documento.
 * I valori intermedi sono scelti dentro le forchette indicate (es. 1–3 anni a
 * 3–4× → ~26). Il risultato è sempre limitato dal tetto POSITIONING_CAP_LEVEL.
 */
const LEVEL_MAP: Record<Experience, Record<Frequency, number>> = {
  never: { '0': 1,  '1-2': 1,  '3-4': 1,  '5plus': 1 },
  lt1:   { '0': 4,  '1-2': 6,  '3-4': 12, '5plus': 12 },
  '1to3':{ '0': 16, '1-2': 18, '3-4': 26, '5plus': 28 },
  '3plus':{ '0': 30, '1-2': 32, '3-4': 38, '5plus': 41 },
};

/** Frequenza dichiarata → obiettivo settimanale (asticella iniziale prudente). */
const WEEK_GOAL_MAP: Record<Frequency, number> = {
  '0': 2, '1-2': 2, '3-4': 3, '5plus': 4,
};

/** Dati raccolti dal questionario di primo accesso. */
export interface OnboardingInput {
  experience: Experience;
  frequency: Frequency;
  goal: Goal;
  sex: Sex;
  age: number;
  weight: number;
  height: number;
  hasPT: boolean;
}

/** Esito del posizionamento: livello, XP e tier di partenza + target settimanale. */
export interface PositioningResult {
  level: number;
  xp: number;
  tier: Tier;
  weekGoal: number;
  /** true se il livello è stato limitato dal tetto. */
  capped: boolean;
}

/** Livello iniziale (limitato dal tetto) per esperienza × frequenza. */
export function initialLevel(experience: Experience, frequency: Frequency): number {
  const raw = LEVEL_MAP[experience]?.[frequency] ?? 1;
  return Math.min(POSITIONING_CAP_LEVEL, raw);
}

/** Calcola il posizionamento completo dai dati del questionario. */
export function positioningFor(input: OnboardingInput): PositioningResult {
  const rawLevel = LEVEL_MAP[input.experience]?.[input.frequency] ?? 1;
  const level = Math.min(POSITIONING_CAP_LEVEL, rawLevel);
  return {
    level,
    xp: xpToReachLevel(level),
    tier: tierForLevel(level),
    weekGoal: WEEK_GOAL_MAP[input.frequency] ?? 3,
    capped: rawLevel > POSITIONING_CAP_LEVEL,
  };
}
