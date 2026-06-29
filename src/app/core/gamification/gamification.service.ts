/**
 * ============================================================================
 *  FILE: gamification.service.ts  —  MOTORE GAMIFICATION (stato + regia)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   È l'unico punto che trasforma un allenamento concluso in PROGRESSIONE:
 *   calcola gli XP (curva + costanza), aggiorna livello/tier, traccia la
 *   costanza settimanale (Ritmo) e sblocca gli achievement. Implementa il
 *   sistema descritto in docs/gamification-system.md e gamification-punti.md.
 *
 * RAPPORTO CON GLI ALTRI SERVIZI
 *   - Logica PURA in level-curve.ts / xp.ts / achievements.ts (testabile da sola).
 *   - QUI vive lo STATO persistito (localStorage) e la regia: dopo ogni sessione
 *     ricalcola tutto e SCRIVE i valori derivati nel WorkoutStore (user, badge,
 *     storico, settimana) → la UI esistente si aggiorna da sola via Signals.
 *   - Dipendenza a senso unico: questo servizio conosce lo Store, lo Store NON
 *     conosce questo servizio (niente DI circolare).
 *
 * INIZIALIZZAZIONE
 *   Un effect osserva lo stato dello Store: appena i dati sono 'loaded', il
 *   servizio adotta lo stato persistito (o lo semina da user.xp al primo avvio)
 *   e allinea lo Store alla curva ufficiale.
 *
 * PERSISTENZA
 *   localStorage (chiave STORAGE_KEY). È una demo: il "backend" è il browser.
 *   Tutto è difensivo (try/catch) per non rompersi in assenza di storage.
 * ============================================================================
 */

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Accent, Badge, HistoryItem, UnlockedAchievement, WeekDay, WorkoutSummary } from '../models/workout.models';
import { WorkoutStore } from '../services/workout-store.service';
import { ACHIEVEMENTS, AchievementContext, satisfiedAchievementIds } from './achievements';
import { LevelInfo, levelForXp, levelInfoForXp } from './level-curve';
import { OnboardingInput, PositioningResult, positioningFor } from './positioning';
import { weeklyConsistencyBonus, workoutXp } from './xp';

const STORAGE_KEY = 'ff-gamification-v1';
/** Frequenza settimanale di default se lo store non ne fornisce una. */
const DEFAULT_WEEK_GOAL = 3;
/** Giorni di inattività oltre i quali un rientro è un "comeback". */
const COMEBACK_DAYS = 14;

/** Stato persistito del motore di gamification. */
interface GamificationState {
  /** XP totali accumulati (fonte di verità di livello/tier). */
  totalXp: number;
  /** Allenamenti completati in tutta la storia. */
  totalWorkouts: number;
  /** Settimane di costanza consecutive (Ritmo). */
  weeksStreak: number;
  /** Chiave ISO della settimana corrente (es. "2026-W26"). */
  weekKey: string;
  /** Sessioni completate nella settimana corrente. */
  weekSessions: number;
  /** Chiavi-giorno (YYYY-MM-DD) in cui ci si è allenati nella settimana corrente. */
  weekDays: string[];
  /** XP allenamenti accumulati nella settimana corrente (per il bonus). */
  weekXp: number;
  /** La frequenza della settimana corrente è già stata raggiunta? */
  weekCompleted: boolean;
  /** Chiave del giorno corrente (per il cap giornaliero). */
  dayKey: string;
  /** Allenamenti "pieni" già contati oggi. */
  workoutsToday: number;
  /** Data (YYYY-MM-DD) dell'ultimo allenamento, per rilevare i comeback. */
  lastWorkoutDate: string | null;
  /** Record di carico per esercizio (per il bonus sovraccarico). */
  records: Record<string, number>;
  /** L'utente ha registrato almeno una volta dati corporei. */
  bodyTracked: boolean;
  /** Programmi/schede completati. */
  programsCompleted: number;
  /** Id degli achievement già sbloccati. */
  unlocked: string[];
  /** Onboarding di primo accesso completato (o saltato). */
  onboarded: boolean;
  /** Obiettivo principale scelto in onboarding (tono/categoria). */
  goal: string | null;
}

/** Dati grezzi di una sessione conclusa, passati dal componente di allenamento. */
export interface FinishedWorkout {
  schedaName: string;
  accent: Accent;
  icon: string;
  seconds: number;
  exTotal: number;
  exDone: number;
  setsDone: number;
  setsTotal: number;
  volume: number;
  /** Per esercizio: carico massimo sollevato in una serie completata (0 = corpo libero). */
  exercises: { name: string; topKg: number }[];
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly store = inject(WorkoutStore);

