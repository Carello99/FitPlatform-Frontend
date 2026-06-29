# Punti & XP — Schema rapido

> Riferimento veloce: **come** si guadagnano i punti e **quanti**. Versione discorsiva e
> motivata nel documento `gamification-system.md`. I valori qui sono la calibrazione di
> partenza: si possono ritoccare senza cambiare la logica.

---

## 1. Tabella azioni → punti

| # | Azione | Punti (XP) | Quando |
|---|---|---|---|
| 1 | **Allenamento completato** | **100** (base) | A fine sessione |
| 2 | **Esercizio migliorato** (batti il tuo record) | **+40** ciascuno · max **3** | Dentro l'allenamento |
| 3 | **Costanza settimanale** (fai tutte le sessioni pianificate) | **+50%** dell'XP allenamenti della settimana | Fine settimana |
| 4 | **Appuntamento PT onorato** | **+30** | Alla presenza |
| 5 | **Tracking corpo** (peso o misure) | **+15** | Una volta a settimana |
| 6 | **Programma/scheda completato** | **+300** (una tantum) | A fine programma |

**Non danno punti:** aprire l'app, scrollare, leggere la chat, creare/modificare una scheda,
login. → Si premia l'**allenamento**, non l'uso dell'app.

---

## 2. Quanti punti vale UN allenamento

Formula:

```
XP allenamento = 100 × Completezza + (40 × esercizi migliorati, max 3)
```

