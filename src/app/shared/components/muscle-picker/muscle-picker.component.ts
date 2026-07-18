/**
 * ============================================================================
 *  FILE: muscle-picker.component.ts  —  WIZARD DI SELEZIONE ESERCIZIO
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Componente riusabile che guida l'utente a scegliere e configurare un
 *   esercizio: mappa dei gruppi muscolari → lista esercizi → schermata di
 *   configurazione (serie/reps/recupero/kg). Usato sia per creare una scheda
 *   (new-scheda) sia per aggiungere esercizi a una esistente (scheda-detail).
 *
 * COSA RAPPRESENTA / COMUNICAZIONE
 *   Componente "smart-ish": legge i dati dallo store ma NON li scrive. Comunica
 *   col padre via @Input/@Output (pattern controllato):
 *     - @Input added: esercizi già presenti (per mostrare lo stato "aggiunto").
 *     - @Output exercisePicked: emesso a conferma → il padre lo inserisce.
 *     - @Output exerciseRemoved: emesso per togliere un esercizio già presente.
 *   Il padre resta proprietario della lista; questo componente è uno strumento.
 *
 * MACCHINA A STATI (il cuore del file)
 *   Il signal `view` ha 3 stati: 'map' → 'exercises' → 'config'. selectMuscle()
 *   e selectExercise() avanzano; goBack() torna indietro. ATTENZIONE: da
 *   'config' il "back" dipende da selectedMuscle: se è null la config arriva
 *   dalla RICERCA e si torna a 'map', altrimenti a 'exercises'. È la regola da
 *   conoscere se la navigazione "indietro" sembra saltare uno step.
 *
 * FLUSSO DEI DATI
 *   exercisesByMuscle (store) → lista per gruppo. La ricerca (searchResults)
 *   filtra per nome esercizio O nome gruppo; searchGroups li raggruppa in
 *   Upper/Lower con la stessa logica centralizzata dello store. In config, i
 *   campi sono PRECOMPILATI: se l'esercizio è già aggiunto si riusano i suoi
 *   valori, altrimenti default sensati (getDefaultKg + preset 3×12).
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutStore (dati + groupByMacro), ExerciseImageService (GIF),
 *     ui.constants (MUSCLE_CATEGORIES/META), ExerciseCardComponent.
 *   - CHI LO USA: new-scheda, scheda-detail (overlay "Aggiungi esercizio").
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - I valori numerici passano da clampInt(): input fuori range o non numerici
 *     vengono limitati/sostituiti col fallback. Le reps NO (sono testo libero,
 *     es. "8-12"): nessun clamp, di proposito.
 *   - confirmExercise() resetta view→'map', selezione e ricerca: se dopo
 *     l'aggiunta la UI "torna alla mappa", è voluto.
 *   - getExerciseIcon usa regex sul nome: un nome nuovo non riconosciuto ricade
 *     sull'icona default 'ti-dumbbell' (non è un bug).
 * ============================================================================
 */

import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal,
} from '@angular/core';
import { WorkoutStore } from '../../../core/services/workout-store.service';
import { ExerciseImageService } from '../../../core/services/exercise-image.service';
import {
  KG_QUICK, MUSCLE_CATEGORIES, MUSCLE_META, MuscleInfo, SET_PRESETS, SetPreset,
} from '../../../core/constants/ui.constants';
import { ExerciseCardComponent } from '../exercise-card/exercise-card.component';

export interface PickedExercise {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  kg: number;
}

interface MuscleCategory {
  label: string;
  icon: string;
  muscles: MuscleInfo[];
}


// Sezioni e colori derivano dalla fonte unica MUSCLE_META → coerenza con il recap.
const MUSCLE_GROUPS: MuscleCategory[] = MUSCLE_CATEGORIES.map((cat) => ({
  label: cat.label,
  icon: cat.icon,
  muscles: Object.values(MUSCLE_META).filter((m) => m.category === cat.id),
}));

// Flat list for lookup helpers
const ALL_MUSCLES: MuscleInfo[] = Object.values(MUSCLE_META);



