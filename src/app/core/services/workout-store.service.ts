/**
 * ============================================================================
 *  FILE: workout-store.service.ts  —  STORE GLOBALE (single source of truth)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   È l'UNICO posto dove vivono i dati dell'applicazione (utente, schede,
 *   statistiche, storico, libreria esercizi...). Per uno sviluppatore Java:
 *   immaginalo come un bean @Service "singleton" che fa da cache in memoria +
 *   repository di sola lettura. I componenti NON parlano mai direttamente con
 *   l'API: leggono SEMPRE da qui.
 *
 * PERCHÉ ESISTE / QUALE PROBLEMA RISOLVE
 *   Centralizza lo stato per evitare che ogni schermata richiami l'API per
 *   conto suo (dati duplicati e disallineati). Modifica in un punto solo →
 *   tutte le viste che leggono si aggiornano da sole (reattività via Signals).
 *
 * COSA RAPPRESENTA IN ANGULAR
 *   Un Service @Injectable({ providedIn: 'root' }) = istanza unica condivisa in
 *   tutta l'app. Pattern adottato: "Signal Store".
 *
 * FLUSSO DEI DATI
 *   load() → WorkoutApiService scarica il JSON → salvato nel signal privato
 *   `data` → i getter pubblici (user, schede, ...) lo espongono → i componenti
 *   li leggono e, leggendoli, si "abbonano": al prossimo data.set/update si
 *   ri-disegnano automaticamente. Le scritture (addScheda/updateScheda) usano
 *   update() immutabile (nuovo oggetto, mai mutazione in place).
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutApiService: sorgente dei dati (HTTP/mock).
 *   - ui.constants (MACRO_SECTIONS, macroForMuscle): logica di raggruppamento.
 *   - CHI LO USA: praticamente ogni componente feature + SessionService.
 *     Modificare la forma dei getter impatta MOLTE schermate: attenzione.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - `data` è null finché load() non completa: i getter usano `?? default`
 *     per non esplodere. L'unico che usa `!` è `user` (vedi nota lì).
 *   - load() è idempotente sul "loading" (no doppie chiamate concorrenti) ma
 *     PUÒ essere richiamato per il retry dopo un errore.
 *   - muscleIdForExercise usa un match per prefisso: vedi nota sul rischio.
 * ============================================================================
 */

// computed: crea un segnale derivato (calcolato automaticamente da altri signal)
// inject: dependency injection funzionale
// signal: crea un segnale reattivo (il cuore del nuovo sistema di reattività Angular)
import { Injectable, computed, inject, signal } from '@angular/core';
// takeUntilDestroyed: operatore RxJS che cancella automaticamente la subscription
// quando il componente/servizio viene distrutto. Previene memory leak.
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// DestroyRef: riferimento al ciclo di vita del contesto corrente (usato con takeUntilDestroyed)
import { DestroyRef } from '@angular/core';
import {
  AppData, Badge, ChartBar, FaqItem, GuideItem,
  HistoryItem, QuickStat, Scheda, UserProfile, WeekDay,
} from '../models/workout.models';
import { MACRO_SECTIONS, MacroSectionId, macroForMuscle } from '../constants/ui.constants';
import { WorkoutApiService } from './workout-api.service';
import { ExerciseCatalogService } from './exercise-catalog.service';

// Tipo per lo stato del caricamento dati
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

// Profilo neutro restituito da `user` finché i dati non sono caricati. Evita il
// crash "Cannot read properties of null" se il getter viene letto prima di load()
// (la shell normalmente lo previene col gate di loading, ma questo è un paracadute
// difensivo). xpNext = 1 così eventuali divisioni xp/xpNext non producono NaN.
const EMPTY_USER: UserProfile = {
  name: '', level: 0, levelTitle: '', xp: 0, xpNext: 1, streak: 0, weight: 0,
};

