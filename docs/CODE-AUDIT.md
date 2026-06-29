# Code Audit & Refactoring — FitFlow

> Audit di livello production-grade del frontend FitFlow (Angular 22, zoneless + signals).
> Data: 2026-06-22 · Branch: `punteggio/prima-commit` · Build verificata: ✅ `ng build` (production) senza errori né warning.
>
> Legenda priorità: **🔴 HIGH PRIORITY** (rischio prod) · **🟡 MEDIUM** (manutenibilità/robustezza) · **🟢 LOW** (cosmetico/nice-to-have).
> Le **assunzioni** dell'auditor sono marcate `ASSUNZIONE`.

---

## A. Summary tecnico

### A.1 Stack tecnologico

| Area | Tecnologia |
|------|-----------|
| Framework | Angular 22 (standalone components, **zoneless** change detection) |
| Reattività | Angular **Signals** (`signal`/`computed`/`effect`) — niente Zone.js |
| Linguaggio | TypeScript ~6.0, `strict` (vedi `tsconfig.json`) |
| HTTP | `HttpClient` + interceptor funzionali (`HttpInterceptorFn`) |
| Routing | Router standalone, **lazy** (`loadComponent`), guardie funzionali (`CanActivateFn`) |
| Stile | SCSS modulare con design-token CSS custom properties (dark/light via `[data-theme]`) |
| Async | RxJS 7.8 (solo dove serve: HTTP, eventi router), `takeUntilDestroyed` per il cleanup |
| Mobile | Capacitor 8 (target iOS, cartella `ios/`) |
| Backend | **Nessuno**: i dati arrivano da file JSON statici in `src/assets/` (mock) |

### A.2 Architettura generale

Applicazione **single-page, client-only**. Non esiste un backend: la "sorgente dati" è un file
JSON statico servito tra gli asset. L'architettura segue una separazione a livelli pulita e
idiomatica per Angular moderno:

```
                          ┌─────────────────────────────────────────┐
                          │              UI (features)               │
                          │  home · schede · scheda-detail · active  │
                          │  summary · progress · profile · history  │
                          │  help · new-scheda                       │
                          └───────────────┬─────────────────────────┘
                                          │ leggono signal / chiamano metodi
              ┌───────────────────────────┼───────────────────────────┐
              ▼                            ▼                           ▼
   ┌──────────────────┐        ┌────────────────────┐      ┌────────────────────┐
   │   WorkoutStore   │        │   SessionService   │      │  servizi di UI      │
   │  (stato dati,    │◀──────▶│  (flusso/regia     │      │  Theme · Toast      │
   │   single source) │        │   navigazione)     │      │  ExerciseImage      │
   └────────┬─────────┘        └─────────┬──────────┘      └────────────────────┘
            │                            │ Router.navigate()
            ▼                            ▼
   ┌──────────────────┐        ┌────────────────────┐
   │ WorkoutApiService│        │ ExerciseCatalog    │
   │ (HTTP puro)      │        │ Service (snapshot  │
   └────────┬─────────┘        │ + cache localStorage)
            │                  └─────────┬──────────┘
            ▼ HTTP GET                   ▼ HTTP GET
   assets/mock/app-data.json   assets/data/exercise-catalog.json
            │
            ▼ attraversano gli interceptor
   [latencyInterceptor (solo dev)] → [errorInterceptor]
```

**Strati e responsabilità**

- **`core/models`** — solo tipi/interfacce TypeScript: il "contratto dati" (`AppData` e figli).
- **`core/services`** — logica e stato:
  - `WorkoutApiService` → *data access layer* puro (solo la GET, niente stato).
  - `WorkoutStore` → **single source of truth** (Signal Store): conserva `AppData`, espone
    getter read-only, scritture immutabili (`addScheda`/`updateScheda`), selettori e la logica
    di raggruppamento muscolare.
  - `SessionService` → **macchina a stati di navigazione** del flusso allenamento (quale scheda
    sto guardando/eseguendo, dove vado dopo). Non duplica i dati: tiene solo ID/flag.
  - `ExerciseCatalogService` → catalogo esercizi (snapshot statico + cache `localStorage`),
    fonte primaria di `exerciseLib`/`exercisesByMuscle` quando disponibile.
  - `ExerciseImageService` → risolve nome esercizio → URL GIF (CDN esterno).
  - `ThemeService`, `ToastService` → preferenze/feedback UI.
- **`core/interceptors`** — `latencyInterceptor` (ritardo finto dev), `errorInterceptor`
  (normalizza gli errori HTTP in messaggi leggibili).
