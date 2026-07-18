/**
 * ============================================================================
 *  FILE: personal-trainer.component.ts  —  HUB COACH (lato UTENTE)
 * ============================================================================
 *  SCOPO: unico punto della relazione col PT. Layout ripreso dalla scheda
 *    cliente (client-detail) di FitPlatform PT — hero + segmented control +
 *    blocchi card — per restare coerenti col design dell'applicativo.
 *    Assorbe Agenda e Messaggi (si aprono in push da qui).
 *  SOTTO-VISTE: Panoramica (settimana + prossima sessione + piano) · Sessioni
 *    (prossime + svolte) · Pacchetto (sessioni residue + rinnovo).
 *  FLUSSO: legge TrainerService (profilo, sessioni) e WorkoutStore (settimana,
 *    schede assegnate). Naviga a /agenda e /messaggi.
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrainerService } from '../../core/services/trainer.service';
import { WorkoutStore } from '../../core/services/workout-store.service';
import { ToastService } from '../../core/services/toast.service';
import { TILE_CLASS } from '../../core/constants/ui.constants';
import { AppHeaderComponent } from '../../layout/app-header/app-header.component';
import { AgendaCalendarComponent } from '../agenda/agenda-calendar.component';

type CoachTab = 'panoramica' | 'sedute' | 'pacchetto';

interface WkDay { dow: string; num: number; done: boolean; today: boolean; }

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

@Component({
  selector: 'ff-personal-trainer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeaderComponent, AgendaCalendarComponent],
  template: `
    <div class="screen-pad screen-anim">
      <ff-app-header></ff-app-header>

      <!-- ===== HERO: foto PT centrata + accesso immediato a Agenda e Messaggi ===== -->
      <section class="hero">
        <span class="avatar" [style.background]="t.trainer.photoUrl ? 'transparent' : t.trainer.color">
          @if (t.trainer.photoUrl) { <img [src]="t.trainer.photoUrl" [alt]="t.trainer.name" /> }
          @else { {{ t.trainer.initials }} }
        </span>
        <h1 class="name">{{ t.trainer.name }}</h1>
        <div class="sub">
          <span class="ff-badge">{{ t.trainer.role }}</span>
          <span class="focus"><i class="ti ti-star-filled" aria-hidden="true"></i>{{ t.trainer.rating }}</span>
        </div>
        <div class="hero-actions">
          <button class="ff-btn ff-btn--primary press" (click)="go('messaggi')">
            <i class="ti ti-message-circle" aria-hidden="true"></i>Messaggia il coach
            @if (t.unread()) { <span class="ha-badge">{{ t.unread() }}</span> }
          </button>
        </div>
      </section>

      <!-- ===== SEGMENTED CONTROL ===== -->
      <nav class="segment" role="tablist" aria-label="Sezioni coach">
        @for (tb of tabs; track tb.key) {
          <button class="seg press" [class.on]="tab() === tb.key" role="tab" [attr.aria-selected]="tab() === tb.key" (click)="tab.set(tb.key)">{{ tb.label }}</button>
        }
      </nav>

      @switch (tab()) {

        <!-- ---------- PANORAMICA: progressi col coach + schede assegnate ---------- -->
        @case ('panoramica') {
          <!-- Progressi del percorso con il coach -->
          <div class="ff-card block">
            <div class="block-hd"><i class="ti ti-trending-up" aria-hidden="true"></i><span>Il tuo percorso con {{ firstName() }}</span></div>
            <div class="prog3">
              <div class="pg"><span class="pg-v">{{ t.trainer.sessionsDone }}</span><span class="pg-l">sessioni insieme</span></div>
              <div class="pg"><span class="pg-v">{{ w.user.streak }}</span><span class="pg-l">settimane</span></div>
              <div class="pg"><span class="pg-v">{{ weekPct() }}%</span><span class="pg-l">obiettivo sett.</span></div>
            </div>
            <div class="track" style="margin-top:14px;height:7px"><div class="fill" style="background:var(--green)" [style.width.%]="weekPct()"></div></div>
            <div class="prog-sub">{{ w.weekDone }} di {{ w.weekGoal }} allenamenti questa settimana</div>
            <button class="prog-link press" (click)="go('progress')"><i class="ti ti-chart-line" aria-hidden="true"></i>Vedi tutti i progressi</button>
          </div>

          <!-- Schede assegnate dal coach -->
          <div class="sec-row">
            <h3>Schede di {{ firstName() }}</h3>
            <span class="sec-n">{{ schedeCount() }}</span>
          </div>
          @if (w.schede.length) {
            <div class="sk-list">
              @for (s of w.schede; track s.id) {
                <button class="sked press" (click)="openScheda(s.id)">
                  <span class="sk-ic" [class]="TILE_CLASS[s.accent]"><i class="ti" [class]="s.icon" aria-hidden="true"></i></span>
                  <span class="sk-txt">
                    <span class="sk-name">{{ s.name }}</span>
                    <span class="sk-meta">{{ s.focus }} · {{ s.duration }} min · {{ s.exercises.length }} eserc.</span>
                  </span>
                  <i class="ti ti-player-play-filled sk-go" aria-hidden="true"></i>
                </button>
              }
            </div>
          } @else { <p class="muted">Nessuna scheda assegnata dal coach.</p> }
        }

        <!-- ---------- SEDUTE: calendario mensile completo incorporato ---------- -->
        @case ('sedute') {
          <div class="sedute-cal">
            <ff-agenda-calendar></ff-agenda-calendar>
          </div>
        }

        <!-- ---------- PACCHETTO ---------- -->
        @case ('pacchetto') {
          <div class="ff-card block">
            <div class="block-hd"><i class="ti ti-wallet" aria-hidden="true"></i><span>Riepilogo</span></div>
            <div class="renew">
              <div class="renew-l">
                <span class="renew-lbl">Pacchetto {{ t.trainer.packageTotal }} sessioni</span>
                <span class="renew-date">con {{ t.trainer.name }}</span>
              </div>
              <span class="renew-badge">{{ t.trainer.sessionsLeft }} residue</span>
            </div>
            <div class="track"><div class="fill" style="background:var(--amber)" [style.width.%]="pkgPct()"></div></div>
            <div class="subgrid">
              <div><span class="sv">{{ t.trainer.sessionsLeft }}</span><span class="sl">residue</span></div>
              <div><span class="sv">{{ t.trainer.sessionsDone }}</span><span class="sl">svolte in totale</span></div>
            </div>
          </div>

          <div class="ff-card block cta">
            <span class="cta-ic"><i class="ti ti-heart-handshake" aria-hidden="true"></i></span>
            <div class="cta-body">
              <div class="cta-t">Continua il percorso</div>
              <div class="cta-s">Stai ottenendo ottimi risultati. Rinnova il pacchetto per non perdere lo slancio con {{ firstName() }}.</div>
            </div>
            <button class="ff-btn ff-btn--primary ff-btn--block press" (click)="toast.show('Richiesta di rinnovo inviata', 'ti-refresh')"><i class="ti ti-refresh" aria-hidden="true"></i>Rinnova pacchetto</button>
          </div>

          <!-- Chi è il coach -->
          <div class="ff-card block">
            <div class="block-hd"><i class="ti ti-user-heart" aria-hidden="true"></i><span>Chi è {{ firstName() }}</span></div>
            <p class="notes">{{ t.trainer.bio }}</p>
            <div class="tags">@for (sp of t.trainer.specialties; track sp) { <span class="tag">{{ sp }}</span> }</div>
          </div>
        }
      }

      <!-- Footer discreto: scoperta occasionale, in fondo alla sezione per non
           competere con il coach attuale (come le azioni "gestione account"). -->
      <div class="mkt-foot">
        <span class="mkt-q">Vuoi valutare altre opzioni?</span>
        <button class="mkt-link press" (click)="go('coach-marketplace')"><i class="ti ti-compass" aria-hidden="true"></i>Esplora altri coach</button>
      </div>
    </div>
  `,
  styles: [`
    /* ---- HERO: foto centrata + azioni immediate (da client-detail PT) ---- */
    .hero { text-align: center; padding: 6px 0 2px; }
    .avatar { width: 72px; height: 72px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--amber-ink); font-size: 24px; font-weight: 800; box-shadow: var(--shadow-amber); overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .name { font-size: 22px; font-weight: 800; letter-spacing: -.5px; margin-top: 12px; }
    .sub { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; }
    .sub .focus { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); }
    .sub .focus .ti { font-size: 13px; color: var(--amber); }
    .hero-actions { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
    .hero-actions .ff-btn { position: relative; flex: none; padding: 11px 30px; font-size: 14.5px; }
    .hero-actions .ff-btn .ti { font-size: 18px; }
    .ha-badge { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--rose); color: var(--on-accent); font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; border: 2px solid var(--surface-0); }
    /* ---- Panoramica: progressi col coach ---- */
    .prog3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .pg { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px; }
    .pg-v { font-size: 21px; font-weight: 800; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
    .pg-l { font-size: 10px; font-weight: 800; color: var(--ink-3); text-transform: uppercase; letter-spacing: .2px; text-align: center; }
    .prog-sub { font-size: 12px; font-weight: 600; color: var(--ink-3); margin-top: 9px; }
    .prog-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 9px 14px; border-radius: var(--r-pill); background: var(--surface-3); border: 1px solid var(--hairline); color: var(--ink-2); font-family: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
    .prog-link .ti { font-size: 15px; }

    /* ---- Panoramica: schede assegnate dal coach ---- */
    .sec-row { display: flex; align-items: center; gap: 8px; margin: 20px 2px 10px; }
    .sec-row h3 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-3); }
    .sec-n { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--surface-3); color: var(--ink-2); font-size: 10.5px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
    .sk-list { display: flex; flex-direction: column; gap: 10px; }
    .sked { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 13px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--hairline); font-family: inherit; color: inherit; text-align: left; cursor: pointer; }
    .sk-ic { width: 44px; height: 44px; flex: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 21px; }
    .sk-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .sk-name { font-size: 14.5px; font-weight: 800; letter-spacing: -.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sk-meta { font-size: 11.5px; font-weight: 600; color: var(--ink-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sk-go { font-size: 20px; color: var(--amber); flex: none; }
    /* Accenti tessere (set completo per le schede) */
    .t-violet { background: var(--violet-soft); color: var(--violet); }
    .t-rose { background: var(--rose-soft); color: var(--rose); }
    .t-blue { background: var(--blue-soft); color: var(--blue); }
    .t-teal { background: var(--teal-soft); color: var(--teal); }
    .t-magenta { background: var(--magenta-soft); color: var(--magenta); }
    .t-orange { background: var(--orange-soft); color: var(--orange); }

    /* ---- Agenda incorporata: leggero inset così il calendario resta dentro
           la larghezza del segmented (allineato ai pill, non a filo bordo). ---- */
    .sedute-cal { margin-top: 14px; padding: 0 8px; }

    /* ---- Footer marketplace: discreto, in fondo, non compete col coach ---- */
    .mkt-foot { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--hairline); }
    .mkt-q { font-size: 12px; font-weight: 600; color: var(--ink-4); }
    .mkt-link { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--r-pill); background: none; border: 1px solid var(--hairline); color: var(--ink-2); font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; }
    .mkt-link .ti { font-size: 15px; color: var(--ink-3); }

    /* ---- ANCORA: prossima sessione (elemento dominante) ---- */
    .next-hero { position: relative; overflow: hidden; padding: 17px 17px 16px 19px; margin-top: 16px; background: linear-gradient(150deg, rgba(245,166,35,.12), var(--surface-2) 58%); border-color: rgba(245,166,35,.24); }
    .next-hero::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--amber); }
    .nh-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .nh-lbl { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--amber); }
    .nh-lbl .ti { font-size: 14px; }
    .nh-title { font-size: 23px; font-weight: 800; letter-spacing: -.5px; margin-top: 9px; }
    .nh-when { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-2); margin-top: 5px; text-transform: capitalize; }
    .nh-when .ti { font-size: 15px; color: var(--amber); }
    .nh-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; padding: 8px 14px; border-radius: var(--r-pill); background: var(--surface-1); border: 1px solid var(--hairline); color: var(--amber); font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; }
    .nh-link .ti { font-size: 15px; }
    .next-hero.empty .nh-title { font-size: 18px; margin-top: 8px; }

    /* ---- Bottoni ---- */
    .ff-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 12px 18px; border-radius: 13px; font-family: inherit; font-size: 13.5px; font-weight: 800; border: 1px solid transparent; cursor: pointer; }
    .ff-btn .ti { font-size: 17px; }
    .ff-btn--primary { background: var(--amber); color: var(--amber-ink); box-shadow: var(--shadow-amber); }
    .ff-btn--ghost { background: var(--surface-2); color: var(--ink); border-color: var(--hairline); }
    .ff-btn--block { width: 100%; }

    /* ---- Badge ---- */
    .ff-badge { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; padding: 4px 10px; border-radius: var(--r-pill); background: var(--surface-3); color: var(--ink-2); }
    .ff-badge--green { background: var(--green-soft); color: var(--green); }

    /* ---- Segmented control (sticky) ---- */
    .segment { display: flex; gap: 3px; background: var(--surface-2); border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); padding: 5px; margin: 18px 0 6px; box-shadow: 0 8px 22px -12px rgba(0,0,0,.65); }
    .seg { flex: 1; padding: 10px 0; border-radius: var(--r-pill); background: none; border: none; color: var(--ink-3); font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: background .16s, color .16s; }
    .seg.on { background: var(--surface-4); color: var(--ink); box-shadow: var(--shadow-card); }
    .seg-badge { min-width: 16px; height: 16px; padding: 0 4px; margin-left: 5px; border-radius: 999px; background: var(--rose); color: var(--on-accent); font-size: 9.5px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; }

    /* ---- Blocco card (base + spaziatura) ---- */
    .ff-card { background: var(--surface-2); border: 1px solid var(--hairline); border-radius: var(--r-lg); box-shadow: var(--shadow-card); }
    .block { padding: 15px; margin-top: 12px; }
    .block-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; }
    .block-hd > .ti { font-size: 17px; color: var(--ink-2); }
    .block-hd > span { font-size: 13.5px; font-weight: 800; letter-spacing: -.2px; }
    .block-hd .go { margin-left: auto; color: var(--ink-4); }
    .muted { font-size: 12.5px; font-weight: 600; color: var(--ink-3); }

    /* ---- Mini-calendario settimana ---- */
    .wk { display: flex; justify-content: space-between; gap: 4px; }
    .wk-d { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 7px 0; border-radius: 12px; }
    .wk-d.today { background: var(--surface-3); }
    .wk-dow { font-size: 10px; font-weight: 700; color: var(--ink-4); text-transform: uppercase; }
    .wk-num { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .wk-d.today .wk-num { color: var(--amber); }
    .wk-mark { width: 8px; height: 8px; border-radius: 50%; background: transparent; box-shadow: inset 0 0 0 1.5px var(--hairline-strong); }
    .wk-mark.k-done { background: var(--amber); box-shadow: none; }

    /* ---- Il tuo piano: tile azione forte (allenarsi) ---- */
    .plan { display: flex; align-items: center; gap: 13px; width: 100%; margin-top: 10px; padding: 14px 15px; text-align: left; font-family: inherit; color: inherit; cursor: pointer; }
    .plan-ic { width: 46px; height: 46px; flex: none; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: var(--amber-soft); color: var(--amber); font-size: 22px; }
    .plan-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .plan-n { font-size: 16px; font-weight: 800; letter-spacing: -.3px; }
    .plan-s { font-size: 12px; font-weight: 600; color: var(--ink-3); margin-top: 2px; }
    .plan-go { font-size: 20px; color: var(--ink-4); flex: none; }

    /* ---- Questa settimana: intestazione leggera + check-in ---- */
    .wk-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .wk-hd > span { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; color: var(--ink-3); }
    .wk-checkin { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: var(--r-pill); background: var(--green-soft); border: 1px solid rgba(57,197,110,.3); color: var(--green); font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer; }
    .wk-checkin .ti { font-size: 14px; }

    /* ---- Liste sessioni ---- */
    .wlist { display: flex; flex-direction: column; gap: 11px; }
    .wrow { display: flex; align-items: center; gap: 11px; }
    .wdot { width: 30px; height: 30px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; color: var(--amber-ink); }
    .wdot.ok { background: var(--green-soft); color: var(--green); }
    .wdot .ti { font-size: 16px; }
    .winfo { flex: 1; min-width: 0; }
    .wtitle { display: block; font-size: 13.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wmeta { display: block; font-size: 11px; font-weight: 600; color: var(--ink-3); margin-top: 1px; text-transform: capitalize; }
    .wnums { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
    .wnums span { font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .wnums span:last-child { font-size: 10px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; }

    /* ---- Pacchetto ---- */
    .renew { display: flex; align-items: center; gap: 10px; padding: 12px 13px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--hairline); margin-bottom: 14px; }
    .renew-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .renew-lbl { font-size: 13.5px; font-weight: 800; letter-spacing: -.2px; }
    .renew-date { font-size: 11.5px; font-weight: 600; color: var(--ink-3); }
    .renew-badge { flex: none; font-size: 11px; font-weight: 800; padding: 5px 11px; border-radius: var(--r-pill); background: var(--amber-soft); color: var(--amber); }
    .subgrid { display: flex; gap: 12px; margin-top: 14px; }
    .subgrid > div { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .subgrid .sv { font-size: 20px; font-weight: 800; letter-spacing: -.3px; font-variant-numeric: tabular-nums; }
    .subgrid .sl { font-size: 10.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: .3px; }

    /* ---- CTA rinnovo ---- */
    .cta { text-align: center; background: linear-gradient(150deg, rgba(57,197,110,.14), var(--surface-2) 62%); border-color: rgba(57,197,110,.28); }
    .cta-ic { width: 46px; height: 46px; border-radius: 14px; margin: 2px auto 10px; display: flex; align-items: center; justify-content: center; background: var(--green-soft); color: var(--green); font-size: 24px; }
    .cta-body { margin-bottom: 14px; }
    .cta-t { font-size: 15px; font-weight: 800; letter-spacing: -.3px; }
    .cta-s { font-size: 12.5px; font-weight: 600; color: var(--ink-2); line-height: 1.5; margin-top: 5px; }

    /* ---- Bio / tags ---- */
    .notes { font-size: 13px; font-weight: 500; color: var(--ink-2); line-height: 1.55; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
    .tag { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: var(--r-pill); background: var(--surface-3); color: var(--ink-2); }
  `],
})
export class PersonalTrainerComponent {
  private readonly router = inject(Router);
  readonly t = inject(TrainerService);
  readonly toast = inject(ToastService);
  readonly w = inject(WorkoutStore);

  constructor() {
    // Adattivo: senza un coach assegnato, l'hub non ha senso → vai al marketplace.
    if (!this.t.hasCoach()) {
      void this.router.navigate(['/coach-marketplace']);
    }
  }

  readonly tab = signal<CoachTab>('panoramica');
  readonly tabs: { key: CoachTab; label: string }[] = [
    { key: 'panoramica', label: 'Panoramica' },
    { key: 'sedute', label: 'Agenda' },
    { key: 'pacchetto', label: 'Pacchetto' },
  ];

  readonly TILE_CLASS = TILE_CLASS;

  readonly firstName = computed(() => this.t.trainer.name.split(' ')[0]);
  readonly schedeCount = computed(() => this.w.schede.length);
  readonly pkgPct = computed(() =>
    Math.round((this.t.trainer.sessionsLeft / Math.max(this.t.trainer.packageTotal, 1)) * 100),
  );
  /** % di completamento dell'obiettivo settimanale di allenamenti. */
  weekPct(): number {
    return Math.round((this.w.weekDone / Math.max(this.w.weekGoal, 1)) * 100);
  }

  /** Apre il dettaglio di una scheda assegnata. */
  openScheda(id: string): void {
    void this.router.navigate(['/scheda', id]);
  }

  /** Settimana corrente (lun→dom) con numero del giorno, oggi e "allenato". */
  readonly trainingWeek = computed<WkDay[]>(() => {
    const week = this.w.week;
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // lunedì di questa settimana
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const wd = week[i];
      return {
        dow: wd?.d ?? ['L', 'M', 'M', 'G', 'V', 'S', 'D'][i],
        num: d.getDate(),
        done: wd?.state === 'done',
        today: wd?.state === 'today',
      };
    });
  });

  whenLong(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const todayIso = new Date().toISOString().slice(0, 10);
    if (iso === todayIso) return 'Oggi';
    return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }

  short(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }

  sendCheckin(): void {
    this.toast.show('Check-in inviato al coach', 'ti-clipboard-heart');
  }

  go(route: string): void { void this.router.navigate(['/' + route]); }
}
