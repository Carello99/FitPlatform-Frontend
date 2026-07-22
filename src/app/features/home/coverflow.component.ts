/**
 * ============================================================================
 *  FILE: coverflow.component.ts  —  CAROSELLO 3D "Cover Flow" delle schede
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Mostra le schede come un carosello in stile iTunes Cover Flow, con drag,
 *   frecce e effetti 3D. È il fulcro visivo della Home.
 *
 * COSA RAPPRESENTA / COMUNICAZIONE
 *   Componente "dumb" (nessun servizio iniettato). Riceve [schede]/[activeId] dal
 *   padre (HomeComponent) ed emette (open) per il dettaglio e (start) per avviare
 *   l'allenamento della carta centrale. Stato interno (carta corrente) via signal.
 *
 * LIFECYCLE
 *   ngOnChanges: usato UNA sola volta per posizionare il carosello sulla scheda
 *   `activeId` al primo arrivo dei dati (flag `inited` evita riposizionamenti
 *   successivi mentre l'utente naviga).
 *
 * PUNTI CRITICI PER IL DEBUGGING (qui si annida la complessità!)
 *   - rel(i): offset CIRCOLARE con segno della carta i rispetto al centro. Tutta
 *     la grafica 3D (transform/zIndex/visibilità) deriva da questo.
 *   - "Teleporting": quando una carta wrappa ai bordi dell'anello (|Δrel|>n/2) la
 *     CSS transition la animerebbe nel verso SBAGLIATO. Si disattiva la
 *     transition (transition:none) finché lo spostamento istantaneo non è stato
 *     disegnato, poi la si riattiva. Vedi _markWrapping/_scheduleSettle.
 *   - DOPPIO requestAnimationFrame in _scheduleSettle: NECESSARIO. Con un solo
 *     rAF la carta "vola" attraverso lo schermo (bug dello scroll non lineare).
 *   - settleToken: durante swipe rapidi assicura che solo l'ULTIMO ripristino
 *     azzeri `teleporting`. Non rimuoverlo.
 *   - Drag: SOLO Pointer Events (no Touch Events) per non far scattare il gesto
 *     due volte su mobile (causa di doppi `step` / carte saltate).
 * ============================================================================
 */

// ChangeDetectionStrategy, Component: basi di qualsiasi componente Angular
// Input: decorator per le proprietà passate dal componente padre
// Output: decorator per gli eventi emessi verso il componente padre
// EventEmitter: classe per emettere eventi (@Output)
// signal: segnale reattivo locale al componente
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { ACCENT_VAR, TILE_CLASS } from '../../core/constants/ui.constants';
import { Scheda } from '../../core/models/workout.models';

/**
 * Componente presentazionale (no servizi iniettati) che mostra un carosello
 * in stile "Cover Flow" di iTunes.
 *
 * Funzionalità:
 * - Trascinamento (drag) touch/mouse
 * - Navigazione con frecce
 * - Tap su carta laterale → porta quella carta al centro
 * - Tap sulla carta centrale → emette evento `start`
 * - Effetti 3D CSS (perspective, rotateY, translateZ)
 *
 * Comunicazione con il componente padre (HomeComponent):
 * - Riceve: @Input schede, activeId
 * - Emette: @Output open (naviga al dettaglio), start (apre dialog di avvio)
 */
@Component({
  selector: 'ff-coverflow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [], // Nessun componente figlio — solo HTML puro
  templateUrl: './coverflow.component.html',
  styleUrl: './coverflow.component.scss',
})
export class CoverflowComponent {
  // @Input({ required: true }): proprietà OBBLIGATORIA ricevuta dal padre.
  // Se il padre non la passa, TypeScript/Angular darà un errore.
  @Input({ required: true }) schede: Scheda[] = [];

  // @Input(): proprietà opzionale ricevuta dal padre
  @Input() activeId: string | null = null;

  // @Output(): eventi emessi verso il padre.
  // EventEmitter<T>: T è il tipo del valore emesso con .emit(valore)
  @Output() open = new EventEmitter<string>();  // emette l'ID della scheda
  @Output() start = new EventEmitter<Scheda>(); // emette l'oggetto scheda

  // Signal locale: indice della carta al centro del carosello
  readonly cur = signal<number>(0);

  // Stato per il drag: coordinata X di partenza e flag "il dito si è mosso"
  private dragX: number | null = null;
  private moved = false;

  // Costanti UI per il template
  readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS = TILE_CLASS;

  // Flag per inizializzare il carosello solo una volta
  private inited = false;

  /**
   * Indici delle carte che si stanno "teletrasportando" (cambio di posizione istantaneo).
   *
   * Problema: con n carte il valore `rel` è circolare. Quando cur avanza e una carta
   * passa da rel=-1 a rel=+2 (salto di +3), la CSS transition la anima verso DESTRA
   * mentre tutte le altre vanno a sinistra → animazione sbagliata.
   *
   * Soluzione: prima di cambiare cur, rileva quali carte "wrappano" (|Δrel| > n/2).
   * Quelle carte ricevono `transition:none` finché lo spostamento istantaneo non è
   * stato disegnato dal browser; poi la transition viene ripristinata (vedi
   * `_scheduleSettle`, che usa un DOPPIO requestAnimationFrame).
   */
  private readonly teleporting = signal<ReadonlySet<number>>(new Set());

