/**
 * ============================================================================
 *  FILE: photo-viewer.component.ts  —  VISORE FOTO A TUTTO SCHERMO
 * ============================================================================
 *  SCOPO: mostrare una o più foto che l'utente deve LEGGERE, non solo guardare
 *    — oggi il piano alimentare che il coach manda in chat, domani qualunque
 *    altro documento fotografato. Un foglio A4 fotografato, dentro un telefono,
 *    è illeggibile: senza ingrandimento questa non è una funzionalità, è
 *    un'anteprima inutile. Lo zoom **è** il componente.
 *
 *  I GESTI, tutti e tre quelli che una persona prova d'istinto:
 *    - pizzicare per ingrandire (2 dita), con trascinamento mentre si pizzica;
 *    - doppio tap per passare da 1× a 2.6× nel punto toccato;
 *    - trascinare per muoversi quando è ingrandito, per cambiare pagina quando
 *      non lo è. Un solo dito, due significati che non si sovrappongono mai
 *      perché dipendono dallo zoom.
 *
 *  PERCHÉ POINTER EVENTS E NON UNA LIBRERIA: sono tre gesti, e una dipendenza
 *    in più costa più di 120 righe. `touch-action: none` sul palco disattiva
 *    lo scroll del browser, che altrimenti ruberebbe il trascinamento.
 *
 *  PERCHÉ <ff-modal full>: il top layer del <dialog> nativo sta fuori da ogni
 *    contenimento — la stessa ragione per cui il modale esiste (D-44). Un velo
 *    fatto a mano qui dentro tornerebbe a scorrere col contenuto.
 * ============================================================================
 */
import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../modal/modal.component';

/** Limiti dell'ingrandimento: sotto 1 la foto rimpicciolisce, sopra 4 sfoca. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
/** Zoom del doppio tap: abbastanza da leggere un A4, non tanto da perdersi. */
const TAP_SCALE = 2.6;
/** Quanto va trascinata una pagina prima che cambi (frazione di larghezza). */
const PAGE_THRESHOLD = 0.22;

@Component({
  selector: 'ff-photo-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
  template: `
    <ff-modal [open]="open()" [full]="true" (closed)="close.emit()">
      <div class="viewer">

        <!-- Barra alta: chi/che cosa a sinistra, uscita e salvataggio a destra.
             Sta SOPRA la foto e non la restringe: la foto ha tutto lo schermo. -->
        <header class="vbar">
          <button class="vbtn press" (click)="close.emit()" aria-label="Chiudi">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
          <div class="vttl">
            <span class="vt">{{ title() }}</span>
            @if (subtitle()) { <span class="vs">{{ subtitle() }}</span> }
          </div>
          <button class="vbtn press" (click)="save()" aria-label="Salva questa pagina">
            <i class="ti ti-download" aria-hidden="true"></i>
          </button>
        </header>

        <!-- Palco: intercetta i gesti. touch-action:none perché lo scroll del
             browser e il trascinamento vogliono lo stesso dito. -->
        <div
          #stage
          class="stage"
          (pointerdown)="down($event)"
          (pointermove)="move($event)"
          (pointerup)="up($event)"
          (pointercancel)="up($event)"
        >
          <div class="track" [class.snap]="!dragging()" [style.transform]="trackTransform()">
            @for (p of photos(); track p; let i = $index) {
              <div class="slide">
                <img
                  [src]="p"
                  [alt]="title() + ' — pagina ' + (i + 1)"
                  [style.transform]="i === index() ? imgTransform() : null"
                  [class.snap]="!dragging()"
                  draggable="false"
                />
              </div>
            }
          </div>
        </div>

        <!-- Barra bassa: esiste solo se c'è più di una pagina. Un indicatore
             che dice sempre "1 di 1" è arredamento. -->
        @if (photos().length > 1) {
          <footer class="vfoot">
            <div class="dots">
              @for (p of photos(); track p; let i = $index) {
                <button
                  class="dot"
                  [class.on]="i === index()"
                  (click)="goTo(i)"
                  [attr.aria-label]="'Pagina ' + (i + 1)"
                  [attr.aria-current]="i === index()"
                ></button>
              }
            </div>
            <span class="cnt">{{ index() + 1 }} di {{ photos().length }}</span>
          </footer>
        }
      </div>
    </ff-modal>
  `,
  styles: [`
    :host { display: contents; }

    /* Fondo pieno e opaco: una foto si legge sul nero, non su un velo. */
    .viewer { position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; background: #08080c; overflow: hidden; }

    /* ---- Barre ---- */
    .vbar { position: absolute; inset: 0 0 auto; z-index: 2; display: flex; align-items: center; gap: 12px; padding: calc(10px + env(safe-area-inset-top)) 12px 22px; background: linear-gradient(rgba(0,0,0,.72), transparent); }
    .vttl { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
    .vt { font-size: 14px; font-weight: 800; letter-spacing: -.2px; color: #F2F1EA; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .vs { font-size: 11.5px; font-weight: 600; color: rgba(242,241,234,.6); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .vbtn { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.14); color: #F2F1EA; cursor: pointer; }
    .vbtn .ti { font-size: 20px; }

    /* ---- Palco e pagine ---- */
    .stage { flex: 1; min-height: 0; overflow: hidden; touch-action: none; }
    .track { display: flex; height: 100%; will-change: transform; }
    .track.snap { transition: transform .26s cubic-bezier(.22,.61,.36,1); }
    .slide { flex: 0 0 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
    .slide img { max-width: 100%; max-height: 100%; object-fit: contain; transform-origin: center center; user-select: none; -webkit-user-drag: none; }
    .slide img.snap { transition: transform .2s ease-out; }

    .vfoot { position: absolute; inset: auto 0 0; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 12px calc(14px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, rgba(0,0,0,.72)); }
    .dots { display: flex; gap: 7px; }
    .dot { width: 7px; height: 7px; padding: 0; border-radius: 50%; background: rgba(255,255,255,.28); border: none; cursor: pointer; transition: background .18s, transform .18s; }
    .dot.on { background: var(--amber); transform: scale(1.25); }
    .cnt { font-size: 11px; font-weight: 700; color: rgba(242,241,234,.6); font-variant-numeric: tabular-nums; }

    @media (prefers-reduced-motion: reduce) {
      .track.snap, .slide img.snap { transition: none; }
    }
  `],
})
export class PhotoViewerComponent {
  /** Aperto o chiuso: lo stato resta di chi lo apre, come per <ff-modal>. */
  readonly open = input(false);
  /** Le pagine, nell'ordine in cui vanno lette. */
  readonly photos = input<string[]>([]);
  readonly title = input('');
  readonly subtitle = input('');
  /** Pagina da cui aprire: chi mostra una griglia di miniature apre su quella toccata. */
  readonly startIndex = input(0);
  readonly close = output<void>();

