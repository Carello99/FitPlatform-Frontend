/**
 * ============================================================================
 *  FILE: exercise-card.component.ts  —  CARD ESERCIZIO (UI standard delle liste)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   È la riga-esercizio UFFICIALE riusata in OGNI lista dell'app (dettaglio
 *   scheda, allenamento attivo, recap, picker...). Centralizzarla garantisce
 *   che tutte le liste abbiano lo stesso aspetto e la stessa identità di colore
 *   per gruppo muscolare. È l'UNICO punto in cui cambiare lo stile delle liste.
 *
 * COSA RAPPRESENTA / COMUNICAZIONE
 *   Componente "dumb" guidato da @Input. Deriva da `name` il gruppo muscolare e
 *   quindi il colore (via WorkoutStore + MUSCLE_META). Espone uno slot
 *   <ng-content> in coda per contenuto extra (badge recupero, pulsante rimuovi).
 *
 * FLUSSO DEI DATI
 *   name → muscleIdForExercise() → MUSCLE_META → color/soft/label → stile della
 *   card (barra laterale colorata, sfondo soft, badge gruppo, nome colorato).
 *   statsLine compone "3 × 12 · 60 kg · 90s rec." usando solo le parti fornite.
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutStore (muscleIdForExercise), ExerciseImageService (GIF opzionale),
 *     MUSCLE_META (colori). CHI LO USA: scheda-detail, active-workout,
 *     summary, muscle-picker, ...  → modifiche qui impattano molte schermate.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - Variante: 'full' (sfondo tinto, badge pieno) vs 'subtle' (allenamento
 *     attivo, niente sfondo invasivo). Aspetto "sbagliato"? Controlla `variant`.
 *   - Input `active`: serve a FONDERE la card con un pannello aperto sotto (vedi
 *     accordion in scheda-detail): toglie bordo/raggio così il contenitore
 *     esterno disegna bordo + barra colorata continui.
 *   - Se manca il colore/gruppo, l'esercizio non è mappato in exercisesByMuscle:
 *     fallback a var(--ink-3) e label '—' (non è un crash).
 * ============================================================================
 */

import {
  ChangeDetectionStrategy, Component, Input, inject, signal,
} from '@angular/core';
import { MUSCLE_META, MuscleInfo } from '../../../core/constants/ui.constants';
import { ExerciseImageService } from '../../../core/services/exercise-image.service';
import { WorkoutStore } from '../../../core/services/workout-store.service';

/**
 * Card esercizio — standard UI ufficiale per OGNI lista di esercizi nell'app.
 *
 * Identità di colore del gruppo muscolare:
 *  - barra laterale (left border) nel colore del gruppo;
 *  - sfondo soft coerente col gruppo;
 *  - badge gruppo pieno (testo bianco);
 *  - nome esercizio evidenziato con lo stesso colore.
 *
 * I colori sono token CSS (`var(--x)` / `var(--x-soft)`) → coerenti con
 * dark/light mode. Unico punto in cui modificare lo stile delle liste.
 *
 * Varianti:
 *  - `full`   → sfondo tinto + barra + badge pieno (liste, recap, modifica).
 *  - `subtle` → niente sfondo invasivo, badge contornato (allenamento attivo).
 *
 * Slot `<ng-content>`: contenuto in coda (badge recupero, pulsante rimuovi…).
 */
@Component({
  selector: 'ff-exercise-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exercise-card.component.html',
  styleUrl: './exercise-card.component.scss',
})
export class ExerciseCardComponent {
  private readonly w    = inject(WorkoutStore);
  private readonly imgs = inject(ExerciseImageService);

  /** Nome esercizio: da qui si ricava il gruppo muscolare e il colore. */
  @Input({ required: true }) name = '';
  /** Override esplicito del gruppo muscolare (se non derivabile dal nome). */
  @Input() muscleId: string | null = null;
  /** Numero progressivo (0-based) opzionale; null = nascosto. */
  @Input() index: number | null = null;
  @Input() sets: number | null | undefined = null;
  @Input() reps: string | number | null | undefined = null;
  @Input() kg: number | null | undefined = null;
  @Input() rest: number | null | undefined = null;
  /** 'full' (default) o 'subtle' per l'allenamento attivo. */
  @Input() variant: 'full' | 'subtle' = 'full';
  /**
   * Card "fusa" con un pannello sottostante (accordion aperto): rimuove
   * bordo/raggio propri così il contenitore esterno fornisce bordo + rail
   * colorato continui su tutta l'altezza (card + pannello = un blocco unico).
   */
  @Input() active = false;
  /** Mostra la GIF dell'esercizio come elemento leading. */
  @Input() showGif = false;
  /** Lato (px) della GIF leading. */
  @Input() gifSize = 46;

  private readonly failedImg = signal(false);

  /** Metadati del gruppo muscolare (derivati da name o muscleId). */
  metaInfo(): MuscleInfo | undefined {
    const id = this.muscleId ?? this.w.muscleIdForExercise(this.name);
    return id ? MUSCLE_META[id] : undefined;
  }

  get color(): string {
    return this.metaInfo()?.color ?? 'var(--ink-3)';
  }
  get soft(): string {
    return this.metaInfo()?.soft ?? 'var(--surface-2)';
  }
  get groupLabel(): string | null {
    return this.metaInfo()?.label ?? null;
  }

  /** Riga statistiche: "3 × 12 · 60 kg · 90s rec." con solo le parti fornite. */
  get statsLine(): string {
    const parts: string[] = [];
    if (this.sets != null && this.reps != null) parts.push(`${this.sets} × ${this.reps}`);
    else if (this.reps != null) parts.push(`${this.reps} reps`);
    if (this.kg != null && this.kg > 0) parts.push(`${this.kg} kg`);
    if (this.rest != null) parts.push(`${this.rest}s rec.`);
    return parts.join(' · ');
  }

  get gifUrl(): string | null {
    return this.showGif && !this.failedImg() ? this.imgs.getGifUrl(this.name) : null;
  }
  onImgError(): void {
    this.failedImg.set(true);
  }
}
