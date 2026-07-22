/**
 * ============================================================================
 *  FILE: request-card.component.ts  —  LA CARD DI UNA RICHIESTA D'AGENDA
 * ============================================================================
 *  SCOPO: l'unico posto in cui una richiesta si disegna. Prima esisteva due
 *    volte con markup diverso (`.card.rq` in agenda, `.bubble.action` in chat):
 *    due copie che sarebbero divergite alla prima modifica.
 *
 *  TRE VARIANTI, UNA SOLA ANATOMIA DI DATI:
 *    - `strip` : riga compatta nella strip "da confermare" sotto il calendario
 *    - `inline`: card evento "in prova" nella timeline del giorno (ghost)
 *    - `chat`  : bolla azionabile nella conversazione col coach
 *
 *  NON DECIDE NULLA: emette azioni. Chi la ospita chiama AgendaRequestStore.
 *    `counter` in particolare non apre nulla da sé — in agenda apre lo sheet
 *    degli orari, in chat porta all'agenda (dove il calendario ha senso).
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TrainerService } from '../../../core/services/trainer.service';
import { AgendaRequestStore } from '../../../core/services/agenda-request.service';
import { AgendaRequest, KIND_ICON, KIND_SHORT } from '../../../core/models/agenda-request.model';
import { isoDay } from '../../../core/utils/date.utils';

const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export type RequestCardVariant = 'strip' | 'inline' | 'chat';

/**
 * Da quale dei due giorni di uno spostamento si sta guardando la richiesta.
 * Non cambia COSA si può fare — la decisione è una sola e si prende da
 * entrambi i lati — cambia solo come la si racconta: chi apre il 21 vede la
 * sessione che se ne va, chi apre il 22 vede la sessione che arriva.
 */
export type RequestSide = 'origin' | 'destination';

@Component({
  selector: 'ff-request-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-card.component.html',
  styleUrl: './request-card.component.scss',
  host: { '[class]': 'variant()' },
})
export class RequestCardComponent {
  private readonly store = inject(AgendaRequestStore);
  readonly trainer = inject(TrainerService);

  /** La richiesta da disegnare. */
  readonly req = input.required<AgendaRequest>();
  /** Come disegnarla. */
  readonly variant = input<RequestCardVariant>('strip');
  /** Se false, la card non mostra il pulsante "Sposta" (es. giorno non spostabile). */
  readonly canCounter = input(true);
  /** Se true, il corpo della card è un pulsante che porta al giorno proposto. */
  readonly bodyTappable = input(false);
  /** Se true, mostra la maniglia di trascinamento in alto a sinistra. */
  readonly grip = input(false);
  /** Da quale dei due giorni la stiamo leggendo (solo variante inline). */
  readonly side = input<RequestSide | null>(null);
  /**
   * Cosa può fare la riga compatta: decidere (chat, dove non c'è calendario) o
   * portare al giorno (strip, che è un indice del calendario che ha sotto).
   */
  readonly actions = input<'decide' | 'open'>('decide');

  readonly accept = output<string>();
  readonly decline = output<string>();
  readonly counter = output<string>();
  readonly withdraw = output<string>();
  /** Emesso dal corpo della card quando `bodyTappable` è attivo. */
  readonly openDay = output<string>();

  readonly KIND_SHORT = KIND_SHORT;
  readonly KIND_ICON = KIND_ICON;

  /** True se la richiesta è mia e sto aspettando il coach: posso solo ritirarla. */
  readonly mine = computed(() => this.req().actor === 'user');

  /** Motivo del conflitto con una seduta già in agenda, o null. */
  readonly conflict = computed(() => this.store.conflictReason(this.req()));

  /** True nelle ultime 24 ore prima dello slot proposto. */
  readonly urgent = computed(() => this.store.isUrgent(this.req()));

  /** True finché il destinatario non l'ha aperta (dot ambra). */
  readonly unseen = computed(() => !this.mine() && !this.req().seenAt);

  /** La scadenza, se è dentro le 24 ore: dettaglio dello stato, non un stato. */
  readonly deadline = computed(() => (this.mine() ? '' : this.countdown()));

  /** Slot da liberare in uno spostamento (null se è una nuova sessione). */
  readonly from = computed(() => {
    const r = this.req();
    if (r.kind !== 'reschedule' || !r.sessionId) return null;
    const s = this.trainer.session(r.sessionId);
    return s ? { day: this.dowShort(s.date), time: s.time } : null;
  });

  /** Slot proposto: il dato più importante della card. */
  readonly to = computed(() => ({
    day: this.dowShort(this.req().payload.date),
    time: this.req().payload.time,
  }));