- **`core/guards`** — `activeSessionGuard` protegge `/active`.
- **`core/constants`** — `ui.constants.ts`: lookup table di presentazione (colori per accento /
  gruppo muscolare, macro-sezioni Upper/Lower, etichette livello, frasi motivazionali).
- **`layout`** — `PhoneShellComponent` (telaio + gate globale loading/error + layout per-rotta),
  `BottomNavComponent`.
- **`features`** — una cartella per schermata; componenti **smart** che leggono i servizi.
- **`shared/components`** — UI riusabile **dumb** (`ExerciseCard`, `Ring`, `Diff`, `LineChart`,
  `BarChart`, `MusclePicker`, `Toast`, `LoadingOverlay`, `ErrorState`).

### A.3 Flusso end-to-end

1. **Bootstrap** — `main.ts` → `bootstrapApplication(AppComponent, appConfig)`. `appConfig`
   registra change detection zoneless, `HttpClient` con interceptor, Router con le route.
2. **Avvio dati** — `AppComponent` istanzia `ThemeService` (tema applicato pre-paint) e in
   `ngOnInit` chiama `WorkoutStore.load()`.
3. **Caricamento** — `WorkoutStore.load()` → `WorkoutApiService.loadAppData()` → `GET
   assets/mock/app-data.json` → interceptor → il payload finisce nel signal privato `data`,
   `status` passa a `loaded`.
4. **Gate UI** — `PhoneShellComponent` mostra loading/errore e renderizza le feature **solo a
   dati pronti**, quindi i componenti non leggono mai stato `null`.
5. **Navigazione allenamento** — Home (coverflow) → `openScheda()` → `/scheda/:id` →
   `beginSession()` → `/active` (protetta da guardia) → `finishSession(summary)` → `/summary`.
   La regia delle rotte è centralizzata in `SessionService`.
6. **Esecuzione** — `ActiveWorkoutComponent` costruisce la griglia `log[esercizio][serie]`,
   gestisce timer (`setInterval` 1s), recupero, volume/percentuale via `computed`, e produce il
   `WorkoutSummary` finale.

### A.4 Lifecycle delle operazioni principali

```
LOAD DATI            load() → loading → [HTTP] → loaded | error(retry)
CREA SCHEDA          wizard 3 step → save() → store.addScheda() → /schede   (solo in memoria)
MODIFICA SCHEDA      enterEditMode() [copia bozza] → edit live su signal →
                     saveEdit() → store.updateScheda()   |   cancelEdit() [scarta]
SESSIONE             beginSession(id) → /active → log per serie + recupero →
                     finishSession(summary) → /summary    |   exitSession() → /home
TEMA                 toggle()/set() → effect() → <html data-theme> + localStorage
```

> `ASSUNZIONE`: l'app è una **demo/prototipo UI ad alta fedeltà**. Non c'è persistenza
> server-side: ogni scrittura (nuova scheda, modifica, sessione) vive **solo in memoria** e si
> azzera al refresh. È coerente e documentato nel codice, ma va esplicitato come vincolo
> architetturale prima di un vero rilascio (vedi B.1).

---

## B. Problemi trovati

### B.1 Architetturali

| # | Pri | Problema | Dettaglio |
|---|-----|----------|-----------|
| 1 | 🔴 | **Nessuna persistenza delle scritture** | `addScheda`/`updateScheda`/sessioni vivono solo nei signal in memoria. Refresh = tutto perso. Accettabile per demo, **bloccante** per produzione. Serve un vero backend o almeno `localStorage`. |
| 2 | 🟡 | **Nessun layer `environment`** | URL dati, base CDN GIF e flag dev sono hardcoded sparsi (`WorkoutApiService.DATA_URL`, `GIF_BASE`, `isDevMode()`). Per un deploy multi-ambiente serve `src/environments/`. |
| 3 | 🟡 | **Validazione dati al confine HTTP assente** | `http.get<AppData>()` è solo un cast a compile-time. Un JSON malformato rompe la UI silenziosamente. Considerare uno schema runtime (zod/valibot) o una `assertAppData()`. |
| 4 | 🟢 | **Gamification: design senza implementazione** | `docs/gamification-*.md` descrive un sistema XP/livelli/tier ricco; nel codice l'XP è un placeholder (`120 + doneSets*8` in `active-workout`). È un **documento di design** (dichiarato tale), non un bug — ma il gap va tracciato come backlog. |

### B.2 Codice sporco / duplicato

