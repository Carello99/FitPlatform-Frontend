/**
 * ============================================================================
 *  FILE: exercise-image.service.ts  —  RISOLUTORE GIF DIMOSTRATIVE
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Dato il nome di un esercizio, restituisce l'URL della GIF dimostrativa
 *   (ospitata su un CDN esterno). Centralizza la mappa nome → id GIF così le
 *   viste non hardcodano URL.
 *
 * COSA RAPPRESENTA / COME INTERAGISCE
 *   Service singleton. CHI LO USA: ExerciseCardComponent (quando showGif=true,
 *   es. nell'allenamento attivo) per mostrare l'anteprima animata.
 *
 * FLUSSO DEI DATI
 *   getGifUrl(name) → resolveId(name) cerca l'id nella tabella GIF_IDS →
 *   compone `${GIF_BASE}${id}.gif`. Se l'id non si trova → null → la card
 *   mostra il fallback (numero/placeholder) tramite (error)="onImgError()".
 *
 * DIPENDENZE PRINCIPALI
 *   - CDN esterno static.exercisedb.dev (rete!). Se è irraggiungibile o un id
 *     è errato, l'immagine fallisce: la card DEVE gestire (error).
 *
 * PUNTI CRITICI PER IL DEBUGGING
 *   - resolveId usa lo STESSO match per prefisso di muscleIdForExercise: un
 *     prefisso ambiguo può puntare alla GIF sbagliata. Nuovo esercizio senza
 *     voce in GIF_IDS → niente GIF (non è un errore, è il fallback previsto).
 *   - Gli id sono opachi (stringhe del CDN): non inventarli, vanno dal provider.
 * ============================================================================
 */

import { Injectable, inject } from '@angular/core';
import { ExerciseCatalogService } from './exercise-catalog.service';

const GIF_BASE = 'https://static.exercisedb.dev/media/';

const GIF_IDS: Record<string, string> = {
  // Petto
  'Panca piana':            'EIeI8Vf',  // barbell bench press
  'Panca inclinata':        '3TZduzM',  // barbell incline bench press
  'Spinte manubri':         'SpYC0Kp',  // dumbbell bench press
  'Push-up':                '0br45wL',  // push-up
  'Dip alle parallele':     '05Cf2v8',  // dips
  'Cavi incrociati':        'j7XMAyn',  // cable chest crossover
  'Pec deck':               '0CXGHya',  // cable cross-over variation
  // Dorsali
  'Trazioni':               '0V2YQjW',  // pull up neutral grip
  'Rematore bilanciere':    'aaxA3cm',  // smith bent over row
  'Lat machine':            'LEprlgG',  // cable lat pulldown full range
  'Pulley basso':           'A3P4O0R',  // cable seated row
  'Stacco da terra':        'hrVQWvE',  // barbell straight leg deadlift
  // Spalle
  'Lento avanti':           'f1jf47L',  // dumbbell seated shoulder press
  'Military press':         'kTbSH9h',  // barbell seated overhead press
  'Arnold press':           'Xy4jlWA',  // dumbbell arnold press
  'Alzate laterali':        'hrrS0Ed',  // dumbbell seated lateral raise
  'Alzate frontali':        'xMjBKwn',  // dumbbell lateral to front raise
  // Bicipiti
  'Curl bilanciere':        '25GPyDY',  // barbell curl
  'Curl manubri':           '6em2Dxj',  // dumbbell hammer curl
  'Curl concentrato':       'gvsWLQw',  // dumbbell concentration curl
  'Curl a martello':        '6em2Dxj',  // dumbbell hammer curl
  // Tricipiti
  'Tricipiti ai cavi':      'gAwDzB3',  // cable triceps pushdown
  'French press':           '1cTf2Ux',  // ez bar french press
  'Skull crusher':          'h8LFzo9',  // barbell skull crusher
  'Tricipiti overhead':     '2IxROQ1',  // cable overhead triceps extension
  'Close grip bench':       '7jGOBF3',  // dumbbell close grip press
  // Core
  'Plank':                  'h1ezqSu',  // kneeling plank tap shoulder
  'Crunch':                 '9Ap7miY',  // decline crunch
  'Russian twist':          'fZFZ704',  // weighted russian twist
  'Leg raise':              '4Ml7QFO',  // hanging straight leg raise
  'Plank laterale':         '5VXmnV5',  // bodyweight incline side plank
  'Bicycle crunch':         'tZkGYZ9',  // band bicycle crunch
  'Ab wheel':               'KtRomty',  // standing wheel rollerout
  // Quadricipiti
  'Squat':                  'DhMl549',  // barbell full squat
  'Pressa 45°':             '10Z2DXU',  // sled 45° leg press
  'Leg extension':          'my33uHU',  // lever leg extension
  'Affondi':                '13VW2VO',  // weighted stretch lunge
  'Affondi bulgari':        'gGNQmVt',  // barbell single leg split squat
  'Hack squat':             '5VCj6iH',  // barbell hack squat
  // Femorali
  'Stacco rumeno':          'wQ2c4XD',  // barbell romanian deadlift
  'Leg curl':               '17lJ1kr',  // lever lying leg curl
  'Good morning':           'XlZ4lAC',  // barbell good morning
  // Glutei
  'Hip thrust':             'Pjbc0Kt',  // resistance band hip thrusts
  'Sumo squat':             'KgI0tqW',  // barbell sumo deadlift
  'Kickback glutei':        'Kpajagk',  // cable standing hip extension
  'Glutei al cavo':         'Kpajagk',  // cable standing hip extension
  // Polpacci
  'Calf raise':             '6HmFgmx',  // standing calf raise
  'Calf raise seduto':      '0S75mYG',  // smith seated calf raise
  'Leg press calf':         'IeDEXTe',  // lever seated calf raise on leg press
};

@Injectable({ providedIn: 'root' })
export class ExerciseImageService {
  // Catalogo ampliato: contiene il gifId per ogni esercizio importato. È la
  // fonte primaria; GIF_IDS qui sotto resta come fallback per i nomi storici.
  private readonly catalog = inject(ExerciseCatalogService);

  getGifUrl(exerciseName: string): string | null {
    const id = this.resolveId(exerciseName);
    return id ? `${GIF_BASE}${id}.gif` : null;
  }

  /**
   * Risolve l'id GIF, in ordine di priorità:
   *   1) catalogo importato (corrispondenza esatta sul nome);
   *   2) mappa statica GIF_IDS (corrispondenza esatta);
   *   3) match per prefisso sulla mappa statica (es. "Squat bilanciere" → "Squat").
   * Restituisce undefined se nessuna GIF è associabile → la card mostra il
   * fallback (icona/numero) e NON un'immagine rotta.
   */
  private resolveId(name: string): string | undefined {
    // 1) Catalogo (la sorgente ampia: centinaia/migliaia di esercizi).
    const fromCatalog = this.catalog.gifByName()[name];
    if (fromCatalog) return fromCatalog;
    // 2) Mappa statica esatta.
    if (GIF_IDS[name]) return GIF_IDS[name];
    // 3) Fallback per prefisso sulla mappa statica.
    let best: string | undefined;
    let bestLen = 0;
    for (const key of Object.keys(GIF_IDS)) {
      if (name.startsWith(key) && key.length > bestLen) {
        best = GIF_IDS[key];
        bestLen = key.length;
      }
    }
    return best;
  }
}
