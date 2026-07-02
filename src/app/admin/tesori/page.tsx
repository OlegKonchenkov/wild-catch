'use client'
import { useState, useEffect } from 'react'
import CatalogManager, { type Field } from '@/components/admin/CatalogManager'

const REWARD_TYPES = ['gold', 'exp', 'gemme', 'oggetto', 'creatura', 'abilita', 'uovo', 'bustina', 'forziere', 'premio', 'personaggio', 'opera', 'aneddoto', 'missione', 'indizio', 'evento']

const TABS = ['Bustine', 'Contenuti bustine', 'Forzieri', 'Premi'] as const
type Tab = typeof TABS[number]

export default function TesoriAdminPage() {
  const [tab, setTab] = useState<Tab>('Bustine')
  const [packs, setPacks] = useState<Array<{ value: string; label: string }>>([])
  const [places, setPlaces] = useState<Array<{ value: string; label: string }>>([])

  useEffect(() => {
    fetch('/api/admin/catalog/packs').then(r => r.json()).then(d => setPacks((d.rows ?? []).map((p: any) => ({ value: p.id, label: p.name }))))
    fetch('/api/admin/catalog/cultural_places').then(r => r.json()).then(d => setPlaces((d.rows ?? []).map((p: any) => ({ value: p.id, label: p.name }))))
  }, [])

  const packFields: Field[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'rarity', label: 'Rarità', type: 'rarity', half: true },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
    { key: 'min_drops', label: 'Min ricompense', type: 'number', half: true },
    { key: 'max_drops', label: 'Max ricompense', type: 'number', half: true },
    { key: 'price_gold', label: 'Prezzo oro (shop)', type: 'number', half: true },
    { key: 'price_gemme', label: 'Prezzo gemme (shop)', type: 'number', half: true },
  ]

  const poolFields: Field[] = [
    { key: 'pack_id', label: 'Bustina', type: 'select', options: packs },
    { key: 'reward_type', label: 'Tipo ricompensa', type: 'select', options: REWARD_TYPES.map(t => ({ value: t, label: t })), half: true },
    { key: 'weight', label: 'Peso (probabilità)', type: 'number', half: true },
    { key: 'reward_payload', label: 'Payload (JSON)', type: 'json', placeholder: '{"pack_id":"..."} oppure {"item_id":"..."} — per gold/gemme/exp lascia {}' },
    { key: 'rarity_tier', label: 'Tier rarità', type: 'rarity', half: true },
    { key: 'min_qty', label: 'Qtà min', type: 'number', half: true },
    { key: 'max_qty', label: 'Qtà max', type: 'number', half: true },
  ]

  const chestFields: Field[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'rarity', label: 'Rarità', type: 'rarity', half: true },
    { key: 'place_id', label: 'Luogo culturale', type: 'select', options: places, half: true },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
    { key: 'key_requirements', label: 'Chiavi richieste (JSON)', type: 'json', placeholder: '[{"item_id":"<id chiave>","qty":1}]' },
    { key: 'contents', label: 'Contenuto fisso (JSON)', type: 'json', placeholder: '[{"type":"gold","payload":{"amount":100}},{"type":"opera","payload":{"artwork_id":"..."}}]' },
  ]

  const prizeFields: Field[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'rarity', label: 'Rarità', type: 'rarity', half: true },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
    { key: 'redemption_note', label: 'Istruzioni di riscatto', type: 'textarea' },
  ]

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">🎴 Tesori</h1>
      <p className="text-white/40 text-sm mb-4">Bustine, forzieri e premi speciali.</p>

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === t ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/50'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Bustine' && <CatalogManager table="packs" title="Bustine" fields={packFields} hasArt
        artPrompt={r => `A sealed collectible card pack, ${r.rarity ?? 'common'} tier, foil accents, Roman motifs. ${r.name}: ${r.description}`} />}
      {tab === 'Contenuti bustine' && <CatalogManager table="pack_pool" title="Contenuti (loot pool)" fields={poolFields} />}
      {tab === 'Forzieri' && <CatalogManager table="chests" title="Forzieri" fields={chestFields} hasArt
        artPrompt={r => `An ornate ancient treasure chest, ${r.rarity ?? 'rare'} tier, bronze and marble Roman styling, closed with a heavy lock. ${r.name}: ${r.description}`} />}
      {tab === 'Premi' && <CatalogManager table="special_prizes" title="Premi speciali" fields={prizeFields} hasArt
        artPrompt={r => `A premium reward voucher representing a real-world prize, elegant and celebratory. ${r.name}: ${r.description}`} />}
    </div>
  )
}
