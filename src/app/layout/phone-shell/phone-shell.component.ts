/**
 * ============================================================================
 *  FILE: phone-shell.component.ts  —  SHELL / CORNICE FISSA DELL'APP
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   È il telaio che resta sempre a schermo mentre le pagine cambiano dentro di
 *   esso: cornice "telefono", area contenuto (router-outlet), bottom nav e
 *   overlay globali (loading, errore, toast). Per uno sviluppatore Java: è il
 *   "layout master" / template di pagina che ospita le viste.
 *
 * RESPONSABILITÀ PRINCIPALI
 *   1. Gate globale dei dati: mostra loading o errore, e renderizza le feature
 *      SOLO quando i dati sono pronti (così i componenti non leggono dati null).
 *   2. Decidere il layout per-rotta leggendo il campo `data` (chrome/selfLayout).
 *   3. Resettare lo scroll a ogni cambio pagina.
 *
 * COSA RAPPRESENTA / LIFECYCLE
 *   Componente standalone montato da AppComponent. Niente ngOnInit: tutto è nel
 *   constructor (sottoscrizione agli eventi del Router + un effect()).
 *
 * FLUSSO DEI DATI
 *   store.loading()/error() pilotano il blocco @if del template. Ad ogni
 *   NavigationEnd si scende fino alla rotta foglia, si legge snapshot.data e si
 *   aggiornano i signal chrome/selfLayout → il template si riadatta. Un effect()
 *   osserva quei signal e azzera scrollTop dopo il render (queueMicrotask).
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutStore (loading/error/load), Router + ActivatedRoute.
 *   - Componenti figli: BottomNav, Toast, LoadingOverlay, ErrorState.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - chrome default = true: la bottom nav si NASCONDE solo se la rotta ha
 *     esplicitamente data:{chrome:false}. Bottom nav di troppo? Controlla lì.
 *   - selfLayout cambia il contenitore di scroll: le pagine che gestiscono il
 *     proprio scroll (es. active-workout) devono avere data:{selfLayout:true}.
 *   - Il reset scroll usa #scroll: esiste SOLO nel ramo non-selfLayout, per
 *     questo è dietro un optional chaining (?.).
 * ============================================================================
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,  // Tipo che wrappa un elemento DOM nativo
  effect,
  inject,
  signal,
  viewChild,   // Query per ottenere un riferimento a un elemento nel template
} from '@angular/core';
// ActivatedRoute: dati della rotta attualmente attiva (params, data, ecc.)
// NavigationEnd: evento emesso dal Router quando la navigazione è completata
// Router: servizio di navigazione
// RouterOutlet: direttiva che indica dove Angular renderizza il componente della rotta corrente
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
// filter: operatore RxJS che filtra gli eventi (passa solo quelli che soddisfano la condizione)
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';

/**
 * Componente "shell" — la struttura fissa dell'app (cornice del telefono, status bar,
 * bottom nav, area contenuto) che rimane mentre le pagine cambiano al suo interno.
 *
 * Gestisce anche il gate globale loading/error: i componenti delle feature
 * vengono renderizzati SOLO quando i dati sono disponibili.
 */
@Component({
  selector: 'ff-phone-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,           // Necessario per usare <router-outlet> nel template
    BottomNavComponent,
    ToastComponent,
    LoadingOverlayComponent,
    ErrorStateComponent,
  ],
  // Template inline (non usa templateUrl perché è abbastanza breve)
  template: `
    <div class="phone-inner">
      <!-- Blocco di controllo flusso Angular (@if/@else if/@else) -->
      <!-- Mostra loading, errore, oppure il contenuto normale -->
      @if (store.loading()) {
        <ff-loading-overlay label="Preparo i tuoi allenamenti…"></ff-loading-overlay>
      } @else if (store.error(); as err) {
        <!-- "as err" assegna il valore del signal a una variabile locale del template -->
        <ff-error-state [message]="err" (retry)="store.load()"></ff-error-state>
      } @else {
        <!-- selfLayout: il componente gestisce il proprio scroll (es. active-workout) -->
        @if (selfLayout()) {
          <div class="screen-self">
            <!-- router-outlet: qui Angular inserisce il componente della rotta corrente -->
            <router-outlet></router-outlet>
          </div>
        } @else {
          <!-- #scroll: variabile template — viewChild('scroll') la referenzia nel TS -->
          <div class="screen" #scroll>
            <router-outlet></router-outlet>
          </div>
        }

        <!-- chrome: true → mostra la barra di navigazione in basso -->
        @if (chrome()) {
          <ff-bottom-nav></ff-bottom-nav>
        }
      }

      <!-- Il toast è sempre presente (si nasconde quando null) -->
      <ff-toast></ff-toast>
    </div>
  `,
})
export class PhoneShellComponent {
  // inject() con visibilità "readonly" → il servizio non può essere riassegnato
  readonly store = inject(WorkoutStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // viewChild('scroll'): legge l'elemento con #scroll nel template.
  // ElementRef<HTMLDivElement> wrappa il nodo DOM nativo.
  // Utile per accedere direttamente all'elemento (es. scrollTop).
  private readonly scroll = viewChild<ElementRef<HTMLDivElement>>('scroll');

  // Signal locali per i flag del layout
  readonly chrome = signal<boolean>(true);
  readonly selfLayout = signal<boolean>(false);

  constructor() {
    // router.events è un Observable di tutti gli eventi di navigazione.
    // filter() seleziona solo gli eventi NavigationEnd (navigazione completata).
    // (e): e is NavigationEnd è un "type guard" TypeScript
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(), // Cancella quando il componente viene distrutto
      )
      .subscribe(() => {
        // Risale l'albero delle route figlie per trovare la route "foglia" attiva
        let r = this.route.firstChild;
        while (r?.firstChild) {
          r = r.firstChild;
        }
        // snapshot.data contiene il campo `data` definito in app.routes.ts
        const data = r?.snapshot.data ?? {};
        // Aggiorna i signal → il template si aggiorna automaticamente
        this.chrome.set(data['chrome'] !== false);
        this.selfLayout.set(data['selfLayout'] === true);
      });

    // effect(): si esegue ogni volta che chrome() o selfLayout() cambiano.
    // Resetta lo scroll al cambio di pagina.
    effect(() => {
      this.selfLayout(); // Legge il signal → questa dipendenza è tracciata
      this.chrome();
      // queueMicrotask: esegue il codice dopo che Angular ha aggiornato il DOM,
      // ma prima del prossimo frame di rendering del browser
      queueMicrotask(() => {
        const el = this.scroll()?.nativeElement; // nativeElement: il vero elemento DOM
        if (el) {
          el.scrollTop = 0; // Torna in cima alla pagina
        }
      });
    });
  }
}
