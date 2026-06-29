# Sistema di Gamification, Progressione & Ranking — FitPlatform

> Documento di design. Sorgente editabile: questo file `.md`. Il PDF è generato da qui
> (vedi `docs/README-gamification.md` per rigenerarlo). Modifica il testo e chiedi una nuova esportazione.

Analisi condotta come team integrato: Senior Product Manager, Game Designer (retention),
Behavioral Psychologist, UX Designer, Fitness Coach, Growth Expert. Dove una scelta è guidata
da una disciplina specifica è marcata così: `[PM] [Game] [Psico] [UX] [Coach] [Growth]`.

> ## 🎯 Il concept: **Tu contro la tua versione peggiore**
> Non gareggi con gli altri: gareggi con **il te di ieri**, con la versione di te che restava sul
> divano, che trovava scuse, che mollava. Ogni punto, ogni livello, ogni tier è **un te-peggiore
> lasciato indietro**. La progressione racconta una sola storia: *stai diventando la versione
> migliore di te stesso*. Tutto il sistema — XP, livelli, tier, achievement, schermate — serve a
> rendere visibile e gratificante questa sfida personale.

---

## 0. Tesi di fondo (leggere prima di tutto)

Tre vincoli del prodotto ribaltano il design rispetto a una gamification fitness standard:

1. **Spesso è il PT a loggare l'allenamento.** → Non possiamo premiare *l'uso dell'app*.
   Dobbiamo premiare *l'allenamento reale* (verificato da PT o dai dati). La maggior parte
   delle app premia l'engagement; noi premiamo il comportamento allenante. È il nostro
   vantaggio competitivo. `[Coach][Psico]`

2. **"Minimo sforzo nell'uso dell'app".** → La gamification deve essere **passiva e
   automatica**. L'utente non deve *fare* nulla per guadagnare: i punti arrivano
   dall'allenamento. L'app non è il luogo dove ottieni la ricompensa col lavoro — è il luogo
   dove **vieni a vederla** e a sentire i progressi. Il "pull" è la narrazione del progresso;
   la "reward" è agganciata al training reale. `[UX][PM]`

