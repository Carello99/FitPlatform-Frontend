/**
 * ============================================================================
 *  FILE: active-workout.component.ts  —  ALLENAMENTO ATTIVO (logging per serie)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   La schermata che l'utente usa MENTRE si allena: registra ogni serie (peso,
 *   reps, completata), gestisce il timer di recupero, calcola volume/percentuale
 *   e produce il riepilogo finale. È il componente più "stateful" dell'app.
 *
 * COSA RAPPRESENTA / LIFECYCLE
 *   Componente di feature protetto da activeSessionGuard (serve una sessione
 *   attiva). Implementa:
 *     - ngOnInit: inizializza la griglia `log` dagli esercizi della scheda e
 *       avvia il `ticker` (setInterval 1s) per cronometro + countdown recupero.
 *     - ngOnDestroy: FERMA il ticker (clearInterval). CRITICO: senza, il timer
 *       continuerebbe a girare dopo l'uscita → memory leak / aggiornamenti su
 *       un componente distrutto.
 *
 * FLUSSO DEI DATI
 *   sessionSchedaId (SessionService) → getScheda() → `scheda`. Lo stato vive in
 *   signal (log[ei][si], restDef, skipped, elapsed, rest, editor...). I computed
 *   (totalSets/doneSets/pct/volume/active) derivano tutto dal `log`. A fine
 *   allenamento buildSummary() → finishSession() deposita il riepilogo e naviga
 *   a /summary.
 *
 * MODELLO STATO (riferimento veloce)
 *   - log: matrice serie per esercizio (kg/reps/done). È la fonte di verità.
 *   - rest: timer di recupero corrente (left/total/paused/ei) o null.
 *   - numEditor/restEditor: quale editor a tendina è aperto (kg|reps / recupero).
 *   - skipped[ei]: esercizio saltato (escluso dal calcolo "active").
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutStore (scheda), SessionService (begin/finish/exit), ToastService
 *     (feedback recupero), ExerciseImageService (GIF), RingComponent.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - IMMUTABILITÀ: ogni modifica al log clona la matrice
 *     (log().map(a => a.map(x => ({...x})))) prima di set(). Mutare in place NON
 *     farebbe scattare i signal/computed (UI non aggiornata). NON rimuovere i clone.
 *   - guessKg/targetReps sono SOLO valori di partenza stimati (default per nome
 *     esercizio + primo numero delle reps): non sono dati salvati.
 *   - stepKg ha step variabile (1kg sotto i 4, poi 2kg): se gli incrementi peso
 *     "sembrano strani", la regola è lì.
 *   - Il volume in buildSummary ha un fallback stimato (doneSets*88) se il volume
 *     calcolato è 0: evita un riepilogo a 0 quando non si sono inseriti kg.
 *   - haptic() (navigator.vibrate) è best-effort: assente su desktop, ignorato.
 * ============================================================================
 */

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { Exercise, Scheda, WorkoutSummary } from '../../core/models/workout.models';
import { ExerciseImageService } from '../../core/services/exercise-image.service';
import { FinishedWorkout, GamificationService } from '../../core/gamification/gamification.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { RingComponent } from '../../shared/components/ring/ring.component';

/** Log di una singola serie. */
interface SetLog {
  kg: number;
  reps: number;
  done: boolean;
}

/** Timer di recupero attivo. */
interface Rest {
  left: number;
  total: number;
  paused: boolean;
  ei: number; // esercizio che ha avviato il recupero
}

/** Editor numerico (peso/ripetizioni) aperto. */
interface NumEditor {
  kind: 'kg' | 'reps';
  ei: number;
  si: number;
}

