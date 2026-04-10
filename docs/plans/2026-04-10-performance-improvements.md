# Performance Improvements — Appunti

> Creato: 2026-04-10
> Stato: da fare quando ci sono tempo e crediti

---

## 1. Conversione immagini creature PNG → WebP

### Problema
Le immagini generate da `gpt-image-1.5` vengono salvate come PNG da **~2 MB ciascuna**.
Vengono caricate tutte nel DaimonDex (bestiary) e nelle card degli incontri — su rete lenta il caricamento è lento e bloccante.

### Soluzione
Convertire tutto in WebP con quality 85 → **~300-500 KB** per immagine, perdita visiva praticamente nulla su mobile.

### Come farlo

**Step 1 — Script conversione batch (Node.js con sharp):**

```bash
npm install sharp
```

```js
// scripts/convert-to-webp.mjs
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: creatures } = await supabase.from('creatures').select('id, image_url').not('image_url', 'is', null)

for (const c of creatures) {
  const res = await fetch(c.image_url)
  const buffer = Buffer.from(await res.arrayBuffer())
  const webp = await sharp(buffer).webp({ quality: 85 }).toBuffer()

  const path = `creatures/${c.id}.webp`
  await supabase.storage.from('creature-artwork').upload(path, webp, { contentType: 'image/webp', upsert: true })

  const { data } = supabase.storage.from('creature-artwork').getPublicUrl(path)
  await supabase.from('creatures').update({ image_url: data.publicUrl }).eq('id', c.id)

  console.log(`✅ ${c.id} → ${(webp.length / 1024).toFixed(0)} KB`)
}
```

**Step 2 — Aggiornare la route di generazione artwork** (`src/app/api/admin/creatures/[id]/artwork/route.ts`):

Cambiare `output_format: 'png'` → `output_format: 'webp'` e il content-type da `image/png` a `image/webp` e il path da `.png` a `.webp`.

**Step 3 — Aggiungere `next/image`** nelle card del bestiary con `width`, `height` e `quality={85}` per il lazy loading automatico e il resize adattivo.

### Stima impatto
| | Prima | Dopo |
|---|---|---|
| Peso medio per immagine | ~2 MB | ~400 KB |
| Bestiary 30 creature (prima volta) | ~60 MB | ~12 MB |
| Con lazy loading (solo visibili) | — | ~2-4 MB |

---

## 2. Feedback immediato su rete lenta (Optimistic UI)

### Problema
Su rete lenta, cliccare un bottone non dà risposta visiva immediata → l'utente pensa che non sia successo niente e riclicca.

### Soluzione
Ogni bottone che fa una chiamata di rete deve **disabilitarsi e mostrare spinner immediatamente** al click, prima che la risposta arrivi. Già fatto in alcuni punti (login), da estendere ai bottoni chiave del gioco (catch, duel, shop).

### Dove intervenire
- `src/app/game/encounter/` — bottone Cattura / Combatti
- `src/app/game/duel/` — bottone Attacca
- `src/app/game/shop/` — bottone Acquista
- `src/app/home/page.tsx` — join sessione

---

## 3. Skeleton loaders dove mancano

Già implementati in admin. Estendere a:
- Bestiary card grid (attualmente blank mentre carica)
- Profilo utente — sezione statistiche
- Leaderboard
