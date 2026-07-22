/**
 * ============================================================================
 *  FILE: new-scheda.component.ts  —  WIZARD CREAZIONE SCHEDA (feature)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Procedura guidata in 3 step per creare una nuova scheda da zero:
 *     step 0 → Setup    : nome, icona, colore (con preview live della card)
 *     step 1 → Esercizi : selezione dalla libreria + preset serie×reps
 *     step 2 → Riepilogo: anteprima finale e salvataggio nello store.
 *
 * COSA RAPPRESENTA / NOTA ANGULAR
 *   Componente di feature sulla rotta /new-scheda. NON usa ReactiveForms: il
 *   form è interamente gestito con signal + event binding (approccio leggero).
 *   La validazione per-step è il computed `canNext`.
 *
 * FLUSSO DEI DATI
 *   Tutto lo stato vive in signal locali (name, icon, accent, picked...). Il
 *   passo finale save() COSTRUISCE un oggetto Scheda dai signal, lo converte nel
 *   formato Exercise[] e chiama store.addScheda() → toast → torna a /schede.
 *   Niente viene persistito finché non si salva.
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutStore (libreria esercizi, addScheda, groupByMacro), ToastService,
 *     MusclePickerComponent, ExerciseCardComponent, MUSCLE_META/ui.constants.
 *   - CHI CI ARRIVA: schede (pulsante "Nuova scheda").
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - L'id generato è 'custom-' + Date.now(): unico nella sessione. Lo store
 *     vive in memoria → un refresh perde le schede create (nessuna persistenza).
 *   - save() assegna valori FISSI: focus/desc placeholder, level:2, icon esercizi
 *     'ti-barbell', muscle dalla label di MUSCLE_META. Se quei campi "sembrano
 *     sempre uguali", è qui.
 *   - canNext blocca l'avanzamento: step 0 richiede nome >1 char, step 1 almeno
 *     un esercizio. Se "Continua" resta disabilitato, controlla quelle condizioni.
 *   - selectPreset chiude l'accordion (openEx=null): comportamento diverso dalla
 *     modifica in scheda-detail, dove invece resta aperto (scelte UX distinte).
 * ============================================================================
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Accent, Scheda } from '../../core/models/workout.models';
import {
  ACCENT_VAR, MUSCLE_META, MuscleInfo, SET_PRESETS, SetPreset, TILE_CLASS,
} from '../../core/constants/ui.constants';
import { ToastService } from '../../core/services/toast.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { MusclePickerComponent, PickedExercise } from '../../shared/components/muscle-picker/muscle-picker.component';
import { ExerciseCardComponent } from '../../shared/components/exercise-card/exercise-card.component';

// Esercizio selezionato dall'utente con la configurazione serie×reps×kg scelta
interface PickedEx {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  kg: number;
}

// Configurazione predefinita di serie×reps mostrata nel selettore accordeon

/**
 * Wizard guidato per la creazione di una nuova scheda di allenamento.
 *
 * 3 step:
 *   0 → Setup    : nome, icona, colore della card (con preview live)
 *   1 → Esercizi : seleziona dalla libreria e scegli il preset serie×reps
 *   2 → Riepilogo: anteprima finale e salvataggio nello store
 *
 * Non usa ReactiveFormsModule — tutto è gestito con signal + event binding.
 */
@Component({
  selector: 'ff-new-scheda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MusclePickerComponent, ExerciseCardComponent],
  templateUrl: './new-scheda.component.html',
  // L'host deve riempire la colonna della phone-shell: senza flex+min-height:0
  // l'area .screen non si vincola in altezza e lo scroll si blocca con molti esercizi.
  styles: [':host{display:flex;flex-direction:column;flex:1;min-height:0}'],
})
export class NewSchedaComponent {
  readonly w     = inject(WorkoutStore);
  private readonly toast  = inject(ToastService);
  private readonly router = inject(Router);

  // Esponi le mappe costanti al template
  readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS  = TILE_CLASS;