// Carichi di partenza realistici (kg). 0 = corpo libero.
const KG_DEFAULTS: Record<string, number> = {
  'Panca piana bilanciere': 60, 'Spinte manubri inclinata': 24, 'Lento avanti manubri': 18,
  'Alzate laterali': 10, 'French press': 25, 'Push-down ai cavi': 30,
  'Trazioni alla sbarra': 0, 'Rematore bilanciere': 50, 'Lat machine presa larga': 45,
  'Curl bilanciere': 25, 'Curl manubri alternato': 12,
  'Squat bilanciere': 80, 'Pressa 45°': 120, 'Stacco rumeno': 70, 'Affondi camminata': 16, 'Calf raise': 90,
  'Goblet squat': 20, 'Push-up': 0, 'Rematore manubrio': 18, 'Plank': 0,
  'Hollow hold': 0, 'Russian twist': 8, 'Bird dog': 0, 'Mobilità anche': 0,
};
const guessKg = (e: Exercise): number => KG_DEFAULTS[e.name] ?? 20;
const targetReps = (e: Exercise): number => parseInt(String(e.reps).match(/\d+/)?.[0] || '10', 10);

/**
 * Allenamento attivo — logging per serie.
 *
 * Tutti gli esercizi sono visibili come card; ogni card elenca le serie con
 * stepper del peso, cella ripetizioni e check di completamento. Al completamento
 * di una serie parte la barra di recupero (con pausa, ±15s e salta). Peso e
 * ripetizioni si modificano inline o tramite editor a tendina; il recupero per
 * esercizio si modifica con l'apposito editor.
 */