| # | Pri | Problema | Dove |
|---|-----|----------|------|
| 5 | 🟡 | **`PRESETS` duplicato identico** | Array `Preset[]` copiato 1:1 in `new-scheda.component.ts` e `scheda-detail.component.ts`. Va in `ui.constants.ts`. |
| 6 | 🟡 | **`ICONS` quasi-duplicato** | Liste icone Tabler in `new-scheda` (~95 voci) e `scheda-detail` (~47 voci) divergenti. Unica fonte condivisa. |
| 7 | 🟡 | **`interface PickedEx`/`Preset` duplicate** | Stesse interfacce ridichiarate in `new-scheda` e `scheda-detail` (più `PickedExercise` nel picker). Consolidare nei model. |
| 8 | 🟡 | **Logica prefix-match duplicata** | Lo stesso algoritmo "chiave più lunga che è prefisso del nome" è in `WorkoutStore.muscleIdForExercise` e `ExerciseImageService.resolveId`. Estrarre un helper puro condiviso. |
| 9 | 🟢 | **`onMusclePicked` duplicato** | Identico in `new-scheda` e `scheda-detail`. |
| 10 | 🟢 | **`badgeClass`/`totalSets`/`coverBg` ripetuti** | Piccoli helper di presentazione replicati tra componenti. |
| 11 | 🟢 | **`GIF_IDS` (47 voci) ora ridondante** | Da quando esiste `ExerciseCatalogService`, la mappa statica in `exercise-image.service.ts` è solo fallback legacy. Verificare se ancora necessaria. |

### B.3 Bug o rischi

| # | Pri | Problema | Dove | Stato |
|---|-----|----------|------|-------|
| 12 | 🔴 | **`npm run import:exercises` rotto** | `package.json` puntava a `scripts/fetch-exercise-catalog.mjs` **inesistente** (cartella `scripts/` assente). | ✅ **CORRETTO** (script rimosso) |
| 13 | 🔴 | **`latencyInterceptor` in produzione** | Aggiungeva 650ms a ogni GET mock **anche nel bundle prod**. | ✅ **CORRETTO** (incluso solo con `isDevMode()`) |
| 14 | 🟡 | **`WorkoutStore.user` poteva crashare** | Unico getter con `!` (non-null assertion): lettura pre-`load()` → "Cannot read properties of null". | ✅ **CORRETTO** (fallback `EMPTY_USER`) |
| 15 | 🟡 | **Prefix-match non semantico** | `muscleIdForExercise`/`resolveId`: due esercizi con prefisso comune → gruppo/GIF sbagliati. Documentato, ma resta un rischio dati. | Proposto (B.5) |
| 16 | 🟡 | **Rinominare un esercizio perde muscle/icon** | `saveEdit` recupera `muscle`/`icon` dall'originale **per nome**: se il nome cambia, ricadono ai default. | Proposto |
| 17 | 🟢 | **`home.xpPct` senza guardia /0** | `user.xp / user.xpNext` assume `xpNext>0`. Mitigato dal nuovo `EMPTY_USER` (xpNext=1), ma dati reali con `xpNext=0` darebbero `Infinity`. | Parz. mitigato |
| 18 | 🟢 | **`coverflow.center` può essere `undefined`** | `schede[cur()]` se l'array si svuota; i template lo gestiscono ma il tipo mente (`: Scheda`). | Proposto |

### B.4 Performance / scalabilità

| # | Pri | Problema | Dettaglio |
|---|-----|----------|-----------|
| 19 | 🟡 | **19 PNG inutilizzati nel bundle** | `src/assets/icons/` conteneva 21 PNG, solo `home.png`/`weightlifting.png` referenziati. Gli altri venivano copiati nel `dist`. | ✅ **CORRETTO** (19 file rimossi) |
| 20 | 🟢 | **`statsLine`/`metaInfo` ricalcolati a ogni CD** | In `ExerciseCard` sono getter; con OnPush + input statici l'impatto è minimo, ma su liste lunghe si potrebbero memoizzare. |
| 21 | 🟢 | **`exercisesByMuscle`/`muscleByExercise` ricomputati** | Sono `computed` (cache automatica) → ok. Nessun intervento necessario, solo nota. |
| 22 | 🟢 | **Catalogo: 48 esercizi vs "migliaia"** | Gli header parlano di scalare a migliaia; lo snapshot reale è 48 (13KB). La cache `localStorage` reggerebbe, ma documentare la dimensione attesa. |

### B.5 Manutenzione

