/**
 * ============================================================================
 *  FILE: exercise-catalog.service.ts  —  CATALOGO ESERCIZI (snapshot + cache)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Carica il catalogo completo degli esercizi dallo snapshot statico
 *   (assets/data/exercise-catalog.json), lo ripulisce e lo espone all'app come
 *   indici pronti all'uso: lista nomi, mappa gruppo→esercizi, nome→gifId,
 *   nome→gruppo muscolare. È la NUOVA fonte di verità del catalogo, pensata per
 *   scalare a migliaia di esercizi.
 *
 * PERCHÉ ESISTE / QUALE PROBLEMA RISOLVE
 *   Il catalogo prima era piccolo e sparso tra app-data.json e una mappa GIF
 *   statica. Qui è centralizzato e ampliabile: lo snapshot lo genera lo script
 *   scripts/fetch-exercise-catalog.mjs dall'API ExerciseDB (una volta, niente
 *   chiamate ripetute a runtime → veloce e offline).
 *
 * COSA RAPPRESENTA IN ANGULAR
 *   Service singleton (providedIn:'root'). Carica una sola volta in costruttore.
 *   Per istantaneità usa una cache localStorage (riusa l'ultimo snapshot già
 *   parsato) mentre in parallelo ricarica l'asset bundlato e si aggiorna se è
 *   più recente (confronto su generatedAt).
 *
 * FLUSSO DEI DATI
 *   localStorage (cache) → popolamento immediato dei signal → HttpClient GET
 *   dell'asset → sanitize() → se generatedAt è cambiato, aggiorna signal+cache.
 *   I consumatori (WorkoutStore, ExerciseImageService) leggono gli indici
 *   reattivi: appena il catalogo è pronto, picker/ricerca/filtri usano i dati
 *   nuovi senza modifiche lato UI.
 *
 * PIPELINE sanitize() (robustezza anche se l'asset è editato a mano)
 *   - normalizza il nome (trim + spazi singoli);
 *   - SCARTA gli esercizi senza gifId valido (requisito: GIF sempre presente);
 *   - DEDUPLICA per chiave normalizzata (minuscolo, senza accenti/punteggiatura);
 *   - ricalcola macro (upper/lower) dal gruppo se mancante/incoerente.
 *
 * DIPENDENZE / CHI LO USA
 *   - HttpClient. CHI LO LEGGE: WorkoutStore (exercisesByMuscle/exerciseLib/
 *     muscleIdForExercise) ed ExerciseImageService (gifId per nome).
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - ready() diventa true solo a catalogo non vuoto: finché è false, lo store
 *     ricade sui dati di app-data.json (nessuna schermata vuota).
 *   - La cache è invalidata da CACHE_VERSION + generatedAt: se cambi lo schema
 *     dell'asset, alza CACHE_VERSION per forzare il refresh sui client.
 *   - Tutto è racchiuso in try/catch: localStorage assente (navigazione privata)
 *     o asset mancante NON devono rompere l'app, solo disattivare il catalogo.
 * ============================================================================
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

/** Forma di un singolo esercizio nel catalogo (vedi schema dell'asset JSON). */
export interface CatalogExercise {
  id: string;
  name: string;
  gifId: string;
  muscleId: string;
  macro: 'upper' | 'lower';
  bodyPart?: string | null;
  target?: string | null;
  secondary?: string[];
  equipment?: string | null;
  source?: string;
}

interface CatalogFile {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  gifBase: string;
  count: number;
  exercises: CatalogExercise[];
}

// Gruppi "upper": tutto il resto è "lower" (coerente con MUSCLE_META/CATEGORY_MACRO).
const UPPER = new Set(['petto', 'dorsali', 'spalle', 'bicipiti', 'tricipiti']);
const ASSET_URL = 'assets/data/exercise-catalog.json';
const CACHE_KEY = 'ff_exercise_catalog';
const CACHE_VERSION = 1; // ALZARE se cambia lo schema → invalida le cache client

