/**
 * ============================================================================
 *  FILE: progress.component.ts  —  SCHERMATA PROGRESSI (feature)
 * ============================================================================
 *  SCOPO: grafici (volume, peso) e record personali, con selettore di periodo.
 *  COSA RAPPRESENTA: pagina del tab "Progressi". Mostra una catena reattiva di
 *    computed: period() → totals() → headStats(). Cambi il periodo e tutto si
 *    ricalcola da solo, senza handler manuali.
 *  FLUSSO DATI: store.volumeWeeks/weightTrend alimentano i grafici (BarChart,
 *    LineChart). totalsMap/prs sono dati statici DEMO (in una vera app
 *    verrebbero dall'API).
 *  DIPENDENZE / USATO IN: rotta /progress. BarChartComponent, LineChartComponent.
 *  DEBUG: lastWeight prende l'ultimo elemento di weightTrend con fallback 0 se
 *    l'array è vuoto. Se i numeri "non cambiano col periodo", ricorda che
 *    totalsMap è hardcoded.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { Accent } from '../../core/models/workout.models';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { BarChartComponent } from '../../shared/components/bar-chart/bar-chart.component';
import { LineChartComponent } from '../../shared/components/line-chart/line-chart.component';

// Interfacce locali per i tipi di dati usati in questa schermata
interface Totals {
  workouts: string | number;
  time: string;
  sets: string | number;
  vol: string;
}
interface HeadStat {
  ic: string;
  tile: Accent;
  v: string | number;
  l: string;
}
interface Pr {
  ex: string;   // Nome esercizio
  v: string;    // Valore del PR (es. "120 kg")
  d: string;    // Delta rispetto al precedente (es. "+5 kg")
  ic: string;
  tile: Accent;
}

/**
 * Schermata Progressi — grafici e record personali.
 *
 * Dimostra l'uso di computed() con dati che cambiano in base
 * al periodo selezionato (Settimana/Mese/Anno).
 */
@Component({
  selector: 'ff-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarChartComponent, LineChartComponent],
  templateUrl: './progress.component.html',
})
export class ProgressComponent {
  readonly w = inject(WorkoutStore);
  private readonly router = inject(Router);
  readonly TILE_CLASS = TILE_CLASS;

  // Array dei periodi disponibili
  readonly periods = ['Settimana', 'Mese', 'Anno'];

  // Signal: periodo selezionato (default: Settimana)
  readonly period = signal('Settimana');

  // Mappa dei totali per ciascun periodo (dati statici in questa demo)
  // In una vera app, questi verrebbero dall'API
  private readonly totalsMap: Record<string, Totals> = {
    Settimana: { workouts: 4,   time: '4h 12m',  sets: 168,  vol: '18.4k' },
    Mese:      { workouts: 14,  time: '15h 40m', sets: 612,  vol: '71.2k' },
    Anno:      { workouts: 142, time: '168h',    sets: 6840, vol: '812k'  },
  };

  // computed: si aggiorna automaticamente quando period() cambia
  // totalsMap[this.period()]: accede al record con il periodo selezionato come chiave
  readonly totals = computed<Totals>(() => this.totalsMap[this.period()]);

  // computed che dipende da totals (che dipende da period) — catena reattiva automatica
  readonly headStats = computed<HeadStat[]>(() => {
    const t = this.totals(); // Legge il computed → traccia la dipendenza
    return [
      { ic: 'ti-barbell',      tile: 'amber',  v: t.workouts, l: 'Allenamenti' },
      { ic: 'ti-clock-hour-4', tile: 'cyan',   v: t.time,     l: 'Tempo allenato' },
      { ic: 'ti-stretching',   tile: 'green',  v: t.sets,     l: 'Serie totali' },
      { ic: 'ti-weight',       tile: 'violet', v: t.vol,      l: 'Volume (kg)' },
    ];
  });

  // Record personali — statici in questa demo
  readonly prs: Pr[] = [
    { ex: 'Squat',       v: '120 kg',   d: '+5 kg',   ic: 'ti-barbell', tile: 'violet' },
    { ex: 'Panca piana', v: '92.5 kg',  d: '+2.5 kg', ic: 'ti-barbell', tile: 'amber' },
    { ex: 'Stacco',      v: '150 kg',   d: 'nuovo PR', ic: 'ti-barbell', tile: 'green' },
  ];

  /** Ultimo peso registrato (ultimo elemento dell'array weightTrend). */
  get lastWeight(): number {
    const t = this.w.weightTrend;
    // t[t.length - 1]: accede all'ultimo elemento dell'array
    // ?? 0: fallback a 0 se l'array è vuoto
    return t[t.length - 1] ?? 0;
  }

  go(route: string): void {
    void this.router.navigate(['/' + route]);
  }
}