  /** Stato reattivo (mirror dello stato persistito). */
  private readonly state = signal<GamificationState>(this.loadState() ?? this.freshState());
  private initialized = false;

  /** Snapshot di progressione (livello/tier/barra) dal totale XP corrente. */
  readonly progress = computed<LevelInfo>(() => levelInfoForXp(this.state().totalXp));
  /** Settimane di costanza consecutive (Ritmo). */
  readonly weeksStreak = computed(() => this.state().weeksStreak);
  /** Allenamenti completati in tutta la storia. */
  readonly totalWorkouts = computed(() => this.state().totalWorkouts);
  /** Numero di achievement sbloccati. */
  readonly unlockedCount = computed(() => this.state().unlocked.length);
  /** Badge derivati dagli achievement (got = sbloccato). */
  readonly badges = computed<Badge[]>(() => this.buildBadges(new Set(this.state().unlocked)));

  constructor() {
    // Appena lo Store ha i dati, allinea la progressione (semina al primo avvio).
    effect(() => {
      if (this.store.status() === 'loaded' && !this.initialized) {
        this.initialized = true;
        this.bootstrap();
      }
    });
  }

  // ---------------------------------------------------------------------------
  //  Inizializzazione / sincronizzazione
  // ---------------------------------------------------------------------------

  /**
   * Prima sincronizzazione. Se NON c'è stato persistito siamo al primo accesso:
   * lo stato resta "fresco" (livello 1, onboarded=false) → `needsOnboarding`
   * diventa true e la app instrada al questionario (sez. K). Se lo stato esiste,
   * lo si adotta e si allinea lo Store alla curva ufficiale.
   */
  private bootstrap(): void {
    // Lo stato del signal è già stato caricato (loadState) in fase di init: se è
    // "fresco" significa nessuna persistenza → mostriamo l'onboarding.
    this.syncStore();
  }

  /** true quando il primo accesso non è ancora stato completato/saltato. */
  readonly needsOnboarding = computed(
    () => this.storeReady() && !this.state().onboarded,
  );
  /** Onboarding completato (o saltato). */
  readonly onboarded = computed(() => this.state().onboarded);

  /** Lo Store ha finito di caricare i dati di base? */
  private readonly storeReady = computed(() => this.store.status() === 'loaded');

  /** Scrive nello Store i valori derivati dalla progressione (UI reattiva). */
  private syncStore(): void {
    const s = this.state();
    const info = levelInfoForXp(s.totalXp);
    this.store.patchUser({
      level: info.level,
      levelTitle: info.tier.name,
      xp: info.xpIntoLevel,
      xpNext: info.xpForLevel,
      streak: s.weeksStreak,
    });
    this.store.setBadges(this.buildBadges(new Set(s.unlocked)));
    this.store.setWeekDone(s.weekSessions);
    this.store.setWeek(this.buildWeek(s));
  }

  /**
   * Costruisce il recap settimanale (lun→dom) dai giorni realmente allenati:
   * 'done' = allenamento registrato, 'today' = oggi senza allenamento, 'rest'
   * gli altri. Così i check verdi riflettono il tracking reale, non dati mock.
   */
  private buildWeek(s: GamificationState): WeekDay[] {
    const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']; // lun→dom
    const now = new Date();
    const todayKey = this.dayKey(now);
    // Lunedì della settimana ISO corrente.
    const monday = new Date(now);
    const dow = (now.getDay() + 6) % 7; // 0=lun … 6=dom
    monday.setDate(now.getDate() - dow);
    const done = new Set(s.weekDays);
    return LETTERS.map((d, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const key = this.dayKey(day);
      const state: WeekDay['state'] = done.has(key) ? 'done' : key === todayKey ? 'today' : 'rest';
      return { d, state };
    });
  }

  // ---------------------------------------------------------------------------
  //  Onboarding / posizionamento (sez. K)
  // ---------------------------------------------------------------------------

  /**
   * Applica il questionario di primo accesso: calcola livello/XP di partenza
   * (calibrazione, non ricompensa), imposta l'obiettivo settimanale e i dati
   * corporei, marca l'onboarding come completato e allinea lo Store.
   */
  applyOnboarding(input: OnboardingInput): PositioningResult {
    const pos = positioningFor(input);
    const next: GamificationState = {
      ...this.state(),
      records: { ...this.state().records },
      unlocked: [...this.state().unlocked],
      totalXp: pos.xp,          // XP di partenza = soglia del livello assegnato
      totalWorkouts: 0,         // è calibrazione: nessun allenamento reale ancora
      goal: input.goal,
      bodyTracked: true,        // ha registrato peso/altezza → "Prime misure"
      onboarded: true,
      // Nuova settimana pulita: la prima "settimana completata" è da conquistare.
      weekKey: this.weekKey(new Date()),
      weekSessions: 0,
      weekDays: [],
      weekXp: 0,
      weekCompleted: false,
    };
    // Achievement coerenti col contesto (es. "Prime misure"); nessun punto extra.
    next.unlocked = [
      ...new Set([...next.unlocked, ...satisfiedAchievementIds(this.contextFrom(next, 0, false, false))]),
    ];
    this.state.set(next);
    this.persist();
    // Riflette nel profilo: peso e obiettivo settimanale dichiarati.
    if (input.weight > 0) this.store.patchUser({ weight: input.weight });
    this.store.setWeekGoal(pos.weekGoal);
    this.syncStore();
    return pos;
  }

