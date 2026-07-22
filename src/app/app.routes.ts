/**
 * ============================================================================
 *  FILE: app.routes.ts  —  TABELLA DI ROUTING (mappa URL → componente)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Definisce quale componente Angular mostrare per ogni URL del browser.
 *   È l'equivalente concettuale di un file di mapping URL → Controller in un
 *   web framework Java (es. le @RequestMapping di Spring), ma lato client:
 *   la navigazione avviene SENZA ricaricare la pagina (Single Page App).
 *
 * RESPONSABILITÀ PRINCIPALI
 *   - Associare ogni path a un componente (lazy-loaded).
 *   - Proteggere rotte sensibili con guardie (canActivate).
 *   - Trasportare metadati di layout nel campo `data` (chrome, selfLayout).
 *
 * DIPENDENZE PRINCIPALI
 *   - activeSessionGuard: blocca /active se non c'è un allenamento in corso.
 *   - I componenti feature, importati in modo lazy (vedi sotto).
 *   - phone-shell.component.ts LEGGE il campo `data` per decidere il layout.
 *
 * FLUSSO GENERALE
 *   URL nel browser → Angular Router cerca il path corrispondente qui →
 *   scarica (lazy) il componente → lo monta nel <router-outlet> della shell.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - L'ORDINE conta: la wildcard '**' DEVE restare ultima, altrimenti
 *     catturerebbe ogni URL prima delle rotte reali.
 *   - Se aggiungi una rotta, riccontrolla `data: { chrome }` per la bottom nav.
 *   - loadComponent fallisce silenziosamente se il nome esportato della classe
 *     non combacia con `m.XxxComponent`: verifica sempre quel riferimento.
 * ============================================================================
 */

// Routes è il tipo per l'array di route di Angular
import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
// activeSessionGuard: una "guardia" che blocca l'accesso a /active se non c'è una sessione attiva
import { activeSessionGuard } from './core/guards/active-session.guard';

/**
 * Definizione delle route dell'applicazione.
 *
 * Ogni oggetto { path, ... } mappa un URL a un componente.
 * Tutti i componenti sono caricati in modo LAZY (loadComponent) → il codice
 * del componente viene scaricato dal server solo quando l'utente naviga su quella rotta.
 * Questo riduce il bundle iniziale e velocizza il primo caricamento.
 *
 * Il campo `data` è un oggetto libero letto dalla shell (phone-shell.component.ts):
 *  - chrome: true  → mostra la barra di navigazione in basso
 *  - selfLayout: true → il componente gestisce autonomamente il proprio layout (flex colonna)
 */