/**
 * Store (archivio) centrale dei dati di FitFlow.
 *
 * Questo servizio è la "singola fonte di verità" per tutti i dati dell'app.
 * I componenti NON chiamano direttamente l'API — leggono sempre da qui.
 *
 * Pattern usato: Signal Store
 * - I dati sono esposti come Angular Signals
 * - I componenti si "abbonano" automaticamente ai signal che leggono
 * - Quando un signal cambia, solo i componenti che lo leggono vengono aggiornati
 */
@Injectable({ providedIn: 'root' })
export class WorkoutStore {
  private readonly api = inject(WorkoutApiService);
  // DestroyRef ci serve per passarlo a takeUntilDestroyed()
  private readonly destroyRef = inject(DestroyRef);
  // Catalogo esercizi ampliato (snapshot ExerciseDB). Quando è pronto, diventa
  // la fonte della libreria esercizi; altrimenti si ricade su app-data.json.
  private readonly catalog = inject(ExerciseCatalogService);

  // ---- stato grezzo (privato — non accessibile dall'esterno) ----

  // signal<T>(valore iniziale): crea un segnale reattivo di tipo T.
  // Quando il valore cambia (con .set() o .update()), tutti i componenti
  // che lo leggono vengono automaticamente aggiornati.
  private readonly data = signal<AppData | null>(null);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<string | null>(null);

  // ---- stato derivato (pubblico — read-only) ----

  // .asReadonly() espone il signal senza il metodo .set() → i consumatori non possono modificarlo
  readonly status = this._status.asReadonly();

  // computed(): crea un signal derivato. Viene ricalcolato automaticamente
  // ogni volta che uno dei signal che legge cambia.
  // Qui: loading è true se lo status è 'loading' O 'idle'
  readonly loading = computed(() => this._status() === 'loading' || this._status() === 'idle');
  readonly error = this._error.asReadonly();

  /** Toggle demo: simula la presenza/assenza di schede di allenamento.
   *  Se false nasconde SOLO le schede demo (seed): le schede create dall'utente
   *  restano sempre visibili → creare una scheda in modalità "senza schede" la
   *  fa comparire subito nel carosello e nella lista. */
  readonly hasSchede = signal(true);

  /** ID delle schede create dall'utente in-app: bypassano il gate `hasSchede`. */
  private readonly _createdIds = signal<Set<string>>(new Set());