// Default kg by exercise name (common compound/isolation lifts)
const KG_BY_EXERCISE: Record<string, number> = {
  'Panca piana': 60, 'Panca inclinata': 50, 'Spinte manubri': 20, 'Cavi incrociati': 15,
  'Lento avanti': 40, 'Military press': 50, 'Arnold press': 14, 'Alzate laterali': 8,
  'Alzate frontali': 8, 'Facepull': 20,
  'Trazioni': 0, 'Rematore bilanciere': 60, 'Lat machine': 50, 'Pulley basso': 45,
  'Stacco da terra': 80, 'Hyperextension': 0,
  'Curl bilanciere': 30, 'Curl manubri': 12, 'Curl concentrato': 10,
  'Curl a martello': 12, 'Curl su panca inclinata': 10,
  'Tricipiti ai cavi': 20, 'French press': 25, 'Skull crusher': 30,
  'Tricipiti overhead': 20, 'Close grip bench': 50,
  'Squat': 60, 'Pressa 45°': 80, 'Leg extension': 40, 'Affondi': 20,
  'Affondi bulgari': 20, 'Hack squat': 60,
  'Stacco rumeno': 50, 'Leg curl': 35, 'Good morning': 30, 'Nordic curl': 0,
  'Hip thrust': 60, 'Sumo squat': 50, 'Kickback glutei': 0, 'Glutei al cavo': 15,
  'Calf raise': 40, 'Calf raise seduto': 30, 'Leg press calf': 80,
  'Push-up': 0, 'Dip alle parallele': 0, 'Pec deck': 30, 'Plank': 0,
  'Crunch': 0, 'Russian twist': 0, 'Leg raise': 0, 'Plank laterale': 0,
  'Bicycle crunch': 0, 'Ab wheel': 0,
};

@Component({
  selector: 'ff-muscle-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExerciseCardComponent],
  templateUrl: './muscle-picker.component.html',
})
export class MusclePickerComponent {
  private readonly w    = inject(WorkoutStore);
  private readonly imgs = inject(ExerciseImageService);

  private readonly failedImgs = signal<Set<string>>(new Set());

  @Input() added: PickedExercise[] = [];
  @Output() exercisePicked  = new EventEmitter<PickedExercise>();
  @Output() exerciseRemoved = new EventEmitter<string>();

  readonly MUSCLE_GROUPS = MUSCLE_GROUPS;
  readonly PRESETS        = SET_PRESETS;
  readonly KG_QUICK       = KG_QUICK;

  readonly view             = signal<'map' | 'exercises' | 'config'>('map');
  readonly search           = signal('');
  readonly selectedMuscle   = signal<MuscleInfo | null>(null);

