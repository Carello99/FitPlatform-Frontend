/**
 * ============================================================================
 *  FILE: help.component.ts  —  SCHERMATA HELP DESK (feature)
 * ============================================================================
 *  SCOPO: pagina di supporto: FAQ ad accordion, chat simulata, guide rapide.
 *  COSA RAPPRESENTA: componente di feature (pagina). Stato locale via signal;
 *    legge FAQ/guide dallo store (dati) e usa ToastService per i feedback.
 *  FLUSSO DATI: store.faq/guides → template. La chat è SIMULATA: send()
 *    aggiunge il messaggio utente e, dopo 700ms (setTimeout), una risposta
 *    fissa del "bot". Nessun backend coinvolto.
 *  DIPENDENZE / USATO IN: rotta /help. Store, ToastService, Router, TILE_CLASS.
 *  DEBUG: `open` = indice FAQ aperta (null = chiuse). Il ritardo del bot è
 *    finto: non cercare chiamate HTTP che non esistono.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { ToastService } from '../../core/services/toast.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// Interfaccia locale per i messaggi della chat di supporto
interface ChatMsg {
  me: boolean; // true = messaggio dell'utente, false = risposta del bot
  t: string;   // Testo del messaggio
}

/**
 * Schermata Help Desk — FAQ accordion, chat di supporto, guide rapide, contatti.
 *
 * Dimostra un accordion FAQ fatto con signal (nessuna animazione complessa).
 * La chat è simulata: la risposta del bot arriva con un setTimeout dopo 700ms.
 */
@Component({
  selector: 'ff-help',
  standalone: true,
  imports: [AppHeaderComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help.component.html',
})
export class HelpComponent {
  readonly w = inject(WorkoutStore);
  readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly TILE_CLASS = TILE_CLASS;

  // Signal per l'indice della FAQ aperta (null = nessuna aperta)
  readonly open = signal<number | null>(null);

  // Signal per la visibilità del bottom sheet della chat
  readonly chat = signal(false);

  // Signal per i messaggi della chat (inizializzato con il messaggio di benvenuto)
  readonly msgs = signal<ChatMsg[]>([
    { me: false, t: "Ciao! 👋 Sono l'assistente FitFlow. Come posso aiutarti oggi?" },
  ]);

  // Signal per il testo in fase di composizione nell'input della chat
  readonly draft = signal('');

  /** Apre/chiude una voce FAQ. Se già aperta, la chiude. */
  toggle(i: number): void {
    // Se l'indice è già aperto → chiudi (null), altrimenti apri i
    this.open.set(this.open() === i ? null : i);
  }

  /** Aggiorna il testo del messaggio in composizione. */
  onDraft(e: Event): void {
    this.draft.set((e.target as HTMLInputElement).value);
  }

  /** Invia il messaggio e simula una risposta automatica del bot. */
  send(): void {
    const q = this.draft().trim();
    if (!q) {
      return; // Ignora i messaggi vuoti
    }
    // Aggiunge il messaggio dell'utente alla chat
    this.msgs.update((m) => [...m, { me: true, t: q }]);
    this.draft.set(''); // Svuota l'input

    // Simula un ritardo di digitazione del bot (700ms)
    setTimeout(() => {
      // update(): aggiunge la risposta in coda ai messaggi esistenti
      this.msgs.update((m) => [
        ...m,
        {
          me: false,
          t: "Grazie per il messaggio! Un membro del team ti risponderà a breve. Nel frattempo, dai un'occhiata alle nostre guide rapide. 💪",
        },
      ]);
    }, 700);
  }

  back(): void {
    void this.router.navigate(['/home']);
  }
}
