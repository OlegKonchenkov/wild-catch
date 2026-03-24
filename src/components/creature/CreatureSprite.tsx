'use client'
import { motion } from 'framer-motion'
import Image from 'next/image'

type AnimState = 'idle' | 'attack' | 'damage' | 'catch' | 'flee' | 'victory'

interface Props {
  imageUrl: string
  name: string
  animState?: AnimState
  size?: number
}

const ANIM_VARIANTS: Record<AnimState, object> = {
  idle: {
    y: [0, -8, 0],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  attack: {
    x: [-20, 20, 0],
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  damage: {
    x: [0, -8, 8, -8, 0],
    filter: ['brightness(1)', 'brightness(3)', 'brightness(1)'],
    transition: { duration: 0.35 },
  },
  catch: {
    scale: [1, 0.8, 0.2],
    opacity: [1, 0.8, 0],
    transition: { duration: 0.6, ease: 'easeIn' },
  },
  flee: {
    x: [0, 300],
    opacity: [1, 0],
    transition: { duration: 0.5, ease: 'easeIn' },
  },
  victory: {
    scale: [1, 1.2, 1],
    rotate: [0, 10, -10, 0],
    transition: { duration: 0.6 },
  },
}

export default function CreatureSprite({ imageUrl, name, animState = 'idle', size = 200 }: Props) {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      animate={ANIM_VARIANTS[animState]}
      key={animState}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={size}
          height={size}
          className="object-contain drop-shadow-2xl"
          priority
        />
      ) : (
        <div
          className="rounded-full bg-white/10 flex items-center justify-center text-5xl"
          style={{ width: size, height: size }}
        >
          🐾
        </div>
      )}
    </motion.div>
  )
}