@Injectable({ providedIn: 'root' })
export class ExerciseCatalogService {
  private readonly http = inject(HttpClient);

  /** Lista pulita degli esercizi (signal: i consumatori si aggiornano da soli). */
  private readonly _exercises = signal<CatalogExercise[]>([]);
  private generatedAt = '';

  constructor() {
    this.hydrateFromCache(); // popolamento istantaneo (se c'è cache valida)
    this.loadAsset();        // refresh dall'asset bundlato
  }

  // ---- Stato pubblico (read-only) ----

  /** true quando il catalogo è caricato e non vuoto. */
  readonly ready = computed(() => this._exercises().length > 0);

  /** Numero totale di esercizi nel catalogo. */
  readonly count = computed(() => this._exercises().length);

  /** Lista piatta dei nomi (per la libreria/ricerca). */
  readonly exerciseLib = computed<string[]>(() => this._exercises().map((e) => e.name));

  /** Mappa gruppoMuscolareId → nomi esercizi. */
  readonly exercisesByMuscle = computed<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const e of this._exercises()) (map[e.muscleId] ??= []).push(e.name);
    return map;
  });

  /** Mappa nome esercizio → id GIF (per il rendering dell'animazione). */
  readonly gifByName = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const e of this._exercises()) map[e.name] = e.gifId;
    return map;
  });

  /** Mappa nome esercizio → id gruppo muscolare (per il colore/identità card). */
  readonly muscleByName = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const e of this._exercises()) map[e.name] = e.muscleId;
    return map;
  });

  // ---- Caricamento ----

  private loadAsset(): void {
    this.http.get<CatalogFile>(ASSET_URL).subscribe({
      next: (file) => {
        // Aggiorna solo se l'asset è più recente della cache già idratata
        if (file?.generatedAt && file.generatedAt === this.generatedAt) return;
        const clean = this.sanitize(file?.exercises ?? []);
        if (clean.length) {
          this.generatedAt = file.generatedAt ?? '';
          this._exercises.set(clean);
          this.writeCache(file.generatedAt, clean);
        }
      },
      // Asset assente o non valido: l'app continua coi dati di app-data.json.
      error: () => { /* catalogo opzionale: nessun blocco */ },
    });
  }

  private hydrateFromCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const c = JSON.parse(raw) as { v: number; generatedAt: string; exercises: CatalogExercise[] };
      if (c?.v !== CACHE_VERSION || !Array.isArray(c.exercises)) return;
      const clean = this.sanitize(c.exercises);
      if (clean.length) {
        this.generatedAt = c.generatedAt ?? '';
        this._exercises.set(clean);
      }
    } catch {
      /* cache corrotta o localStorage non disponibile: ignora */
    }
  }

  private writeCache(generatedAt: string, exercises: CatalogExercise[]): void {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ v: CACHE_VERSION, generatedAt, exercises }),
      );
    } catch {
      /* quota piena o storage non disponibile: la cache è solo un'ottimizzazione */
    }
  }

  // ---- Normalizzazione / dedupe / filtro GIF (vedi header) ----

  private sanitize(list: CatalogExercise[]): CatalogExercise[] {
    const seen = new Set<string>();
    const out: CatalogExercise[] = [];
    for (const e of list) {
      if (!e?.gifId || !e?.name) continue;            // serve sempre una GIF valida
      const name = String(e.name).replace(/\s+/g, ' ').trim();
      const key = this.dedupeKey(name);
      if (!key || seen.has(key)) continue;            // niente duplicati semantici
      seen.add(key);
      const muscleId = e.muscleId || 'core';
      out.push({
        ...e,
        name,
        muscleId,
        macro: e.macro === 'upper' || e.macro === 'lower'
          ? e.macro
          : (UPPER.has(muscleId) ? 'upper' : 'lower'),
      });
    }
    return out;
  }

  /** Chiave di dedupe: minuscolo, senza accenti/punteggiatura, spazi compressi. */
  private dedupeKey(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
