/**
 * ============================================================================
 *  FILE: storage.constants.ts  —  REGISTRO DELLE CHIAVI localStorage
 * ============================================================================
 *
 * SCOPO DEL FILE
 *   Unico posto in cui sono dichiarate le chiavi di persistenza dell'app.
 *   Prima erano stringhe letterali sparse nei servizi (e in un componente),
 *   con due convenzioni di naming incoerenti: impossibile sapere cosa l'app
 *   scrive sul dispositivo senza cercare `localStorage` in tutta la codebase.
 *
 * REGOLA (vedi ARCHITECTURE.md → Persistenza locale)
 *   - Ogni chiave nuova si dichiara QUI, mai inline.
 *   - Formato: `ff-<dominio>` in kebab-case, con `-vN` solo se lo schema
 *     persistito è versionato e una modifica deve invalidare i dati vecchi.
 *   - Solo i servizi in core/ leggono e scrivono: i componenti non toccano
 *     localStorage direttamente.
 *
 * NOTA SUI VALORI STORICI
 *   Alcune chiavi usano ancora snake_case (`ff_exercise_catalog`,
 *   `ff_skip_del_confirm`): i VALORI restano invariati di proposito, perché
 *   rinominarli scarterebbe i dati già salvati sui dispositivi degli utenti.
 *   La convenzione kebab-case vale per ogni chiave nuova; le due storiche si
 *   normalizzano solo con una migrazione esplicita.
 * ============================================================================
 */

/** Tema scelto dall'utente ('dark' | 'light'). Scritta da ThemeService. */
export const STORAGE_THEME = 'ff-theme';

/** Stato della progressione (XP, livelli, streak, badge). Scritta da GamificationService. */
export const STORAGE_GAMIFICATION = 'ff-gamification-v1';

/** Cache dello snapshot catalogo esercizi. Scritta da ExerciseCatalogService. */
export const STORAGE_EXERCISE_CATALOG = 'ff_exercise_catalog';

/** Preferenza "non chiedermelo più" sulla conferma di eliminazione esercizio. */
export const STORAGE_SKIP_DELETE_CONFIRM = 'ff_skip_del_confirm';
