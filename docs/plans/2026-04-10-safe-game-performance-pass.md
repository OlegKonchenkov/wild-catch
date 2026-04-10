# Safe Game Performance Pass

> Perimetro approvato: approccio A, miglioramenti a basso rischio su percezione di velocita', loading e feedback immediato.

**Goal:** Rendere le sezioni gioco piu' reattive senza toccare regole di gameplay, risultati server o logiche di progressione.

**Architecture:** Interveniamo solo su fallback di route, skeleton coerenti con la UI esistente, prefetch conservativo del menu di gioco e feedback immediato dei pulsanti che eseguono chiamate di rete. Evitiamo refactor invasivi di layout, caching avanzata e optimistic UI che modifichi stati di gioco.

**Out of scope:** Conversione immagini in WebP, modifiche alle formule di combattimento/cattura, refactor profondi di data fetching server/client, cambi di design non concordati.

## Passi

1. Introdurre componenti loading condivisi per il lato gioco.
2. Aggiungere un `loading.tsx` alla sezione `/game` con fallback coerente.
3. Migliorare gli skeleton delle pagine player dove oggi il caricamento e' debole o testuale.
4. Rendere piu' immediato il feedback del menu di gioco con prefetch conservativo.
5. Rendere piu' chiaro il feedback nelle azioni di encounter senza alterare l'esito server.
6. Verificare con lint mirato e controllo diff.
