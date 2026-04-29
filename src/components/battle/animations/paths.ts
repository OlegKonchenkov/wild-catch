// Path helpers used by element animations to give each element
// a distinctive trajectory shape — without changing timings or coords contract.

interface Coords { ox: string; oy: string; ix: string; iy: string }

const p = (s: string) => parseFloat(s)
const f = (n: number) => `${n}%`

export interface MotionPath {
  left: string[]
  top: string[]
  times: number[]
}

/** Upward arc — for fire updraft. */
export function arcUp(c: Coords, height = 14): MotionPath {
  const mx = (p(c.ox) + p(c.ix)) / 2
  const my = (p(c.oy) + p(c.iy)) / 2 - height
  return { left: [c.ox, f(mx), c.ix], top: [c.oy, f(my), c.iy], times: [0, 0.55, 1] }
}

/** Ballistic toss — high apex, gravity-feeling drop. */
export function ballistic(c: Coords, height = 18): MotionPath {
  const mx = (p(c.ox) + p(c.ix)) / 2
  const my = Math.min(p(c.oy), p(c.iy)) - height
  return { left: [c.ox, f(mx), c.ix], top: [c.oy, f(my), c.iy], times: [0, 0.45, 1] }
}

/** Sinusoidal wave — for water. */
export function wave(c: Coords, amp = 7): MotionPath {
  const dx = p(c.ix) - p(c.ox)
  const dy = p(c.iy) - p(c.oy)
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len * amp
  const ny =  dx / len * amp
  const at = (t: number) => ({ x: p(c.ox) + dx * t, y: p(c.oy) + dy * t })
  const a = at(0.25), b = at(0.5), d = at(0.75)
  return {
    left: [c.ox, f(a.x + nx), f(b.x), f(d.x - nx), c.ix],
    top:  [c.oy, f(a.y + ny), f(b.y), f(d.y - ny), c.iy],
    times: [0, 0.25, 0.5, 0.75, 1],
  }
}

/** Mild organic curve — for forest leaves. */
export function curve(c: Coords, height = 8, sideways = 4): MotionPath {
  const mx = (p(c.ox) + p(c.ix)) / 2 + sideways
  const my = (p(c.oy) + p(c.iy)) / 2 - height
  return { left: [c.ox, f(mx), c.ix], top: [c.oy, f(my), c.iy], times: [0, 0.5, 1] }
}

/** Tight spiral — for cosmic/armonia (small-amplitude S curve). */
export function spiral(c: Coords, amp = 5): MotionPath {
  const dx = p(c.ix) - p(c.ox)
  const dy = p(c.iy) - p(c.oy)
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len * amp
  const ny =  dx / len * amp
  const at = (t: number) => ({ x: p(c.ox) + dx * t, y: p(c.oy) + dy * t })
  const a = at(0.2), b = at(0.4), d = at(0.6), e = at(0.8)
  return {
    left: [c.ox, f(a.x + nx), f(b.x - nx * 0.5), f(d.x + nx * 0.5), f(e.x - nx), c.ix],
    top:  [c.oy, f(a.y + ny), f(b.y - ny * 0.5), f(d.y + ny * 0.5), f(e.y - ny), c.iy],
    times: [0, 0.2, 0.4, 0.6, 0.8, 1],
  }
}

/** Linear (fallback). */
export function straight(c: Coords): MotionPath {
  return { left: [c.ox, c.ix], top: [c.oy, c.iy], times: [0, 1] }
}
