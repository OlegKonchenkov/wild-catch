'use client'
/**
 * THROWAWAY demo route (not under /game, so no auth/session/GameShell gate).
 * Shows the immersive battle UI with the 2 style-test assets — Muschio (bosco)
 * vs Miniera (terra) — at real device proportions, with the real framer-motion
 * animation system, so the proportions + animation can be judged for real.
 * Delete once the look is approved and the real screens are wired.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnimationControls, motion } from 'framer-motion'
import BattleScene, { type BattleAnimState } from '@/components/battle/BattleScene'
import BattleTopBar from '@/components/battle/BattleTopBar'
import CombatantCard from '@/components/battle/CombatantCard'
import SquadBar, { type SquadMember } from '@/components/battle/SquadBar'
import ActionBar, { type BattleAction } from '@/components/battle/ActionBar'
import TurnTimer from '@/components/battle/TurnTimer'
import DamageBurst, { type BurstKind } from '@/components/battle/DamageBurst'
import { IconCapture, IconSwords, IconFlask, IconFlee } from '@/components/battle/icons'

const MUSCHIO = '/creatures-test/muschio.webp'
const MINIERA = '/creatures-test/miniera.webp'

const ENEMY_MAX = 30
const PLAYER_MAX = 324
const rand = (n: number) => Math.floor(Math.random() * n)

interface Burst { id: number; amount: number; kind: BurstKind; target: 'enemy' | 'player'; label?: string }

export default function BattleDemoPage() {
  const [enemyHp, setEnemyHp] = useState(ENEMY_MAX)
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX)
  const [enemyAnim, setEnemyAnim] = useState<BattleAnimState>('idle')
  const [playerAnim, setPlayerAnim] = useState<BattleAnimState>('idle')
  const [enemyFaint, setEnemyFaint] = useState(false)
  const [freeze, setFreeze] = useState(false)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [activeSquad, setActiveSquad] = useState('miniera')
  const [seconds, setSeconds] = useState(15)
  const [auto, setAuto] = useState(true)

  const burstId = useRef(0)
  const shake = useAnimationControls()
  const autoRef = useRef(auto)
  autoRef.current = auto

  const addBurst = useCallback((b: Omit<Burst, 'id'>) => {
    const id = ++burstId.current
    setBursts((prev) => [...prev, { ...b, id }])
  }, [])

  const doAttack = useCallback((attacker: 'player' | 'enemy', forceCrit = false) => {
    const target = attacker === 'player' ? 'enemy' : 'player'
    const setAttackerAnim = attacker === 'player' ? setPlayerAnim : setEnemyAnim
    const setTargetAnim = target === 'player' ? setPlayerAnim : setEnemyAnim
    setAttackerAnim('attack')

    window.setTimeout(() => {
      const crit = forceCrit || Math.random() < 0.22
      const dmg = target === 'enemy'
        ? (crit ? 16 + rand(3) : 5 + rand(4))
        : (crit ? 80 + rand(13) : 34 + rand(17))

      setTargetAnim('damage')
      addBurst({ amount: dmg, kind: crit ? 'crit' : 'damage', target, label: crit ? 'Colpo critico! ×1.75' : undefined })

      if (crit) {
        setFreeze(true)
        shake.start({ x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.16 } })
        window.setTimeout(() => setFreeze(false), 180)
      }

      const apply = target === 'enemy' ? setEnemyHp : setPlayerHp
      const max = target === 'enemy' ? ENEMY_MAX : PLAYER_MAX
      apply((prev) => {
        const nv = Math.max(0, prev - dmg)
        if (nv === 0) {
          if (target === 'enemy') setEnemyFaint(true)
          window.setTimeout(() => {
            if (target === 'enemy') setEnemyFaint(false)
            apply(max)
          }, 1100)
        }
        return nv
      })

      window.setTimeout(() => setTargetAnim('idle'), 380)
    }, 230)

    window.setTimeout(() => setAttackerAnim('idle'), 560)
  }, [addBurst, shake])

  const doCatch = useCallback(() => {
    setEnemyAnim('catch')
    addBurst({ amount: 0, kind: 'heal', target: 'enemy', label: 'Cattura!' })
    window.setTimeout(() => { setEnemyAnim('idle'); setEnemyHp(ENEMY_MAX) }, 1000)
  }, [addBurst])

  const reset = useCallback(() => {
    setEnemyHp(ENEMY_MAX); setPlayerHp(PLAYER_MAX); setEnemyFaint(false)
    setEnemyAnim('idle'); setPlayerAnim('idle'); setFreeze(false)
  }, [])

  // Entrance choreography → first auto-attack after the creatures land + VS strikes.
  useEffect(() => {
    let i = 0
    const start = window.setTimeout(function tick() {
      if (autoRef.current) doAttack(i % 3 === 2 ? 'enemy' : 'player', i % 4 === 3)
      i++
      timer = window.setTimeout(tick, 2600)
    }, 1400)
    let timer = start
    return () => { window.clearTimeout(start); window.clearTimeout(timer) }
  }, [doAttack])

  // Turn timer cosmetic countdown.
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => (s <= 1 ? 15 : s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [])

  const squad: SquadMember[] = [
    { id: 'miniera', name: 'Miniera', element: 'terra', hp: playerHp, maxHp: PLAYER_MAX, imageUrl: MINIERA, active: activeSquad === 'miniera' },
    { id: 'spinoso', name: 'Spinoso', element: 'bosco', hp: 280, maxHp: 280, active: activeSquad === 'spinoso' },
    { id: 'petroso', name: 'Petroso', element: 'terra', hp: 310, maxHp: 310, active: activeSquad === 'petroso' },
  ]

  const actions: BattleAction[] = [
    { id: 'cattura', label: 'CATTURA', icon: <IconCapture size={21} />, primary: true, tone: 'orange', onClick: doCatch },
    { id: 'lotta', label: 'Lotta', icon: <IconSwords size={20} />, tone: 'purple', onClick: () => doAttack('player') },
    { id: 'oggetti', label: 'Oggetti', icon: <IconFlask size={19} />, tone: 'dark' },
    { id: 'fuggi', label: 'Fuggi', icon: <IconFlee size={19} />, tone: 'dark', onClick: reset },
  ]

  return (
    <main style={{ minHeight: '100dvh', background: 'radial-gradient(1000px 600px at 50% -10%,#11151b,transparent 70%),#05060a', color: '#ECEFF1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 10px 28px', fontFamily: 'var(--font-dm-sans), system-ui, sans-serif' }}>
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
        <h1 style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>Wild Catch — Battle UI immersiva (anteprima)</h1>
        <p style={{ color: '#9aa4ae', fontSize: 12, marginTop: 4 }}>Arte reale · animazioni reali. Le creature combattono da sole; usa i pulsanti per provare attacco/critico.</p>
      </div>

      {/* device-proportioned battle stage */}
      <motion.div
        animate={shake}
        style={{
          position: 'relative', width: 'min(100vw, 430px)', height: 'min(100dvh, 930px)',
          borderRadius: 30, overflow: 'hidden', background: '#04060a',
          boxShadow: '0 40px 100px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.05)',
        }}
      >
        <div style={{ ['--font-mono' as string]: 'var(--font-geist-mono)' } as React.CSSProperties}>
          <BattleScene
            enemy={{ element: 'bosco', spriteUrl: MUSCHIO, name: 'Muschio', rarity: 'comune', animState: enemyAnim, fainting: enemyFaint, hpPct: enemyHp / ENEMY_MAX }}
            player={{ element: 'terra', spriteUrl: MINIERA, name: 'Miniera', rarity: 'leggendario', animState: playerAnim, hpPct: playerHp / PLAYER_MAX }}
            freeze={freeze}
            vsStruck
            seamPct={44}
          >
            <BattleTopBar level={12} xpPct={0.64} gold={2448} sessionLabel="43h 48m" notifications={1} />
            <CombatantCard side="enemy" name="Muschio" element="bosco" rarity="comune" currentHp={enemyHp} maxHp={ENEMY_MAX} stars={1} style={{ top: 70, left: 12 }} />
            <CombatantCard side="player" name="Miniera" element="terra" rarity="leggendario" currentHp={playerHp} maxHp={PLAYER_MAX} atk={102} style={{ top: '52.5%', right: 10 }} />
            {bursts.map((b) => (
              <DamageBurst key={b.id} amount={b.amount} kind={b.kind} target={b.target} label={b.label} onComplete={() => setBursts((prev) => prev.filter((x) => x.id !== b.id))} />
            ))}
            <SquadBar members={squad} onSwitch={setActiveSquad} />
            <TurnTimer seconds={seconds} total={15} />
            <ActionBar actions={actions} />
          </BattleScene>
        </div>
      </motion.div>

      {/* dev controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { l: auto ? '⏸ Auto' : '▶ Auto', f: () => setAuto((a) => !a) },
          { l: '⚔ Attacca', f: () => doAttack('player') },
          { l: '✦ Critico', f: () => doAttack('player', true) },
          { l: '🔍 Cattura', f: doCatch },
          { l: '↺ Reset', f: reset },
        ].map((b) => (
          <button key={b.l} onClick={b.f} style={{ fontSize: 12, color: '#ECEFF1', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}>{b.l}</button>
        ))}
      </div>
    </main>
  )
}