- **Completezza** = serie fatte ÷ serie pianificate, limitata tra **0,5 e 1,0**
  (finire l'allenamento vale di più; fare serie extra NON dà punti in più).

### Esempi

| Caso | Completezza | Esercizi migliorati | Calcolo | XP |
|---|---|---|---|---|
| Allenamento finito, nessun record | 1,0 | 0 | 100 × 1,0 | **100** |
| Finito + 2 record | 1,0 | 2 | 100 + 80 | **180** |
| Finito + 4 record (contano max 3) | 1,0 | 3 | 100 + 120 | **220** |
| Fatto a metà | 0,5 | 0 | 100 × 0,5 | **50** |

→ Un allenamento vale **tra 50 e 220 XP**.

---

## 3. Bonus costanza settimanale (il più importante)

Se completi **tutte** le sessioni che avevi pianificato nella settimana:

```
Bonus = 50% dell'XP degli allenamenti della settimana × Fattore costanza
Fattore costanza: parte da 1,0 e sale fino a 1,5 dopo 8 settimane consecutive
```

### Esempio — settimana tipo (principiante costante)

| Voce | XP |
|---|---|
| 3 allenamenti finiti, 1 record ciascuno (140 × 3) | 420 |
| Bonus costanza: 50% di 420 × 1,0 | +210 |
| **Totale settimana** | **630** |

Con il fattore al massimo (1,5) la stessa settimana varrebbe **420 + 315 = 735 XP**.

→ La costanza **premia più dell'intensità**: due settimane regolari battono una settimana
esagerata seguita dal nulla.

---

## 3-ter. Settimana tipo: punti per frequenza (parti da livello 1)

### Com'è fatta una settimana tipo
Una settimana = i tuoi allenamenti pianificati + giorni di recupero. **Non serve allenarsi ogni
giorno**: 3–4 sessioni con buon recupero sono il punto d'equilibrio. Ogni allenamento finito con
un piccolo miglioramento vale circa **140 XP**; se completi il tuo piano settimanale scatta il
**bonus costanza +50%**.

### Punti accumulati in UNA settimana, secondo quanti allenamenti fai

Assunzioni: allenamento finito + 1 record ≈ **140 XP**; **dal 5° allenamento** la sessione vale
**metà** (70 XP — il recupero conta, l'eccesso non raddoppia i risultati); **bonus costanza +50%**
(fattore 1,0 la 1ª settimana).

| Allenamenti / sett. | XP allenamenti | XP settimana (con bonus) | Livello a fine settimana* |
|---|---|---|---|
| 1 | 140 | **210** | ~4 |
| 2 | 280 | **420** | ~7 |
| 3 | 420 | **630** | ~9 |
| 4 | 560 | **840** | ~11 |
| 5 | 630 | **945** | ~12 |
| 6 | 700 | **1.050** | ~12–13 |
| 7 | 770 | **1.155** | ~13 |

\* partendo da livello 1 (0 XP), con la curva esponenziale (sez. 5).

**Cosa si nota:**
- Da 1 a 4 allenamenti l'XP **cresce in pieno** → fai bene a essere costante.
- Dal 5° in poi ogni sessione aggiunge **sempre meno** (recupero + *costanza > intensità*): chi si
  spacca 7 giorni su 7 **non guadagna il doppio** di chi ne fa 3–4 e recupera.
- Già nella **prima settimana** sali da livello 1 a **4–13 livelli**: tante celebrazioni, zero
  punti regalati — è solo la curva esponenziale che rende economici i primi livelli.

---

## 3-bis. Nuovi iscritti — più gratificazione, MAI più punti

**I nuovi NON ricevono punti extra** (niente moltiplicatori): gonfiare l'XP falserebbe livelli e
classifiche. La gratificazione in più arriva da **level-up frequenti, celebrazioni e badge** —
roba che non tocca il punteggio:

| Leva (senza XP extra) | Effetto |
|---|---|
| **Curva veloce all'inizio** | I primi livelli costano pochissimo → con l'XP **normale** salgono più livelli la 1ª settimana |
| **Primo allenamento** | Celebrazione + **salita immediata al livello 2** |
| **Celebrazioni dense** | Più animazioni/messaggi positivi nei primi 14 giorni (ricompensa emotiva) |
| **Achievement & badge di benvenuto** | Tanti traguardi facili = status e collezione (**0 XP**) |
| **Asticella costanza 1ª settimana** | Parte bassa (es. **2 sessioni**) → "settimana completata" quasi garantita |
| **Posizionamento iniziale** (sez. 5-bis) | L'esperto non parte da zero → riconoscimento, non punti regalati |
| **Penalità** | **Nessuna** nelle prime 2 settimane (niente streak persa, niente leghe) |

### Esempio — prima settimana (XP normale, niente boost)

| Voce | XP |
|---|---|
| 3 allenamenti finiti, 1 record ciascuno (140 × 3) | 420 |
| Bonus costanza (50%) | +210 |
| **Totale settimana** | **630** |

→ Con la **curva esponenziale** (livelli bassi economici) questi 630 XP onesti bastano per salire
**da livello 1 a ~9**: 8 level-up celebrati nella prima settimana, senza un solo punto regalato.

---

## 4. Limiti anti-furbata (cap)

| Regola | Valore |
|---|---|
| Allenamenti "pieni" contati al giorno | **1** (il 2° dà solo **20** XP simbolici) |
| Esercizi migliorati che danno bonus | **max 3** per allenamento |
| Completezza | **cap 1,0** (niente XP per serie extra) |
| XP da volume | cresce **sotto-lineare** (raddoppiare l'allenamento ≠ raddoppiare i punti) |
| Record assurdi (es. +20 kg in una settimana) | **non validi** senza conferma PT |
| Punti per azioni nell'app (login, scroll…) | **0** |

→ Il modo più redditizio di fare punti **è anche quello sano**: allenarsi con regolarità,
finire le sessioni, migliorare poco alla volta.

---

## 5. Quanti punti per salire di livello

**60 livelli**, **8 Tier** col concept "**Tu contro la tua versione peggiore**" (ogni tier = un
te-peggiore battuto). Curva **esponenziale**: ogni livello costa circa **+10%** del precedente →
all'inizio si sale **spessissimo** (tante celebrazioni), poi ogni livello è una conquista. **Più
tier in basso, sempre meno in alto.**

```
XP cumulativi per il livello n = 450 × (1,1^n − 1)
```

| Livello | XP totali | Tier | Tempo* |
|---|---|---|---|
| 1 | 0 | 🌱 **Risveglio (entra)** | subito |
| 2 | ~95 | 🌱 Risveglio | 1ª sessione |
| 6 | ~350 | 🛋️ **Anti-Divano (entra)** | ~pochi giorni |
| 9 | ~630 | 🛋️ Anti-Divano | ~1ª settimana |
| 13 | ~1.100 | 📈 **Meglio di Ieri (entra)** | ~1–2 settimane |
| 20 | ~2.580 | 📈 Meglio di Ieri | ~3–4 settimane |
| 21 | ~2.900 | 🚫 **Zero Scuse (entra)** | ~3–4 settimane |
| 26 | ~4.900 | ⚙️ **Inarrestabile (entra)** | ~1,5 mesi |
| 40 | ~20.000 | ⚙️ Inarrestabile (fine) | ~6 mesi |
| 41 | ~22.000 | ⚔️ **Guerriero Interiore (entra)** | ~6–7 mesi |
| 50 | ~52.000 | ⚔️ Guerriero Interiore (fine) | ~13 mesi |
| 51 | ~58.000 | 🧬 **Versione 2.0 (entra)** | ~16 mesi |
| 57 | ~103.000 | 🧬 Versione 2.0 (fine) | ~2,5 anni |
| 58 | ~113.000 | 👑 **Leggenda di Te Stesso (entra)** | ~2,7 anni |
| 60 | ~137.000 | 👑 Leggenda di Te Stesso (max) | ~3,3 anni |

\* a ~800 XP/settimana (utente molto costante). Chi si allena meno impiega di più.

### Ritmo realistico
- Settimana tipo ≈ **600–900 XP**.
- **Prima sessione → livello 2.** Prima settimana → **~livello 9** (già *Anti-Divano*). Primi 5
  mesi → **~livello 39**.
- Poi sempre più distanziati: **Inarrestabile** ~1,5 mesi, **Guerriero Interiore** ~6 mesi, **Versione 2.0**
  ~16 mesi, **Leggenda di Te Stesso** ~3 anni.
- Non si **scende** mai di livello: si può solo rallentare.

---

## 5-bis. Livello e punti di partenza (primo accesso)

Al primo login l'utente indica **esperienza** e **frequenza**: da lì lo mettiamo subito al livello
giusto (con l'XP di partenza corrispondente), così l'esperto non parte da zero.

| Esperienza | Frequenza | Livello iniziale | XP di partenza |
|---|---|---|---|
| Mai allenato | qualsiasi | 1 | 0 |
| <1 anno | 1–2× | ~6 | ~350 |
| <1 anno | 3+× | ~12 | ~960 |
| 1–3 anni | 3–4× | ~24–28 | ~4.000–6.000 |
| 3+ anni | 4–5× costante | ~38–41 | ~18.000–22.000 |

- **Tetto: inizio Guerriero Interiore (~livello 41).** Versione 2.0 e Leggenda di Te Stesso si **conquistano solo allenandosi**.
- È **calibrazione, non ricompensa**: nessun punto extra, solo il punto di partenza giusto.
- Un posizionamento alto va **confermato dal PT** o si stabilizza sui primi allenamenti reali
  (anti-autodichiarazione gonfiata).
- I dati corporei (peso, misure) servono a **mostrare i progressi**, mai a dare punti.

---

## 6. Riepilogo in una frase

> Fai i tuoi allenamenti, finiscili, migliora un po' alla volta e ripeti ogni settimana:
> i punti arrivano da soli. Saltare giorni non ti fa "perdere" nulla, esagerare non ti fa
> guadagnare il doppio. **Vince la costanza.**