| # | Pri | Problema | Dettaglio |
|---|-----|----------|-----------|
| 23 | 🟡 | **Nessun test** | Zero unit/e2e. Per produzione servono almeno test su `WorkoutStore` (selettori, grouping, prefix-match) e sulle guardie. |
| 24 | 🟡 | **Nessun lint/format in CI** | C'è `.editorconfig` ma niente ESLint/Prettier né script `lint`/`test` in `package.json`. |
| 25 | 🟢 | **Magic number sparsi** | `2400` (toast), `650` (latency), `42`/`60` (drag/click coverflow), `88` (volume stimato), `±15s` recupero. Estrarre costanti nominate. |
| 26 | 🟢 | **Commenti tutorial molto verbosi** | Ogni file ha header didattici (DI/signals/RxJS per dev Java). **Scelta intenzionale, mantenuta su richiesta.** Nota: per un team senior alzano il rumore; valutare di spostarli in un `CONTRIBUTING.md` se il pubblico cambia. |

---

## C. Migliorie applicate o proposte

### C.1 Applicate in questo audit (build verificata ✅)

1. **🔴 `latencyInterceptor` solo in dev** — `app.config.ts` ora include il ritardo finto solo
   con `isDevMode()`. La build di produzione non paga più i 650ms artificiali.
   ```ts
   provideHttpClient(
     withInterceptors(
       isDevMode() ? [latencyInterceptor, errorInterceptor] : [errorInterceptor],
     ),
   ),
   ```
2. **🔴 Script npm rotto rimosso** — eliminato `"import:exercises"` da `package.json` (puntava a
   un file inesistente). Se serve rigenerare il catalogo, va prima ripristinato lo script
   `scripts/fetch-exercise-catalog.mjs`.
3. **🟡 `WorkoutStore.user` reso sicuro** — fallback a `EMPTY_USER` (con `xpNext=1`) invece del
   `!`, coerente con tutti gli altri getter. Niente più crash potenziale "Cannot read
   properties of null"; mitiga anche la divisione `xpPct`.
4. **🟢 Asset morti rimossi** — eliminati 19 PNG inutilizzati da `src/assets/icons/`
   (conservati solo `home.png` e `weightlifting.png`). Bundle più snello, niente file orfani.

### C.2 Proposte (NON applicate — richiedono decisioni o test)

1. **Persistenza (🔴)** — introdurre un `PersistenceService` che fa mirror dello store su
   `localStorage` (o un vero backend). Minimo: serializzare `schede` create/modificate.
2. **Layer `environment` (🟡)** — `src/environments/environment[.prod].ts` per `DATA_URL`,
   `GIF_BASE`, flag. Rimuove gli hardcode sparsi.
3. **Validazione runtime (🟡)** — `assertAppData(json)` o schema (zod) in `WorkoutApiService`
   per fallire forte e chiaro su JSON malformato.
4. **Dedup costanti (🟡)** — spostare `PRESETS`, `ICONS`, `Preset`/`PickedEx` in
   `ui.constants.ts` / `core/models`. Elimina i punti 5–7, 9.
5. **Helper prefix-match condiviso (🟡)** — estrarre `longestPrefixMatch(map, name)` puro e
   riusarlo in store + image service (punto 8). Opzionale: passare a match per token/normalizzato
   per ridurre il rischio 15.
6. **Fix rinomina esercizio (🟡)** — in `saveEdit`, derivare `muscle` da `MUSCLE_META` via
   `muscleIdForExercise(nuovoNome)` invece che dal nome originale (punto 16).
7. **Test + lint (🟡)** — aggiungere ESLint/Prettier + Vitest/Karma con copertura su
   `WorkoutStore`, `SessionService`, `activeSessionGuard`, `ExerciseCatalogService.sanitize`.
8. **Costanti nominate (🟢)** — estrarre i magic number (punto 25).

---

## D. Documentazione del sistema

### D.1 Come il frontend interagisce con il "backend"

Non esiste un backend applicativo. Il **data access layer** (`WorkoutApiService`) esegue una
singola `HttpClient.get<AppData>('assets/mock/app-data.json')`. La risposta attraversa la catena
di interceptor e torna come `Observable<AppData>` al `WorkoutStore`, che la conserva. Un secondo
asset (`assets/data/exercise-catalog.json`) è caricato dall'`ExerciseCatalogService`.

> Punto di estensione: per collegare un backend reale basta cambiare `DATA_URL` (e, se la API è
> spezzata, suddividere `loadAppData()` in più chiamate `forkJoin`). Nessun componente cambia,
> perché tutti leggono dallo store.

### D.2 Flusso di una richiesta (request lifecycle)