  private readonly toast = inject(ToastService);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  readonly index = signal(0);
  readonly dragging = signal(false);

  /** Stato dell'ingrandimento della pagina corrente. */
  private readonly scale = signal(1);
  private readonly tx = signal(0);
  private readonly ty = signal(0);
  /** Scorrimento orizzontale in corso, in pixel (solo a zoom 1×). */
  private readonly dragX = signal(0);

  /** Dita attualmente appoggiate. Una = trascino, due = pizzico. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private startDist = 0;
  private startScale = 1;
  private startMid = { x: 0, y: 0 };
  private startT = { x: 0, y: 0 };
  private startPt = { x: 0, y: 0 };
  private lastTap = 0;

  constructor() {
    // Ogni apertura riparte dalla pagina chiesta e a grandezza naturale, non da
    // dove si era rimasti: riaprire un documento a metà e ingrandito disorienta.
    effect(() => {
      if (!this.open()) return;
      this.index.set(this.startIndex());
      this.resetZoom();
    });
  }

  readonly trackTransform = computed(
    () => `translate3d(calc(${-this.index() * 100}% + ${this.dragX()}px), 0, 0)`,
  );

  readonly imgTransform = computed(
    () => `translate3d(${this.tx()}px, ${this.ty()}px, 0) scale(${this.scale()})`,
  );

  goTo(i: number): void {
    this.index.set(i);
    this.resetZoom();
  }

  // ==========================================================================
  //  GESTI
  // ==========================================================================

  down(ev: PointerEvent): void {
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    this.dragging.set(true);

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.startScale = this.scale();
      this.startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.startT = { x: this.tx(), y: this.ty() };
      return;
    }

    this.startPt = { x: ev.clientX, y: ev.clientY };
    this.startT = { x: this.tx(), y: this.ty() };

    // Doppio tap: due contatti ravvicinati nel tempo sullo stesso punto.
    const now = Date.now();
    if (now - this.lastTap < 300) {
      this.toggleZoom(ev);
      this.lastTap = 0;
    } else {
      this.lastTap = now;
    }
  }

  move(ev: PointerEvent): void {
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    // --- Due dita: ingrandimento + spostamento del punto pizzicato ---
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const next = this.clamp(this.startScale * (dist / this.startDist), MIN_SCALE, MAX_SCALE);
      this.scale.set(next);
      this.pan(
        this.startT.x + (mid.x - this.startMid.x),
        this.startT.y + (mid.y - this.startMid.y),
      );
      return;
    }

    const dx = ev.clientX - this.startPt.x;
    const dy = ev.clientY - this.startPt.y;

    // --- Un dito, ingrandito: mi muovo dentro la foto ---
    if (this.scale() > 1) {
      this.pan(this.startT.x + dx, this.startT.y + dy);
      return;
    }

    // --- Un dito, a grandezza naturale: cambio pagina ---
    // Ai bordi il trascinamento fa resistenza invece di bloccarsi: dice che non
    // c'è altro senza sembrare rotto.
    const last = this.photos().length - 1;
    const atEdge = (this.index() === 0 && dx > 0) || (this.index() === last && dx < 0);
    this.dragX.set(atEdge ? dx * 0.28 : dx);
  }

  up(ev: PointerEvent): void {
    this.pointers.delete(ev.pointerId);

    // Finché resta un dito appoggiato il gesto non è finito: si riparte da lì,
    // altrimenti staccando un dito dal pizzico la foto farebbe un salto.
    if (this.pointers.size === 1) {
      const [p] = [...this.pointers.values()];
      this.startPt = { x: p.x, y: p.y };
      this.startT = { x: this.tx(), y: this.ty() };
      return;
    }
    if (this.pointers.size > 1) return;

    this.dragging.set(false);

    // Il trascinamento decide la pagina solo se ha superato la soglia.
    const w = this.stage()?.nativeElement.clientWidth ?? 1;
    const moved = this.dragX();
    if (Math.abs(moved) > w * PAGE_THRESHOLD) {
      const dir = moved < 0 ? 1 : -1;
      const next = this.clamp(this.index() + dir, 0, this.photos().length - 1);
      if (next !== this.index()) this.goTo(next);
    }
    this.dragX.set(0);

    // Tornati a grandezza naturale la foto si ricentra da sé: lasciarla storta
    // costringerebbe a rimetterla a posto a mano.
    if (this.scale() <= 1) this.resetZoom();
    else this.pan(this.tx(), this.ty());
  }

  /** Doppio tap: 1× ⇄ 2.6×, portando sotto al dito il punto toccato. */
  private toggleZoom(ev: PointerEvent): void {
    if (this.scale() > 1) { this.resetZoom(); return; }
    const el = this.stage()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = ev.clientX - (r.left + r.width / 2);
    const cy = ev.clientY - (r.top + r.height / 2);
    this.scale.set(TAP_SCALE);
    this.pan(-cx * (TAP_SCALE - 1), -cy * (TAP_SCALE - 1));
  }

