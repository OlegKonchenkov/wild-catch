# Level EXP Cap Design

**Date:** 2026-04-21

**Goal**

Allineare tutta la logica EXP/livelli alla regola di gioco confermata:
- livelli `1..19` con la curva già definita
- livelli `20..99` con costo fisso `860 EXP`
- livello massimo `99`

**Problema Attuale**

La tabella `level_exp_config` e la migrazione `019` descrivono la curva corretta, ma la funzione SQL `increment_player_stats`, il flow `redeem-item` e la progress bar client usano ancora la formula legacy `floor(exp / 50) + 1`.

**Approccio Approvato**

Usare un approccio ibrido:
- SQL: nuova migrazione che ricrea `increment_player_stats` usando `level_exp_config` fino al livello 99 e impedisce ogni avanzamento oltre il 99.
- TypeScript: helper condiviso per soglie EXP, EXP al prossimo livello e progress bar, così UI e flussi che non passano dalla RPC restano coerenti.
- API admin: bloccare configurazioni oltre il livello 99 e forzare `860 EXP` per i livelli `20..99`, così la regola concordata resta protetta anche lato pannello admin.

**Dettagli di Design**

1. Fonte della regola

La curva canonica lato app verrà rappresentata in un helper `src/lib/game/leveling.ts`, con:
- `MAX_PLAYER_LEVEL = 99`
- curva `1..19` esplicita
- `860` fisso da `20` a `99`

La funzione SQL userà la tabella `level_exp_config`, ma con `LEAST(..., 99)` e con i livelli `20..99` reinseriti/normalizzati a `860`.

2. Flussi backend

I flussi che già usano `increment_player_stats` erediteranno il fix via SQL.

`src/app/api/admin/players/redeem-item/route.ts` verrà corretto per usare l'helper condiviso invece della formula `exp / 50`.

`src/app/api/admin/exp-config/route.ts` verrà aggiornato per:
- rifiutare `level > 99`
- mantenere `exp_to_next = 860` per i livelli `20..99`

3. UI

`src/components/GameShell.tsx` smetterà di assumere blocchi da `50 EXP`.
La progress bar mostrerà:
- percentuale reale verso il prossimo livello
- barra piena al livello `99`

4. Test

Verranno aggiunti test per:
- soglia esatta `19 -> 20`
- costo fisso `20 -> 21`
- cap al livello `99`
- progress bar / helper livello
- flow `redeem-item` aggiornato

**Rischi e Mitigazioni**

- Rischio: dati admin incoerenti oltre il 99.
  Mitigazione: validazione API + migrazione SQL con cap.

- Rischio: mismatch tra backend e UI.
  Mitigazione: helper condiviso in TypeScript e test su soglie e progressione.

- Rischio: regressioni nei reward flow.
  Mitigazione: non cambiare i call site che già usano la RPC; correggere solo quelli che oggi bypassano la regola.