  /** Salta l'onboarding: si parte da livello 1, il sistema affina col tempo. */
  skipOnboarding(): void {
    this.state.set({ ...this.state(), onboarded: true });
    this.persist();
    this.syncStore();
  }

  // ---------------------------------------------------------------------------
  //  Registrazione di un allenamento concluso
  // ---------------------------------------------------------------------------

  /**
   * Registra una sessione conclusa: calcola XP, costanza, livello e achievement,
   * persiste lo stato, allinea lo Store e restituisce il riepilogo da mostrare.
   */
  recordWorkout(w: FinishedWorkout): WorkoutSummary {
    const prev = this.state();
    const now = new Date();
    const dayKey = this.dayKey(now);
    const weekKey = this.weekKey(now);

    // Lavoriamo su una copia mutabile dello stato.
    const next: GamificationState = {
      ...prev,
      records: { ...prev.records },
      unlocked: [...prev.unlocked],
    };

    // --- Esercizi migliorati (record battuto) + aggiornamento record ---
    let improved = 0;
    for (const ex of w.exercises) {
      if (ex.topKg <= 0) continue; // corpo libero: niente record di carico
      const best = next.records[ex.name] ?? 0;
      if (ex.topKg > best) {
        improved++;
        next.records[ex.name] = ex.topKg;
      }
    }

    // --- Cap giornaliero: il 2º allenamento pieno del giorno vale poco ---
    if (next.dayKey !== dayKey) {
      next.dayKey = dayKey;
      next.workoutsToday = 0;
    }
    const isSecondToday = next.workoutsToday >= 1;
    next.workoutsToday += 1;

    // --- XP della sessione ---
    const breakdown = workoutXp({ doneSets: w.setsDone, plannedSets: w.setsTotal, improvedCount: improved });
    const sessionXp = isSecondToday ? 20 : breakdown.total; // XP_SECOND_WORKOUT
    const xpBase = isSecondToday ? 20 : breakdown.base;
    const xpOverload = isSecondToday ? 0 : breakdown.overload;

    // --- Comeback (rientro dopo una lunga pausa) ---
    const comeback = this.isComeback(prev.lastWorkoutDate, now);
    next.lastWorkoutDate = dayKey;

    // --- Tracciamento settimanale (Ritmo) ---
    if (next.weekKey !== weekKey) {
      // Si entra in una nuova settimana: se la precedente non era stata
      // completata, la costanza si azzera (forgiving: nessun'altra penalità).
      if (!next.weekCompleted) next.weeksStreak = 0;
      next.weekKey = weekKey;
      next.weekSessions = 0;
      next.weekDays = [];
      next.weekXp = 0;
      next.weekCompleted = false;
    }
    next.weekSessions += 1;
    if (!next.weekDays.includes(dayKey)) next.weekDays = [...next.weekDays, dayKey];
    next.weekXp += sessionXp;

    const weekGoal = this.store.weekGoal || DEFAULT_WEEK_GOAL;
    let weeklyBonus = 0;
    let weekCompletedNow = false;
    if (!next.weekCompleted && next.weekSessions >= weekGoal) {
      next.weekCompleted = true;
      weekCompletedNow = true;
      // Il fattore costanza usa lo streak PRIMA dell'incremento di questa settimana.
      weeklyBonus = weeklyConsistencyBonus(next.weekXp, next.weeksStreak);
      next.weeksStreak += 1;
    }

    // --- Totali XP e livello ---
    const levelBefore = levelForXp(prev.totalXp);
    next.totalXp = prev.totalXp + sessionXp + weeklyBonus;
    next.totalWorkouts = prev.totalWorkouts + 1;
    const info = levelInfoForXp(next.totalXp);
    const levelAfter = info.level;

    // --- Achievement ---
    const ctx = this.contextFrom(next, improved, comeback, weekCompletedNow);
    const satisfied = satisfiedAchievementIds(ctx);
    const already = new Set(next.unlocked);
    const newlyIds = satisfied.filter((id) => !already.has(id));
    next.unlocked = [...new Set([...next.unlocked, ...satisfied])];
    const unlocked: UnlockedAchievement[] = newlyIds.map((id) => {
      const def = ACHIEVEMENTS.find((a) => a.id === id)!;
      return { name: def.name, icon: def.icon };
    });

    // --- Commit stato + allineamento Store ---
    this.state.set(next);
    this.persist();
    this.pushHistory(w, now);
    this.syncStore();

    // --- Riepilogo per la schermata Summary ---
    return {
      schedaName: w.schedaName,
      accent: w.accent,
      icon: w.icon,
      seconds: w.seconds,
      exTotal: w.exTotal,
      exDone: w.exDone,
      setsDone: w.setsDone,
      setsTotal: w.setsTotal,
      volume: w.volume,
      xp: sessionXp + weeklyBonus,
      xpBase,
      xpOverload,
      xpWeeklyBonus: weeklyBonus,
      improvedCount: breakdown.improvedRewarded,
      leveledUp: levelAfter > levelBefore,
      levelBefore,
      levelAfter,
      levelTitle: info.tier.name,
      tierEmoji: info.tier.emoji,
      weekCompleted: weekCompletedNow,
      weeksStreak: next.weeksStreak,
      unlocked,
    };
  }

