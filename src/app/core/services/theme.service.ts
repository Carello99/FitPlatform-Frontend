/**
 * ============================================================================
 *  FILE: theme.service.ts  —  GESTIONE TEMA (dark / light) + persistenza
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Tiene il tema corrente, lo applica al documento e lo ricorda tra le
 *   sessioni (localStorage). Per uno sviluppatore Java: un piccolo service di
 *   "user preference" con effetto collaterale sul DOM.
 *
 * COSA RAPPRESENTA IN ANGULAR
 *   Service singleton. Espone un signal `theme`; un effect() reagisce ai suoi
 *   cambiamenti applicando l'attributo data-theme su <html> e salvando su disco.
 *
 * FLUSSO DEI DATI
 *   Avvio → readInitial() legge localStorage (default 'dark') → signal `theme`.
 *   toggle()/set() cambiano il signal → l'effect() (1) setta
 *   document.documentElement[data-theme] (i token CSS in _tokens.scss cambiano)
 *   e (2) riscrive localStorage. I componenti leggono theme()/isDark per la UI.
 *
 * DIPENDENZE PRINCIPALI
 *   - Nessun servizio Angular. Dipende dai CSS: i token in _tokens.scss devono
 *     definire l'override [data-theme='light'] perché il cambio sia visibile.
 *   - CHI LO USA: AppComponent (istanziato subito per evitare il flash) e le
 *     viste con lo switch tema (es. profile).
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - localStorage è racchiuso in try/catch: in navigazione privata / iframe
 *     sandbox può lanciare. L'app deve restare funzionante anche se fallisce.
 *   - Se il tema "non si applica", verificare che esista la regola CSS per
 *     [data-theme] corrispondente: qui si setta solo l'attributo.
 * ============================================================================
 */

// effect: esegue una funzione ogni volta che uno dei signal letti al suo interno cambia
// signal: crea un segnale reattivo
import { Injectable, effect, signal } from '@angular/core';
// Le chiavi di persistenza sono dichiarate nel registro centrale, mai inline.
import { STORAGE_THEME as STORAGE_KEY } from '../constants/storage.constants';

// Tipo TypeScript per i temi disponibili
export type Theme = 'dark' | 'light';

/**
 * Servizio che gestisce il tema dell'applicazione (dark/light).
 *
 * Funzionamento:
 * 1. Al primo avvio, legge il tema salvato in localStorage
 * 2. Lo applica all'attributo data-theme dell'elemento <html>
 * 3. Ogni volta che il tema cambia, aggiorna DOM e localStorage automaticamente
 *
 * I componenti leggono this.theme (signal) per reagire ai cambiamenti.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  // signal con valore iniziale preso da localStorage (o 'dark' se non trovato)
  // readInitial() viene chiamata UNA VOLTA alla creazione del servizio
  readonly theme = signal<Theme>(this.readInitial());

  constructor() {
    // effect(): esegue la funzione ogni volta che theme() cambia.
    // Angular rileva automaticamente quali signal sono letti nella funzione
    // e la ri-esegue quando cambiano.
    effect(() => {
      const value = this.theme(); // Legge il signal → Angular traccia questa dipendenza

      // Applica il tema all'elemento <html> → i CSS custom properties cambiano
      // Il file _tokens.scss usa [data-theme='light'] { ... } per sovrascrivere i colori
      document.documentElement.setAttribute('data-theme', value);

      try {
        // Salva la preferenza in localStorage per ricordarla al prossimo avvio
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // In modalità privata del browser, localStorage può essere non disponibile — ignoriamo l'errore
      }
    });
  }

  /** Alterna tra dark e light. */
  toggle(): void {
    // signal.update(): aggiorna il valore in base al valore corrente
    // t => è una arrow function che riceve il valore attuale
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  /** Imposta un tema specifico. */
  set(theme: Theme): void {
    // signal.set(): imposta un valore direttamente
    this.theme.set(theme);
  }

  /** true se il tema attuale è dark. Getter JavaScript — si accede senza parentesi. */
  get isDark(): boolean {
    return this.theme() === 'dark';
  }

  /** Legge il tema salvato in localStorage. Chiamata solo nel costruttore. */
  private readInitial(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Controlla che il valore salvato sia valido prima di usarlo
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      /* localStorage non disponibile (es. iframe sandboxed) */
    }
    return 'dark'; // Tema di default
  }
}
