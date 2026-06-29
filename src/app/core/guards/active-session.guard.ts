/**
 * ============================================================================
 *  FILE: active-session.guard.ts  —  GUARDIA DI ROTTA per /active
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Impedisce di entrare nella schermata di allenamento attivo (/active) se non
 *   c'è davvero una sessione in corso. Per uno sviluppatore Java: è un filtro /
 *   interceptor di accesso eseguito PRIMA di "aprire" la pagina.
 *
 * QUALE PROBLEMA RISOLVE
 *   Senza guardia, digitando /active nell'URL o ricaricando la pagina (F5, che
 *   azzera lo stato in memoria) l'utente vedrebbe una schermata di allenamento
 *   senza dati → crash o UI rotta. La guardia lo rimanda a /home.
 *
 * COSA RAPPRESENTA IN ANGULAR
 *   Un CanActivateFn (guardia funzionale, Angular v15+), agganciato a /active in
 *   app.routes.ts via `canActivate: [activeSessionGuard]`.
 *
 * FLUSSO / DIPENDENZE
 *   Router sta per attivare /active → esegue questa funzione →
 *   SessionService.hasActiveSession() decide → true = procede, altrimenti
 *   UrlTree('/home') = redirect. Dipende da SessionService e Router.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - Se /active reindirizza sempre a /home, la causa è sessionSchedaId === null
 *     in SessionService (es. arrivo diretto da URL o refresh): è il comportamento
 *     voluto, non un bug.
 *   - inject() qui funziona perché la guardia gira nel contesto DI di Angular.
 * ============================================================================
 */

import { inject } from '@angular/core';
// CanActivateFn: tipo per una "guardia" di navigazione (funzione, approccio moderno)
// Router: servizio per la navigazione programmatica
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/**
 * Guardia di navigazione per la rotta /active.
 *
 * In Angular, un Guard è una funzione (o classe) che Angular esegue PRIMA
 * di navigare verso una rotta. Può permettere o bloccare la navigazione.
 *
 * Questo guard impedisce all'utente di accedere a /active se non ha una
 * sessione di allenamento in corso (es. se aggiorna la pagina o arriva
 * direttamente dall'URL).
 *
 * CanActivateFn è il tipo funzionale moderno (Angular v15+).
 * Il vecchio approccio usava una classe con implements CanActivate.
 */
export const activeSessionGuard: CanActivateFn = () => {
  // inject() funziona anche fuori dalle classi, purché sia nel contesto di iniezione Angular
  const session = inject(SessionService);
  const router = inject(Router);

  // Se c'è una sessione attiva → restituisce true → navigazione permessa
  // Altrimenti → restituisce un UrlTree → Angular reindirizza a /home
  // router.createUrlTree() crea un "albero URL" che Angular usa per il redirect
  return session.hasActiveSession() ? true : router.createUrlTree(['/home']);
};
