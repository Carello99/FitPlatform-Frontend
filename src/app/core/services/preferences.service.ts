/**
 * ============================================================================
 *  FILE: preferences.service.ts  —  PREFERENZE UI PERSISTENTI
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Custodisce le piccole preferenze dell'utente che sopravvivono alla chiusura
 *   dell'app ma non appartengono né al dominio dati (WorkoutStore) né alla
 *   progressione (GamificationService): scelte del tipo "non chiedermelo più".
 *
 * PERCHÉ ESISTE / QUALE PROBLEMA RISOLVE
 *   Queste preferenze nascevano come chiamate a localStorage dentro il
 *   componente che le usava. Funzionava, ma violava la regola di dipendenza
 *   dell'app (i componenti leggono lo stato dai servizi, non dal dispositivo) e
 *   rendeva la preferenza invisibile a chiunque non aprisse quel componente.
 *
 * COSA RAPPRESENTA IN ANGULAR
 *   Service singleton (providedIn:'root'). Ogni preferenza è un signal, così i
 *   template reagiscono al cambio senza logica aggiuntiva.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - localStorage può lanciare (Safari in navigazione privata, quota piena):
 *     ogni accesso è in try/catch e degrada al valore di default, mai in crash.
 * ============================================================================
 */

import { Injectable, signal } from '@angular/core';
import { STORAGE_SKIP_DELETE_CONFIRM } from '../constants/storage.constants';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  /**
   * true = l'utente ha spuntato "non chiedermelo più" nella conferma di
   * eliminazione di un esercizio: le prossime eliminazioni sono immediate.
   */
  readonly skipDeleteConfirm = signal<boolean>(this.read(STORAGE_SKIP_DELETE_CONFIRM));

  /** Registra la scelta "non chiedermelo più" (irreversibile dalla UI attuale). */
  setSkipDeleteConfirm(value: boolean): void {
    this.skipDeleteConfirm.set(value);
    this.write(STORAGE_SKIP_DELETE_CONFIRM, value);
  }

  private read(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false; // storage non disponibile → default prudente: chiedi conferma
    }
  }

  private write(key: string, value: boolean): void {
    try {
      if (value) {
        localStorage.setItem(key, '1');
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // storage non disponibile: la preferenza vale solo per questa sessione
    }
  }
}
