/**
 * ============================================================================
 *  FILE: agenda.component.ts  —  PAGINA AGENDA (rotta /agenda)
 * ============================================================================
 *  SCOPO: contenitore di pagina che monta l'header di sezione + il calendario
 *    riusabile (ff-agenda-calendar). Tutta la logica del calendario vive in
 *    AgendaCalendarComponent, così può essere incorporata anche nel tab
 *    "Sessioni" dell'hub Coach.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';
import { AgendaCalendarComponent } from './agenda-calendar.component';

@Component({
  selector: 'ff-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeaderComponent, AgendaCalendarComponent],
  templateUrl: './agenda.component.html',
})
export class AgendaComponent {}
