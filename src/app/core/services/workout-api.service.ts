/**
 * ============================================================================
 *  FILE: workout-api.service.ts  —  DATA ACCESS LAYER (solo trasporto HTTP)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Fa UNA cosa sola: la chiamata HTTP che scarica i dati dell'app. Niente
 *   stato, niente logica di business, niente trasformazioni. Per uno
 *   sviluppatore Java: è il @Repository / client REST puro, separato dal
 *   "service" che orchestra lo stato (quello è WorkoutStore).
 *
 * PERCHÉ ESISTE / QUALE PROBLEMA RISOLVE
 *   Isolare il "come si recuperano i dati" dal "dove si conservano". Domani il
 *   backend reale sostituisce il file mock cambiando SOLO DATA_URL (e, se serve,
 *   spezzando loadAppData in più chiamate): il resto dell'app non se ne accorge.
 *
 * FLUSSO DEI DATI
 *   WorkoutStore.load() → loadAppData() → HTTP GET su assets/mock/app-data.json
 *   → la risposta passa per gli interceptor (latency, error) → torna come
 *   Observable<AppData> a chi ha fatto .subscribe() (lo store).
 *
 * DIPENDENZE PRINCIPALI
 *   - HttpClient (registrato in app.config.ts con gli interceptor).
 *   - AppData (workout.models.ts): tipizza la risposta.
 *   - CHI LO USA: solo WorkoutStore.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - get<AppData>() NON valida davvero il JSON: il generic è solo un cast a
 *     compile-time. Se il file ha una forma diversa, l'errore emerge a valle.
 *   - L'Observable è "lazy": senza .subscribe() la richiesta non parte.
 * ============================================================================
 */

// HttpClient: servizio Angular per le chiamate HTTP (GET, POST, PUT, DELETE, ecc.)
import { HttpClient } from '@angular/common/http';
// Injectable: decoratore che rende la classe iniettabile come servizio
import { Injectable, inject } from '@angular/core';
// Observable: tipo RxJS — rappresenta un flusso di dati asincroni (come una Promise, ma più potente)
import { Observable } from 'rxjs';
import { AppData } from '../models/workout.models';

/**
 * Livello di accesso ai dati (Data Access Layer).
 *
 * Questo servizio ha UN'UNICA responsabilità: fare la chiamata HTTP.
 * Non gestisce lo stato, non trasforma i dati, non ha logica di business.
 * Tutta la gestione dello stato sta in WorkoutStore.
 *
 * Separare "trasporto" da "stato" è un pattern consigliato in Angular.
 *
 * In questa demo, il "backend" è un file JSON statico in assets/.
 * Per passare a un vero backend, basta cambiare DATA_URL.
 */
@Injectable({
  // providedIn: 'root' → Angular crea UNA SOLA istanza di questo servizio
  // per tutta l'applicazione (singleton) e la mette a disposizione ovunque.
  // Non serve registrarlo in nessun providers[].
  providedIn: 'root',
})
export class WorkoutApiService {
  // Proprietà statica: appartiene alla classe, non alle istanze.
  // private → non accessibile dall'esterno della classe.
  // readonly → non modificabile dopo l'inizializzazione.
  private static readonly DATA_URL = 'assets/mock/app-data.json';

  // inject(HttpClient) richiede ad Angular di fornire il servizio HttpClient
  private readonly http = inject(HttpClient);

  /**
   * Carica il payload completo dell'applicazione.
   * Restituisce un Observable<AppData>:
   *   - Non fa la chiamata HTTP subito — solo quando qualcuno fa .subscribe()
   *   - Il generics <AppData> dice ad Angular come tipizzare la risposta JSON
   */
  loadAppData(): Observable<AppData> {
    // http.get<T>() fa una richiesta GET e mappa la risposta JSON al tipo T
    return this.http.get<AppData>(WorkoutApiService.DATA_URL);
  }
}