3. **Niente ansia, niente streak tossica, costanza > intensità.** → Ogni meccanica è
   **autoreferenziale** (tu vs il te di prima, mai vs gli altri sul valore assoluto) e
   **forgiving** (granularità settimanale, non giornaliera; i giorni di riposo sono parte
   dell'allenamento, non un fallimento). `[Psico][Coach]`

**Framework portante:** Self-Determination Theory — ogni meccanica deve nutrire
**Competenza** (mi sto migliorando), **Autonomia** (è il mio percorso) o **Relazione**
(PT/amici mi vedono). Ciò che non nutre uno di questi tre lo tagliamo.

**North-star metric:** % di utenti che completano la propria frequenza pianificata
≥3 settimane di fila. Non "minuti in app", non "DAU".

---

## A) Quali azioni assegnano punti (e perché)

Principio: si premia **ciò che l'utente controlla** (presentarsi, essere costante), si
**celebra** ciò che non controlla pienamente (PR, peso) senza renderlo obbligatorio — così
l'outcome negativo non genera senso di fallimento.

| Azione | XP | Perché / bisogno SDT |
|---|---|---|
| **Allenamento completato** | Base | Unità atomica del progresso. Competenza. Comportamento-chiave. |
| **Costanza settimanale** (frequenza pianificata raggiunta) | Bonus alto | #1 predittore di risultati. Premiamo la *settimana*, non solo la sessione → focus dall'episodio all'abitudine. Competenza. |
| **Sovraccarico progressivo** (battere il *tuo* record di carico/volume) | Bonus medio | Premia il miglioramento reale, **vs te stesso** → nessuna paura del confronto. Competenza. |
| **Completamento programma/scheda** | Bonus alto (one-shot) | Chiusura, effetto milestone, senso di "ce l'ho fatta". |
| **Appuntamento PT onorato** | Bonus medio | Presenza reale + Relazione. Aiuta la retention del PT. |
| **Tracking corpo** (peso/misure) | Bonus piccolo | Premiamo **l'atto di tracciare**, mai il numero (no scale-anxiety). Abilita la narrazione del progresso. |

**Cosa NON dà punti (deliberatamente):** aprire l'app, scrollare, leggere la chat,
creare/modificare una scheda, login giornaliero. Nessun engagement-for-engagement.

---

## B) Formula di assegnazione punti

Obiettivo: **costanza > intensità**, non abusabile, robusta al fatto che a volte logga il PT.

### Punti base
```
XP_base_allenamento = 100
```

### Moltiplicatori (sull'allenamento)
```
XP_allenamento = 100
  × Completezza        // sets eseguiti / sets pianificati, clamp [0.5 … 1.0]
  + Overload_bonus     // vedi sotto
```
- **Completezza** scoraggia il "log vuoto per i punti" e premia il finire — ma è **cappata a
  1.0**: serie extra oltre il piano non danno XP extra (no farming di volume). `[Game]`

### Overload bonus (autoreferenziale)
```
Overload_bonus = 40 × min(N_esercizi_migliorati, 3)
```
- Conta solo i **primi 3** esercizi in cui batti il tuo record → impedisce il micro-gaming
  (+0,5 kg ovunque).
- Il delta dev'essere **fisiologicamente plausibile** vs storico; salti assurdi
  (+20 kg/settimana) non vengono premiati o richiedono conferma PT → anti-cheat. `[Coach]`

### Bonus costanza settimanale (il cuore del sistema)
Assegnato **a fine settimana**, non per sessione:
```
Se sessioni_completate ≥ sessioni_pianificate:
   XP_settimana = 0.5 × (XP_allenamenti_della_settimana)   // +50%
   × Streak_costanza_factor                                 // 1.0 → 1.5, cap
```
`Streak_costanza_factor` cresce con le settimane consistenti consecutive ma **satura**
(es. cap a 1.5 dopo 8 settimane) → il veterano non scappa via, il principiante recupera.
`[Psico: goal-gradient]`

### Cap & rendimenti decrescenti (anti-abuso)
- **Cap giornaliero:** un solo allenamento "pieno" conta al giorno; un secondo nello stesso
  giorno dà XP simbolico → no grinding. `[Game]`
- **Volume sub-lineare:** l'XP da volume cresce in modo **logaritmico** (2× allenamento ≠
  2× XP) → protegge dall'overtraining e disinnesca la "gara di intensità". `[Coach][Psico]`
- **Solo allenamenti verificati:** loggati dal PT, o completati in-app con timing realistico.

**Risultato:** il modo *ottimale* per massimizzare XP coincide col comportamento sano —
frequenza giusta, sessioni finite, miglioramento graduale, settimana dopo settimana.
L'abuso è matematicamente poco redditizio.

---

## C) Sistema livelli

**Curva: ESPONENZIALE** — ogni livello costa circa **+10%** del precedente. `[Game][Psico]`

Perché esponenziale (e non lineare):
- All'inizio i livelli costano pochissimo → **si sale spesso** (tanti level-up nei primi mesi =
  gratificazione continua, **senza dare punti extra**: la ricompensa è la salita stessa).
- Man mano ogni livello costa di più → i progressi rallentano **da soli**: i tier alti sono un
  **prestigio da anni**, non si raggiungono in poche settimane.

```
XP cumulativi per il livello n = round( 450 × (1,1^n − 1) )
```
(equivale a: costo di un livello ≈ +10% rispetto al precedente)

**60 livelli**, **8 Tier** col concept "**Tu contro la tua versione peggiore**": ogni tier è un
te-peggiore che hai battuto. **Più tier in basso e sempre meno in alto** (i primi 25 livelli sono
4 tier; gli ultimi 3 livelli uno solo) → tante salite al novizio, senza inflazionare i punti.

