'use client'
import { useEffect, useState } from 'react'
import {
  isMusicMuted, isSfxMuted, isHapticsOff,
  setMusicMuted, setSfxMuted, setHapticsOff,
  onPrefsChange,
} from '@/lib/audioPrefs'
import PushOptIn from '@/components/game/PushOptIn'

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{
        position: 'relative',
        width: 44,
        height: 26,
        flexShrink: 0,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        background: on ? '#3ABCA8' : 'rgba(255,255,255,0.15)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  )
}

function Row({
  icon, title, desc, on, onToggle,
}: { icon: string; title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{desc}</div>
      </div>
      <Switch on={on} onToggle={onToggle} label={title} />
    </div>
  )
}

export default function PlayerPreferences() {
  const [music, setMusic] = useState(true)
  const [sfx, setSfx] = useState(true)
  const [haptics, setHaptics] = useState(true)
  const [hapticsSupported, setHapticsSupported] = useState(false)

  useEffect(() => {
    const sync = () => {
      setMusic(!isMusicMuted())
      setSfx(!isSfxMuted())
      setHaptics(!isHapticsOff())
    }
    sync()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only capability check
    setHapticsSupported(typeof navigator !== 'undefined' && !!navigator.vibrate)
    return onPrefsChange(sync)
  }, [])

  return (
    <div>
      <Row
        icon="🎵" title="Musica" desc="Colonna sonora e atmosfere di gioco"
        on={music} onToggle={() => setMusicMuted(music)}
      />
      <Row
        icon="🔊" title="Effetti sonori" desc="Attacchi, livelli, vittorie e altri suoni"
        on={sfx} onToggle={() => setSfxMuted(sfx)}
      />
      {hapticsSupported && (
        <Row
          icon="📳" title="Vibrazione" desc="Feedback aptico su eventi di gioco"
          on={haptics} onToggle={() => setHapticsOff(haptics)}
        />
      )}
      <div style={{ padding: '14px 6px 16px' }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
          padding: '0 12px 2px',
        }}>
          NOTIFICHE PUSH
        </div>
        <PushOptIn />
      </div>
    </div>
  )
}