  /**
   * COSA È QUESTA RICHIESTA, dal giorno in cui la stai leggendo.
   * Uno spostamento è una cosa sola vista da due lati: nel giorno di PARTENZA
   * è una seduta che se ne va, e si chiama spostamento; nel giorno d'ARRIVO è
   * un appuntamento che prima non c'era — cioè, per chi guarda quel giorno,
   * una sessione nuova. Il perché resta scritto nel messaggio del coach.
   */
  private readonly asBooking = computed(
    () => this.req().kind === 'reschedule' && this.side() === 'destination',
  );

  /**
   * PAROLA E ICONA RISPONDONO A DUE DOMANDE DIVERSE, e per questo non dicono
   * sempre la stessa cosa.
   *
   * La parola dice **cosa ti si chiede qui**, e cambia col lato: nel giorno
   * d'arrivo ti si chiede di accettare una sessione nuova, ed è quello che
   * c'è scritto.
   *
   * L'icona dice **da dove viene**, e non cambia mai: resta quella dello
   * spostamento su tutti e due i giorni. È il filo che lega le due card —
   * senza, la sessione nuova sembra nata dal nulla proprio mentre da qualche
   * altra parte una seduta se ne va, e i due fatti non si toccano. In più
   * distingue una sessione che nasce da uno spostamento da una prenotazione
   * vera, che tiene la sua `ti-calendar-plus`.
   */
  readonly kindLabel = computed(() => (this.asBooking() ? KIND_SHORT.booking : KIND_SHORT[this.req().kind]));
  readonly kindIcon = computed(() => KIND_ICON[this.req().kind]);

  /**
   * La scadenza, scritta dove serve: sopra ai bottoni.
   * In testata era un'etichetta da catalogare; qui è la ragione per cui si
   * decide adesso, e la legge chi sta già guardando i due tasti.
   */
  readonly dueLine = computed(() => {
    if (this.mine()) return `In attesa di ${this.trainer.trainer.name}`;
    const d = this.deadline();
    return d ? `Da confermare ${d}` : 'Da confermare';
  });

  /**
   * IL GIORNO SI SCRIVE SOLO SE NON È QUELLO CHE STAI GUARDANDO.
   * Nella timeline la card è già appesa al suo giorno e alla sua ora: scrivere
   * «gio 23 lug ore 19:00» dentro una card che sta a giovedì 23 sulla riga
   * delle 19 è la stessa frase detta tre volte. Fa eccezione il giorno di
   * partenza di uno spostamento, dove la destinazione è un altro giorno e
   * quindi è l'informazione della card.
   */
  /**
   * Uno spostamento che resta nello stesso giorno: cambia solo l'ora.
   * `from` e `to` cadono nella stessa data, quindi la card di partenza non ha
   * un giorno nuovo da annunciare.
   */
  readonly sameDay = computed(() => {
    const r = this.req();
    if (r.kind !== 'reschedule' || !r.sessionId) return false;
    const s = this.trainer.session(r.sessionId);
    return !!s && s.date === r.payload.date;
  });

  /**
   * Il giorno si scrive solo quando è un ALTRO giorno. Ripeterlo su uno
   * spostamento d'orario («si sposta a mar 28 lug», stando sul 28 lug) fa
   * cercare la differenza dove non c'è: l'unica cosa cambiata è l'ora, e deve
   * restare l'unica cosa scritta in grande.
   */
  readonly showDay = computed(() => this.side() === 'origin' && !this.sameDay());

  /**
   * L'etichetta sopra l'orario dice DOVE si va. Se si resta nel giorno, lo dice
   * col nome che quel giorno ha per chi legge — «oggi» quando è oggi, «stesso
   * giorno» quando è una data futura, dove «oggi» sarebbe una bugia.
   */
  readonly slotLabel = computed(() => {
    if (this.side() !== 'origin') return 'Orario';
    if (!this.sameDay()) return 'Si sposta a';
    return this.req().payload.date === isoDay() ? 'Oggi' : 'Stesso giorno';
  });

  /**
   * L'intervallo dello slot. La timeline segna l'inizio; la fine no, ed è
   * l'altra metà di «quanto mi impegna». Sostituisce anche la durata scritta a
   * parte: 18:00 – 19:00 dice già un'ora.
   */
  readonly span = computed(() => {
    const p = this.req().payload;
    const [h, m] = p.time.split(':').map(Number);
    const end = new Date(2000, 0, 1, h, m + p.durationMin);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${p.time} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
  });

  /** "entro 6 ore" — solo nelle ultime 24h, altrimenti stringa vuota. */
  readonly countdown = computed(() => {
    const ms = new Date(`${this.req().payload.date}T${this.req().payload.time}:00`).getTime() - Date.now();
    const h = Math.round(ms / 3_600_000);
    if (h <= 0) return 'scaduta';
    if (h < 24) return `entro ${h} ${h === 1 ? 'ora' : 'ore'}`;
    return '';
  });

  dowShort(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  }
}
