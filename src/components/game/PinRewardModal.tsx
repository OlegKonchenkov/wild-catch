'use client'
import { useEffect, useState } from 'react'
import CreatureDiorama from '@/components/creature/CreatureDiorama'
import ElementIcon from '@/components/ui/ElementIcon'
import { GiTwoCoins, GiRoundStar, GiEggClutch } from 'react-icons/gi'
import { playMissionComplete } from '@/lib/game/sounds/events'

const RARITY_COLOR: Record<string, string> = {
  comune:      '#7AB87A',
  non_comune:  '#4A9FD4',
  raro:        '#E8A820',
  epico:       '#7B4DB8',
  leggendario: '#C8352A',
  mitologico:  '#FF4D6D',
}

const RARITY_LABEL: Record<string, string> = {
  comune:      'Terrestre',
  non_comune:  'Arcaico',
  raro:        'Eroico',
  epico:       'Mostruoso',
  leggendario: 'Leggendario',
  mitologico:  'Mitologico',
}

const ELEMENT_GLOW: Record<string, string> = {
  fiamma:    '#FF6B35',
  adriatico: '#3A9DBC',
  bosco:     '#34D399',
  terra:     '#A78BFA',
  armonia:   '#F9A8D4',
}

const REWARD_TYPE_LABEL: Record<string, string> = {
  oggetto: '🎁 Oggetto trovato!',
  uovo:    '🥚 Uovo trovato!',
  creatura:'🐾 Creatura trovata!',
  indizio: '🧩 Frammento enigma!',
  boss:    '⚔️ Boss apparso!',
  evento:  '🎉 Evento!',
  enigma:  '🔐 Enigma risolto!',
}

export interface PinRewardData {
  type: string
  pinName: string
  itemName?: string
  quantity?: number
  eggRarity?: string
  stepsRequired?: number
  rewardType?: string   // nested reward type for enigma pins
  amount?: number       // exp/gold amount for enigma reward
  creature?: { name: string; rarity: string; element: string; image_url: string | null; hp?: number; atk?: number; def?: number }
  chapterOrder?: number
  text?: string
  imageUrl?: string
  bossFightId?: string
  bossName?: string
  eventType?: string
  effect?: string
}

