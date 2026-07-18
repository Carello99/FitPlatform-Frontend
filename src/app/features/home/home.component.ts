/**
 * ============================================================================
 *  FILE: home.component.ts  —  DASHBOARD / HOME (feature, componente "smart")
 * ============================================================================
 *  SCOPO: la schermata principale: saluto, recap settimanale, ring XP, frase
 *    motivazionale e il coverflow delle schede con avvio rapido.
 *  COSA RAPPRESENTA: componente "container/smart": conosce servizi e dati e li
 *    PASSA ai figli "dumb" (Coverflow, Ring, Diff) via @Input. Pattern smart vs
 *    presentational da tenere a mente leggendo il template.
 *  FLUSSO DATI: store (utente/schede/settimana) + SessionService (scheda attiva)
 *    → `carousel` (computed: scheda attiva per prima) alimenta il coverflow.
 *    (open)→openScheda()→/scheda/:id; (start)→mini-dialog→beginSession()→/active.
 *  DIPENDENZE / USATO IN: rotta /home. Store, SessionService, Router.
 *  DEBUG:
 *    - weekPct e xpPct sono calcolati nell'INIZIALIZZAZIONE del campo (una volta):
 *      leggono store.user/weekDone. Funzionano perché la shell monta la Home solo
 *      a dati pronti (gate loading). Se store fosse vuoto qui → divisioni su dati
 *      mancanti; xpPct NON ha guardia /0 (assume xpNext>0 dai dati reali).
 *    - `carousel` invece è reattivo: si riordina quando cambia la scheda attiva.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ACCENT_VAR, LEVEL_LABEL, MOTIVATION, TILE_CLASS } from '../../core/constants/ui.constants';
import { Scheda } from '../../core/models/workout.models';
import { SessionService } from '../../core/services/session.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { DiffComponent } from '../../shared/components/diff/diff.component';
import { CoverflowComponent } from './coverflow.component';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';
import { TrainerService } from '../../core/services/trainer.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Dashboard principale — il cuore dell'app.
 *
 * Componente "smart" (o "container"): conosce i servizi e i dati.
 * I componenti figli (CoverflowComponent, RingComponent, ecc.) sono
 * "presentazionali": ricevono dati via @Input e non conoscono i servizi.
 *
 * Il template HTML è in home.component.html (templateUrl).
 */