  // Sei accenti disponibili per il colore della card
  readonly ACCENTS: Accent[] = ['amber', 'cyan', 'violet', 'green', 'rose', 'slate'];
// Icone Tabler selezionabili per la card
  readonly ICONS: string[] = [
    // Forza / sala pesi
    'ti-barbell',          'ti-dumbbell',        'ti-weight',          'ti-stretching',
    'ti-stretching-2',
    // Cardio / movimento
    'ti-run',              'ti-walk',            'ti-treadmill',       'ti-jump-rope',
    'ti-bike',             'ti-swimming',        'ti-stairs-up',       'ti-mountain',
    'ti-trekking',         'ti-cliff-jumping',
    // Discipline / sport
    'ti-yoga',             'ti-karate',          'ti-gymnastics',      'ti-skateboarding',
    'ti-ski-jumping',      'ti-soccer-field',    'ti-play-basketball', 'ti-play-football',
    'ti-play-volleyball',  'ti-play-handball',   'ti-ball-basketball', 'ti-ball-football',
    'ti-ball-tennis',      'ti-ball-volleyball', 'ti-ball-baseball',   'ti-ball-bowling',
    'ti-ball-american-football', 'ti-bowling',   'ti-golf',            'ti-disc-golf',
    'ti-waterpolo',        'ti-scuba-diving',    'ti-sailboat',        'ti-olympics',
    'ti-olympic-torch',
    // Obiettivi / progressi
    'ti-heart',            'ti-heartbeat',       'ti-activity',        'ti-activity-heartbeat',
    'ti-heart-rate-monitor', 'ti-target',        'ti-target-arrow',    'ti-trophy',
    'ti-medal',            'ti-medal-2',         'ti-award',           'ti-crown',
    'ti-rosette',          'ti-star',            'ti-flame',           'ti-bolt',
    'ti-trending-up',      'ti-chart-line',      'ti-chart-bar',       'ti-chart-arcs',
    'ti-chart-radar',      'ti-gauge',           'ti-progress',        'ti-stopwatch',
    'ti-flag',             'ti-shield',
    // Pianificazione / routine
    'ti-clock',            'ti-clock-play',      'ti-calendar',        'ti-calendar-check',
    'ti-calendar-week',    'ti-repeat',          'ti-checklist',       'ti-list-check',
    'ti-route',
    // Nutrizione / idratazione
    'ti-droplet',          'ti-bottle',          'ti-glass-full',      'ti-salad',
    'ti-apple',            'ti-egg',             'ti-meat',            'ti-scale',
    'ti-ruler-measure',
    // Recupero / benessere
    'ti-bed',              'ti-moon',            'ti-zzz',             'ti-lungs',
    'ti-stethoscope',      'ti-first-aid-kit',
  ];

  // Preset serie×reps: ogni pulsante ha un colore tile diverso per la categoria
  readonly PRESETS = SET_PRESETS;

  // Etichette degli step per header e progress bar
  readonly steps = ['Setup', 'Esercizi', 'Riepilogo'];

  // ---- Signal: stato del form ----
  readonly step   = signal(0);
  readonly name   = signal('');
  readonly icon   = signal('ti-barbell');
  readonly accent = signal<Accent>('amber');
  readonly picked = signal<PickedEx[]>([]);    // esercizi aggiunti dall'utente
  readonly search = signal('');
  // Esercizio con accordion preset aperto (null = tutti chiusi)
  readonly openEx = signal<string | null>(null);

  // ---- Computed ----

  // Il pulsante "Continua" è abilitato solo se lo step è valido
  readonly canNext = computed(() => {
    if (this.step() === 0) return this.name().trim().length > 1;
    if (this.step() === 1) return this.picked().length > 0;
    return true;
  });

  // Filtra la libreria esercizi in base al campo di ricerca
  readonly filteredLib = computed(() => {
    const q = this.search().toLowerCase().trim();
    return q
      ? this.w.exerciseLib.filter((e) => e.toLowerCase().includes(q))
      : this.w.exerciseLib;
  });