@Component({
  selector: 'ff-active-workout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RingComponent],
  templateUrl: './active-workout.component.html',
  // L'host deve riempire la colonna della phone-shell, altrimenti height:100%
  // del contenitore collassa e l'area .screen non scrolla.
  styles: [':host{display:flex;flex-direction:column;flex:1;min-height:0}'],
})
export class ActiveWorkoutComponent implements OnInit, OnDestroy {
  readonly w = inject(WorkoutStore);
  readonly state = inject(SessionService);
  private readonly imgs = inject(ExerciseImageService);
  private readonly gami = inject(GamificationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly TILE_CLASS = TILE_CLASS;

  readonly scheda = this.w.getScheda(this.state.sessionSchedaId()) as Scheda;

  // ---- Stato ----
  readonly log = signal<SetLog[][]>([]);     // log[ei][si]
  readonly restDef = signal<number[]>([]);   // recupero (s) per esercizio
  readonly skipped = signal<boolean[]>([]);
  readonly elapsed = signal<number>(0);
  readonly rest = signal<Rest | null>(null);
  readonly numEditor = signal<NumEditor | null>(null);
  readonly restEditor = signal<number | null>(null); // ei in editazione
  readonly confirmExit = signal<boolean>(false);

  // GIF degli esercizi che hanno fallito il caricamento (fallback su icona)
  readonly failedImg = signal<Set<string>>(new Set());

  // Stato locale degli editor a tendina
  readonly edVal = signal<number>(0);
  readonly edAll = signal<boolean>(false);

  private ticker: ReturnType<typeof setInterval> | null = null;

  // ---- Computed ----
  readonly totalSets = computed(() => this.log().reduce((a, arr) => a + arr.length, 0));
  readonly doneSets = computed(() =>
    this.log().reduce((a, arr) => a + arr.filter((x) => x.done).length, 0),
  );
  readonly pct = computed(() => (this.totalSets() ? this.doneSets() / this.totalSets() : 0));
  readonly volume = computed(() =>
    Math.round(
      this.log().reduce(
        (a, arr) => a + arr.filter((x) => x.done).reduce((b, x) => b + x.kg * x.reps, 0),
        0,
      ),
    ),
  );

  /** Prima serie incompleta tra gli esercizi non saltati: { ei, si } o null. */
  readonly active = computed<{ ei: number; si: number } | null>(() => {
    const log = this.log();
    const sk = this.skipped();
    for (let i = 0; i < log.length; i++) {
      if (sk[i]) continue;
      const si = log[i].findIndex((x) => !x.done);
      if (si >= 0) return { ei: i, si };
    }
    return null;
  });

  // ---- Lifecycle ----
  ngOnInit(): void {
    if (!this.scheda) {
      void this.router.navigate(['/home']);
      return;
    }
    this.log.set(
      this.scheda.exercises.map((e) =>
        Array.from({ length: e.sets }, () => ({ kg: guessKg(e), reps: targetReps(e), done: false })),
      ),
    );
    this.restDef.set(this.scheda.exercises.map((e) => e.rest));
    this.skipped.set(this.scheda.exercises.map(() => false));
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
  }

  private tick(): void {
    this.elapsed.update((e) => e + 1);
    const r = this.rest();
    if (r && !r.paused) {
      if (r.left <= 0) {
        this.toast.show('Recupero finito · si torna a spingere 💪', 'ti-bolt-filled');
        this.rest.set(null);
      } else {
        this.rest.set({ ...r, left: r.left - 1 });
      }
    }
  }

  // ---- Helpers ----
  fmt(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  fmtKg(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.0', '');
  }

  fmtVol(v: number): string {
    return v.toLocaleString('it-IT');
  }

  private haptic(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  exDone(ei: number): boolean {
    const arr = this.log()[ei];
    return !!arr && arr.every((x) => x.done);
  }
  setsDoneHere(ei: number): number {
    return (this.log()[ei] ?? []).filter((x) => x.done).length;
  }
  isCurrent(ei: number): boolean {
    const a = this.active();
    return !!a && a.ei === ei;
  }
  isActiveSet(ei: number, si: number): boolean {
    const a = this.active();
    return !!a && a.ei === ei && a.si === si;
  }

  // ---- Azioni sulle serie ----
  toggleSet(ei: number, si: number): void {
    const grid = this.log().map((a) => a.map((x) => ({ ...x })));
    const willDo = !grid[ei][si].done;
    grid[ei][si].done = willDo;
    this.log.set(grid);
    if (willDo) {
      this.haptic(35);
      const r = this.restDef()[ei];
      this.rest.set({ left: r, total: r, paused: false, ei });
    }
  }

  /**
   * Incremento/decremento del peso con step variabile:
   *  - sotto i 4 kg → passo di 1 kg (0→1→2→3→4)
   *  - da 4 kg in poi → passo di 2 kg (4→6→8→10)
   * Il decremento applica la logica inversa (10→8→6→4→3→2→1→0).
   */
  stepKg(ei: number, si: number, dir: 1 | -1): void {
    const grid = this.log().map((a) => a.map((x) => ({ ...x })));
    const cur = grid[ei][si].kg;
    const next = dir > 0 ? (cur < 4 ? cur + 1 : cur + 2) : cur <= 4 ? cur - 1 : cur - 2;
    grid[ei][si].kg = Math.max(0, next);
    this.log.set(grid);
  }

  // ---- GIF esercizio ----
  gifUrl(name: string): string | null {
    return this.imgs.getGifUrl(name);
  }
  showGif(name: string): boolean {
    return !!this.imgs.getGifUrl(name) && !this.failedImg().has(name);
  }
  markImgFailed(name: string): void {
    this.failedImg.update((s) => new Set([...s, name]));
  }

  private commitNum(kind: 'kg' | 'reps', ei: number, si: number, val: number, applyAll: boolean): void {
    const grid = this.log().map((a) => a.map((x) => ({ ...x })));
    if (applyAll) grid[ei].forEach((x) => (x[kind] = val));
    else grid[ei][si][kind] = val;
    this.log.set(grid);
  }

  skipExercise(ei: number): void {
    const sk = this.skipped().slice();
    sk[ei] = true;
    this.skipped.set(sk);
  }
  resume(ei: number): void {
    const sk = this.skipped().slice();
    sk[ei] = false;
    this.skipped.set(sk);
  }

  // ---- Recupero ----
  adjRest(delta: number): void {
    const r = this.rest();
    if (!r) return;
    const left = Math.max(0, r.left + delta);
    this.rest.set({ ...r, left, total: Math.max(r.total, left) });
  }
  togglePause(): void {
    const r = this.rest();
    if (r) this.rest.set({ ...r, paused: !r.paused });
  }
  skipRest(): void {
    this.rest.set(null);
  }

  // ---- Editor numerico (kg / reps) ----
  openNum(kind: 'kg' | 'reps', ei: number, si: number): void {
    const set = this.log()[ei][si];
    this.edVal.set(kind === 'kg' ? set.kg : set.reps);
    this.edAll.set(false);
    this.numEditor.set({ kind, ei, si });
  }
  bumpEd(d: number): void {
    const kind = this.numEditor()?.kind ?? (this.restEditor() !== null ? 'rest' : 'kg');
    this.edVal.update((x) => {
      const n = x + d;
      if (kind === 'kg') return Math.max(0, Math.round(n * 4) / 4);
      return Math.max(0, Math.round(n)); // reps / rest
    });
  }
  setEd(v: number): void {
    this.edVal.set(Math.max(0, v));
  }
  commitNumEditor(): void {
    const ne = this.numEditor();
    if (!ne) return;
    this.commitNum(ne.kind, ne.ei, ne.si, this.edVal(), this.edAll());
    this.numEditor.set(null);
  }

  // ---- Editor recupero ----
  openRest(ei: number): void {
    this.edVal.set(this.restDef()[ei]);
    this.restEditor.set(ei);
  }
  commitRestEditor(): void {
    const ei = this.restEditor();
    if (ei === null) return;
    const val = this.edVal();
    const arr = this.restDef().slice();
    arr[ei] = val;
    this.restDef.set(arr);
    const r = this.rest();
    if (r && r.ei === ei) this.rest.set({ ...r, total: val, left: Math.min(r.left, val) });
    this.restEditor.set(null);
  }

  // ---- Editor: dati per il template ----
  editorExercise(): Exercise | null {
    const ne = this.numEditor();
    if (ne) return this.scheda.exercises[ne.ei];
    const re = this.restEditor();
    if (re !== null) return this.scheda.exercises[re];
    return null;
  }

  // ---- Riepilogo / uscita ----
  /**
   * Costruisce il payload grezzo per il motore di gamification. Gli esercizi
   * saltati sono esclusi dal calcolo dei record (non hanno serie completate utili).
   */
  private buildFinished(): FinishedWorkout {
    const s = this.scheda;
    const exDoneCount = s.exercises.filter((_, i) => !this.skipped()[i] && this.exDone(i)).length;
    return {
      schedaName: s.name,
      accent: s.accent,
      icon: s.icon,
      seconds: this.elapsed(),
      exTotal: s.exercises.length,
      exDone: exDoneCount,
      setsDone: this.doneSets(),
      setsTotal: this.totalSets(),
      volume: this.volume() || Math.round(this.doneSets() * 88),
      // Cosa è stato fatto davvero, esercizio per esercizio: alimenta i record
      // e il riepilogo consultabile dallo Storico. Un esercizio saltato esce con
      // sets 0 e topKg 0, così non risulta svolto né segna record.
      exercises: s.exercises.map((e, i) => {
        const skipped = this.skipped()[i];
        const done = skipped ? [] : (this.log()[i] ?? []).filter((x) => x.done);
        const heaviest = done.reduce<{ kg: number; reps: number } | null>(
          (best, x) => (!best || x.kg > best.kg ? { kg: x.kg, reps: x.reps } : best),
          null,
        );
        return {
          name: e.name,
          sets: done.length,
          reps: heaviest?.reps ?? 0,
          topKg: heaviest?.kg ?? 0,
        };
      }),
    };
  }

  finish(): void {
    // Il motore calcola XP/livello/achievement e produce il riepilogo arricchito.
    const summary: WorkoutSummary = this.gami.recordWorkout(this.buildFinished());
    this.state.finishSession(summary);
  }
  exit(): void {
    this.state.exitSession();
  }
}