  /**
   * Token incrementale: garantisce che, durante uno swipe rapido con più `step`
   * consecutivi, SOLO l'ultimo ripristino azzeri `teleporting`. Senza questo, un
   * vecchio requestAnimationFrame riattiverebbe la transition mentre nuove carte
   * stanno ancora wrappando → effetto "salto" / scorrimento non lineare.
   */
  private settleToken = 0;

  // ngOnChanges: lifecycle hook chiamato ogni volta che un @Input cambia.
  // Qui lo usiamo per impostare la carta iniziale (quella con activeId) solo al primo cambio.
  ngOnChanges(): void {
    if (!this.inited && this.schede.length) {
      const k = this.schede.findIndex((s) => s.id === this.activeId);
      this.cur.set(k < 0 ? 0 : k);
      this.inited = true;
    }
  }

  /** Getter: la scheda attualmente al centro del carosello. */
  get center(): Scheda {
    return this.schede[this.cur()];
  }

  /** Colore del NOME sotto il carosello: l'accento della scheda centrale,
   *  mixato con una tinta theme-aware (token). In tema scuro accento schiarito
   *  (verso il bianco); in tema chiaro accento molto scuro. Cambia con la scheda
   *  e la transizione CSS rende morbido lo swipe. */
  get nameColor(): string {
    return `color-mix(in srgb, ${this.ACCENT_VAR[this.center.accent]} var(--cover-name-amt), var(--cover-name-tint))`;
  }

  /** Calcola le serie totali di una scheda. */
  totalSets(s: Scheda): number {
    return s.exercises.reduce((a, e) => a + e.sets, 0);
  }

  /**
   * Offset relativo (con segno) della carta i rispetto al centro.
   * Usa l'aritmetica del modulo per un anello circolare.
   * 0 = centro, 1 = una a destra, -1 = una a sinistra, ecc.
   */
  private rel(i: number): number {
    const n = this.schede.length;
    let r = (((i - this.cur()) % n) + n) % n; // Modulo sempre positivo
    if (r > n / 2) {
      r -= n; // Converti in offset con segno (più corto)
    }
    return r;
  }

  /** Sposta il carosello di `dir` posizioni (+1 avanti, -1 indietro). */
  step(dir: number): void {
    const n = this.schede.length;
    const next = (this.cur() + dir + n) % n;
    // Segna (in UNIONE) le carte che wrappano PRIMA di aggiornare cur
    this._markWrapping(next);
    this.cur.set(next);
    // Ripristina la transition solo dopo che il teletrasporto è stato disegnato
    this._scheduleSettle();
  }

  /** Gestisce il tap su una carta: centra la carta laterale o emette `start` per quella centrale. */
  focus(i: number): void {
    if (this.moved) {
      return; // Ignora il tap se si trattava di un drag
    }
    if (this.rel(i) === 0) {
      this.start.emit(this.schede[i]); // Carta centrale → apri dialog avvio
    } else {
      // Anche il focus può causare wrap (es. click su rel=2 con n=4)
      this._markWrapping(i);
      this.cur.set(i);
      this._scheduleSettle();
    }
  }

  /**
   * Calcola gli indici delle carte il cui `rel` cambierebbe di più di n/2 passando a `next`.
   * Queste carte "wrappano" circolarmente e devono teletrasportarsi senza animazione.
   */
  private _wrapSet(next: number): ReadonlySet<number> {
    const n = this.schede.length;
    const tele = new Set<number>();
    for (let i = 0; i < n; i++) {
      const oldRel = this.rel(i);
      // Calcola il nuovo rel come farebbe rel() ma con `next` come centro
      let r = (((i - next) % n) + n) % n;
      if (r > n / 2) r -= n;
      // Se il rel salta di più di n/2, la CSS transition andrebbe nella direzione sbagliata
      if (Math.abs(r - oldRel) > n / 2) tele.add(i);
    }
    return tele;
  }

  /**
   * Aggiunge (in UNIONE) all'insieme `teleporting` le carte che wrappano passando
   * a `next`. L'unione (invece della sostituzione) è fondamentale durante gli swipe
   * rapidi: se due step avvengono ravvicinati, le carte del primo non devono
   * "scongelarsi" prima che anche il secondo si sia stabilizzato.
   */
  private _markWrapping(next: number): void {
    const wraps = this._wrapSet(next);
    if (!wraps.size) return;
    this.teleporting.update((prev) => {
      const s = new Set(prev);
      wraps.forEach((i) => s.add(i));
      return s;
    });
  }

