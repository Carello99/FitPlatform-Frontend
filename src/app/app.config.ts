/**
 * ============================================================================
 *  FILE: app.config.ts  —  CONFIGURAZIONE GLOBALE (composition root / DI)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Registra una sola volta, all'avvio, tutti i servizi e le funzionalità
 *   disponibili in TUTTA l'app. Per uno sviluppatore Java: è il punto in cui
 *   si configura il "contenitore di dependency injection" (simile a una
 *   classe @Configuration di Spring che dichiara i bean condivisi).
 *
 * RESPONSABILITÀ PRINCIPALI
 *   - Abilitare il change detection "zoneless" (basato su Signals, senza Zone.js).
 *   - Registrare HttpClient con la catena di interceptor.
 *   - Registrare il Router con le rotte e il ripristino dello scroll.
 *
 * DIPENDENZE PRINCIPALI
 *   - routes (app.routes.ts), latencyInterceptor, errorInterceptor.
 *   - Consumato da main.ts tramite bootstrapApplication(AppComponent, appConfig).
 *
 * FLUSSO GENERALE
 *   main.ts avvia l'app passando questo config → Angular crea il contenitore DI
 *   con questi provider → ogni componente/servizio può poi fare inject() di ciò
 *   che è stato registrato qui.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - L'ORDINE degli interceptor in withInterceptors([]) è significativo: la
 *     richiesta li attraversa in quell'ordine (latency PRIMA di error).
 *   - Essendo "zoneless", aggiornamenti di stato fatti FUORI dai Signals
 *     potrebbero non ri-disegnare la UI: usare sempre signal()/computed().
 * ============================================================================
 */

// ApplicationConfig è il tipo TypeScript per la configurazione dell'app standalone
// provideZonelessChangeDetection: attiva il change detection senza Zone.js
import { ApplicationConfig, isDevMode, provideZonelessChangeDetection } from '@angular/core';
// provideHttpClient: registra HttpClient globalmente
// withInterceptors: collega gli interceptor HTTP (funzioni che si "agganciano" alle richieste)
import { provideHttpClient, withInterceptors } from '@angular/common/http';
// provideRouter: registra il router Angular
// withInMemoryScrolling: controlla il ripristino della posizione di scroll tra le route
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
// Interceptor che normalizza gli errori HTTP in messaggi leggibili
import { errorInterceptor } from './core/interceptors/error.interceptor';
// Interceptor che simula il ritardo di rete (utile in sviluppo per testare gli stati di caricamento)
import { latencyInterceptor } from './core/interceptors/latency.interceptor';

/**
 * Configurazione globale dell'applicazione.
 * Questo oggetto viene passato a bootstrapApplication() in main.ts.
 *
 * "providers" è un array di servizi/funzionalità disponibili globalmente.
 * Ogni provideXxx() è una "feature factory" di Angular.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Attiva il change detection SENZA Zone.js.
    // Zone.js è la libreria che Angular usava in passato per capire "quando aggiornare il DOM".
    // Con i Signals (moderni), non serve più: il cambiamento è tracciato precisamente.
    provideZonelessChangeDetection(),

    // Registra HttpClient con gli interceptor funzionali (applicati nell'ordine indicato).
    // 1. latencyInterceptor → ritardo artificiale alle chiamate mock. È un AIUTO DI
    //    SVILUPPO: si include SOLO con isDevMode() (build dev). In produzione viene
    //    omesso, così non rallenta le chiamate reali.
    // 2. errorInterceptor  → trasforma gli errori HTTP in messaggi user-friendly.
    provideHttpClient(
      withInterceptors(
        isDevMode() ? [latencyInterceptor, errorInterceptor] : [errorInterceptor],
      ),
    ),

    // Registra il router con le route definite in app.routes.ts.
    // withInMemoryScrolling ripristina la posizione di scroll quando si torna su una pagina.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
  ],
};