export default function PinRewardModal({ reward, onDone }: { reward: PinRewardData; onDone: () => void }) {
  const [visible, setVisible] = useState(false)
  const { type, pinName } = reward

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    // Enigma already plays playEnigmaSolve() before this modal mounts — skip here
    if (type !== 'enigma') playMissionComplete()
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rarityColor = RARITY_COLOR[reward.creature?.rarity ?? ''] ?? '#F7C841'
  const glow = ELEMENT_GLOW[reward.creature?.element ?? ''] ?? rarityColor

  function handleDone() {
    if (type === 'boss' && reward.bossFightId) {
      window.location.href = `/game/boss/${reward.bossFightId}`
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col items-end justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleDone} />

      <div
        className="relative w-full rounded-t-3xl overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, #080E1A 0%, #0F1F2E 100%)',
          border: '1px solid rgba(247,200,65,0.25)',
          borderBottom: 'none',
          maxHeight: '78vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div className="flex justify-center pt-3 mb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-start gap-3 bg-[#F7C841]/10 border border-[#F7C841]/25 rounded-2xl p-3">
            <span className="text-2xl leading-none mt-0.5">📍</span>
            <div>
              <p className="text-xs font-bold text-[#F7C841] uppercase tracking-wide">Luogo raggiunto</p>
              <p className="text-base font-extrabold text-white mt-0.5">{pinName}</p>
              <p className="text-xs text-white/40 mt-0.5">Sei arrivato in questo punto di interesse!</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-extrabold text-white">{REWARD_TYPE_LABEL[type] ?? 'Ricompensa!'}</p>
          </div>

          {type === 'oggetto' && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-4xl mb-2">🎁</p>
              <p className="text-white font-bold text-lg">{reward.itemName}</p>
              <p className="text-white/50 text-sm">×{reward.quantity}</p>
            </div>
          )}

          {type === 'uovo' && (() => {
            const eggColor = RARITY_COLOR[reward.eggRarity ?? ''] ?? '#7AB87A'
            return (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="flex justify-center mb-2">
                  <GiEggClutch size={44} color={eggColor} style={{ filter: `drop-shadow(0 0 10px ${eggColor}88)` }} />
                </div>
                <p className="font-bold" style={{ color: eggColor }}>{RARITY_LABEL[reward.eggRarity ?? ''] ?? reward.eggRarity}</p>
                {(reward.stepsRequired ?? 0) > 0 && (
                  <p className="text-white/50 text-sm mt-1">Si schiuderà dopo {reward.stepsRequired} passi</p>
                )}
              </div>
            )
          })()}

          {type === 'creatura' && reward.creature && (() => {
            const c = reward.creature!
            return (
              <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${rarityColor}40`, background: `linear-gradient(135deg, ${glow}12 0%, transparent 100%)` }}>
                <div className="flex flex-col items-center py-5 px-4">
                  <CreatureDiorama creature={c} size={140} anchor="center" rounded={18} className="w-full" style={{ aspectRatio: '5 / 4', maxWidth: 280 }} />
                  <p className="text-white font-bold text-xl mt-3">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <ElementIcon element={c.element} size={14} />
                    <span className="text-xs capitalize text-white/40">{c.element}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${rarityColor}22`, color: rarityColor }}>{RARITY_LABEL[c.rarity] ?? c.rarity}</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {type === 'indizio' && (
            <div className="bg-[#1A0D2E] border border-[#7B4DB8]/30 rounded-2xl p-4 space-y-3">
              {reward.chapterOrder != null && (
                <p className="text-xs font-bold text-[#C084FC] uppercase tracking-wide">Capitolo {reward.chapterOrder}</p>
              )}
              {reward.text && (
                <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{reward.text}</p>
              )}
              {reward.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reward.imageUrl} alt="Indizio"
                  className="w-full rounded-xl object-cover max-h-40 cursor-zoom-in"
                  onClick={() => window.dispatchEvent(new CustomEvent('wc:zoom-image', { detail: reward.imageUrl }))}
                />
              )}
            </div>
          )}

          {type === 'boss' && (
            <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 text-center">
              <p className="text-4xl mb-2">⚔️</p>
              <p className="text-white font-bold text-lg">{reward.bossName}</p>
              <p className="text-red-300/70 text-sm mt-1">Il boss ti sfida in battaglia!</p>
            </div>
          )}

          {type === 'evento' && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-white/70 text-sm">{reward.effect}</p>
            </div>
          )}

          {type === 'enigma' && (() => {
            const rType = reward.rewardType
            const c     = reward.creature
            const enigmaRarityColor = RARITY_COLOR[c?.rarity ?? ''] ?? '#A78BFA'
            const enigmaGlow        = ELEMENT_GLOW[c?.element ?? ''] ?? enigmaRarityColor
            return (
              <>
                <div className="flex items-center justify-center gap-2 bg-violet-500/10 border border-violet-400/25 rounded-xl px-3 py-2">
                  <span className="text-lg">🔐</span>
                  <p className="text-sm font-bold text-violet-300">Enigma risolto! Ecco la tua ricompensa:</p>
                </div>

                {rType === 'creatura' && c && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${enigmaRarityColor}40`, background: `linear-gradient(135deg, ${enigmaGlow}12 0%, transparent 100%)` }}>
                    <div className="flex flex-col items-center py-5 px-4">
                      <CreatureDiorama creature={c} size={140} anchor="center" rounded={18} className="w-full" style={{ aspectRatio: '5 / 4', maxWidth: 280 }} />
                      <p className="text-white font-bold text-xl mt-3">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <ElementIcon element={c.element} size={14} />
                        <span className="text-xs capitalize text-white/40">{c.element}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${enigmaRarityColor}22`, color: enigmaRarityColor }}>{RARITY_LABEL[c.rarity] ?? c.rarity}</span>
                      </div>
                    </div>
                  </div>
                )}

                {rType === 'oggetto' && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <p className="text-4xl mb-2">🎁</p>
                    <p className="text-white font-bold text-lg">{reward.itemName}</p>
                    <p className="text-white/50 text-sm">×{reward.quantity ?? 1}</p>
                  </div>
                )}

                {(rType === 'exp' || rType === 'gold') && reward.amount != null && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <div className="flex justify-center mb-2">
                      {rType === 'exp'
                        ? <GiRoundStar size={38} color="#34D399" style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,0.5))' }} />
                        : <GiTwoCoins size={38} color="#F7C841" style={{ filter: 'drop-shadow(0 0 10px rgba(247,200,65,0.5))' }} />}
                    </div>
                    <p className="text-white font-bold text-2xl">+{reward.amount}</p>
                    <p className="text-white/50 text-sm mt-1">{rType === 'exp' ? 'Punti esperienza' : 'Monete'}</p>
                  </div>
                )}
              </>
            )
          })()}

          <button
            onClick={handleDone}
            className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
            style={{ background: 'linear-gradient(135deg, #F7C841 0%, #E5A800 100%)', color: '#080E1A' }}
          >
            {type === 'boss' ? '⚔️ Affronta il boss!' : 'Continua'}
          </button>
        </div>
      </div>
    </div>
  )
}