export const routes: Routes = [
  // Rotta vuota → redirect automatico a /home
  { path: '', pathMatch: 'full', redirectTo: 'home' },

  {
    // Onboarding di primo accesso (sez. K): questionario + posizionamento.
    // Layout autonomo (wizard a tutta altezza), senza bottom nav.
    path: 'onboarding',
    title: 'Benvenuto',
    data: { chrome: false, selfLayout: true },
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
  },

  {
    path: 'home',
    title: 'FitFlow',       // <title> del browser
    data: { chrome: true }, // mostra la bottom nav; scroll verticale gestito dalla shell
    // loadComponent: lazy loading — importa il componente solo quando necessario
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'schede',
    title: 'Schede',
    data: { chrome: true },
    loadComponent: () => import('./features/schede/schede.component').then((m) => m.SchedeComponent),
  },
  {
    // :id è un parametro dinamico della rotta (es. /scheda/push, /scheda/legs)
    path: 'scheda/:id',
    title: 'Dettaglio scheda',
    data: { chrome: true }, // mostra la bottom nav anche nel dettaglio scheda
    loadComponent: () =>
      import('./features/scheda-detail/scheda-detail.component').then((m) => m.SchedaDetailComponent),
  },
  {
    // Riepilogo di un allenamento SVOLTO (gemello "passato" di /scheda/:id).
    // chrome: true → si resta dentro l'hub Schede, da cui si arriva.
    path: 'allenamento/:id',
    title: 'Riepilogo allenamento',
    data: { chrome: true },
    loadComponent: () =>
      import('./features/workout-detail/workout-detail.component').then((m) => m.WorkoutDetailComponent),
  },
  {
    path: 'active',
    title: 'Allenamento attivo',
    data: { chrome: false, selfLayout: true },
    // canActivate: array di guardie. Se activeSessionGuard restituisce false,
    // Angular blocca la navigazione e reindirizza altrove.
    canActivate: [activeSessionGuard],
    loadComponent: () =>
      import('./features/active-workout/active-workout.component').then((m) => m.ActiveWorkoutComponent),
  },
  {
    path: 'summary',
    title: 'Riepilogo',
    data: { chrome: false },
    loadComponent: () =>
      import('./features/summary/summary.component').then((m) => m.SummaryComponent),
  },
  {
    path: 'progress',
    title: 'Progressi',
    data: { chrome: true },
    loadComponent: () =>
      import('./features/progress/progress.component').then((m) => m.ProgressComponent),
  },
  {
    path: 'new-scheda',
    title: 'Nuova scheda',
    data: { chrome: false, selfLayout: true },
    loadComponent: () =>
      import('./features/new-scheda/new-scheda.component').then((m) => m.NewSchedaComponent),
  },
  {
    path: 'help',
    title: 'Help Desk',
    data: { chrome: true },
    loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent),
  },
  {
    // Lo Storico NON è più una schermata a sé: vive nel tab "Allenamenti" della
    // sezione Schede (DECISIONS D-38). La rotta resta come redirect perché i
    // vecchi link continuino a valere.
    //
    // redirectTo è una FUNZIONE, non una stringa: una stringa non può portare
    // query param ('schede?tab=allenamenti' verrebbe interpretato come un
    // segmento di path, non come una query). La funzione costruisce un UrlTree
    // e può quindi propagare il ?focus=<id> del deep-link dall'Agenda.
    path: 'history',
    redirectTo: ({ queryParams }) =>
      inject(Router).createUrlTree(['/schede'], {
        queryParams: { tab: 'allenamenti', ...queryParams },
      }),
  },
  {
    path: 'profile',
    title: 'Profilo',
    data: { chrome: true },
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    // Le fasce in cui accetti sedute. È configurazione, non agenda: si tocca
    // una volta ogni mesi, quindi vive sotto il Profilo.
    path: 'disponibilita',
    title: 'Disponibilità',
    data: { chrome: true },
    loadComponent: () =>
      import('./features/availability/availability.component').then((m) => m.AvailabilityComponent),
  },
  {
    path: 'personal-trainer',
    title: 'Personal Trainer',
    data: { chrome: true },
    loadComponent: () =>
      import('./features/personal-trainer/personal-trainer.component').then((m) => m.PersonalTrainerComponent),
  },
  {
    // Chat 1:1 col PT — selfLayout: gestisce header/scroll/composer da sé.
    path: 'messaggi',
    title: 'Messaggi',
    data: { chrome: true, selfLayout: true },
    loadComponent: () =>
      import('./features/messaggi/messaggi.component').then((m) => m.MessaggiComponent),
  },
  {
    path: 'agenda',
    title: 'Agenda',
    data: { chrome: true },
    loadComponent: () =>
      import('./features/agenda/agenda.component').then((m) => m.AgendaComponent),
  },
  {
    // Marketplace coach — sotto-pagina dell'hub Coach (scoperta/scelta coach).
    path: 'coach-marketplace',
    title: 'Esplora coach',
    data: { chrome: true },
    loadComponent: () =>
      import('./features/coach-marketplace/coach-marketplace.component').then((m) => m.CoachMarketplaceComponent),
  },
  // Wildcard: qualsiasi URL non riconosciuto → redirect a /home
  { path: '**', redirectTo: 'home' },
];
