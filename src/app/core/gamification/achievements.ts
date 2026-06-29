/**
 * ============================================================================
 *  FILE: achievements.ts  —  CATALOGO ACHIEVEMENT (logica pura, no Angular)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Definisce i traguardi sbloccabili e la regola che decide quando scattano.
 *   Tutti gli achievement sono **autoreferenziali o di costanza** (mai "più forte
 *   di X"), come da documento di design (§E). Non danno XP: sono status/collezione.
 *
 * COME FUNZIONA
 *   Ogni achievement ha un predicato `unlocked(ctx)` valutato su uno snapshot di
 *   statistiche utente (AchievementContext). Il servizio confronta il set di
 *   achievement già sbloccati con quelli soddisfatti e celebra i NUOVI.
 *
 * NOTA
 *   `tile` riusa gli accenti del design system (Accent) per renderli come Badge
 *   nella UI esistente (profilo). L'icona è una classe Tabler (ti-*).
 * ============================================================================
 */

import { Accent } from '../models/workout.models';

/** Fascia narrativa dell'achievement (onboarding → identità). */
export type AchievementTier = 'iniziale' | 'medio' | 'avanzato' | 'nascosto';

/** Snapshot delle statistiche su cui si valutano i predicati. */
export interface AchievementContext {
  /** Allenamenti totali completati (storico). */
  totalWorkouts: number;
  /** Esercizi migliorati nell'ULTIMA sessione. */
  lastImproved: number;
  /** Settimane di costanza consecutive (Ritmo). */
  weeksStreak: number;
  /** La settimana corrente è stata completata in questa sessione? */
  weekCompletedNow: boolean;
  /** L'utente ha registrato almeno una volta dati corporei? */
  bodyTracked: boolean;
  /** Programmi/schede portati a termine. */
  programsCompleted: number;
  /** L'utente è rientrato dopo una pausa ≥ 14 giorni (comeback)? */
  comeback: boolean;
  /** È la primissima sessione assoluta? */
  firstEver: boolean;
}

/** Definizione di un achievement. */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;   // classe Tabler ti-*
  tile: Accent;   // accento per il rendering come Badge
  tier: AchievementTier;
  /** Predicato: true quando il traguardo è raggiunto. */
  unlocked: (ctx: AchievementContext) => boolean;
}

/**
 * Catalogo achievement. L'ordine è anche l'ordine di presentazione (iniziali
 * prima → goal-gradient e onboarding denso).
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ---- Iniziali (gancio, prima settimana) ----
  { id: 'first-workout', name: 'Primo passo', desc: 'Primo allenamento completato', icon: 'ti-medal',          tile: 'amber',  tier: 'iniziale', unlocked: (c) => c.totalWorkouts >= 1 },
  { id: 'first-week',    name: 'Prima settimana', desc: 'Frequenza pianificata raggiunta', icon: 'ti-calendar-check', tile: 'green', tier: 'iniziale', unlocked: (c) => c.weeksStreak >= 1 },
  { id: 'first-pr',      name: 'Primo record', desc: 'Battuto un tuo record personale', icon: 'ti-trending-up',  tile: 'violet', tier: 'iniziale', unlocked: (c) => c.lastImproved >= 1 },
  { id: 'first-body',    name: 'Prime misure', desc: 'Primi dati corporei registrati', icon: 'ti-ruler-2',      tile: 'cyan',   tier: 'iniziale', unlocked: (c) => c.bodyTracked },

  // ---- Medi (abitudine, 1–3 mesi) ----
  { id: 'streak-4',      name: '4 settimane', desc: '4 settimane costanti di fila', icon: 'ti-flame',          tile: 'amber',  tier: 'medio',    unlocked: (c) => c.weeksStreak >= 4 },
  { id: 'program-done',  name: 'Programma finito', desc: 'Una scheda portata a termine', icon: 'ti-checkup-list', tile: 'green', tier: 'medio',  unlocked: (c) => c.programsCompleted >= 1 },
  { id: 'workouts-25',   name: '25 sessioni', desc: '25 allenamenti completati', icon: 'ti-barbell',           tile: 'cyan',   tier: 'medio',    unlocked: (c) => c.totalWorkouts >= 25 },

  // ---- Avanzati (identità, 3 mesi+) ----
  { id: 'streak-12',     name: '90 giorni', desc: '12 settimane di costanza', icon: 'ti-calendar-stats',       tile: 'rose',   tier: 'avanzato', unlocked: (c) => c.weeksStreak >= 12 },
  { id: 'workouts-100',  name: '100 sessioni', desc: '100 allenamenti completati', icon: 'ti-trophy',          tile: 'violet', tier: 'avanzato', unlocked: (c) => c.totalWorkouts >= 100 },

  // ---- Nascosti (ricompensa variabile) ----
  { id: 'comeback',      name: 'Ritorno', desc: 'Tornato dopo una pausa: bentornato', icon: 'ti-mood-heart',  tile: 'rose',   tier: 'nascosto', unlocked: (c) => c.comeback },
];

/** Mappa id → definizione, per lookup rapido. */
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** Restituisce gli id degli achievement soddisfatti dal contesto dato. */
export function satisfiedAchievementIds(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => a.unlocked(ctx)).map((a) => a.id);
}