  /**
   * Risultati ricerca: tutti gli esercizi (di ogni gruppo) il cui nome — o il
   * nome del gruppo muscolare — contiene la query. Vuoto se la query è vuota.
   */
  readonly searchResults = computed<{ name: string; muscleId: string }[]>(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return [];
    const out: { name: string; muscleId: string }[] = [];
    for (const [muscleId, names] of Object.entries(this.w.exercisesByMuscle)) {
      const label = MUSCLE_META[muscleId]?.label.toLowerCase() ?? '';
      const groupHit = label.includes(q);
      for (const name of names) {
        if (groupHit || name.toLowerCase().includes(q)) out.push({ name, muscleId });
      }
    }
    return out;
  });

  /** Risultati ricerca raggruppati in Upper / Lower Body (logica centralizzata). */
  readonly searchGroups = computed(() =>
    this.w.groupByMacro(this.searchResults(), (r) => r.name),
  );

  onSearch(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }
  clearSearch(): void {
    this.search.set('');
  }

  readonly selectedExercise = signal<string | null>(null);
  readonly configSets       = signal(3);
  readonly configReps       = signal('12');
  readonly configRest       = signal(60);
  readonly configKg         = signal(0);

  // ---- Query helpers ----

  exercisesForMuscle(muscleId: string): string[] {
    return this.w.exercisesByMuscle[muscleId] ?? [];
  }

  hasExercisesForMuscle(muscleId: string): boolean {
    const exs = this.exercisesForMuscle(muscleId);
    return this.added.some((a) => exs.includes(a.name));
  }

  exerciseCountForMuscle(muscleId: string): number {
    const exs = this.exercisesForMuscle(muscleId);
    return this.added.filter((a) => exs.includes(a.name)).length;
  }

  isExerciseAdded(name: string): boolean {
    return this.added.some((a) => a.name === name);
  }

  getAddedConfig(name: string): PickedExercise | undefined {
    return this.added.find((a) => a.name === name);
  }

  getMuscleById(id: string): MuscleInfo | undefined {
    return ALL_MUSCLES.find((m) => m.id === id);
  }

  /** Metadati (colore identificativo) del gruppo muscolare di un esercizio. */
  metaForExercise(name: string): MuscleInfo | undefined {
    const id = this.w.muscleIdForExercise(name);
    return id ? MUSCLE_META[id] : undefined;
  }

  // ---- Navigation ----

  selectMuscle(muscleId: string): void {
    const m = ALL_MUSCLES.find((g) => g.id === muscleId);
    if (!m) return;
    this.selectedMuscle.set(m);
    this.view.set('exercises');
  }

  selectExercise(name: string): void {
    this.selectedExercise.set(name);
    const existing = this.getAddedConfig(name);
    this.configSets.set(existing?.sets ?? 3);
    this.configReps.set(existing?.reps ?? '12');
    this.configRest.set(existing?.rest ?? 60);
    this.configKg.set(existing?.kg ?? this.getDefaultKg(name));
    this.view.set('config');
  }

  /** Apre la config da un risultato di ricerca (back tornerà alla mappa). */
  selectFromSearch(name: string): void {
    this.selectedMuscle.set(null);
    this.selectExercise(name);
  }

  selectPreset(p: SetPreset): void {
    this.configSets.set(p.sets);
    this.configReps.set(p.reps);
    this.configRest.set(p.rest);
  }

  // ---- Modifica parametri: pulsanti +/- + input manuale con validazione ----

  private clampInt(v: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  }

  adjustSets(delta: number): void {
    this.configSets.update((v) => this.clampInt(v + delta, 1, 20, 1));
  }
  onSetsInput(e: Event): void {
    this.configSets.set(this.clampInt(parseInt((e.target as HTMLInputElement).value, 10), 1, 20, 1));
  }

  adjustReps(delta: number): void {
    const cur = parseInt(this.configReps(), 10);
    this.configReps.set(String(this.clampInt((Number.isNaN(cur) ? 10 : cur) + delta, 1, 100, 10)));
  }
  onRepsInput(e: Event): void {
    // Le ripetizioni possono essere un range testuale (es. "8-12"): nessun clamp.
    this.configReps.set((e.target as HTMLInputElement).value);
  }

  adjustRest(delta: number): void {
    this.configRest.update((v) => this.clampInt(v + delta, 0, 600, 60));
  }
  onRestInput(e: Event): void {
    this.configRest.set(this.clampInt(parseInt((e.target as HTMLInputElement).value, 10), 0, 600, 60));
  }

  adjustKg(delta: number): void {
    this.configKg.update((v) => this.clampInt(v + delta, 0, 500, 0));
  }
  onKgInput(e: Event): void {
    this.configKg.set(this.clampInt(parseInt((e.target as HTMLInputElement).value, 10), 0, 500, 0));
  }

  confirmExercise(): void {
    const name = this.selectedExercise();
    if (!name) return;
    this.exercisePicked.emit({
      name,
      sets: this.configSets(),
      reps: this.configReps(),
      rest: this.configRest(),
      kg:   this.configKg(),
    });
    this.view.set('map');
    this.selectedExercise.set(null);
    this.search.set(''); // reset barra ricerca dopo l'aggiunta
  }

  goBack(): void {
    if (this.view() === 'config') {
      // Se non c'è un muscolo selezionato la config arriva dalla ricerca → mappa
      this.view.set(this.selectedMuscle() ? 'exercises' : 'map');
      this.selectedExercise.set(null);
    } else {
      this.view.set('map');
      this.selectedMuscle.set(null);
    }
  }

  removeExercise(name: string): void {
    this.exerciseRemoved.emit(name);
  }

  // ---- Helpers ----

  getGifUrl(name: string): string | null {
    return this.imgs.getGifUrl(name);
  }

  showIcon(name: string): boolean {
    return !this.imgs.getGifUrl(name) || this.failedImgs().has(name);
  }

  markImgFailed(name: string): void {
    this.failedImgs.update((s) => new Set([...s, name]));
  }

  getExerciseIcon(name: string): string {
    const n = name.toLowerCase();
    if (/panca|spinte manubri|pec deck|cavi incrociati|push-up/.test(n)) return 'ti-barbell';
    if (/trazioni|rematore|lat machine|pulley/.test(n)) return 'ti-arrows-up';
    if (/stacco da terra|hyperextension/.test(n)) return 'ti-barbell';
    if (/lento|arnold|alzate|facepull|military/.test(n)) return 'ti-dumbbell';
    if (/curl/.test(n)) return 'ti-dumbbell';
    if (/tricipiti|skull|french|close grip/.test(n)) return 'ti-dumbbell';
    if (/dip/.test(n)) return 'ti-chevrons-down';
    if (/squat|pressa|leg extension|affondi|hack/.test(n)) return 'ti-barbell';
    if (/stacco rumeno|leg curl|nordic|good morning/.test(n)) return 'ti-stretching';
    if (/hip thrust|glutei|kickback|sumo/.test(n)) return 'ti-stretching-2';
    if (/calf|polpacci/.test(n)) return 'ti-run';
    if (/plank|crunch|russian|leg raise|bicycle|ab wheel/.test(n)) return 'ti-activity';
    return 'ti-dumbbell';
  }

  private getDefaultKg(exerciseName: string): number {
    return KG_BY_EXERCISE[exerciseName] ?? 20;
  }
}
