/**
 * ============================================================================
 *  FILE: level-curve.ts  —  CURVA LIVELLI & TIER (logica pura, no Angular)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Traduce un totale di XP in **livello**, **progresso nel livello** e **tier**,
 *   secondo la curva esponenziale del documento di design (docs/gamification-*).
 *   È pura matematica/tabelle: nessuna dipendenza Angular, facile da testare.
 *
 * MODELLO (dai documenti)
 *   - 60 livelli, 8 tier ("Tu contro la tua versione peggiore").
 *   - Curva esponenziale: ogni livello costa ~+10% del precedente.
 *     Soglia XP cumulativa per ESSERE al livello n:  round(450 × (1,1^n − 1)).
 *     Eccezione: il livello 1 parte da 0 XP (un nuovo utente è livello 1).
 *   - I primi livelli costano pochissimo → tanti level-up iniziali (gratificazione
 *     senza regalare punti); i tier alti sono un prestigio da anni.
 *
 * PUNTI CRITICI
 *   - Le soglie sono PRE-CALCOLATE una volta (LEVEL_THRESHOLDS) per evitare
 *     ricalcoli e garantire coerenza tra livello mostrato e barra di progresso.
 *   - Oltre MAX_LEVEL non si sale: la barra resta piena (pct = 1).
 * ============================================================================
 */

/** Numero massimo di livelli previsti dal sistema. */
export const MAX_LEVEL = 60;

/** Un tier: un raggruppamento di livelli con identità narrativa propria. */
export interface Tier {
  /** Indice progressivo (1..8), utile per ordinamenti. */
  index: number;
  /** Nome del tier (usato anche come "titolo" del livello utente). */
  name: string;
  /** Emoji identificativa del tier. */
  emoji: string;
  /** Primo livello incluso nel tier. */
  minLevel: number;
  /** Ultimo livello incluso nel tier. */
  maxLevel: number;
  /** Frase "hai battuto il te che…" — narrazione autoreferenziale. */
  beatenSelf: string;
}

/**
 * Gli 8 tier, dal documento di design. L'ordine e i range di livello sono la
 * "single source of truth" della progressione narrativa.
 */
export const TIERS: readonly Tier[] = [
  { index: 1, name: 'Risveglio',            emoji: '🌱', minLevel: 1,  maxLevel: 5,  beatenSelf: 'restava a letto' },
  { index: 2, name: 'Anti-Divano',          emoji: '🛋️', minLevel: 6,  maxLevel: 12, beatenSelf: 'sceglieva il divano' },
  { index: 3, name: 'Meglio di Ieri',       emoji: '📈', minLevel: 13, maxLevel: 20, beatenSelf: 'si fermava al primo giorno' },
  { index: 4, name: 'Zero Scuse',           emoji: '🚫', minLevel: 21, maxLevel: 25, beatenSelf: 'trovava sempre una scusa' },
  { index: 5, name: 'Inarrestabile',        emoji: '⚙️', minLevel: 26, maxLevel: 40, beatenSelf: 'mollava dopo due settimane' },
  { index: 6, name: 'Guerriero Interiore',  emoji: '⚔️', minLevel: 41, maxLevel: 50, beatenSelf: 'si accontentava' },
  { index: 7, name: 'Versione 2.0',         emoji: '🧬', minLevel: 51, maxLevel: 57, beatenSelf: 'eri un anno fa' },
  { index: 8, name: 'Leggenda di Te Stesso', emoji: '👑', minLevel: 58, maxLevel: 60, beatenSelf: 'ogni versione precedente di te' },
] as const;

/**
 * Soglia XP cumulativa per RAGGIUNGERE il livello n (1..MAX_LEVEL).
 * LEVEL_THRESHOLDS[n] = XP minimi totali per essere al livello n.
 * Il livello 1 è forzato a 0 (un utente a 0 XP è livello 1).
 */
export const LEVEL_THRESHOLDS: readonly number[] = (() => {
  const t: number[] = [0, 0]; // indice 0 inutilizzato; indice 1 = livello 1 = 0 XP
  for (let n = 2; n <= MAX_LEVEL; n++) {
    t[n] = Math.round(450 * (Math.pow(1.1, n) - 1));
  }
  return t;
})();

/** XP totali necessari per raggiungere un dato livello (clamp ai limiti). */
export function xpToReachLevel(level: number): number {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return LEVEL_THRESHOLDS[lvl];
}

/** Livello corrispondente a un totale di XP (1..MAX_LEVEL). */
export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  // Il livello è il più alto n la cui soglia è ≤ xp.
  let level = 1;
  for (let n = 2; n <= MAX_LEVEL; n++) {
    if (xp >= LEVEL_THRESHOLDS[n]) level = n;
    else break;
  }
  return level;
}

/** Il tier che contiene un dato livello. */
export function tierForLevel(level: number): Tier {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return TIERS.find((t) => lvl >= t.minLevel && lvl <= t.maxLevel) ?? TIERS[0];
}

/** Snapshot completo di progressione derivato da un totale di XP. */
export interface LevelInfo {
  level: number;
  tier: Tier;
  /** XP totali accumulati. */
  totalXp: number;
  /** XP maturati DENTRO il livello corrente. */
  xpIntoLevel: number;
  /** Ampiezza (in XP) del livello corrente: XP necessari per il prossimo. */
  xpForLevel: number;
  /** Percentuale 0..1 di avanzamento verso il livello successivo. */
  pct: number;
  /** true se si è al livello massimo (barra sempre piena). */
  maxed: boolean;
}

/** Calcola lo snapshot di progressione (livello, tier, barra) da un totale XP. */
export function levelInfoForXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.round(totalXp));
  const level = levelForXp(xp);
  const tier = tierForLevel(level);
  const start = LEVEL_THRESHOLDS[level];
  const maxed = level >= MAX_LEVEL;
  // Ampiezza del livello: differenza tra la prossima soglia e quella attuale.
  // Al livello massimo non esiste un "prossimo": si usa l'ultimo span per coerenza.
  const next = maxed ? start + (start - LEVEL_THRESHOLDS[level - 1]) : LEVEL_THRESHOLDS[level + 1];
  const xpForLevel = Math.max(1, next - start);
  const xpIntoLevel = Math.max(0, xp - start);
  const pct = maxed ? 1 : Math.max(0, Math.min(1, xpIntoLevel / xpForLevel));
  return { level, tier, totalXp: xp, xpIntoLevel, xpForLevel, pct, maxed };
}
