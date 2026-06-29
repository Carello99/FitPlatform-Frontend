# FitFlow — Premium Fitness & Personal Training App

App mobile per fitness e allenamento personale costruita con **Angular 22** seguendo le convenzioni di un team frontend aziendale: **standalone components**, **change detection zoneless**, **signals**, lazy loading, SCSS modulare e una netta separazione `core` / `shared` / `features` / `layout`.

L'app riproduce fedelmente il design approvato: tema premium scuro (ambra + verde), 10 schermate, **Cover Flow** in stile iTunes con loop infinito in home, flusso di allenamento completo.

---

## Avvio rapido

```bash
npm install
npm start          # ng serve  ->  http://localhost:4200
```

Build di produzione:

```bash
npm run build:prod # output in dist/fitflow
```

**Prerequisiti:** Node.js ≥ 20.11, Angular CLI 22 (`npm i -g @angular/cli@22`).
Font (*Plus Jakarta Sans*) e icone (*Tabler Icons* webfont) sono caricati via CDN in `src/index.html`.

---

## Scelte architetturali (e perché)

| Decisione | Motivazione |
|---|---|
| **Standalone components** (no NgModule) | È l'approccio raccomandato da Angular: niente boilerplate di moduli, dipendenze esplicite per componente, tree-shaking migliore. |
| **Zoneless change detection** (`provideZonelessChangeDetection`) | L'app è interamente guidata da **signals**: Zone.js diventa overhead inutile. La CD parte solo quando un signal cambia → più prevedibile e performante. |
| **Signals come state management** | Stato locale e applicativo (store, sessione, toast) sono signals/`computed`. Niente NgRx: per questa scala introdurrebbe complessità non necessaria. La separazione store ⇄ transport mantiene comunque la strada aperta a soluzioni più strutturate. |
| **Lazy loading per feature** (`loadComponent`) | Ogni schermata è uno split-point: bundle iniziale minimo, caricamento on-demand. |
| **`HttpClient` + interceptor funzionali** | Service layer reale: i dati arrivano via HTTP da un endpoint (qui un JSON statico in `assets/`). Latenza ed errori sono gestiti centralmente da interceptor, non nei componenti. |
| **OnPush ovunque** | Coerente con il modello signal/zoneless. |
| **SCSS modulare** | Design system suddiviso in partial (`tokens`, `base`, `layout`, `components`, `animations`, `utilities`) e composto via `@use`. |
| **Tema chiaro/scuro** | Il design **dark è il default**. `ThemeService` (signal) applica `data-theme` su `<html>`, persiste la scelta in `localStorage` e i token in `_tokens.scss` reagiscono. Toggle in **Profilo → Aspetto**. |

### Flusso dati e separazione delle responsabilità

```
WorkoutApiService   (transport: HttpClient -> assets/mock/app-data.json)
        │  Observable<AppData>
        ▼
WorkoutStore        (stato: signals + loading/error, selettori)
        │  getters reattivi
        ▼
Feature components  (smart: orchestrano; presentational: solo @Input/@Output)
```

- **Smart components** (es. `HomeComponent`, `ActiveWorkoutComponent`) iniettano store/servizi e gestiscono la logica.
- **Presentational components** (`RingComponent`, `BarChartComponent`, `CoverflowComponent`, `DiffComponent`, …) ricevono dati via `@Input` ed emettono `@Output`: nessuna logica di business, massima riusabilità.
- **Loading / error**: `WorkoutStore` espone `loading()` ed `error()`; la `PhoneShellComponent` fa da gate globale mostrando spinner o stato d'errore con **retry**, così le feature montano solo a dati pronti.
- **Interceptor**: `latencyInterceptor` simula la rete (rimovibile in produzione), `errorInterceptor` normalizza gli errori HTTP in messaggi presentabili.
- **Guard**: `activeSessionGuard` protegge la rotta `/active` (redirect a `/home` senza sessione).

---

## Struttura del progetto

```
fitflow-app/
├── angular.json · package.json · tsconfig*.json · .editorconfig · .gitignore
└── src/
    ├── index.html · main.ts
    ├── assets/mock/app-data.json          # "backend" mock servito via HttpClient
    ├── styles/                            # SCSS modulare
    │   ├── styles.scss                     # entry: @use dei partial
    │   ├── _tokens.scss · _base.scss · _layout.scss
    │   └── _components.scss · _animations.scss · _utilities.scss
    └── app/
        ├── app.component.ts                # root: avvia il load e monta lo shell
        ├── app.config.ts                   # provider: zoneless, http+interceptors, router
        ├── app.routes.ts                   # rotte lazy + guard + flag layout
        ├── core/
        │   ├── models/workout.models.ts
        │   ├── constants/ui.constants.ts   # mappe accent/tile, label, motivazioni
        │   ├── services/
        │   │   ├── workout-api.service.ts  # HttpClient
        │   │   ├── workout-store.service.ts# signals + loading/error + selettori
        │   │   ├── session.service.ts      # flusso allenamento + navigazione
        │   │   ├── theme.service.ts         # tema chiaro/scuro (signal + localStorage)
        │   │   └── toast.service.ts
        │   ├── interceptors/  latency · error
        │   └── guards/        active-session.guard.ts
        ├── layout/
        │   ├── phone-shell/                # frame, gate loading/error, outlet
        │   ├── status-bar/
        │   └── bottom-nav/
        ├── shared/components/              # ring · diff · bar-chart · line-chart
        │   └── toast · loading-overlay · error-state
        └── features/                       # 10 feature lazy-loaded
            ├── home/ (+ coverflow)
            ├── schede/ · scheda-detail/
            ├── active-workout/ · summary/
            ├── progress/ · new-scheda/
            └── help/ · history/ · profile/
```

---

## Schermate (10)

1. **Home Dashboard** — Cover Flow schede, azioni rapide, livello/XP + badge, recap settimanale, statistiche, motivazione.
2. **Selezione Scheda** — ricerca, filtri, anteprime (nome, durata, n° esercizi, difficoltà).
3. **Dettaglio Scheda** — descrizione, statistiche, esercizi, dialog "Vuoi iniziare?".
4. **Allenamento Attivo** — timer automatico discreto, completamento serie, timer di recupero, salta esercizio, termina con conferma.
5. **Riepilogo** — durata, serie, esercizi, volume, XP, streak.
6. **Progressi** — grafici volume/peso/performance, record personali, periodi.
7. **Nuova Scheda** — wizard guidato in 4 step.
8. **Help Desk** — FAQ, chat di supporto, guide rapide, contatti.
9. **Storico** — sessioni recenti con metriche.
10. **Profilo** — identità, livello, badge, impostazioni.

---

## Note di deployment

Lo shell mostra un **frame telefono** centrato (come nel design di consegna). Per pubblicare a tutto schermo su dispositivo, in `src/styles/_layout.scss` porta `.phone` a piena viewport (`width:100%; height:100dvh; border:0; border-radius:0`), nascondi `.island` e lo sfondo di `.stage`.

I dati provengono da `assets/mock/app-data.json` tramite `WorkoutApiService`. Per collegare un'API reale è sufficiente cambiare `DATA_URL` (o i metodi del service): l'interfaccia pubblica dello store resta invariata e nessun componente va toccato.
