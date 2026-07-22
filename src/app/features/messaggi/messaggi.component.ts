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
import { DietPlan, PtMessage } from '../../core/data/trainer-mock';
import { TrainerService } from '../../core/services/trainer.service';
import { AgendaRequestStore } from '../../core/services/agenda-request.service';
import { ToastService } from '../../core/services/toast.service';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';
import { PhotoViewerComponent } from '../../shared/components/photo-viewer/photo-viewer.component';
import { RequestCardComponent } from '../../shared/components/request-card/request-card.component';

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

@Component({
  selector: 'ff-messaggi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeaderComponent, PhotoViewerComponent, RequestCardComponent],
  templateUrl: './messaggi.component.html',
  styleUrl: './messaggi.component.scss',
})
export class MessaggiComponent implements AfterViewChecked {
  private readonly router = inject(Router);
  readonly trainer = inject(TrainerService);
  readonly store = inject(AgendaRequestStore);
  private readonly toast = inject(ToastService);

  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');
  readonly draft = signal('');

  /** Il piano alimentare aperto a tutto schermo (null = visore chiuso). */
  readonly diet = signal<DietPlan | null>(null);

  /** Il piano allegato a un messaggio, se ce n'è uno. */
  dietOf(m: PtMessage): DietPlan | undefined {
    const a = m.attachment;
    return a?.kind === 'diet' ? this.trainer.diet(a.dietId) : undefined;
  }

  openDiet(d: DietPlan): void { this.diet.set(d); }

  /** '12 lug' — la data in cui il piano è stato mandato. */
  short(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }

  // --- Decisioni sulle richieste del coach (le stesse dell'Agenda) ---
  accept(id: string): void { this.store.accept(id); this.toast.show('Seduta confermata', 'ti-calendar-check'); }
  decline(id: string): void { this.store.decline(id); this.toast.show('Proposta rifiutata', 'ti-x'); }

  /**
   * Controproporre richiede un calendario, e il calendario sta in Agenda:
   * si va lì, sul giorno della proposta, invece di infilare una griglia in chat.
   */
  toAgenda(date: string): void {
    void this.router.navigate(['/agenda'], { queryParams: { day: date } });
  }

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