  // Durata stimata: base 10 min + 6 min per esercizio
  readonly estDuration = computed(() => Math.max(20, this.picked().length * 6 + 10));

  // Somma delle serie totali (usata nel riepilogo)
  readonly totalSeries = computed(() =>
    this.picked().reduce((acc, e) => acc + e.sets, 0)
  );

  // Metadati del gruppo muscolare di un esercizio (colore identificativo).
  metaFor(name: string): MuscleInfo | undefined {
    const id = this.w.muscleIdForExercise(name);
    return id ? MUSCLE_META[id] : undefined;
  }

  /**
   * Recap raggruppato nelle due macro-sezioni Upper / Lower Body tramite la
   * logica centralizzata dello store. Si aggiorna ad ogni modifica.
   */
  readonly recapGroups = computed(() => this.w.groupByMacro(this.picked(), (e) => e.name));

  // Gradiente di sfondo della preview card (identico a quello del coverflow)
  readonly cardBg = computed(() =>
    `linear-gradient(155deg, ${ACCENT_VAR[this.accent()]} -10%, var(--cover-end) 115%)`
  );

  // ---- Event handlers ----

  onName(e: Event): void {
    this.name.set((e.target as HTMLInputElement).value);
  }

  onSearch(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }

  // ---- Logica esercizi ----

  isAdded(name: string): boolean {
    return this.picked().some((e) => e.name === name);
  }

  getAdded(name: string): PickedEx | undefined {
    return this.picked().find((e) => e.name === name);
  }

  // Toggle accordion preset per un esercizio
  toggleEx(exName: string): void {
    this.openEx.set(this.openEx() === exName ? null : exName);
  }

  // Aggiunge l'esercizio con il preset scelto (o aggiorna se già presente)
  selectPreset(exName: string, p: SetPreset): void {
    const idx = this.picked().findIndex((e) => e.name === exName);
    if (idx >= 0) {
      // Aggiorna la configurazione di un esercizio già aggiunto
      this.picked.update((list) =>
        list.map((e, i) =>
          i === idx ? { ...e, sets: p.sets, reps: p.reps, rest: p.rest } : e
        )
      );
    } else {
      // Aggiunge il nuovo esercizio in coda
      this.picked.update((list) => [
        ...list,
        { name: exName, sets: p.sets, reps: p.reps, rest: p.rest, kg: 0 },
      ]);
    }
    this.openEx.set(null); // chiude l'accordion
  }

  removeEx(name: string): void {
    this.picked.update((list) => list.filter((e) => e.name !== name));
    if (this.openEx() === name) this.openEx.set(null);
  }

  onMusclePicked(ex: PickedExercise): void {
    const idx = this.picked().findIndex((e) => e.name === ex.name);
    if (idx >= 0) {
      this.picked.update((list) => list.map((e, i) => i === idx ? ex : e));
    } else {
      this.picked.update((list) => [...list, ex]);
    }
  }

  // ---- Navigazione wizard ----

  back(): void {
    if (this.step() > 0) {
      this.step.update((s) => s - 1);
    } else {
      void this.router.navigate(['/schede']);
    }
  }

  next(): void {
    if (this.step() < 2) {
      this.step.update((s) => s + 1);
    } else {
      this.save();
    }
  }

  private save(): void {
    const scheda: Scheda = {
      id: 'custom-' + Date.now(),
      name: this.name().trim(),
      focus: 'Scheda personalizzata',
      duration: this.estDuration(),
      level: 2,
      accent: this.accent(),
      icon: this.icon(),
      tag: 'Nuova',
      desc: 'Scheda creata da te.',
      // Converte PickedEx[] nel formato Exercise[] richiesto dall'interfaccia
      exercises: this.picked().map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        rest: e.rest,
        kg: e.kg,
        muscle: this.metaFor(e.name)?.label ?? '',
        icon: 'ti-barbell',
      })),
    };
    this.w.addScheda(scheda);
    this.toast.show('Scheda creata con successo!', 'ti-circle-check-filled');
    void this.router.navigate(['/schede']);
  }
}