  // ---------------------------------------------------------------------------
  //  Helper
  // ---------------------------------------------------------------------------

  /** Costruisce il contesto di valutazione achievement dallo stato + dati sessione. */
  private contextFrom(
    s: GamificationState,
    lastImproved: number,
    comeback: boolean,
    weekCompletedNow: boolean,
  ): AchievementContext {
    return {
      totalWorkouts: s.totalWorkouts,
      lastImproved,
      weeksStreak: s.weeksStreak,
      weekCompletedNow,
      bodyTracked: s.bodyTracked,
      programsCompleted: s.programsCompleted,
      comeback,
      firstEver: s.totalWorkouts <= 1,
    };
  }

  /** Trasforma il catalogo achievement in Badge per la UI (got = sbloccato). */
  private buildBadges(unlocked: Set<string>): Badge[] {
    return ACHIEVEMENTS.map((a) => ({
      icon: a.icon,
      tile: a.tile,
      name: a.name,
      got: unlocked.has(a.id),
    }));
  }

  /** Inserisce nello storico l'allenamento appena concluso. */
  private pushHistory(w: FinishedWorkout, now: Date): void {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const item: HistoryItem = {
      name: w.schedaName,
      date: `Oggi · ${hh}:${mm}`,
      dur: `${Math.round(w.seconds / 60)} min`,
      vol: `${w.volume.toLocaleString('it-IT')} kg`,
      ex: w.exDone,
      accent: w.accent,
      icon: w.icon,
    };
    this.store.prependHistory(item);
  }

  private isComeback(lastDate: string | null, now: Date): boolean {
    if (!lastDate) return false;
    const last = new Date(lastDate + 'T00:00:00');
    const days = (now.getTime() - last.getTime()) / 86_400_000;
    return days >= COMEBACK_DAYS;
  }

  /** Chiave giorno YYYY-MM-DD (orario locale). */
  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Chiave settimana ISO "YYYY-Www". */
  private weekKey(d: Date): string {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7; // lun=1 … dom=7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum); // giovedì della settimana ISO
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------------
  //  Persistenza
  // ---------------------------------------------------------------------------

  private freshState(): GamificationState {
    return {
      totalXp: 0,
      totalWorkouts: 0,
      weeksStreak: 0,
      weekKey: this.weekKey(new Date()),
      weekSessions: 0,
      weekDays: [],
      weekXp: 0,
      weekCompleted: false,
      dayKey: this.dayKey(new Date()),
      workoutsToday: 0,
      lastWorkoutDate: null,
      records: {},
      bodyTracked: false,
      programsCompleted: 0,
      unlocked: [],
      onboarded: false,
      goal: null,
    };
  }

  private loadState(): GamificationState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<GamificationState>;
      // Merge difensivo con lo stato fresco: tollera versioni/campi mancanti.
      // Uno stato già persistito = utente di ritorno → onboarding considerato fatto.
      return {
        ...this.freshState(),
        ...parsed,
        records: parsed.records ?? {},
        unlocked: parsed.unlocked ?? [],
        weekDays: parsed.weekDays ?? [],
        onboarded: parsed.onboarded ?? true,
      };
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      /* storage non disponibile: la demo continua solo in memoria */
    }
  }

  /** Azzera tutta la progressione (utile per testare l'onboarding). */
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.state.set(this.freshState());
    this.initialized = false;
    if (this.store.status() === 'loaded') {
      this.initialized = true;
      this.bootstrap();
    }
  }
}