  /**
   * Sposta la foto tenendola attaccata ai bordi: oltre il margine ingrandito non
   * si va, altrimenti si finisce a guardare il nero con la foto fuori campo.
   */
  private pan(x: number, y: number): void {
    const el = this.stage()?.nativeElement;
    const s = this.scale();
    if (!el || s <= 1) { this.tx.set(0); this.ty.set(0); return; }
    const maxX = (el.clientWidth * (s - 1)) / 2;
    const maxY = (el.clientHeight * (s - 1)) / 2;
    this.tx.set(this.clamp(x, -maxX, maxX));
    this.ty.set(this.clamp(y, -maxY, maxY));
  }

  private resetZoom(): void {
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
  }

  // ==========================================================================
  //  SALVATAGGIO
  //  Serve dove la dieta si legge davvero — in cucina e al supermercato, spesso
  //  senza campo. Prima si prova la condivisione di sistema (su telefono è
  //  "Salva nelle foto"), poi il download del browser.
  // ==========================================================================

  async save(): Promise<void> {
    const url = this.photos()[this.index()];
    if (!url) return;
    const name = url.split('/').pop() || 'pagina';
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: blob.type });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file] });
        return;
      }
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
      this.toast.show('Pagina salvata', 'ti-download');
    } catch (err) {
      // AbortError = l'utente ha chiuso il foglio di condivisione. Ha deciso
      // lui: avvisarlo di ciò che ha appena scelto è rumore.
      if ((err as Error)?.name === 'AbortError') return;
      this.toast.show('Non è stato possibile salvare la pagina', 'ti-alert-triangle');
    }
  }
}