@Component({
  selector: 'ff-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Tutti i componenti usati nel template devono essere qui negli imports
  imports: [DiffComponent, CoverflowComponent, AppHeaderComponent],
  // templateUrl: il template è in un file .html separato (per componenti con HTML lungo)
  templateUrl: './home.component.html',
  styles: [`
    /* ===== BLOCCO SETTIMANA: calendario (→ mensile) fuso con le schede (→ allena) ===== */

    /* Striscia calendario: superficie tappabile con cue esplicito "Calendario ›" */
    .wk-cal { -webkit-appearance: none; appearance: none; display: block; width: 100%; text-align: left; margin-top: 24px; padding: 13px 15px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--hairline); font-family: inherit; color: inherit; cursor: pointer; transition: border-color .16s; overflow: hidden; }
    .wk-cal:active { border-color: var(--hairline-strong); }
    .wk-cal-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
    .wk-cal-t { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 800; letter-spacing: -.2px; }
    .wk-cal-t .ti { font-size: 17px; color: var(--ink-2); }
    .wk-cal-go { display: inline-flex; align-items: center; gap: 2px; font-size: 11.5px; font-weight: 800; color: var(--amber); }
    .wk-cal-go .ti { font-size: 15px; }

    /* Giorni della settimana (design ripreso da FitPlatform PT): dow + numero,
       colonna di oggi evidenziata. */
    .wk-days { display: flex; justify-content: space-between; gap: 4px; }
    .wk-d { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 7px 0 9px; border-radius: 12px; }
    .wk-d.is-today { background: var(--surface-3); }
    .wk-dow { font-size: 10px; font-weight: 700; color: var(--ink-4); text-transform: uppercase; }
    .wk-num { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .wk-num.is-today { color: var(--amber); }
    /* Giorno col coach: foto PT anziché pallino. Anello ambra = in programma,
       verde = sessione già svolta (sulla superficie strip surface-2). */
    .wk-coach { width: 23px; height: 23px; border-radius: 50%; overflow: hidden; background: var(--amber); box-shadow: 0 0 0 2px var(--amber), 0 0 0 4px var(--surface-2); display: flex; align-items: center; justify-content: center; }
    .wk-coach.done { background: var(--green); box-shadow: 0 0 0 2px var(--green), 0 0 0 4px var(--surface-2); }
    .wk-coach img { width: 100%; height: 100%; object-fit: cover; }
    .wk-coach span { color: var(--amber-ink); font-size: 9px; font-weight: 800; }
    /* Orario della sessione col coach, sotto la foto (verde se già svolta) */
    .wk-time { font-size: 9px; font-weight: 800; color: var(--amber); font-variant-numeric: tabular-nums; margin-top: -2px; }
    .wk-time.done { color: var(--green); }
    .wk-fire { font-size: 19px; color: var(--amber); }
    .wk-dot-today { width: 8px; height: 8px; border-radius: 50%; background: var(--amber); }
    .wk-dot-rest { width: 5px; height: 5px; border-radius: 50%; background: var(--ink-4); opacity: .55; }

    /* Azioni rapide (navigazione secondaria, quieta): cerchi line-art, icone
       grigie uniformi, label mute → non rubano attenzione all'hero/carosello. */
    .qa-item { flex: 0 0 auto; width: calc((100vw - 40px) / 4.75); display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; font-family: inherit; cursor: pointer; }
    .qa-ic { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--hairline-strong); color: var(--ink-2); transition: transform .16s, color .16s, border-color .16s; }
    .qa-ic .ti { font-size: 22px; }
    .qa-item:active .qa-ic { transform: scale(.92); color: var(--ink); border-color: var(--ink-3); }
    .qa-lb { font-size: 10.5px; font-weight: 700; color: var(--ink-3); text-align: center; line-height: 1.15; }

    /* ===== Card "Coaching" (solo senza PT): pannello coi token del tema ===== */
    .coach-eyebrow { margin: 16px 2px 12px; font-size: 19px; font-weight: 800; letter-spacing: -.4px; color: var(--ink); }
    .coach-card { padding: 16px; border-radius: var(--r-lg); background: var(--surface-2); border: 1px solid var(--hairline); box-shadow: var(--shadow-card); }
    .cc-top { display: flex; gap: 13px; align-items: flex-start; }
    .cc-thumb { width: 52px; height: 52px; flex: none; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: var(--amber-soft); color: var(--amber); font-size: 24px; }
    .cc-title { font-size: 16px; font-weight: 800; letter-spacing: -.3px; color: var(--ink); }
    .cc-sub { font-size: 12.5px; font-weight: 500; color: var(--ink-3); line-height: 1.45; margin-top: 3px; }
    .cc-avail { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
    .cc-avatars { display: flex; }
    .cc-av { width: 26px; height: 26px; border-radius: 50%; overflow: hidden; border: 2px solid var(--surface-2); margin-left: -8px; }
    .cc-av:first-child { margin-left: 0; }
    .cc-av img { width: 100%; height: 100%; object-fit: cover; }
    .cc-count { font-size: 12px; font-weight: 700; color: var(--ink-3); }
    .cc-cta { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 15px; padding: 14px; border-radius: var(--r-pill); background: var(--amber); color: var(--amber-ink); border: none; font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; box-shadow: var(--shadow-amber); }
    .cc-cta .ti { font-size: 18px; }
    .cc-how { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; margin-top: 8px; padding: 6px; background: none; border: none; font-family: inherit; font-size: 12.5px; font-weight: 700; color: var(--ink-4); cursor: pointer; }
    .cc-how .ti { font-size: 15px; }

    /* ===== Empty-state carosello: nessuna scheda → guida alla creazione ===== */
    .sc-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 30px 22px 26px; border-radius: var(--r-lg); background: var(--surface-2); border: 1px dashed var(--hairline-strong); }
    .sc-ic { width: 64px; height: 64px; object-fit: contain; margin-bottom: 14px; }
    .sc-t { font-size: 17px; font-weight: 800; letter-spacing: -.3px; color: var(--ink); }
    .sc-s { font-size: 13px; font-weight: 500; color: var(--ink-3); line-height: 1.5; margin-top: 7px; max-width: 300px; }
    .sc-cta { display: inline-flex; align-items: center; justify-content: center; gap: 7px; margin-top: 18px; padding: 13px 26px; border-radius: var(--r-pill); background: var(--amber); color: var(--amber-ink); border: none; font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; box-shadow: var(--shadow-amber); }
    .sc-cta .ti { font-size: 18px; }

    /* Linea bianca leggera che divide le scelte rapide dal carosello */
    .qa-sep { height: 0; margin: 20px 4px 0; border-top: 1px solid var(--hairline); }
    /* Helper sotto il carosello: le due azioni al tap */
    .sk-hint { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); }
    .sk-hint .ti { font-size: 15px; color: var(--amber); }
    .sk-hint b { color: var(--ink-2); font-weight: 800; }

    /* Card "Allenati libero" (card-bottone) con "+ Crea" bianco */
    .free2 { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 14px; padding: 13px 15px; text-align: left; font-family: inherit; color: inherit; cursor: pointer; }
    .f2-ic { width: 42px; height: 42px; flex: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--surface-3); color: var(--ink); font-size: 22px; }
    .f2-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .f2-t { font-size: 14.5px; font-weight: 800; letter-spacing: -.2px; }
    .f2-s { font-size: 12px; font-weight: 600; color: var(--ink-3); margin-top: 2px; }
    /* Pill ad alto contrasto: --ink si inverte col tema, quindi resta leggibile
       sia sulla card scura sia su quella chiara. Con #fff era invisibile in light. */
    .f2-btn { flex: none; display: inline-flex; align-items: center; gap: 3px; padding: 9px 15px; border-radius: var(--r-pill); background: var(--ink); color: var(--bg-app); font-size: 12.5px; font-weight: 800; }
    .f2-btn .ti { font-size: 15px; }
  `],
})
export class HomeComponent {
  // Servizi iniettati — sono "readonly" per chiarire che non vengono mai riassegnati
  readonly w = inject(WorkoutStore);
  readonly state = inject(SessionService);
  readonly trainer = inject(TrainerService);
  readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Anteprima coach del marketplace (avatar impilati nella card Coaching). */
  readonly coachPreview = this.trainer.catalog.slice(0, 4);

