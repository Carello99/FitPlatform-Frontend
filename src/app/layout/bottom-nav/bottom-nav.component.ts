/**
 * ============================================================================
 *  FILE: bottom-nav.component.ts  —  BARRA DI NAVIGAZIONE INFERIORE (4 tab)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   La barra fissa in basso con i tab principali (Home, Schede, Progressi,
 *   Profilo). Naviga e mostra quale sezione è attiva.
 *
 * COSA RAPPRESENTA / DOVE VIVE
 *   Componente standalone renderizzato dalla shell quando la rotta ha
 *   chrome:true. Tiene il signal `current` = tab da evidenziare.
 *
 * FLUSSO DEI DATI
 *   click → go(route) → Router naviga. In parallelo, ogni NavigationEnd →
 *   resolve(url) ricava il nome del tab → current.set() → il template applica
 *   la classe .active. `current` è inizializzato dall'URL corrente così il tab
 *   giusto è evidenziato anche al primo caricamento / refresh.
 *
 * DIPENDENZE PRINCIPALI
 *   - Router (navigazione + eventi). SessionService è iniettato per uso del
 *     template (azioni rapide). CHI LO MOSTRA: PhoneShellComponent.
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - resolve() rimappa di proposito alcune rotte sul tab "genitore":
 *     '/scheda/*' → tab "schede", '/history' → tab "profile". Se il tab
 *     evidenziato sembra "sbagliato" su quelle pagine, la regola è qui.
 *   - Le icone PNG attive NON si colorano via CSS color: si usa un filtro
 *     (brightness/sepia/hue-rotate) per simulare l'accento amber sui raster.
 * ============================================================================
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionService } from '../../core/services/session.service';

/**
 * Barra di navigazione inferiore con 4 tab.
 *
 * Usa un signal `current` per tenere traccia del tab attivo.
 * Si aggiorna ad ogni NavigationEnd per evidenziare la voce corretta.
 */
@Component({
  selector: 'ff-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- aria-label: testo accessibile per screen reader (accessibilità) -->
    <nav class="bottomnav" aria-label="Navigazione principale">

      <!-- [class.active]="condizione": aggiunge la classe CSS "active" solo se la condizione è vera -->
      <!-- (click)="metodo()": event binding — chiama il metodo al click -->
      <!-- Quando il pulsante ha la classe "active", il CSS in _layout.scss applica un filtro
           amber all'immagine tramite brightness/invert/sepia/hue-rotate, replicando l'effetto
           di "color:var(--amber)" che funziona solo sulle icone font -->
      <button class="bn-item" [class.active]="current() === 'home'" (click)="go('home')">
        <img src="assets/icons/home.png" alt="" aria-hidden="true" />
        <span class="bn-label">Home</span>
      </button>

      <button class="bn-item" [class.active]="current() === 'schede'" (click)="go('schede')">
        <img src="assets/icons/weightlifting.png" alt="" aria-hidden="true"/>
        <span class="bn-label">Schede</span>
      </button>

      <button class="bn-item" [class.active]="current() === 'progress'" (click)="go('progress')">
        <i class="ti ti-chart-line" aria-hidden="true"></i>
        <span class="bn-label">Progressi</span>
      </button>

      <button class="bn-item" [class.active]="current() === 'profile'" (click)="go('profile')">
        <i class="ti ti-user" aria-hidden="true"></i>
        <span class="bn-label">Profilo</span>
      </button>
    </nav>
  `,
})
export class BottomNavComponent {
  // session è "readonly" ma non "private" perché il template lo usa direttamente
  readonly session = inject(SessionService);
  private readonly router = inject(Router);

  // Inizializzato con il nome del tab corrispondente all'URL corrente
  readonly current = signal<string>(this.resolve(this.router.url));

  constructor() {
    // Aggiorna il tab evidenziato ad ogni navigazione completata
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      // urlAfterRedirects: URL finale dopo eventuali redirect (es. '' → 'home')
      .subscribe((e) => this.current.set(this.resolve(e.urlAfterRedirects)));
  }

  /** Naviga alla route specificata. */
  go(route: string): void {
    void this.router.navigate(['/' + route]);
  }

  /**
   * Converte l'URL corrente nel nome del tab da evidenziare.
   * Es: '/scheda/push' → 'schede', '/history' → 'profile'
   */
  private resolve(url: string): string {
    // Le pagine di dettaglio scheda appartengono al tab "schede"
    if (url.startsWith('/scheda')) {
      return 'schede';
    }
    // Lo storico è accessibile dal tab "profilo"
    if (url.startsWith('/history')) {
      return 'profile';
    }
    // Rimuove query string (?...) e lo slash iniziale per ottenere il nome semplice
    const seg = url.split('?')[0].replace('/', '');
    return seg || 'home';
  }
}
