'use client'
import { useState, useEffect } from 'react'
import CatalogManager, { type Field } from '@/components/admin/CatalogManager'

const TABS = ['Luoghi', 'Opere', 'Personaggi', 'Aneddoti', 'Quiz', 'Trofei'] as const
type Tab = typeof TABS[number]

export default function CollezioneAdminPage() {
  const [tab, setTab] = useState<Tab>('Luoghi')
  const [places, setPlaces] = useState<Array<{ value: string; label: string }>>([])
  const [characters, setCharacters] = useState<Array<{ value: string; label: string }>>([])
  const [abilities, setAbilities] = useState<Array<{ value: string; label: string }>>([])
  const [anecdotes, setAnecdotes] = useState<Array<{ value: string; label: string }>>([])

  useEffect(() => {
    fetch('/api/admin/catalog/cultural_places').then(r => r.json()).then(d => setPlaces((d.rows ?? []).map((p: any) => ({ value: p.id, label: p.name }))))
    fetch('/api/admin/catalog/characters').then(r => r.json()).then(d => setCharacters((d.rows ?? []).map((p: any) => ({ value: p.id, label: p.name }))))
    fetch('/api/admin/abilities').then(r => r.json()).then(d => setAbilities((d.abilities ?? d.rows ?? []).map((a: any) => ({ value: a.id, label: a.name }))))
    fetch('/api/admin/catalog/anecdotes').then(r => r.json()).then(d => setAnecdotes((d.rows ?? []).map((a: any) => ({ value: a.id, label: a.title }))))
  }, [])

  const placeFields: Field[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
    { key: 'lat', label: 'Lat', type: 'number', half: true },
    { key: 'lng', label: 'Lng', type: 'number', half: true },
  ]
  const artworkFields: Field[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'rarity', label: 'Rarità', type: 'rarity', half: true },
    { key: 'place_id', label: 'Luogo', type: 'select', options: places, half: true },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
  ]
  const characterFields: Field[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'rarity', label: 'Rarità', type: 'rarity', half: true },
    { key: 'place_id', label: 'Luogo', type: 'select', options: places, half: true },
    { key: 'unlocks_ability_id', label: 'Sblocca abilità', type: 'select', options: abilities },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
  ]
  const anecdoteFields: Field[] = [
    { key: 'title', label: 'Titolo', type: 'text' },
    { key: 'rarity', label: 'Rarità', type: 'rarity', half: true },
    { key: 'place_id', label: 'Luogo', type: 'select', options: places, half: true },
    { key: 'character_id', label: 'Personaggio', type: 'select', options: characters },
    { key: 'body', label: 'Storia', type: 'textarea' },
  ]
  const quizFields: Field[] = [
    { key: 'question', label: 'Domanda', type: 'textarea' },
    { key: 'options', label: 'Opzioni (JSON array di stringhe)', type: 'json', placeholder: '["Roma","Atene","Cartagine","Alessandria"]' },
    { key: 'correct_index', label: 'Indice risposta corretta (0-based)', type: 'number', half: true },
    { key: 'place_id', label: 'Luogo', type: 'select', options: places, half: true },
    { key: 'unlock_anecdote_id', label: "Sbloccato dall'aneddoto (opzionale)", type: 'select', options: anecdotes },
    { key: 'reward', label: 'Ricompensa (JSON, vuoto = 5 gemme)', type: 'json', placeholder: '[{"type":"gemme","payload":{"amount":10}}]' },
  ]
  const trophyFields: Field[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
    { key: 'criteria', label: 'Criterio (JSON)', type: 'json', placeholder: '{"kind":"personaggio","complete_all":true} oppure {"place_id":"<id luogo>"}' },
  ]

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">🏛️ Collezione culturale</h1>
      <p className="text-white/40 text-sm mb-4">Luoghi, opere, personaggi, aneddoti e trofei.</p>

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === t ? 'bg-[#3A9DBC] text-white' : 'bg-white/5 text-white/50'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Luoghi' && <CatalogManager table="cultural_places" title="Luoghi culturali" fields={placeFields} hasArt
        artPrompt={r => `An evocative wide illustration of an Italian archaeological/cultural site. ${r.name}: ${r.description}`} />}
      {tab === 'Opere' && <CatalogManager table="artworks" title="Opere d'arte" fields={artworkFields} hasArt
        artPrompt={r => `A museum artwork / ancient Roman artefact as a collectible card. ${r.name}: ${r.description}`} />}
      {tab === 'Personaggi' && <CatalogManager table="characters" title="Personaggi" fields={characterFields} hasArt
        artPrompt={r => `A dignified portrait of a historical Roman/classical figure as a collectible character card. ${r.name}: ${r.description}`} />}
      {tab === 'Aneddoti' && <CatalogManager table="anecdotes" title="Aneddoti / storie" fields={anecdoteFields} />}
      {tab === 'Quiz' && <CatalogManager table="quizzes" title="Quiz culturali" fields={quizFields} />}
      {tab === 'Trofei' && <CatalogManager table="trophies" title="Trofei" fields={trophyFields} hasArt
        artPrompt={r => `A golden trophy / laurel award icon celebrating a collection milestone. ${r.name}: ${r.description}`} />}
    </div>
  )
}
