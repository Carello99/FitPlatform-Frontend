/**
 * ============================================================================
 *  FILE: app-header.component.ts  —  HEADER DI SEZIONE (brand + streak + avatar)
 * ============================================================================
 *  SCOPO: la striscia alta comune a ogni sezione dell'app: wordmark FitFlow
 *    (→ Home), chip streak settimane (→ Profilo) e avatar con le iniziali
 *    utente (→ Profilo, unico accesso al profilo).
 *  COSA RAPPRESENTA: componente "dumb" riusabile. Legge WorkoutStore per lo
 *    streak e il nome; naviga col Router. Va messo in cima al template di ogni
 *    schermata con chrome (dentro/sopra il .screen-pad).
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WorkoutStore } from '../../core/services/workout-store.service';

@Component({
  selector: 'ff-app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host{display:block;flex:none}'],
  template: `
    <div class="row between" style="padding:4px 0 8px">
      <!-- Wordmark FitFlow → Home -->
      <button class="brand press" (click)="go('home')" aria-label="FitFlow">
        <span class="mark"><i class="ti ti-bolt-filled" aria-hidden="true"></i></span>
        <span class="word">Fit<span>Flow</span></span>
      </button>
      <!-- Streak settimane + avatar iniziali → Profilo -->
      <div class="row gap8">
        <button class="chip" (click)="go('profile')" style="padding:7px 11px" aria-label="Streak settimane">
          <i class="ti ti-flame-filled" style="font-size:15px;color:var(--amber)" aria-hidden="true"></i>
          <span style="color:var(--ink);font-weight:800">{{ w.user.streak }}</span>
          <span style="color:var(--ink-3);font-weight:600;font-size:12px">sett.</span>
        </button>
        <button (click)="go('profile')" aria-label="Profilo"
          style="width:38px;height:38px;border-radius:50%;background:var(--amber);border:none;display:flex;align-items:center;justify-content:center;position:relative;color:var(--amber-ink);font-size:14px;font-weight:800;letter-spacing:0.3px;box-shadow:var(--shadow-amber)">
          {{ userInitials }}
          <span style="position:absolute;top:1px;right:1px;width:9px;height:9px;border-radius:50%;background:var(--rose);box-shadow:0 0 0 2px var(--surface-0)"></span>
        </button>
      </div>
    </div>
  `,
})
export class AppHeaderComponent {
  readonly w = inject(WorkoutStore);
  private readonly router = inject(Router);

  /** Iniziali dell'utente per l'avatar (max 2 lettere). */
  get userInitials(): string {
    return this.w.user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }

  go(route: string): void {
    void this.router.navigate(['/' + route]);
  }
}
