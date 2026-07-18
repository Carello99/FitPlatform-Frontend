/**
 * ============================================================================
 *  FILE: workout-detail.component.ts  —  RIEPILOGO DI UN ALLENAMENTO SVOLTO
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Mostra com'è andato UN allenamento del passato: quando, quanto è durato,
 *   cosa hai fatto esercizio per esercizio, dove hai battuto un record.
 *   Da qui si rifà quello stesso allenamento.
 *
 * PERCHÉ ESISTE / QUALE PROBLEMA RISOLVE
 *   Lo Storico elencava numeri senza profondità: la card diceva "6 esercizi" ma
 *   non quali. Il riepilogo è il posto dove quei numeri diventano una sessione.
 *
 * COSA RAPPRESENTA IN ANGULAR
 *   Feature sulla rotta /allenamento/:id. È il gemello "passato" di
 *   scheda-detail (/scheda/:id) e ne ripete il linguaggio visivo NON per
 *   analogia ma per identità: hero compatto (icona nella barra alta, identità
 *   centrata fra le frecce, riga meta) + lista esercizi ad accordion con GIF +
 *   CTA sticky. Le regole `.sd-*` vivono in styles/_components.scss perché sono
 *   le stesse delle due schermate.
 *
 * FLUSSO DEI DATI
 *   :id (paramMap REATTIVO) → store.history.find(id) → HistoryItem.
 *   "Rifai" → cerca la Scheda per NOME → SessionService.openScheda(id, true).
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - L'id arriva da un signal sul paramMap, non da snapshot: le frecce
 *     prev/next navigano sulla STESSA rotta e Angular riusa il componente, con
 *     lo snapshot il contenuto resterebbe fermo sul primo allenamento aperto.
 *   - Le voci di storico prodotte prima dell'introduzione di `exercises` non ne
 *     hanno: la lista degenera in un messaggio, non in un crash.
 *   - "Rifai" compare solo se la scheda esiste ancora (match per nome): meglio
 *     nessun tasto che un tasto che apre la scheda sbagliata.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ACCENT_VAR, MUSCLE_META, MuscleInfo, TILE_CLASS } from '../../core/constants/ui.constants';
import { Accent, HistoryItem, Scheda } from '../../core/models/workout.models';
import { ExerciseImageService } from '../../core/services/exercise-image.service';
import { SessionService } from '../../core/services/session.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { ExerciseCardComponent } from '../../shared/components/exercise-card/exercise-card.component';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

@Component({
  selector: 'ff-workout-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExerciseCardComponent, AppHeaderComponent],
  templateUrl: './workout-detail.component.html',
  styleUrl: './workout-detail.component.scss',
})
export class WorkoutDetailComponent {
  readonly w = inject(WorkoutStore);
  private readonly state = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly imgs = inject(ExerciseImageService);

  // ACCENT_VAR è privato: dopo la rimozione del blob decorativo lo usa solo
  // heroBg(), non il template (ARCHITECTURE §10).
  private readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS = TILE_CLASS;

  /** L'id della rotta come signal: cambia anche quando il componente è riusato. */
  private readonly id = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly workout = computed<HistoryItem | undefined>(() =>
    this.w.history.find((h) => h.id === this.id().get('id')),
  );

  // ---- Navigazione tra allenamenti (le frecce ai lati dell'hero) ----
  /**
   * Le voci sfogliabili: lo storico nell'ordine in cui lo si vede nel tab
   * Allenamenti (dal più recente). Solo quelle con id: senza, non esiste una
   * rotta a cui navigare.
   */
  private readonly siblings = computed<HistoryItem[]>(() =>
    this.w.history.filter((h) => !!h.id),
  );

  private readonly index = computed(() => {
    const h = this.workout();
    return h ? this.siblings().findIndex((x) => x.id === h.id) : -1;
  });

  /** L'allenamento più recente di questo, se c'è. */
  readonly prevWorkout = computed<HistoryItem | undefined>(() => {
    const i = this.index();
    return i > 0 ? this.siblings()[i - 1] : undefined;
  });

  /** L'allenamento più vecchio di questo, se c'è. */
  readonly nextWorkout = computed<HistoryItem | undefined>(() => {
    const i = this.index();
    const list = this.siblings();
    return i >= 0 && i < list.length - 1 ? list[i + 1] : undefined;
  });

  /**
   * Passa a un altro allenamento. Azzera l'accordion aperto: senza, il pannello
   * di un esercizio sopravvivrebbe al cambio di sessione (Angular RIUSA il
   * componente quando cambia solo il parametro della rotta).
   */
  goWorkout(id: string): void {
    this.openEx.set(null);
    void this.router.navigate(['/allenamento', id]);
  }

  /** La scheda usata, se esiste ancora: abilita "Rifai". */
  readonly scheda = computed<Scheda | undefined>(() => {
    const h = this.workout();
    return h ? this.w.schede.find((s) => s.name === h.name && !s.archived) : undefined;
  });

  /** "mercoledì 15 luglio · 07:40" — il quando, per esteso: qui c'è spazio. */
  readonly when = computed(() => {
    const h = this.workout();
    if (!h) return '';
    const d = new Date(h.dateIso + 'T00:00:00');
    return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} · ${h.time}`;
  });

  /**
   * Le serie davvero completate. Il dettaglio scheda mostra le serie PIANIFICATE
   * nella stessa posizione: qui il numero è quello svolto, e la riga meta si
   * legge come la gemella al futuro.
   */
  readonly totalSets = computed(() =>
    (this.workout()?.exercises ?? []).reduce((tot, e) => tot + e.sets, 0),
  );

  // ---- Accordion esercizi (identico al dettaglio scheda, sola lettura) ----
  /** Nome dell'esercizio attualmente espanso (null = tutti chiusi). */
  readonly openEx = signal<string | null>(null);
  /** GIF non disponibili/rotte: l'esercizio qui dentro non mostra l'immagine. */
  private readonly failedGif = signal<Set<string>>(new Set());

  toggleEx(name: string): void {
    this.openEx.set(this.openEx() === name ? null : name);
  }

  /** URL della GIF dell'esercizio, o null se assente/rotta. */
  gifUrl(name: string): string | null {
    if (this.failedGif().has(name)) return null;
    return this.imgs.getGifUrl(name);
  }

  onGifError(name: string): void {
    this.failedGif.update((s) => new Set(s).add(name));
  }

  /** Metadati (colore identificativo) del gruppo muscolare di un esercizio. */
  metaFor(name: string): MuscleInfo | undefined {
    const id = this.w.muscleIdForExercise(name);
    return id ? MUSCLE_META[id] : undefined;
  }

  /** Raggruppa gli esercizi in Upper / Lower Body (logica centralizzata). */
  groupEx<T extends { name: string }>(items: T[]) {
    return this.w.groupByMacro(items, (e) => e.name);
  }

  heroBg(accent: Accent): string {
    return `linear-gradient(160deg, ${this.ACCENT_VAR[accent]}22 0%, transparent 60%)`;
  }

  back(): void {
    void this.router.navigate(['/schede'], { queryParams: { tab: 'allenamenti' } });
  }

  /** Riapre la scheda di quell'allenamento con il dialog di avvio già aperto. */
  repeat(): void {
    const s = this.scheda();
    if (s) this.state.openScheda(s.id, true);
  }
}
