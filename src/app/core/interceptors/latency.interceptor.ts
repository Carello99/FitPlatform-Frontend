/**
 * ============================================================================
 *  FILE: latency.interceptor.ts  —  RITARDO FINTO (solo sviluppo)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Aggiunge ~650ms di ritardo alle chiamate verso i file mock, così gli stati
 *   di caricamento (spinner/skeleton) si vedono davvero in sviluppo. Senza,
 *   il JSON locale risponderebbe istantaneamente e la UI di loading non
 *   apparirebbe mai (rendendo impossibile testarla).
 *
 * COSA RAPPRESENTA / ORDINE
 *   Un HttpInterceptorFn registrato in app.config.ts, PRIMA dell'errorInterceptor.
 *
 * FLUSSO / DIPENDENZE
 *   Filtra: ritarda SOLO le GET verso 'assets/mock/'. Ogni altra richiesta
 *   passa intatta. Dipende solo da RxJS (delay).
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - In produzione va RIMOSSO dall'array in app.config.ts (è solo un aiuto dev).
 *   - Se i caricamenti "sembrano lenti" in locale, il responsabile è questo
 *     ritardo artificiale, non la rete o il codice.
 * ============================================================================
 */

import { HttpInterceptorFn } from '@angular/common/http';
// delay: operatore RxJS che ritarda l'emissione dei valori di N millisecondi
import { delay } from 'rxjs';

/**
 * Interceptor che simula la latenza di rete in sviluppo.
 *
 * Siccome i dati arrivano da un file JSON locale (assets/mock/app-data.json),
 * la risposta sarebbe istantanea. Questo interceptor aggiunge un ritardo
 * di 650ms per far sì che gli stati di "caricamento" (spinner, skeleton)
 * vengano effettivamente visualizzati durante lo sviluppo.
 *
 * In produzione, questo interceptor si rimuove semplicemente
 * dalla lista in app.config.ts.
 */
export const latencyInterceptor: HttpInterceptorFn = (req, next) => {
  // Applica il ritardo SOLO alle richieste GET verso i file mock.
  // Per qualsiasi altra richiesta, passa direttamente senza ritardo.
  const isMock = req.method === 'GET' && req.url.includes('assets/mock/');

  // Operatore ternario: se è una richiesta mock, aggiungi delay(650ms), altrimenti passa direttamente
  return isMock ? next(req).pipe(delay(650)) : next(req);
};
