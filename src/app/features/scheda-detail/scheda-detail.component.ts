/**
 * ============================================================================
 *  FILE: scheda-detail.component.ts  —  DETTAGLIO + MODIFICA SCHEDA (feature)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Mostra una scheda in dettaglio (hero, statistiche, lista esercizi) e ospita
 *   l'intera modalità di MODIFICA (nome, colore, icona, esercizi: preset, kg,
 *   recupero, aggiunta/rimozione). È una delle schermate più ricche dell'app.
 *
 * COSA RAPPRESENTA / LIFECYCLE
 *   Componente di feature sulla rotta /scheda/:id. Niente ngOnInit: la scheda è
 *   un computed che risolve l'id (da SessionService o dal paramMap dell'URL).
 *
 * FLUSSO DEI DATI
 *   id (route / SessionService.viewSchedaId) → store.getScheda() → `scheda`.
 *   In modifica, enterEditMode() COPIA i valori nei signal di bozza (editName,
 *   editExs, ...): si lavora su una copia, l'originale cambia solo a saveEdit()
 *   → store.updateScheda() + toast. cancelEdit() scarta la bozza.
 *
 * INTERAZIONE MODIFICA ESERCIZI (vedi anche il template)
 *   Ogni esercizio è una ExerciseCard cliccabile che apre un accordion (preset
 *   serie×reps, stepper kg, stepper recupero). Le modifiche sono LIVE sui signal
 *   di bozza e mostrano un feedback "✓ Aggiornato" (flashSaved). Il pannello NON
 *   si chiude da solo dopo un cambio (scelta UX: non perdere il contesto).
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutStore (getScheda/updateScheda/groupByMacro), SessionService,
 *     ToastService, MUSCLE_META/ui.constants, ExerciseCard, MusclePicker, Diff.
 *   - CHI CI ARRIVA: home (openScheda), schede.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - saveEdit() RICOSTRUISCE ogni esercizio recuperando muscle/icon
 *     dall'originale per nome: se rinomini un esercizio, quel lookup fallisce e
 *     muscle/icon ricadono ai default. Attenzione modificando questa mappatura.
 *   - flashSaved usa un setTimeout con un solo timer condiviso (flashTimer):
 *     un nuovo cambio resetta il timer precedente (corretto).
 *   - La conferma di eliminazione può essere disattivata dall'utente: la
 *     preferenza vive in PreferencesService (persistita). Se il dialog "non
 *     chiede più conferma", la causa è quella.
 *   - editExs è la bozza: finché non si salva, lo store NON cambia (un back
 *     prima di Salva perde le modifiche, come previsto).
 * ============================================================================
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ACCENT_VAR, KG_QUICK, LEVEL_LABEL, MUSCLE_META, MuscleInfo, REST_QUICK, SET_PRESETS, SetPreset, TILE_CLASS,
} from '../../core/constants/ui.constants';
import { Accent, Scheda } from '../../core/models/workout.models';
import { ExerciseImageService } from '../../core/services/exercise-image.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { DiffComponent } from '../../shared/components/diff/diff.component';
import { ExerciseCardComponent } from '../../shared/components/exercise-card/exercise-card.component';
import { MusclePickerComponent, PickedExercise } from '../../shared/components/muscle-picker/muscle-picker.component';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

interface PickedEx {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  kg: number;
}


@Component({
  selector: 'ff-scheda-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DiffComponent, MusclePickerComponent, ExerciseCardComponent, AppHeaderComponent, ModalComponent],
  templateUrl: './scheda-detail.component.html',
})
export class SchedaDetailComponent {
  readonly w     = inject(WorkoutStore);
  readonly state = inject(SessionService);
  private readonly toast  = inject(ToastService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly imgs   = inject(ExerciseImageService);
  private readonly prefs  = inject(PreferencesService);

  readonly ACCENT_VAR  = ACCENT_VAR;
  readonly TILE_CLASS  = TILE_CLASS;
  readonly LEVEL_LABEL = LEVEL_LABEL;

  readonly ACCENTS: Accent[] = ['amber', 'cyan', 'violet', 'green', 'rose', 'slate'];

  readonly ICONS: string[] = [
    'ti-barbell',         'ti-dumbbell',        'ti-weight',          'ti-stretching',
    'ti-stretching-2',
    'ti-run',             'ti-walk',            'ti-treadmill',       'ti-jump-rope',
    'ti-bike',            'ti-swimming',        'ti-stairs-up',       'ti-mountain',
    'ti-yoga',            'ti-karate',          'ti-gymnastics',      'ti-skateboarding',
    'ti-ski-jumping',     'ti-soccer-field',    'ti-play-basketball', 'ti-play-football',
    'ti-play-volleyball', 'ti-ball-basketball', 'ti-ball-football',   'ti-ball-tennis',
    'ti-ball-volleyball', 'ti-ball-baseball',   'ti-ball-bowling',    'ti-ball-american-football',
    'ti-heart',           'ti-heartbeat',       'ti-activity',        'ti-activity-heartbeat',
    'ti-heart-rate-monitor', 'ti-target',       'ti-target-arrow',    'ti-trophy',
    'ti-medal',           'ti-medal-2',         'ti-flame',           'ti-bolt',
    'ti-trending-up',     'ti-chart-line',      'ti-stopwatch',       'ti-flag',
    'ti-shield',
  ];

  readonly PRESETS = SET_PRESETS;

  private readonly id = this.route.snapshot.paramMap.get('id');

  readonly scheda = computed(() => this.w.getScheda(this.state.viewSchedaId() ?? this.id));

  // ---- Navigazione tra schede (le frecce ai lati dell'hero) ----
  /**
   * Le schede sfogliabili: solo le attive, nell'ordine della libreria — lo
   * stesso che l'utente vede in /schede. Le archiviate restano fuori: sfogliando
   * ci si aspetta ciò che si può fare, non ciò che è scaduto.
   */
  private readonly siblings = computed<Scheda[]>(() =>
    this.w.schede.filter((s) => !s.archived),
  );

  private readonly index = computed(() => {
    const s = this.scheda();
    return s ? this.siblings().findIndex((x) => x.id === s.id) : -1;
  });

  /** La scheda precedente, se c'è (undefined sulla prima). */
  readonly prevScheda = computed<Scheda | undefined>(() => {
    const i = this.index();
    return i > 0 ? this.siblings()[i - 1] : undefined;
  });

  /** La scheda successiva, se c'è (undefined sull'ultima). */
  readonly nextScheda = computed<Scheda | undefined>(() => {
    const i = this.index();
    const list = this.siblings();
    return i >= 0 && i < list.length - 1 ? list[i + 1] : undefined;
  });

  /**
   * Passa a un'altra scheda. Azzera lo stato di vista locale: senza, un
   * accordion aperto o il dialog di avvio sopravvivrebbero al cambio di scheda
   * (il componente viene RIUSATO da Angular quando cambia solo il parametro).
   */
  goScheda(id: string): void {
    this.openEx.set(null);
    this.showDialog.set(false);
    this.state.openScheda(id);
  }

  readonly showDialog = signal<boolean>(this.state.autoStartDialog());

  // ---- Stato modalità modifica ----
  readonly editMode    = signal(false);
  readonly editName    = signal('');
  readonly editIcon    = signal('ti-barbell');
  readonly editAccent  = signal<Accent>('amber');
  readonly editExs     = signal<PickedEx[]>([]);
  readonly editSearch  = signal('');
  readonly openEditEx       = signal<string | null>(null);
  readonly openLibEx        = signal<string | null>(null);
  readonly showAddEx        = signal(false);
  readonly pendingDeleteEx  = signal<string | null>(null);
  readonly deleteCheckbox   = signal(false);
  // Preferenza persistita: se true il dialog non viene più mostrato.
  // La persistenza vive in PreferencesService — il componente legge solo il signal.
  readonly skipDeleteConfirm = this.prefs.skipDeleteConfirm;

  readonly editCardBg = computed(() =>
    `linear-gradient(155deg, ${ACCENT_VAR[this.editAccent()]} -10%, var(--cover-end) 115%)`
  );

  readonly filteredEditLib = computed(() => {
    const q = this.editSearch().toLowerCase().trim();
    return q
      ? this.w.exerciseLib.filter((e) => e.toLowerCase().includes(q))
      : this.w.exerciseLib;
  });

  get totalSets(): number {
    const s = this.scheda();
    return s ? this.w.totalSets(s) : 0;
  }

  badgeClass(tag: string): string {
    return tag === 'In corso' ? 'badge-amber' : tag === 'Veloce' ? 'badge-green' : 'badge-violet';
  }

  /** Metadati (colore identificativo) del gruppo muscolare di un esercizio. */
  metaFor(name: string): MuscleInfo | undefined {
    const id = this.w.muscleIdForExercise(name);
    return id ? MUSCLE_META[id] : undefined;
  }

  // ---- Accordion esercizi in SOLA LETTURA (vista dettaglio, non modifica) ----
  /** Nome dell'esercizio attualmente espanso nella lista read-only (null = chiuso). */
  readonly openEx = signal<string | null>(null);
  /** GIF non disponibili/rotte: l'esercizio qui dentro non mostra l'immagine. */
  private readonly failedGif = signal<Set<string>>(new Set());

  /** Apre/chiude il pannello read-only dell'esercizio (uno solo aperto per volta). */
  toggleEx(name: string): void {
    this.openEx.set(this.openEx() === name ? null : name);
  }

  /** URL della GIF dell'esercizio, o null se assente/rotta. */
  gifUrl(name: string): string | null {
    if (this.failedGif().has(name)) return null;
    return this.imgs.getGifUrl(name);
  }

  /** Una GIF non è caricabile → la nascondiamo per quell'esercizio. */
  onGifError(name: string): void {
    this.failedGif.update((s) => new Set(s).add(name));
  }

  /** Raggruppa una lista di esercizi in Upper / Lower Body (logica centralizzata). */
  groupEx<T extends { name: string }>(items: T[]) {
    return this.w.groupByMacro(items, (e) => e.name);
  }

  heroBg(accent: Accent): string {
    return `linear-gradient(160deg, ${this.ACCENT_VAR[accent]}22 0%, transparent 60%)`;
  }

  back(): void {
    void this.router.navigate(['/schede']);
  }

  toggleFav(): void {
    this.state.fav.set(!this.state.fav());
  }

  // ---- Modifica scheda ----

  enterEditMode(): void {
    const s = this.scheda();
    if (!s) return;
    this.editName.set(s.name);
    this.editIcon.set(s.icon);
    this.editAccent.set(s.accent);
    this.editExs.set(s.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, rest: e.rest, kg: e.kg ?? 0 })));
    this.openEditEx.set(null);
    this.openLibEx.set(null);
    this.showAddEx.set(false);
    this.editSearch.set('');
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  saveEdit(): void {
    const s = this.scheda();
    if (!s || !this.editName().trim()) return;
    const updated: Scheda = {
      ...s,
      name:     this.editName().trim(),
      icon:     this.editIcon(),
      accent:   this.editAccent(),
      duration: Math.max(20, this.editExs().length * 6 + 10),
      exercises: this.editExs().map((e) => ({
        name:   e.name,
        sets:   e.sets,
        reps:   e.reps,
        rest:   e.rest,
        kg:     e.kg,
        muscle: s.exercises.find((ex) => ex.name === e.name)?.muscle ?? '',
        icon:   s.exercises.find((ex) => ex.name === e.name)?.icon ?? 'ti-barbell',
      })),
    };
    this.w.updateScheda(updated);
    this.toast.show('Scheda aggiornata!', 'ti-circle-check-filled');
    this.editMode.set(false);
  }

  onEditName(e: Event): void {
    this.editName.set((e.target as HTMLInputElement).value);
  }

  onEditSearch(e: Event): void {
    this.editSearch.set((e.target as HTMLInputElement).value);
  }

  // Accordion esercizi già nella scheda
  toggleEditEx(name: string): void {
    this.openEditEx.set(this.openEditEx() === name ? null : name);
  }

  // Accordion libreria (aggiunta nuovi esercizi)
  toggleLibEx(name: string): void {
    if (this.isEditAdded(name)) return; // già presente, non aprire
    this.openLibEx.set(this.openLibEx() === name ? null : name);
  }

  selectEditPreset(exName: string, p: SetPreset): void {
    const idx = this.editExs().findIndex((e) => e.name === exName);
    if (idx >= 0) {
      this.editExs.update((list) =>
        list.map((e, i) => i === idx ? { ...e, sets: p.sets, reps: p.reps, rest: p.rest } : e)
      );
      // Modifica live: il pannello resta aperto, feedback inline (no auto-chiusura).
      this.flashSaved(exName);
    } else {
      this.editExs.update((list) => [...list, { name: exName, sets: p.sets, reps: p.reps, rest: p.rest, kg: 0 }]);
      this.openLibEx.set(null);
    }
  }

  requestDeleteEx(name: string): void {
    if (this.skipDeleteConfirm()) {
      this.removeEditEx(name);
    } else {
      this.deleteCheckbox.set(false);
      this.pendingDeleteEx.set(name);
    }
  }

  confirmDeleteEx(): void {
    if (this.deleteCheckbox()) {
      this.prefs.setSkipDeleteConfirm(true);
    }
    const name = this.pendingDeleteEx();
    if (name) this.removeEditEx(name);
    this.pendingDeleteEx.set(null);
  }

  cancelDeleteEx(): void {
    this.pendingDeleteEx.set(null);
  }

  onDeleteCheckbox(e: Event): void {
    this.deleteCheckbox.set((e.target as HTMLInputElement).checked);
  }

  removeEditEx(name: string): void {
    this.editExs.update((list) => list.filter((e) => e.name !== name));
    if (this.openEditEx() === name) this.openEditEx.set(null);
  }

  isEditAdded(name: string): boolean {
    return this.editExs().some((e) => e.name === name);
  }

  getEditAdded(name: string): PickedEx | undefined {
    return this.editExs().find((e) => e.name === name);
  }

  readonly KG_QUICK = KG_QUICK;
  readonly REST_QUICK = REST_QUICK;

  adjustEditExKg(exName: string, delta: number): void {
    this.editExs.update((list) =>
      list.map((e) => e.name === exName ? { ...e, kg: Math.max(0, e.kg + delta) } : e)
    );
    this.flashSaved(exName);
  }

  setEditExKg(exName: string, kg: number): void {
    this.editExs.update((list) =>
      list.map((e) => e.name === exName ? { ...e, kg } : e)
    );
    this.flashSaved(exName);
  }

  adjustEditExRest(exName: string, delta: number): void {
    this.editExs.update((list) =>
      list.map((e) => e.name === exName ? { ...e, rest: Math.max(0, e.rest + delta) } : e)
    );
    this.flashSaved(exName);
  }

  setEditExRest(exName: string, rest: number): void {
    this.editExs.update((list) =>
      list.map((e) => e.name === exName ? { ...e, rest } : e)
    );
    this.flashSaved(exName);
  }

  // ---- Feedback "✓ Aggiornato" (lampeggia nel pannello aperto) ----
  readonly flashEx = signal<string | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  /** Mostra il pill di conferma per ~1.3s sull'esercizio modificato. */
  private flashSaved(exName: string): void {
    this.flashEx.set(exName);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashEx.set(null), 1300);
  }

  onMusclePicked(ex: PickedExercise): void {
    const idx = this.editExs().findIndex((e) => e.name === ex.name);
    if (idx >= 0) {
      this.editExs.update((list) => list.map((e, i) => i === idx ? ex : e));
    } else {
      this.editExs.update((list) => [...list, ex]);
    }
  }
}
