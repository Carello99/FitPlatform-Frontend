# Documento Gamification — come consultarlo e modificarlo

## File
- **`gamification-system.md`** ← sorgente. **Modifica questo** (testo semplice, facile).
- **`gamification-system.pdf`** ← versione consultabile/stampabile, generata dal `.md`.
- `_build/md2pdf.js` ← script che converte il `.md` in PDF (Markdown → HTML → Chrome headless). Zero dipendenze npm.

## Rigenerare il PDF dopo una modifica
Da terminale, nella cartella del progetto:

```bash
node docs/_build/md2pdf.js docs/gamification-system.md docs/gamification-system.pdf
```

Richiede solo Google Chrome installato (usato in modalità headless per la stampa PDF).
Se Chrome è in un percorso diverso, modifica la riga `const chrome = ...` in `_build/md2pdf.js`.

## Note
- Per editare il contenuto basta un editor di testo qualsiasi (anche VS Code): è Markdown.
- Tabelle, elenchi, blocchi di codice e citazioni `>` sono supportati dal convertitore.
