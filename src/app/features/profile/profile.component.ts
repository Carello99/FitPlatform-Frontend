/**
 * ============================================================================
 *  FILE: profile.component.ts  —  SCHERMATA PROFILO (feature)
 * ============================================================================
 *  SCOPO: identità utente, livello/XP, badge, lista impostazioni, toggle tema.
 *  COSA RAPPRESENTA: pagina del tab "Profilo". Buon esempio di più servizi
 *    iniettati insieme: Store (dati utente), ThemeService (dark/light),
 *    ToastService (feedback), Router (navigazione).
 *  FLUSSO DATI: store.user → header + getter xpPct (barra livello). Le voci
 *    `settings`: se hanno `go` navigano, altrimenti mostrano un toast
 *    placeholder (funzioni non ancora implementate).
 *  DIPENDENZE / USATO IN: rotta /profile.
 *  DEBUG: xpPct evita /0 quando xpNext è 0. `mini` sono valori statici demo,
 *    non calcolati dai dati reali.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { Accent } from '../../core/models/workout.models';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { GamificationService } from '../../core/gamification/gamification.service';

// Interfaccia locale per le voci del menu impostazioni
interface Setting {
  ic: string;    // Classe CSS icona
  tile: Accent;  // Colore del riquadro
  t: string;     // Testo della voce
  r?: string;    // Valore secondario opzionale (es. "5 / sett.")
  go?: string;   // Route opzionale su cui navigare al tap
  act?: 'reset'; // Azione speciale (es. reset onboarding per testing)
}

/**
 * Schermata Profilo — identità utente, livello, badge, impostazioni.
 *
 * Dimostra come più servizi vengono iniettati e usati insieme:
 * - WorkoutStore: dati utente
 * - ThemeService: toggle dark/light
 * - ToastService: feedback visivo
 * - Router: navigazione
 */
@Component({
  selector: 'ff-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [], // Nessun componente figlio personalizzato
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  readonly w = inject(WorkoutStore);
  readonly gami = inject(GamificationService);  // Progressione reale (livello/XP/badge)
  readonly toast = inject(ToastService);        // "readonly" ma non "private" — usato nel template
  readonly theme = inject(ThemeService);        // "readonly" ma non "private" — usato nel template
  private readonly router = inject(Router);     // Privato — usato solo nel TS, non nel template
  readonly TILE_CLASS = TILE_CLASS;

  // Percentuale XP (0-1) per la progress bar del livello
  get xpPct(): number {
    const u = this.w.user;
    return u.xpNext > 0 ? u.xp / u.xpNext : 0;
  }

  // Mini-statistiche reali: allenamenti totali, Ritmo (settimane), badge sbloccati.
  // Getter così restano allineate alla gamification dopo ogni allenamento.
  get mini(): [string, string][] {
    return [
      [String(this.gami.totalWorkouts()), 'Allenamenti'],
      [String(this.gami.weeksStreak()), 'Ritmo 🔥'],
      [String(this.gami.unlockedCount()), 'Badge'],
    ];
  }

  // Lista delle voci del menu impostazioni (getter: l'obiettivo settimanale
  // riflette il valore reale impostato dall'onboarding/gamification).
  get settings(): Setting[] {
    return [
      { ic: 'ti-user-cog',       tile: 'slate',  t: 'Account e dati personali' },
      { ic: 'ti-adjustments-alt', tile: 'cyan',  t: 'Rivedi posizionamento', go: 'onboarding' },
      { ic: 'ti-target-arrow',   tile: 'amber',  t: 'Obiettivi settimanali', r: `${this.w.weekGoal} / sett.` },
      { ic: 'ti-bell',           tile: 'cyan',   t: 'Notifiche e promemoria' },
      { ic: 'ti-device-watch',   tile: 'green',  t: 'Dispositivi connessi' },
      { ic: 'ti-lifebuoy',       tile: 'violet', t: 'Help Desk', go: 'help' },
      // Voce di sviluppo: azzera la progressione e rifà l'onboarding da capo.
      { ic: 'ti-refresh',        tile: 'rose',   t: 'Rifai onboarding (reset)', act: 'reset' },
    ];
  }

  /** Gestisce il tap su una voce delle impostazioni. */
  onSetting(s: Setting): void {
    if (s.act === 'reset') {
      // Azzera la progressione: l'app reindirizza da sola all'onboarding
      // (needsOnboarding torna true → effect in AppComponent).
      this.gami.reset();
      this.toast.show('Progressione azzerata · si riparte!', 'ti-refresh');
      void this.router.navigate(['/onboarding']);
    } else if (s.go) {
      // Se la voce ha una route, naviga
      void this.router.navigate(['/' + s.go]);
    } else {
      // Altrimenti mostra un toast (placeholder)
      this.toast.show('Apertura…', 'ti-settings');
    }
  }
}