  /** Card "Allenati libero": allenamento senza scheda (placeholder demo). */
  freeWorkout(): void {
    this.toast.show('Allenamento libero — presto disponibile', 'ti-bolt-filled');
  }

  /** Numero del giorno (1-31) per ogni cella lun→dom di questa settimana. */
  readonly weekDates = computed<number[]>(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.getDate();
    });
  });

  /**
   * Indice (lun=0 … dom=6) del giorno di questa settimana in cui cade la
   * prossima sessione col PT, o -1 se non è in questa settimana. Serve al
   * mini-recap: sul giorno "coach" mostra la foto del PT invece del pallino.
   */
  readonly coachDayIndex = computed(() => {
    const s = this.trainer.nextSession();
    if (!s) return -1;
    const d = new Date(s.date + 'T00:00:00');
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    if (d < monday || d > sunday) return -1;
    return (d.getDay() + 6) % 7;
  });

  /**
   * Sessione col coach per ciascun giorno di questa settimana (lun→dom), o null.
   * Serve alla card "La tua settimana": foto del PT sul giorno, anello verde se
   * la sessione è già stata svolta, ambra se in programma; l'orario compare sotto
   * la foto del giorno di oggi.
   */
  readonly weekCoach = computed(() => {
    const sessions = this.trainer.sessions();
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return sessions.find((s) => s.date === iso) ?? null;
    });
  });

  // Costanti esposte come proprietà del componente per usarle nel template HTML.
  // Nel template non si può importare direttamente da altri moduli,
  // quindi si "passa" la costante come proprietà.
  readonly ACCENT_VAR = ACCENT_VAR;
  readonly TILE_CLASS = TILE_CLASS;
  readonly LEVEL_LABEL = LEVEL_LABEL;

  // Signal locale: la scheda selezionata nel mini-dialog di avvio rapido
  readonly startTarget = signal<Scheda | null>(null);

  // Frase motivazionale del giorno — cambia in base al giorno della settimana
  // getDay() restituisce 0=Dom, 1=Lun, ..., 6=Sab
  readonly motiv = MOTIVATION[new Date().getDay() % MOTIVATION.length];

  /** Data ISO locale di oggi ('YYYY-MM-DD'). */
  private get todayIso(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  /** La sessione col coach se è OGGI (altrimenti null). */
  readonly coachToday = computed(() => {
    const s = this.trainer.nextSession();
    return s && s.date === this.todayIso ? s : null;
  });

  /**
   * Hero: l'informazione più importante all'apertura, col gioco di font a due
   * righe (bianco `top` + arancione `accent`). Due soli stati: sessione col coach
   * oggi, altrimenti obiettivo raggiunto. La riga grigia `sub` ricorda sempre
   * quante sessioni restano con il coach prima della scadenza dell'abbonamento.
   */
  readonly hero = computed<{ top: string; accent: string; sub: string }>(() => {
    // Senza coach: nessun riferimento al PT (coerente con la card "Trova il tuo coach").
    if (!this.trainer.hasCoach()) {
      return { top: 'Pronto ad', accent: 'allenarti?', sub: 'Scegli una scheda o trova il tuo coach' };
    }
    const coach = this.trainer.trainer.name.split(' ')[0];
    const left = this.trainer.trainer.sessionsLeft;
    const sub = `Ti ${left === 1 ? 'resta 1 sessione' : 'restano ' + left + ' sessioni'} con ${coach}`;

    const c = this.coachToday();
    if (c) {
      return { top: 'Oggi ti alleni con', accent: `${coach} alle ${c.time}`, sub };
    }
    return { top: 'Obiettivo', accent: 'raggiunto! 💪', sub };
  });

  // Calcoli per la progress bar settimanale e la ring XP.
  // Getter (non campi): si rileggono a ogni render, così dopo un allenamento la
  // gamification aggiorna lo Store e questi valori riflettono subito i nuovi dati.
  get weekPct(): number {
    return Math.round((this.w.weekDone / Math.max(this.w.weekGoal, 1)) * 100);
  }
  get xpPct(): number {
    return this.w.user.xpNext > 0 ? this.w.user.xp / this.w.user.xpNext : 0; // 0..1
  }

  /**
   * Lista ordinata delle schede per il coverflow:
   * la scheda attiva per prima, poi tutte le altre.
   *
   * computed(): si ricalcola automaticamente ogni volta che activeSchedaId() cambia.
   */
  readonly carousel = computed<Scheda[]>(() => {
    const active = this.state.activeSchedaId();
    return [
      ...this.w.schede.filter((s) => s.id === active),    // Scheda attiva prima
      ...this.w.schede.filter((s) => s.id !== active),    // Poi le altre
      // ... (spread operator): "spiatta" l'array — unisce i due array in uno
    ];
  });

  /** Naviga a una route. */
  go(route: string): void {
    void this.router.navigate(['/' + route]);
  }

  /** Storico allenamenti = tab "Allenamenti" della sezione Schede (DECISIONS D-38). */
  goStorico(): void {
    void this.router.navigate(['/schede'], { queryParams: { tab: 'allenamenti' } });
  }


  /** Delegato al WorkoutStore per calcolare le serie totali. */
  totalSets(s: Scheda): number {
    return this.w.totalSets(s);
  }

  /** Avvia l'allenamento per la scheda selezionata nel dialog. */
  confirmStart(): void {
    const s = this.startTarget();
    if (s) {
      this.state.beginSession(s.id);
    }
  }

  /** Chiude il dialog e naviga al dettaglio della scheda. */
  toDetail(): void {
    const s = this.startTarget();
    if (s) {
      this.startTarget.set(null); // Chiude il dialog
      this.state.openScheda(s.id);
    }
  }
}