  /** Avvia il caricamento dei dati. Sicuro da chiamare più volte (es. per il retry). */
  load(): void {
    // Evita di avviare un secondo caricamento se uno è già in corso
    if (this._status() === 'loading') {
      return;
    }
    this._status.set('loading'); // Aggiorna il signal → lo spinner appare nei componenti
    this._error.set(null);

    this.api
      .loadAppData()
      // takeUntilDestroyed: quando il servizio viene distrutto, cancella la subscription
      // evitando memory leak (la risposta HTTP non verrebbe più elaborata)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // next: callback chiamata quando i dati arrivano correttamente
        next: (payload) => {
          this.data.set(payload);       // Salva i dati nel signal
          this._status.set('loaded');   // Aggiorna lo stato → lo spinner sparisce
        },
        // error: callback chiamata se la richiesta HTTP fallisce
        error: (err: unknown) => {
          this._error.set(
            err instanceof Error ? err.message : 'Impossibile caricare i dati. Riprova.',
          );
          this._status.set('error'); // Aggiorna lo stato → appare il messaggio di errore
        },
      });
  }

  // ---- Accessori ai dati (getter JavaScript) ----
  // Un "getter" è una proprietà calcolata: si accede con this.store.user (senza parentesi)
  // ma esegue una funzione. Leggendo data() nel getter, il componente diventa reattivo
  // ai cambiamenti del signal data.

  get user(): UserProfile {
    // Coerente con gli altri getter: fallback a un profilo neutro (EMPTY_USER)
    // finché data() è null, così la lettura prima di load() non lancia
    // "Cannot read properties of null". Le viste restano comunque protette a
    // monte dal gate di loading della shell: questo è solo difesa in profondità.
    return this.data()?.user ?? EMPTY_USER;
  }
  get schede(): Scheda[] {
    // ?? è l'operatore "nullish coalescing": se data() è null/undefined, restituisce []
    const all = this.data()?.schede ?? [];
    // Toggle demo: se disattivato, mostra SOLO le schede create dall'utente
    // (le demo/seed spariscono, ma ciò che l'utente crea resta sempre visibile).
    if (!this.hasSchede()) {
      const created = this._createdIds();
      return all.filter((s) => created.has(s.id));
    }
    return all;
  }
  get week(): WeekDay[] {
    return this.data()?.week ?? [];
  }
  get weekGoal(): number {
    return this.data()?.weekGoal ?? 0;
  }
  get weekDone(): number {
    return this.data()?.weekDone ?? 0;
  }
  get stats(): QuickStat[] {
    return this.data()?.stats ?? [];
  }
  get volumeWeeks(): ChartBar[] {
    return this.data()?.volumeWeeks ?? [];
  }
  get weightTrend(): number[] {
    return this.data()?.weightTrend ?? [];
  }
  get perfMonths(): ChartBar[] {
    return this.data()?.perfMonths ?? [];
  }
  get badges(): Badge[] {
    return this.data()?.badges ?? [];
  }
  get history(): HistoryItem[] {
    return this.data()?.history ?? [];
  }
  get faq(): FaqItem[] {
    return this.data()?.faq ?? [];
  }
  get guides(): GuideItem[] {
    return this.data()?.guides ?? [];
  }
  get muscleGroups(): string[] {
    return this.data()?.muscleGroups ?? [];
  }
  get exerciseLib(): string[] {
    // Preferisci il catalogo ampliato quando disponibile (centinaia/migliaia di
    // esercizi); fallback alla piccola libreria di app-data.json.
    return this.catalog.ready() ? this.catalog.exerciseLib() : (this.data()?.exerciseLib ?? []);
  }
  get exercisesByMuscle(): Record<string, string[]> {
    return this.catalog.ready()
      ? this.catalog.exercisesByMuscle()
      : (this.data()?.exercisesByMuscle ?? {});
  }

  /** Mappa inversa nome esercizio → id gruppo muscolare, ricalcolata dai dati. */
  private readonly _muscleByExercise = computed<Record<string, string>>(() => {
    // Sorgente coerente con exercisesByMuscle: catalogo se pronto, altrimenti app-data.
    const byMuscle = this.catalog.ready()
      ? this.catalog.exercisesByMuscle()
      : (this.data()?.exercisesByMuscle ?? {});
    const map: Record<string, string> = {};
    for (const [muscleId, names] of Object.entries(byMuscle)) {
      for (const name of names) map[name] = muscleId;
    }
    return map;
  });

  /**
   * Restituisce l'id del gruppo muscolare di un esercizio.
   * Prova la corrispondenza esatta, poi la chiave più lunga che sia prefisso
   * del nome (es. "Squat bilanciere" → "Squat"). null se sconosciuto.
   */
  muscleIdForExercise(name: string): string | null {
    const map = this._muscleByExercise();
    // 1) Tentativo veloce: corrispondenza ESATTA del nome.
    if (map[name]) return map[name];
    // 2) Fallback: la chiave più LUNGA che sia prefisso del nome vince
    //    (es. "Squat bilanciere" → trova "Squat"). Si sceglie la più lunga per
    //    massimizzare la specificità ("Panca piana" batte "Panca").
    // RISCHIO DA CONOSCERE: è un match per prefisso, NON semantico. Se due
    // esercizi diversi condividono un prefisso, può attribuire il gruppo
    // muscolare sbagliato → la card mostrerebbe il colore errato. Per nuovi
    // esercizi conviene censirli esplicitamente in exercisesByMuscle.
    let best: string | null = null;
    let bestLen = 0;
    for (const key of Object.keys(map)) {
      if (name.startsWith(key) && key.length > bestLen) {
        best = map[key];
        bestLen = key.length;
      }
    }
    return best; // null se nessun gruppo riconosciuto → il chiamante usa un default
  }

  /**
   * Raggruppa una lista di esercizi nelle due macro-sezioni Upper / Lower Body
   * (logica di grouping centralizzata, unica per tutta l'app). Gli esercizi non
   * riconosciuti finiscono in Upper Body per non essere mai nascosti.
   * Le sezioni vuote sono escluse.
   */
  groupByMacro<T>(
    items: T[],
    getName: (item: T) => string,
  ): { id: MacroSectionId; label: string; icon: string; items: T[] }[] {
    return MACRO_SECTIONS.map((sec) => ({
      ...sec,
      items: items.filter((it) => {
        const macro = macroForMuscle(this.muscleIdForExercise(getName(it)));
        return (macro ?? 'upper') === sec.id;
      }),
    })).filter((g) => g.items.length > 0);
  }

  /**
   * Aggiunge una scheda creata dall'utente all'array `schede`.
   * Usa signal.update() per produrre un nuovo oggetto AppData immutabile —
   * tutti i componenti che leggono `schede` si aggiornano automaticamente.
   */
  addScheda(scheda: Scheda): void {
    this.data.update((d) => (d ? { ...d, schede: [...d.schede, scheda] } : d));
    // Registra l'id come "creato dall'utente": resta visibile anche in modalità
    // "senza schede" (bypassa il gate hasSchede).
    this._createdIds.update((ids) => new Set(ids).add(scheda.id));
  }

  updateScheda(scheda: Scheda): void {
    this.data.update((d) =>
      d ? { ...d, schede: d.schede.map((s) => (s.id === scheda.id ? scheda : s)) } : d
    );
  }

  // ---- Scritture della gamification (alimentate da GamificationService) ----
  // Tengono lo store come unica fonte di verità per la UI: aggiornando qui
  // l'utente/i badge/lo storico, tutte le schermate che li leggono si
  // ridisegnano da sole (Signals), senza dover toccare i singoli componenti.

  /** Applica un aggiornamento parziale al profilo utente (livello, XP, streak…). */
  patchUser(patch: Partial<UserProfile>): void {
    this.data.update((d) => (d ? { ...d, user: { ...d.user, ...patch } } : d));
  }

  /** Sostituisce l'elenco badge (derivato dagli achievement della gamification). */
  setBadges(badges: Badge[]): void {
    this.data.update((d) => (d ? { ...d, badges } : d));
  }

  /** Inserisce in cima allo storico un allenamento appena concluso. */
  prependHistory(item: HistoryItem): void {
    this.data.update((d) => (d ? { ...d, history: [item, ...d.history] } : d));
  }

  /** Aggiorna il conteggio degli allenamenti completati nella settimana. */
  setWeekDone(weekDone: number): void {
    this.data.update((d) => (d ? { ...d, weekDone } : d));
  }

  /** Imposta l'obiettivo settimanale (frequenza pianificata). */
  setWeekGoal(weekGoal: number): void {
    this.data.update((d) => (d ? { ...d, weekGoal } : d));
  }

  /** Sostituisce il recap settimanale (giorni lun→dom con relativo stato). */
  setWeek(week: WeekDay[]): void {
    this.data.update((d) => (d ? { ...d, week } : d));
  }

  // ---- Selettori (metodi che filtrano/calcolano dai dati) ----

  /** Trova una scheda per ID. Restituisce undefined se non trovata. */
  getScheda(id: string | null): Scheda | undefined {
    if (!id) {
      return undefined;
    }
    // Array.find() restituisce il primo elemento che soddisfa la condizione, o undefined
    return this.schede.find((s) => s.id === id);
  }

  /** Calcola il numero totale di serie in una scheda. */
  totalSets(scheda: Scheda): number {
    // Array.reduce() accumula un valore iterando sull'array
    // acc = accumulatore, e = elemento corrente, 0 = valore iniziale
    return scheda.exercises.reduce((acc, e) => acc + e.sets, 0);
  }
}
