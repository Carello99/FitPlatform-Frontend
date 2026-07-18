/**
 * ============================================================================
 *  FILE: messaggi.component.ts  —  CHAT col Personal Trainer (lato UTENTE)
 * ============================================================================
 *  SCOPO: singola conversazione utente ↔ suo PT (bolle + composer). Ripreso il
 *    layout chat di FitPlatform PT ma senza lista multi-cliente: qui c'è un solo
 *    interlocutore, il proprio trainer.
 *  FLUSSO: TrainerService.messages() alimenta le bolle; sendMessage() aggiunge
 *    il messaggio dell'utente. Lo scroll segue l'ultimo messaggio.
 * ============================================================================
 */
import {
  AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TrainerService } from '../../core/services/trainer.service';
import { ToastService } from '../../core/services/toast.service';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';

const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

@Component({
  selector: 'ff-messaggi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeaderComponent],
  templateUrl: './messaggi.component.html',
  styleUrl: './messaggi.component.scss',
})
export class MessaggiComponent implements AfterViewChecked {
  private readonly router = inject(Router);
  readonly trainer = inject(TrainerService);
  private readonly toast = inject(ToastService);

  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');
  readonly draft = signal('');

  /** Etichetta breve di una data ("gio 16 lug"). */
  dowShort(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }

  // --- Conferme di ciò che propone il coach (proposte + spostamenti) ---
  accept(id: string): void { this.trainer.acceptSession(id); this.toast.show('Seduta confermata', 'ti-calendar-check'); }
  decline(id: string): void { this.trainer.declineSession(id); this.toast.show('Proposta rifiutata', 'ti-x'); }
  confirmMove(id: string): void { this.trainer.confirmMove(id); this.toast.show('Spostamento confermato', 'ti-calendar-check'); }
  rejectMove(id: string): void { this.trainer.rejectMove(id); this.toast.show('Spostamento rifiutato', 'ti-x'); }

  ngAfterViewChecked(): void {
    const el = this.scrollEl()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  onInput(ev: Event): void {
    this.draft.set((ev.target as HTMLTextAreaElement).value);
  }

  send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.trainer.sendMessage(text);
    this.draft.set('');
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.send();
    }
  }

  toTrainer(): void { void this.router.navigate(['/personal-trainer']); }
}
