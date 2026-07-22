/**
 * ============================================================================
 *  FILE: bottom-nav.component.ts  —  BARRA DI NAVIGAZIONE INFERIORE (5 tab)
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   La barra fissa in basso: Home · Schede · CTA "Allena" (avvio rapido) ·
 *   Progressi · Coach. L'hub Coach raccoglie la relazione col PT (agenda e
 *   messaggi si aprono da lì, come sotto-pagine). Il Profilo è raggiungibile
 *   dall'avatar con le iniziali nell'header di sezione.
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
 *     '/scheda/*' → tab "schede". Se il tab
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
import { TrainerService } from '../../core/services/trainer.service';
import { AgendaRequestStore } from '../../core/services/agenda-request.service';

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
      <!-- Icone Tabler (font): l'accento amber sul tab attivo è applicato via
           color:var(--amber) in _layout.scss, coerente con le altre voci e con
           la barra di navigazione di FitPlatform PT. -->
      <button class="bn-item" [class.active]="current() === 'home'" (click)="go('home')">
        <i class="ti ti-home" aria-hidden="true"></i>
        <span class="bn-label">Home</span>
      </button>

      <button class="bn-item" [class.active]="current() === 'schede'" (click)="go('schede')">
        <i class="ic-mask ic-weightlifting" aria-hidden="true"></i>
        <span class="bn-label">Schede</span>
      </button>

      <button class="bn-item" [class.active]="current() === 'messaggi'" (click)="go('messaggi')">
        <i class="ti ti-message-circle" aria-hidden="true"></i>
        @if (trainer.unread(); as n) { <span class="bn-badge" [attr.aria-label]="n + ' messaggi non letti'">{{ n }}</span> }
        <span class="bn-label">Messaggi</span>
      </button>

      <!-- Il badge Agenda è ciò che fa uscire una richiesta dalla sua schermata:
           una cosa in sospeso non deve poter essere dimenticata (UX §19.4). -->
      <button class="bn-item" [class.active]="current() === 'agenda'" (click)="go('agenda')">
        <i class="ti ti-calendar" aria-hidden="true"></i>
        @if (requests.toAnswerCount(); as n) { <span class="bn-badge" [attr.aria-label]="n + ' richieste da confermare'">{{ n }}</span> }
        <span class="bn-label">Agenda</span>
      </button>

      <button class="bn-item" [class.active]="current() === 'personal-trainer'" (click)="go('personal-trainer')">
        <i class="ic-mask ic-gym" aria-hidden="true"></i>
        <span class="bn-label">Coach</span>
      </button>
    </nav>
  `,
})
export class BottomNavComponent {
  // session è "readonly" ma non "private" perché il template lo usa direttamente
  readonly session = inject(SessionService);
  readonly trainer = inject(TrainerService);
  readonly requests = inject(AgendaRequestStore);
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
   * Es: '/scheda/push' → 'schede'. Le pagine fuori dai 5 tab (profilo,
   * progressi, storico…) non evidenziano alcuna voce.
   */
  private resolve(url: string): string {
    // Le pagine di dettaglio scheda appartengono al tab "schede"
    // '/scheda/:id' e '/allenamento/:id' sono sotto-pagine dell'hub Schede.
    if (url.startsWith('/scheda') || url.startsWith('/allenamento')) {
      return 'schede';
    }
    // Il marketplace è sotto-pagina dell'hub Coach → tiene acceso "Coach"
    if (url.startsWith('/coach-marketplace')) {
      return 'personal-trainer';
    }
    // Rimuove query string (?...) e lo slash iniziale per ottenere il nome semplice
    const seg = url.split('?')[0].replace('/', '');
    return seg || 'home';
  }
}