  /**
   * Ripristina la transition SOLO dopo che lo stato "teletrasportato" è stato
   * effettivamente disegnato dal browser.
   *
   * Perché un DOPPIO requestAnimationFrame?
   * - Il primo rAF viene eseguito PRIMA del paint in cui le carte vengono
   *   riposizionate con transition:none.
   * - Solo dopo quel paint (cioè al secondo rAF) possiamo riattivare la
   *   transition senza che la carta animi nella direzione sbagliata.
   *
   * Con un SINGOLO rAF (come nella versione precedente) `teleporting` veniva
   * azzerato prima del paint → la carta "volava" attraverso lo schermo: è
   * esattamente il bug dello scorrimento non lineare / carte che saltano.
   *
   * Il token assicura che durante swipe con più step consecutivi solo l'ultimo
   * ripristino venga effettivamente eseguito.
   */
  private _scheduleSettle(): void {
    const token = ++this.settleToken;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (token === this.settleToken) {
          this.teleporting.set(new Set());
        }
      })
    );
  }

  /**
   * Transition CSS per la carta i.
   * Le carte in `teleporting` ricevono 'none' → spostamento istantaneo senza
   * animare nella direzione sbagliata; le altre animano normalmente.
   */
  cardTransition(i: number): string {
    return this.teleporting().has(i)
      ? 'none'
      : 'transform 0.5s cubic-bezier(.16,1,.3,1), opacity 0.45s';
  }

  // ---- Funzioni di trasformazione 3D CSS ----
  // Queste funzioni calcolano le trasformazioni CSS per ogni carta
  // in base alla sua distanza dal centro (rel)

  /** Trasformazione CSS 3D per la carta i. */
  cardTransform(i: number): string {
    const rel = this.rel(i);
    const abs = Math.abs(rel);
    const sign = Math.sign(rel);
    const x = rel * 84;         // Spostamento orizzontale in px
    const ry = rel === 0 ? 0 : -sign * 52; // Rotazione Y (prospettiva)
    const sc = rel === 0 ? 1 : 0.8 - (abs - 1) * 0.07; // Scala (le carte lontane sono più piccole)
    const tz = rel === 0 ? 0 : -110 - (abs - 1) * 55;  // Profondità Z (le carte lontane sono "dietro")
    return `translateX(${x}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`;
  }

  /** z-index CSS per la carta i (la carta centrale è in primo piano). */
  cardZ(i: number): number {
    return 100 - Math.abs(this.rel(i)) * 10;
  }

  /** true se la carta i è abbastanza vicina al centro da essere visibile. */
  cardVisible(i: number): boolean {
    return Math.abs(this.rel(i)) <= 2;
  }

  /** true se la carta i è quella centrale. */
  isFront(i: number): boolean {
    return this.rel(i) === 0;
  }

  /** Gradiente di sfondo della carta in base all'accento della scheda. */
  coverBg(s: Scheda): string {
    return `linear-gradient(155deg, ${this.ACCENT_VAR[s.accent]} -10%, var(--cover-end) 115%)`;
  }

  /** Ombra della carta (più prominente per la carta centrale) — tenuta leggera.
   *  La laterale usa un'ombra neutra theme-aware (soft su fondo chiaro). */
  coverShadow(s: Scheda, front: boolean): string {
    return front
      ? `0 16px 34px -14px ${this.ACCENT_VAR[s.accent]}4d` // Ombra colorata per la carta in primo piano
      : '0 10px 22px -12px var(--cover-shadow-side)';       // Ombra neutra (theme-aware) per le laterali
  }

  // ---- Gestione drag (trascinamento) ----
  //
  // NOTA: usiamo SOLO i Pointer Events (onDown/onMove/onUp). I Pointer Events
  // unificano già mouse, touch e penna: collegare anche i Touch Events (come
  // nella versione precedente) faceva scattare DUE volte lo stesso gesto su
  // mobile, causando occasionali doppi `step` (carte saltate).

  /** Restituisce la coordinata X del puntatore (tocco o mouse). */
  private px(e: PointerEvent | TouchEvent): number {
    // 'touches' in e: verifica se è un evento touch (non mouse)
    return 'touches' in e ? e.touches[0].clientX : e.clientX;
  }

  /** Inizia il drag: salva la posizione X di partenza. */
  onDown(e: PointerEvent | TouchEvent): void {
    this.dragX = this.px(e);
    this.moved = false;
    // Pointer capture: il drag continua anche se il dito/mouse esce dalla
    // carta o passa sopra le frecce, evitando swipe "persi" a metà gesto.
    if (typeof PointerEvent !== 'undefined' && e instanceof PointerEvent) {
      try {
        (e.currentTarget as Element)?.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture non disponibile: ignora */
      }
    }
  }

  /** Durante il drag: se lo spostamento supera 42px, avanza o torna. */
  onMove(e: PointerEvent | TouchEvent): void {
    if (this.dragX == null) {
      return; // Nessun drag in corso
    }
    const dx = this.px(e) - this.dragX;
    if (Math.abs(dx) > 42) { // Soglia: almeno 42px di movimento
      this.step(dx < 0 ? 1 : -1); // Swipe sinistra → avanti, destra → indietro
      this.dragX = this.px(e);    // Reset del punto di riferimento
      this.moved = true;
    }
  }

  /** Fine drag: resetta lo stato dopo un breve delay (per evitare click indesiderati). */
  onUp(): void {
    this.dragX = null;
    setTimeout(() => (this.moved = false), 60);
  }
}
