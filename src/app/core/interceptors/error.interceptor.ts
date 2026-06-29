/**
 * ============================================================================
 *  FILE: error.interceptor.ts  —  NORMALIZZAZIONE ERRORI HTTP (middleware)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Intercetta TUTTI gli errori delle chiamate HTTP e li trasforma in un
 *   messaggio leggibile dall'utente, in un punto solo. Per uno sviluppatore
 *   Java: è un filtro/handler di eccezioni globale per le response (tipo un
 *   @ControllerAdvice, ma lato client e per le richieste in uscita).
 *
 * QUALE PROBLEMA RISOLVE
 *   Evita che ogni componente debba interpretare a mano gli HttpErrorResponse
 *   grezzi. Qui l'errore tecnico diventa una frase comprensibile; lo store la
 *   mostra nell'error-state.
 *
 * COSA RAPPRESENTA / ORDINE
 *   Un HttpInterceptorFn registrato in app.config.ts. Gira DOPO il
 *   latencyInterceptor (l'ordine nell'array conta).
 *
 * FLUSSO DEI DATI
 *   richiesta → next(req) → se la response è un errore, catchError lo cattura →
 *   logga in console per il dev → rilancia un Error con messaggio pulito →
 *   arriva al .subscribe() dello store (callback error) → UI di errore.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - err.status === 0 significa "rete assente / CORS / richiesta annullata",
 *     NON un codice HTTP del server: messaggio diverso di proposito.
 *   - Il console.error('[HTTP]', ...) è la traccia da cercare nei DevTools per
 *     capire metodo, URL ed errore reale dietro al messaggio pulito.
 * ============================================================================
 */

// HttpErrorResponse: tipo che rappresenta una risposta HTTP con errore
// HttpInterceptorFn: tipo funzionale per un interceptor HTTP (approccio moderno Angular v15+)
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
// catchError: operatore RxJS che intercetta gli errori nell'Observable
// throwError: operatore RxJS che crea un Observable che emette subito un errore
import { catchError, throwError } from 'rxjs';

/**
 * Interceptor HTTP centralizzato per la gestione degli errori.
 *
 * Un interceptor in Angular è come un "middleware" HTTP:
 * si inserisce tra ogni richiesta/risposta e può trasformarla.
 * Viene registrato globalmente in app.config.ts con withInterceptors().
 *
 * HttpInterceptorFn riceve:
 *   - req: la richiesta HTTP in uscita
 *   - next: la funzione che "passa avanti" la richiesta (come next() in Express)
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  // next(req) restituisce un Observable della risposta HTTP
  // .pipe() incatena operatori RxJS sulla risposta
  next(req).pipe(
    // catchError intercetta qualsiasi errore nell'Observable
    catchError((err: HttpErrorResponse) => {
      // err.status === 0 → nessuna connessione di rete
      // altrimenti → errore HTTP dal server (404, 500, ecc.)
      const message =
        err.status === 0
          ? 'Connessione assente. Controlla la rete e riprova.'
          : `Errore ${err.status}: impossibile completare la richiesta.`;

      // Logga l'errore nella console (visibile negli strumenti del browser)
      console.error('[HTTP]', req.method, req.url, err);

      // throwError() rilancia l'errore come nuovo Observable di errore,
      // ma ora con un messaggio pulito invece del raw HttpErrorResponse
      return throwError(() => new Error(message));
    }),
  );
