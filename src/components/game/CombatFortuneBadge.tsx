import { GiRollingDices } from 'react-icons/gi'

interface CombatFortuneBadgeProps {
  text: string
  tone: 'lucky' | 'rough' | 'steady'
}

const FORTUNE_THEME = {
  lucky: {
    background: 'rgba(52,211,153,0.14)',
    border: '1px solid rgba(52,211,153,0.34)',
    color: '#6EE7B7',
  },
  rough: {
    background: 'rgba(251,191,36,0.14)',
    border: '1px solid rgba(251,191,36,0.34)',
    color: '#FCD34D',
  },
  steady: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.72)',
  },
} as const

export default function CombatFortuneBadge({ text, tone }: CombatFortuneBadgeProps) {
  const theme = FORTUNE_THEME[tone]

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
      style={theme}
    >
      <GiRollingDices size={13} color={theme.color} aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}