| Tier | Livelli | Entra a (XP) | Tempo* | Hai battuto il te che… |
|---|---|---|---|---|
| 🌱 **Risveglio** | 1–5 | 0 | subito | …restava a letto |
| 🛋️ **Anti-Divano** | 6–12 | ~350 | ~pochi giorni | …sceglieva il divano |
| 📈 **Meglio di Ieri** | 13–20 | ~1.100 | ~1–2 settimane | …si fermava al primo giorno |
| 🚫 **Zero Scuse** | 21–25 | ~2.900 | ~3–4 settimane | …trovava sempre una scusa |
| ⚙️ **Inarrestabile** | 26–40 | ~4.900 | ~1,5 mesi | …mollava dopo due settimane |
| ⚔️ **Guerriero Interiore** | 41–50 | ~22.000 | ~6 mesi | …si accontentava |
| 🧬 **Versione 2.0** | 51–57 | ~58.000 | ~16 mesi | …eri un anno fa |
| 👑 **Leggenda di Te Stesso** | 58–60 | ~113.000 | ~2,7 anni | …ogni versione precedente di te |

\* a ~800 XP/settimana (utente molto costante); chi si allena meno impiega di più. Livello
**max 60 ≈ 137.000 XP** (~3,3 anni di costanza).

**Densità delle salite:** prima sessione → **livello 2**; prima settimana (~630 XP) → **~livello
9** (già in *Anti-Divano*); primi 5 mesi → **~livello 39**; poi sempre più lento. Entrare in
**Inarrestabile** richiede **~1,5 mesi** (non 3 settimane), **Guerriero Interiore** ~6 mesi, **Leggenda di Te Stesso**
~3 anni.

Poiché il livello è figlio dell'XP, e l'XP è dominato dalla **costanza** (volume cappato e
sub-lineare), chi si allena 6 volte al giorno **non sfonda la classifica**: i livelli
riflettono la costanza-nel-tempo, non il grind. `[Game]`

---

## D) Ranking

Rischio della leaderboard classica: demotiva il 90% (principianti e casual smettono), premia
avanzati e alto-volume → viola i principi. Soluzione: **non si compete mai sul valore
assoluto, ma sulla costanza rispetto al proprio piano.**

### Meccanica primaria: Leghe a coorti (modello Duolingo, metrica fitness-sana)
- Coorti piccole (**~20–30 persone**), **rimescolate ogni settimana**.
- Metrica = **Punti Costanza** (hai fatto *il tuo* piano?), **non kg/volume**. Un principiante
  che fa 3/3 batte un avanzato che fa 2/5. **Campo livellato.** `[Psico: equità percepita]`
- Coorti **matchate per Tier/impegno** → corri contro pari livello.
- Promozione/retrocessione **soft**: niente shaming → "questa settimana resti in [Lega], la
  prossima ci riprovi". `[UX][Psico]`

### Gli altri ranking

| Tipo | Verdetto | Vantaggi | Rischi / mitigazione |
|---|---|---|---|
| **Globale assoluto** | ❌ Evitare come primario | — | Demotiva la maggioranza, premia avanzati. Al più: **percentile privato e positivo** ("più costante del 78% questo mese"). |
| **Amici (opt-in)** | ✅ Fase 2 | Relazione, kudos | Solo supportivo (kudos, non shaming). Nessun confronto di forza imposto. |
| **PT-clienti** | ✅ (con cura) | Accountability + Relazione; tool di retention PT | Clienti eterogenei → metrica = **% costanza vs proprio piano**; PT dà "kudos"/badge. Mai esporre i carichi tra clienti. |
| **Per categoria/obiettivo** | ✅ opzionale | Confronto tra simili | Solo se resta consistency-based. |

**Regola d'oro:** si gareggia sul *fare la propria parte*, non sull'*essere più forti*.

---

## E) Achievement

Tre livelli + mix di tipi. Tutti **autoreferenziali o di costanza** (mai "più forte di X").