```
Componente / AppComponent
        │  store.load()
        ▼
WorkoutStore  ── status='loading', error=null
        │  api.loadAppData()
        ▼
WorkoutApiService.http.get<AppData>(DATA_URL)
        │  (Observable lazy — parte al subscribe dello store)
        ▼
[ latencyInterceptor ]   (+650ms, SOLO build dev)
        ▼
[ errorInterceptor ]     (su errore: console.error + Error con messaggio pulito)
        ▼
Browser fetch → assets/mock/app-data.json
        │
   ┌────┴─────────────────────────┐
   ▼ success                       ▼ error
data.set(payload)             _error.set(msg)
status='loaded'              status='error'
   │                              │
   ▼                              ▼
getter reattivi               PhoneShell mostra ErrorState
→ le viste si disegnano       → (retry)="store.load()"
```

### D.3 Struttura dei moduli e dipendenze

```
main.ts
 └─ AppComponent ───────────────┬─ ThemeService (effect → <html data-theme> + localStorage)
                                └─ PhoneShellComponent
                                     ├─ gate: WorkoutStore.loading()/error()
                                     ├─ <router-outlet> → feature (lazy)
                                     ├─ BottomNavComponent ── SessionService, Router
                                     ├─ ToastComponent ────── ToastService
                                     ├─ LoadingOverlayComponent
                                     └─ ErrorStateComponent

WorkoutStore  ──depends──▶ WorkoutApiService ──▶ HttpClient
      │                    ExerciseCatalogService ──▶ HttpClient + localStorage
      │                    ui.constants (MACRO_SECTIONS, macroForMuscle)
      ▼ usato da
   (tutte le feature) + SessionService + ExerciseCard

SessionService ──depends──▶ WorkoutStore, Router        ◀── activeSessionGuard (hasActiveSession)
ExerciseImageService ──depends──▶ ExerciseCatalogService (+ mappa GIF_IDS fallback)
```

**Regola di dipendenza** (rispettata): `features` → `core/services` → `core/models`/`constants`.
I componenti non chiamano mai `HttpClient` direttamente né si parlano tra loro se non via servizi
o pattern smart/dumb (`@Input`/`@Output`). `shared/components` non dipendono da `features`.

### D.4 Lifecycle delle operazioni principali

**Sessione di allenamento**
```
/schede o /home
   │ tap card centrale (coverflow) → state.openScheda(id, autoDialog)
   ▼
/scheda/:id  ── scheda = computed(getScheda(viewSchedaId ?? routeId))
   │ "Inizia" → state.beginSession(id)   [sessionSchedaId=id]
   ▼
activeSessionGuard  ── hasActiveSession()? sì → procede / no → /home
   ▼
/active (ActiveWorkoutComponent)
   ├─ ngOnInit: build log[ei][si] (guessKg/targetReps), restDef, skipped; ticker 1s
   ├─ toggleSet → clona log (immutabile) → avvia rest timer
   ├─ computed: totalSets, doneSets, pct, volume, active
   ├─ ngOnDestroy: clearInterval(ticker)        ← critico (no leak)
   │ "Termina" → buildSummary() → state.finishSession(summary)  [sessionSchedaId=null]
   ▼
/summary  ── legge state.summary() (snapshot), toHome()/toProgress() → clearSummary()
```

**Modifica scheda** (copy-on-edit)
```
enterEditMode()  → copia s.* nei signal di bozza (editName/editIcon/editAccent/editExs)
   │ modifiche live sui signal di bozza (preset, kg, rest, add/remove)  → flashSaved feedback
   ├─ cancelEdit()  → editMode=false  (bozza scartata, store intatto)
   └─ saveEdit()    → ricostruisce Scheda → store.updateScheda() → toast
```

### D.5 Note critiche per chi mette in produzione (checklist)

- [ ] **Persistenza** dati (B.1 #1) — bloccante.
- [ ] **Backend/URL** reali via `environment` (#2).
- [ ] **Validazione** payload (#3).
- [ ] Test su store/guard/catalog (#23) + ESLint/Prettier in CI (#24).
- [ ] Verificare dipendenza dal **CDN GIF esterno** (`static.exercisedb.dev`): offline-fallback già
      gestito a livello UI (`(error)` → icona), ma valutare hosting proprio degli asset.
- [x] Latency interceptor neutralizzato in prod.
- [x] Script npm rotto rimosso.
- [x] Crash-guard su `user`.
- [x] Asset morti rimossi.

---

### Appendice — File toccati da questo audit

| File | Modifica |
|------|----------|
| `src/app/app.config.ts` | `latencyInterceptor` solo con `isDevMode()` |
| `package.json` | rimosso script `import:exercises` (target inesistente) |
| `src/app/core/services/workout-store.service.ts` | `EMPTY_USER` + getter `user` senza `!` |
| `src/assets/icons/*.png` | rimossi 19 PNG inutilizzati |
