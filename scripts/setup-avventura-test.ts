/**
 * One-off: crea una sessione Avventura di prova completa per il tester.
 *
 *  - sessione 'avventura' attiva (senza scadenza) con daily rewards ON
 *  - pre-join del tester + kit (gemme, bustine, chiavi, forzieri, abilità)
 *  - enigma col lucchetto (SPQR) + suggerimento (testa il buy-hint in gemme)
 *  - 2 quiz (uno libero, uno bloccato da aneddoto) + missioni ricorrenti
 *
 * Run:
 *   export NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 *   npx tsx scripts/setup-avventura-test.ts konchenkovoleg@gmail.com
 */
import { createClient } from '@supabase/supabase-js'

const EMAIL = process.argv[2] ?? 'konchenkovoleg@gmail.com'
const SESSION_NAME = 'Avventura di Prova'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: { persistSession: false } })

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find(u => (u.email ?? '').toLowerCase() === email.toLowerCase())
    if (u) return u.id
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  const userId = await findUserId(EMAIL)
  if (!userId) { console.error(`User ${EMAIL} not found`); process.exit(1) }
  console.log(`tester = ${userId}`)

  // Idempotenza: riusa la sessione se già creata
  const { data: existing } = await db.from('sessions').select('id').eq('name', SESSION_NAME).maybeSingle()
  let sessionId = existing?.id as string | undefined

  if (!sessionId) {
    // Area: copia i bounds del tutorial (il tester ha già giocato lì)
    const { data: tut } = await db.from('sessions').select('area_bounds').eq('kind', 'tutorial').maybeSingle()
    const { data: bronzo } = await db.from('packs').select('id').eq('name', 'Bustina di Bronzo').maybeSingle()

    const { data: sess, error } = await db.from('sessions').insert({
      name: SESSION_NAME,
      kind: 'avventura',
      status: 'active',
      start_at: new Date().toISOString(),
      end_at: null,
      auto_end: false,
      duration_minutes: 0,
      daily_rewards_enabled: true,
      daily_pack_id: bronzo?.id ?? null,
      area_bounds: tut?.area_bounds ?? {},
      narrative_config: {
        story_title: 'Le Cronache del Territorio',
        intro_text: 'Un’avventura senza fretta: esplora, colleziona la storia della città e torna ogni giorno.',
        villain_name: '',
        chapters: [],
      },
    }).select('id').single()
    if (error || !sess) { console.error('session insert failed', error); process.exit(1) }
    sessionId = sess.id
    console.log(`✓ sessione avventura creata: ${sessionId}`)
  } else {
    console.log(`sessione già esistente: ${sessionId}`)
  }

  // Pre-join del tester
  await db.from('player_sessions').upsert(
    { user_id: userId, session_id: sessionId, role: 'player', gemme: 300, gold: 500 },
    { onConflict: 'user_id,session_id', ignoreDuplicates: true })
  console.log('✓ tester pre-joinato (500 oro, 300 gemme)')

  // Kit: bustine ×2, chiavi ×2, 1 forziere, 2 abilità
  const { data: packs } = await db.from('packs').select('id')
  for (const p of packs ?? []) {
    await db.from('player_packs').upsert(
      { user_id: userId, session_id: sessionId, pack_id: p.id, quantity: 2 },
      { onConflict: 'user_id,session_id,pack_id' })
  }
  const { data: keys } = await db.from('items').select('id').eq('type', 'chiave')
  for (const k of keys ?? []) {
    await db.from('player_inventory').upsert(
      { user_id: userId, session_id: sessionId, item_id: k.id, quantity: 2 },
      { onConflict: 'user_id,session_id,item_id' })
  }
  const { data: chest } = await db.from('chests').select('id').limit(1).maybeSingle()
  if (chest) await db.from('player_chests').upsert(
    { user_id: userId, session_id: sessionId, chest_id: chest.id, quantity: 1 },
    { onConflict: 'user_id,session_id,chest_id' })
  const { data: abilities } = await db.from('abilities').select('id').eq('min_level', 1).limit(2)
  for (const a of abilities ?? []) {
    await db.from('player_abilities').upsert(
      { user_id: userId, session_id: sessionId, ability_id: a.id, quantity: 1 },
      { onConflict: 'user_id,session_id,ability_id' })
  }
  console.log('✓ kit assegnato (bustine, chiavi, forziere, abilità)')

  // Enigma col LUCCHETTO (SPQR) + un suggerimento → testa anche buy-hint in gemme
  const { data: enigmaExists } = await db.from('enigmi').select('id').eq('session_id', sessionId).eq('title', 'Il Sigillo Romano').maybeSingle()
  if (!enigmaExists) {
    const { data: enigma } = await db.from('enigmi').insert({
      session_id: sessionId,
      title: 'Il Sigillo Romano',
      description: 'Quattro lettere che hanno governato un impero. Componile sul lucchetto.',
      solution: 'SPQR',
      difficulty: 'facile',
      reward_type: 'gold',
      reward_payload: { amount: 150 },
      lock_config: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', length: 4 },
    }).select('id').single()
    if (enigma) {
      await db.from('enigma_suggerimenti').insert({
        enigma_id: enigma.id,
        text: 'L’iscrizione più famosa di Roma: Senatus PopulusQue Romanus.',
        order_index: 0,
      })
      console.log('✓ enigma lucchetto "Il Sigillo Romano" + suggerimento')
    }
  }

  // Quiz: uno libero + uno bloccato da aneddoto
  const { data: place } = await db.from('cultural_places').select('id, name').limit(1).maybeSingle()
  const { data: anecdote } = await db.from('anecdotes').select('id, title').limit(1).maybeSingle()
  const { data: quizExists } = await db.from('quizzes').select('id').eq('session_id', sessionId).limit(1).maybeSingle()
  if (!quizExists) {
    await db.from('quizzes').insert([
      {
        session_id: sessionId,
        place_id: place?.id ?? null,
        question: 'Cosa significa l’acronimo SPQR?',
        options: ['Senatus PopulusQue Romanus', 'Sacrum Populi Quirites Romae', 'Septem Pontes Quattuor Rivi', 'Salus Publica Quies Regni'],
        correct_index: 0,
        reward: [{ type: 'gemme', payload: { amount: 10 } }],
      },
      {
        session_id: sessionId,
        place_id: place?.id ?? null,
        unlock_anecdote_id: anecdote?.id ?? null,
        question: 'In che secolo fiorì il Foro come centro della vita pubblica?',
        options: ['II a.C.', 'V d.C.', 'X d.C.', 'VIII a.C.'],
        correct_index: 0,
        reward: [{ type: 'gemme', payload: { amount: 15 } }],
      },
    ])
    console.log(`✓ 2 quiz (luogo: ${place?.name ?? '—'}; gate: ${anecdote?.title ?? 'nessuno'})`)
  }

  // Missioni ricorrenti
  const { data: missionExists } = await db.from('missions').select('id').eq('session_id', sessionId).limit(1).maybeSingle()
  if (!missionExists) {
    await db.from('missions').insert([
      {
        session_id: sessionId, chapter_order: 1,
        title: 'Passeggiata quotidiana',
        description: 'Percorri 50 metri oggi. Si rinnova ogni giorno.',
        type: 'walk', target: '', target_count: 50,
        reward_gold: 30, reward_exp: 10, is_required: false,
        recurrence: 'daily',
      },
      {
        session_id: sessionId, chapter_order: 2,
        title: 'Cattura del giorno',
        description: 'Cattura un Daimon oggi. Si rinnova ogni giorno.',
        type: 'cattura', target: '', target_count: 1,
        reward_gold: 40, reward_exp: 15, is_required: false,
        recurrence: 'daily',
      },
      {
        session_id: sessionId, chapter_order: 3,
        title: 'Collezionista settimanale',
        description: 'Cattura 3 Daimon questa settimana.',
        type: 'cattura', target: '', target_count: 3,
        reward_gold: 120, reward_exp: 50, is_required: false,
        recurrence: 'weekly',
      },
    ])
    console.log('✓ 3 missioni ricorrenti (2 daily, 1 weekly)')
  }

  console.log('\nFatto! Il tester trova "Avventura di Prova" nella home → Entra.')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