**Iniziali (gancio, prima settimana)** — onboarding, *endowed progress*:
- 🥇 Primo allenamento completato
- 📅 Prima settimana piena (frequenza pianificata)
- 💪 Primo record personale (qualsiasi esercizio)
- 📏 Prime misure registrate

**Medi (abitudine, 1–3 mesi):**
- 🔥 4 settimane costanti di fila
- 🏗️ Programma/scheda completato
- 📈 +20 kg cumulativi su un'alzata principale
- 📓 8 settimane di tracking corpo

**Avanzati (identità, 3 mesi+):**
- 🗓️ 90 giorni di costanza
- 💯 100 allenamenti
- ⚡ Carico iniziale raddoppiato su un fondamentale
- 🌗 365 giorni nel percorso

**Nascosti (ricompensa variabile → dopamine):** sblocchi a sorpresa ("Early bird",
"Comeback: tornato dopo una pausa"). Il *comeback* premia chi rientra dopo uno stop →
anti-senso-di-fallimento. `[Psico][Coach]`

Ogni sblocco = **momento di celebrazione** (animazione a fine allenamento + **card
condivisibile** stile Strava → prova sociale e Relazione).

---

## F) Retention — cosa rubare e cosa NO

| Fonte | ✅ Prendi | ❌ Non prendere |
|---|---|---|
| **Duolingo** | Streak con **freeze**, leghe a coorti piccole, tono giocoso | Notifiche-colpa, pressione *giornaliera*, perdita-streak punitiva. Streak **settimanale**, non "giorni di apertura app". |
| **Strava** | **Kudos**, card condivisibili, celebrazione PR | Confronto pubblico che intimidisce i principianti, ossessione da segment. |
| **Apple Fitness** | Visual a **colpo d'occhio** (anello/barra = stato in 1 sguardo), sfida mensile personalizzata | Focus calorie/movimento, "ring-guilt". |
| **Fitbit/Garmin** | **Insight contestuali** ("questo mese sei più forte"), consapevolezza del recupero | Badge-spam, vanity metrics, **overload di dati**. |

**Sintesi:** streak forgiving + social di supporto + visual a colpo d'occhio + narrazione
**"tu vs il te di prima"**. Riconcettualizziamo la *streak* come **"Ritmo / Settimane di
costanza"** (settimanale + buffer/freeze) per togliere ansia mantenendo *consistency &
commitment*.

---

## G) Motivazione psicologica (per meccanica)

| Meccanica | Perché funziona | Bisogno | Comportamento incentivato |
|---|---|---|---|
| XP da costanza settimanale | Focus dall'episodio all'**abitudine**; loss aversion morbida | Competenza | Allenarsi con regolarità |
| Overload autoreferenziale | Feedback di competenza senza paura del confronto | Competenza/Autonomia | Progressione graduale |
| Livelli/Tier identitari | *Commitment & consistency*: "sono uno che si allena" | Competenza/Autonomia | Continuità a lungo termine |
| Barra "manca poco" | **Goal-gradient effect**: si accelera vicino al traguardo | Competenza | Completare settimana/sessione |
| Streak forgiving + freeze + "Comeback" | Toglie il senso di fallimento; permette il rientro | Competenza | Ripresa dopo gli stop |
| Leghe a coorti su costanza | Prova sociale, equità percepita | Relazione | Fare la propria parte |
| Kudos PT/amici | Riconoscimento sociale reale | Relazione | Presentarsi |
| Achievement a sorpresa | **Ricompensa variabile** → picco dopaminergico | Competenza | Esplorazione sana |
| Celebrazione fine allenamento | **Peak-end rule**: ricordi l'allenamento come positivo | Competenza | Ripetere |
| Sfida mensile / "Fresh start" | **Fresh-start effect**: i nuovi cicli rimotivano | Autonomia | Reingaggio periodico |

---

## H) Dashboard utente

Filosofia UX: **una metrica-eroe per schermata**, *progressive disclosure*, default sempre
incoraggiante. `[UX]`

**Profilo — "dove sono nel mio percorso"**
- Mostra: Tier + livello + barra al prossimo, **Settimane di costanza** (il Ritmo), prossimo
  milestone, avatar/titolo.
