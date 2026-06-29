/**
 * ============================================================================
 *  FILE: onboarding.component.ts  —  PRIMO ACCESSO / POSIZIONAMENTO (sez. K)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Questionario breve di primo accesso (~6 tap) che raccoglie esperienza,
 *   frequenza, obiettivo e pochi dati corporei, poi calcola LIVELLO e XP di
 *   partenza (calibrazione, non ricompensa) tramite la logica pura `positioning`.
 *
 * FLUSSO
 *   Wizard a step gestito con signal + event binding (stesso approccio leggero
 *   di new-scheda). Lo step finale mostra in anteprima il posizionamento, vivo e
 *   reattivo; il CTA conferma → GamificationService.applyOnboarding() scrive nel
 *   profilo e instrada alla Home. "Salta" parte da livello 1 (rinviabile).
 *
 * COERENZA UI
 *   Riusa il linguaggio visivo dell'app: appbar, barra di avanzamento a step,
 *   card-opzione con tile colorate (TILE_CLASS/ACCENT_VAR), CTA sticky.
 * ============================================================================
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ACCENT_VAR, TILE_CLASS } from '../../core/constants/ui.constants';
import { Accent } from '../../core/models/workout.models';
import { GamificationService } from '../../core/gamification/gamification.service';
import { levelInfoForXp } from '../../core/gamification/level-curve';
import {
  Experience, Frequency, Goal, OnboardingInput, Sex, positioningFor,
} from '../../core/gamification/positioning';
import { WorkoutStore } from '../../core/services/workout-store.service';

/** Opzione selezionabile a card (esperienza/frequenza/obiettivo). */
interface Opt<T> {
  v: T;
  ic: string;
  tile: Accent;
  t: string;
  s: string;
}

@Component({
  selector: 'ff-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.component.html',
  styles: [':host{display:flex;flex-direction:column;flex:1;min-height:0}'],
})
export class OnboardingComponent {
  private readonly gami = inject(GamificationService);
  private readonly router = inject(Router);
  readonly w = inject(WorkoutStore);
  readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS = TILE_CLASS;

  /** Etichette degli step (l'ultimo è la sintesi del posizionamento). */
  readonly steps = ['Benvenuto', 'Esperienza', 'Frequenza', 'Obiettivo', 'I tuoi dati', 'Posizionamento'];
  readonly step = signal<number>(0);

  // ---- Risposte ----
  readonly experience = signal<Experience | null>(null);
  readonly frequency = signal<Frequency | null>(null);
  readonly goal = signal<Goal | null>(null);
  readonly sex = signal<Sex>('na');
  readonly age = signal<number>(28);
  readonly weight = signal<number>(72);
  readonly height = signal<number>(175);
  readonly hasPT = signal<boolean>(false);

  // ---- Cataloghi opzioni ----
  readonly experiences: Opt<Experience>[] = [
    { v: 'never',  ic: 'ti-seeding',       tile: 'green',  t: 'Mai allenato',     s: 'Si parte da zero, alla grande' },
    { v: 'lt1',    ic: 'ti-flame',         tile: 'amber',  t: 'Meno di 1 anno',   s: 'Hai già rotto il ghiaccio' },
    { v: '1to3',   ic: 'ti-bolt',          tile: 'cyan',   t: '1 – 3 anni',       s: 'Hai una buona base' },
    { v: '3plus',  ic: 'ti-trophy',        tile: 'violet', t: '3+ anni',          s: 'Sei un veterano' },
  ];
  readonly frequencies: Opt<Frequency>[] = [
    { v: '0',      ic: 'ti-bed',           tile: 'slate',  t: 'Quasi mai',        s: 'Ricominciamo con calma' },
    { v: '1-2',    ic: 'ti-calendar',      tile: 'cyan',   t: '1 – 2 a settimana', s: 'Un buon punto di partenza' },
    { v: '3-4',    ic: 'ti-calendar-check', tile: 'green', t: '3 – 4 a settimana', s: 'Il ritmo ideale' },
    { v: '5plus',  ic: 'ti-flame-filled',  tile: 'amber',  t: '5+ a settimana',   s: 'Macchina da guerra' },
  ];
  readonly goals: Opt<Goal>[] = [
    { v: 'dimagrimento', ic: 'ti-flame',   tile: 'rose',   t: 'Dimagrimento',     s: 'Bruciare e definire' },
    { v: 'forza',        ic: 'ti-barbell', tile: 'amber',  t: 'Forza e massa',    s: 'Diventare più forte' },
    { v: 'benessere',    ic: 'ti-heart',   tile: 'green',  t: 'Benessere',        s: 'Stare bene, sentirsi meglio' },
    { v: 'performance',  ic: 'ti-bolt',    tile: 'cyan',   t: 'Performance',      s: 'Spingere i tuoi limiti' },
  ];
  readonly sexes: { v: Sex; t: string }[] = [
    { v: 'm', t: 'Uomo' },
    { v: 'f', t: 'Donna' },
    { v: 'na', t: 'Altro' },
  ];

  /** Accento per colorare il tier nello step di sintesi (per indice tier).
   *  Solo accenti con variante `badge-*` disponibile (niente slate). */
  private readonly TIER_ACCENT: Accent[] = ['green', 'cyan', 'violet', 'rose', 'amber', 'green', 'cyan', 'amber'];

  /** Dati correnti del questionario in forma di input per il motore. */
  private input(): OnboardingInput {
    return {
      experience: this.experience() ?? 'never',
      frequency: this.frequency() ?? '0',
      goal: this.goal() ?? 'benessere',
      sex: this.sex(),
      age: this.age(),
      weight: this.weight(),
      height: this.height(),
      hasPT: this.hasPT(),
    };
  }

  /** Anteprima reattiva del posizionamento (livello/tier/XP/obiettivo). */
  readonly preview = computed(() => positioningFor(this.input()));
  /** Barra di avanzamento del livello assegnato (riempimento parziale). */
  readonly levelInfo = computed(() => levelInfoForXp(this.preview().xp));
  /** Accento del tier di destinazione. */
  readonly tierAccent = computed<Accent>(() => this.TIER_ACCENT[this.preview().tier.index - 1] ?? 'amber');

  /** Validazione per step: blocca l'avanzamento finché non si è risposto. */
  readonly canNext = computed(() => {
    switch (this.step()) {
      case 1: return this.experience() !== null;
      case 2: return this.frequency() !== null;
      case 3: return this.goal() !== null;
      case 4: return this.age() > 0 && this.weight() > 0 && this.height() > 0;
      default: return true;
    }
  });

  // ---- Navigazione ----
  next(): void {
    if (this.step() >= this.steps.length - 1) {
      this.complete();
      return;
    }
    this.step.update((s) => s + 1);
  }

  back(): void {
    if (this.step() === 0) {
      this.skip();
      return;
    }
    this.step.update((s) => s - 1);
  }

  /** Conferma il posizionamento e avvia il percorso. */
  complete(): void {
    this.gami.applyOnboarding(this.input());
    void this.router.navigateByUrl('/home');
  }

  /** Salta l'onboarding: parte da livello 1, si affina col tempo. */
  skip(): void {
    this.gami.skipOnboarding();
    void this.router.navigateByUrl('/home');
  }

  // ---- Setter da input numerici ----
  onNum(sig: 'age' | 'weight' | 'height', e: Event): void {
    const val = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
    if (sig === 'age') this.age.set(val);
    else if (sig === 'weight') this.weight.set(val);
    else this.height.set(val);
  }
}
