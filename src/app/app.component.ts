/**
 * ============================================================================
 *  FILE: app.component.ts  —  COMPONENTE RADICE (root component)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   È il PRIMO componente che Angular monta dentro <ff-root> in index.html.
 *   Tutto l'albero della UI parte da qui. Per uno sviluppatore Java: è
 *   l'equivalente del "main()" lato vista — il punto d'ingresso visuale.
 *
 * RESPONSABILITÀ PRINCIPALI
 *   - Innescare il caricamento iniziale dei dati (WorkoutStore.load()).
 *   - Applicare il tema salvato il prima possibile (istanziando ThemeService).
 *   - Renderizzare la shell (<ff-phone-shell>) che contiene il resto dell'app.
 *
 * DIPENDENZE PRINCIPALI
 *   - WorkoutStore: store globale dei dati di allenamento.
 *   - ThemeService: applica dark/light prima del primo paint.
 *   - PhoneShellComponent: la "cornice" (bottom nav + router-outlet).
 *
 * FLUSSO GENERALE / LIFECYCLE
 *   constructor → istanzia ThemeService (tema applicato subito, niente flash) →
 *   ngOnInit (chiamato UNA volta da Angula dopo la creazione) → store.load()
 *   scarica i dati → la shell e le feature li leggono dai signals dello store.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - Se l'app parte "vuota", verificare che store.load() sia stato chiamato:
 *     senza di esso nessun dato arriva ai componenti.
 *   - Il tema è applicato nel constructor (non in ngOnInit) DI PROPOSITO:
 *     spostarlo dopo causerebbe un flash di tema sbagliato al primo render.
 * ============================================================================
 */

// Importa le funzionalità di Angular necessarie per questo componente
import {
  ChangeDetectionStrategy, // Strategia di rilevamento cambiamenti
  Component,               // Decoratore per definire un componente
  OnInit,                  // Interfaccia per il lifecycle hook ngOnInit
  effect,                  // Reazione automatica ai cambi di signal
  inject,                  // Funzione moderna per la dependency injection
} from '@angular/core';
import { Router } from '@angular/router';
import { WorkoutStore } from './core/services/workout-store.service';
import { ThemeService } from './core/services/theme.service';
import { GamificationService } from './core/gamification/gamification.service';
// PhoneShellComponent è la "cornice" dell'app (barra di navigazione, layout generale)
import { PhoneShellComponent } from './layout/phone-shell/phone-shell.component';

/**
 * Componente radice. Avvia il caricamento dei dati iniziali e renderizza
 * la shell dell'applicazione (cornice del telefono).
 *
 * In Angular, ogni app ha UN componente radice, montato direttamente in index.html.
 */
@Component({
  // selector: il tag HTML personalizzato con cui si usa questo componente
  // Es: <ff-root></ff-root> in index.html
  selector: 'ff-root',

  // standalone: true → questo componente NON ha bisogno di essere dichiarato
  // in un NgModule. È il modo moderno di Angular (v15+).
  standalone: true,

  // changeDetection: OnPush → Angular aggiorna il DOM di questo componente
  // SOLO quando cambia un suo @Input o un signal. Più performante del default.
  changeDetection: ChangeDetectionStrategy.OnPush,

  // imports: lista di componenti/direttive usati nel template di questo componente.
  // Con i componenti standalone, si importa direttamente qui (non in un NgModule).
  imports: [PhoneShellComponent],

  // template: il markup HTML inline del componente.
  // <ff-phone-shell> è il selector di PhoneShellComponent.
  template: `<ff-phone-shell></ff-phone-shell>`,
})
export class AppComponent implements OnInit {
  // inject() è il modo moderno di Angular per richiedere un servizio (dependency injection).
  // Equivale al vecchio: constructor(private store: WorkoutStore) {}
  private readonly store = inject(WorkoutStore);
  private readonly gami = inject(GamificationService);
  private readonly router = inject(Router);

  constructor() {
    // ThemeService viene istanziato subito (anche se non lo usiamo direttamente qui)
    // così il tema salvato viene applicato prima del primo disegno della pagina,
    // evitando il "flash" di tema sbagliato.
    inject(ThemeService);

    // Primo accesso (sez. K): appena i dati sono pronti, se l'onboarding non è
    // stato completato instrada al questionario di posizionamento. L'effect si
    // ridisattiva da solo quando `needsOnboarding` torna false (onboarding fatto).
    effect(() => {
      if (this.gami.needsOnboarding() && !this.router.url.startsWith('/onboarding')) {
        void this.router.navigateByUrl('/onboarding');
      }
    });
  }

  // ngOnInit è un lifecycle hook: Angular lo chiama UNA VOLTA dopo aver
  // creato il componente e aver collegato i suoi @Input.
  // È il posto giusto per avviare operazioni di inizializzazione.
  ngOnInit(): void {
    // Avvia il caricamento dei dati dal server (o dal file JSON mock)
    this.store.load();
  }
}