- Nascondi: numeri grezzi, totali kg sollevati, statistiche fredde.

**Progressi — "la prova che sto migliorando" (schermata più importante)**
- Mostra: **narrazione "tu vs il te di prima"** (1 frase + 1–2 trend: forza su un'alzata,
  **heatmap/calendario di costanza**). Foto/misure corpo dietro un tap, opzionali.
- Nascondi: muro di grafici, delta negativi come fallimento (un calo si mostra neutro/
  contestualizzato, mai in rosso-allarme).

**Ranking**
- Mostra: lega corrente, posizione nella coorte, tempo rimanente, kudos. Piccolo e supportivo.

**Achievement**
- Mostra: galleria con **silhouette dei bloccati** (curiosità + goal-gradient), ultimi
  sbloccati in evidenza, 1–2 "prossimi da sbloccare".

**Anti-overload:** una sola hero-metric visibile, il resto a un tap; mai mostrare tutto ciò
che raccogliamo solo perché lo abbiamo. La filosofia "niente dati inutili" vale anche qui. `[PM]`

---

## I) Sistema per QUESTA app: MVP vs Completo

### ✅ MVP — costruire subito
Tutto **automatico dai dati di allenamento** (funziona anche quando logga il PT, zero carico utente):

0. **Onboarding nuovi iscritti (priorità #1)** — questionario breve di primo accesso con
   **posizionamento al livello giusto** (sez. K); **curva veloce iniziale**, celebrazioni dense,
   achievement e badge di benvenuto = gratificazione **senza punti extra**; asticella bassa,
   zero penalità iniziali (sez. J). È la leva di retention con il ROI più alto.
1. **XP effort+costanza** con cap e rendimenti decrescenti (sez. B).
2. **Livelli ibridi + 5 Tier** (sez. C).
3. **Ritmo settimanale** (streak forgiving) + **1 freeze**.
4. **Achievement core**: costanza + PR autoreferenziali + "Comeback".
5. **Celebrazione di fine allenamento** (peak-end).
6. **Schermata Progressi** "tu vs il te di prima" + heatmap costanza.
7. **Missione settimanale**: "completa le tue X sessioni pianificate".
8. **2–3 notifiche motivazionali** smart, mai sensi-di-colpa.

> Perché: massimizza la costanza con **sforzo utente ≈ 0**, robusto al logging-by-PT, copre
> Competenza + parte di Autonomia.

### 🔜 Versione completa — Fase 2+
- **Leghe a coorti** (ranking costanza).
- **Amici + kudos**, **vista PT-clienti + kudos/badge dal PT** (valore *two-sided*, leva Growth).
- **Card condivisibili** (acquisizione organica).
- **Sfide mensili personalizzate**, achievement nascosti.
- **Reward shop**: cosmetici/titoli/temi sbloccabili coi livelli (mai con denaro, mai pay-to-win).
- **Obiettivi adattivi** (sistema o PT alzano l'asticella in base allo storico).

### ❌ Evitare completamente
- Leaderboard **globale su forza/volume assoluti**.
- **Login streak** / XP per uso dell'app.
- Perdita-streak **punitiva**, notifiche-colpa.
- **Comprare** XP/livelli, pay-to-win.
- **Overload di vanity stats**.
- Premiare **overtraining** / ignorare il recupero.
- Confrontare principianti e avanzati su metriche assolute.

---

## J) Onboarding & nuovi iscritti — la finestra più importante

**Il momento decisivo è la prima/seconda settimana.** Gran parte dell'abbandono avviene qui:
se il principiante non sente **competenza e progresso subito**, sparisce prima che l'abitudine
si formi. Per questo i nuovi iscritti ricevono la **massima gratificazione**: le prime due
settimane sono una "luna di miele" progettata, fatta di vittorie facili, frequenti e celebrate.
`[Growth][Psico]`

### Principio: ai nuovi diamo PIÙ gratificazione, MAI più punti
Niente XP gonfiati ai nuovi: falserebbe livelli e classifiche e premierebbe l'iscrizione invece
dell'allenamento. La gratificazione extra arriva da **level-up frequenti (per la curva, non per
punti regalati), celebrazioni, badge, achievement e riconoscimento** — tutta roba che non tocca
il conteggio XP né il ranking. `[Growth][Psico]`

### Meccaniche dedicate ai nuovi (senza punti extra)
1. **Curva veloce all'inizio** — i primi livelli costano pochissimo (sez. C): con l'XP
   **normale** il nuovo fa **più level-up già nella prima settimana**. La spinta viene dalla
   *curva*, non da punti gonfiati → ranking equo. `[Game]`
2. **Prima sessione = grande celebrazione** + **level-up immediato** (il primo allenamento porta
   già al livello 2). Segnale fortissimo di competenza, a costo XP normale.
3. **Densità di celebrazioni** — nei primi 14 giorni più animazioni, messaggi e feedback
   positivi: ricompensa **emotiva e visiva**, non punti. `[Psico: peak-end]`
4. **Achievement raggruppati all'inizio** — tanti traguardi facili da sbloccare la 1ª/2ª
   settimana (gratificazione da collezione e status, **0 XP**).
5. **Ricompense cosmetiche di benvenuto** — badge "Benvenuto", titolo iniziale, avatar/tema
   sbloccabile completando le missioni. È **status**, non valuta di gioco.
6. **Missioni di benvenuto** (checklist 1ª settimana): *primo allenamento → prima settimana
   piena → primo record*. Obiettivi a portata di mano; premiano con achievement/cosmetici.
7. **Asticella bassa all'inizio** — il target di costanza della 1ª settimana parte conservativo
   (es. 2 sessioni): il primo "settimana completata 🔥" è quasi garantito (sblocca un
   achievement, non XP extra).
8. **Newbie gains assecondati** — il principiante migliora in fretta: i record (e i bonus
   overload) arrivano spesso e **guadagnati davvero**, non regalati. Li celebriamo tutti.
9. **Zero penalità + niente leghe per ~2 settimane** — nessuna retrocessione, nessuna streak
   persa, nessun confronto finché non c'è una base che regge.
10. **Welcome assistito dal PT** — se c'è un PT, il **primo allenamento loggato dal PT** fa
    scattare la celebrazione: l'utente apre l'app e trova **già** una vittoria (sforzo ≈ 0).
11. **Posizionamento iniziale corretto** (sez. K) — l'utente esperto **non parte da zero**: si
    sente riconosciuto senza ricevere "punti regalati".
12. **Reveal progressivo** — al day-1 non si mostra tutto il sistema: ranking e achievement
    avanzati si sbloccano man mano, per non sommergere il novizio. `[UX]`

### Cosa evitare con i nuovi
- **XP gonfiati / boost moltiplicatori** → falsano livelli e classifiche.
- Bombardarli di metriche e statistiche al primo accesso.
- Metterli subito in una lega dove sono ultimi.
- Obiettivi troppo alti la prima settimana (genera fallimento immediato).
- Qualsiasi paragone con utenti avanzati.

**Bisogni soddisfatti:** Competenza (vittorie immediate dalla curva veloce), Autonomia (è il
*mio* inizio), Relazione (il PT mi accoglie). Effetti psicologici: *fresh-start*, *goal-gradient*,
*peak-end* — ottenuti con celebrazioni e riconoscimento, **non con valuta di gioco**.

---

## K) Primo accesso — dati iniziali, posizionamento & punti di partenza

Al primo login chiediamo **pochi dati** (filosofia: minimo sforzo; il PT può compilarli al posto
dell'utente). Servono a **due cose distinte**: (1) **tracciare i progressi** utili nel tempo,
(2) **calcolare livello e punti di partenza**, così un esperto non parte da zero e un
principiante non finisce in mezzo agli avanzati. `[UX][Coach][Growth]`

### Dati da chiedere (onboarding breve, ~6 tap)

| Dato | Valori | A cosa serve | Obbligatorio |
|---|---|---|---|
| **Esperienza di allenamento** | mai · <1 anno · 1–3 anni · 3+ anni | Posizionamento livello iniziale | Sì |
| **Frequenza attuale** | 0 · 1–2 · 3–4 · 5+ a settimana | Baseline costanza + target settimanale | Sì |
| **Obiettivo principale** | dimagrimento · forza/massa · benessere · performance | Personalizzazione, categoria ranking, tono missioni | Sì |
| **Sesso ed età** | — | Normalizzazione metriche, personalizzazione | Sì (per i progressi) |
| **Peso e altezza** | numerico | Tracking progressi (trend, mai giudizio) + baseline | Sì |
| **Misure corporee** (vita, braccia…) | numerico | Tracking progressi fisici | Opzionale |
| **Carichi indicativi sui fondamentali** | numerico | Baseline forza + overload da subito | Opzionale (o lo mette il PT) |
| **Hai un personal trainer?** | sì/no + collegamento | Abilita flussi PT + welcome assistito | Sì |
| **Giorni/disponibilità** | selezione | Pianificazione schede | Opzionale |

> I dati corporei servono a **mostrare** i progressi ("tu vs il te di prima"), **mai** a dare o
> togliere punti (no scale-anxiety). I punti dipendono solo dall'allenamento; i dati iniziali
> servono al *posizionamento*, non al punteggio.

### Posizionamento iniziale (livello & XP di partenza)
Mappa **esperienza × frequenza → livello iniziale**; l'XP di partenza = soglia cumulativa di quel
livello (sez. C).

| Esperienza | Frequenza | Livello iniziale | Tier | XP di partenza |
|---|---|---|---|---|
| Mai allenato | qualsiasi | 1 | 🌱 Risveglio | 0 |
| <1 anno | 1–2× | ~6 | 🛋️ Anti-Divano | ~350 |
| <1 anno | 3+× | ~12 | 🛋️ Anti-Divano | ~960 |
| 1–3 anni | 3–4× | ~24–28 | 🚫 Zero Scuse → ⚙️ Inarrestabile | ~4.000–6.000 |
| 3+ anni | 4–5× costante | ~38–41 | ⚙️ Inarrestabile → ⚔️ Guerriero Interiore | ~18.000–22.000 |

**Tetto al posizionamento: inizio Guerriero Interiore (~livello 41).** Nessuno parte da Versione 2.0 o Leggenda di Te Stesso:
quei tier rappresentano la **costanza dimostrata sull'app** e si conquistano solo allenandosi nel
tempo. Il posizionamento dà *riconoscimento*, non svende il prestigio. `[Game][Psico]`

### Regole del posizionamento
- È **calibrazione, non ricompensa**: nessun "punto extra per azioni", solo il punto di partenza
  giusto sulla scala.
- **Skippabile/rinviabile**: se l'utente salta, parte da livello 1 e il sistema affina col tempo
  (e col PT).
- **Raffinabile**: utente o PT possono correggere esperienza/carichi nelle prime settimane →
  ricalibrazione una tantum.
- **Anti-gonfiaggio**: un posizionamento alto (Inarrestabile/Guerriero Interiore) richiede **conferma del PT**
  oppure si **stabilizza sui primi allenamenti reali** — se i carichi reali non confermano
  l'autodichiarazione, il livello scende dolcemente. Niente "mi dichiaro esperto per partire alto".

---

## TL;DR

Costruiamo un sistema dove **il modo ottimale di "vincere" coincide con allenarsi in modo
sano e costante nel tempo**, dove l'utente **non deve fare nulla in più** per essere premiato,
dove **non si perde mai** (solo si rallenta o si rientra), e dove ogni schermata risponde a
una sola domanda: *"sto migliorando?"* — con un sì visibile, autoreferenziale e celebrato.
Costanza > intensità, incoraggiare > punire, automatico > manuale.
