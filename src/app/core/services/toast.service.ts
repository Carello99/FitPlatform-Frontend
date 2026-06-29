/**
 * ============================================================================
 *  FILE: toast.service.ts  —  NOTIFICHE TEMPORANEE ("toast")
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Permette a qualsiasi punto dell'app di mostrare un messaggio breve che
 *   appare e sparisce da solo (es. "Scheda aggiornata!"). Per uno sviluppatore
 *   Java: un mini event-bus a singolo slot per messaggi UI.
 *
 * COSA RAPPRESENTA / COME INTERAGISCE
 *   Service singleton. Espone il signal read-only `toast`; il componente
 *   ToastComponent (montato nella shell) lo osserva e lo renderizza. Pattern
 *   producer/consumer: chiunque chiama show(), un solo componente disegna.
 *
 * FLUSSO DEI DATI
 *   featureX.show('msg') → _toast.set({id,msg,icon}) → ToastComponent reagisce e
 *   mostra → dopo 2400ms un timer azzera _toast → il toast sparisce.
 *
 * DIPENDENZE PRINCIPALI
 *   - Nessuna. CHI LO USA: scheda-detail, new-scheda, profile, ... (qualsiasi
 *     azione che voglia un feedback non bloccante).
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - C'è UN SOLO slot: un nuovo show() sostituisce il toast precedente. Il
 *     controllo `current.id === id` nel timer evita che un timer vecchio
 *     spenga un toast nuovo (race condition tra due show ravvicinati).
 * ============================================================================
 */

import { Injectable, signal } from '@angular/core';

// Interfaccia che descrive i dati di una notifica toast
export interface ToastData {
  id: number;   // ID univoco (timestamp) per distinguere i toast
  msg: string;  // Messaggio da mostrare
  icon: string; // Classe CSS dell'icona
}

/**
 * Servizio per le notifiche "toast" (messaggi temporanei sovrapposti all'UI).
 *
 * Fornisce un signal che il componente ToastComponent osserva.
 * La notifica scompare automaticamente dopo 2.4 secondi.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  // Signal privato — modificabile solo da questo servizio
  private readonly _toast = signal<ToastData | null>(null);

  // Signal pubblico read-only — i componenti possono solo leggerlo
  // .asReadonly() rimuove i metodi .set() e .update()
  readonly toast = this._toast.asReadonly();

  // Riferimento al timer corrente (per poterlo cancellare se arriva un nuovo toast)
  // ReturnType<typeof setTimeout> è il tipo del valore restituito da setTimeout
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Mostra una notifica toast.
   * @param msg  - Il messaggio da mostrare
   * @param icon - Classe CSS dell'icona (default: icona di spunta)
   */
  show(msg: string, icon = 'ti-circle-check-filled'): void {
    // Date.now() restituisce il timestamp corrente in ms → ID univoco
    const id = Date.now();
    this._toast.set({ id, msg, icon }); // Mostra il toast

    // Cancella il timer precedente se c'è un toast già in corso
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // Programma la sparizione automatica dopo 2400ms
    this.timer = setTimeout(() => {
      const current = this._toast();
      // Controlla che il toast non sia già cambiato (nel caso arrivasse un nuovo show() prima dello scadere)
      if (current && current.id === id) {
        this._toast.set(null); // Nasconde il toast
      }
    }, 2400);
  }
}
