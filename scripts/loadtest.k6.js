// k6 load test — realistic ~150 concurrent-player simulation.
//
// Each VU runs a "player session loop" that mirrors what a real player does:
// initial dashboard load (profile + game profile + squad + starters), then
// map screen (pins + eggs), a leaderboard glance, and a map-pin refresh
// (the polling rhythm of a player walking around). Sleeps between hits keep
// the per-VU request rate at the ~1 req every few seconds rhythm of a real
// player, so 150 VUs produce a realistic aggregate load (~50-80 req/s).
//
// ⚠️ Honest caveats
// 1) All VUs share ONE auth cookie (= one player from the server's POV).
//    The encounter write paths (start/fight/catch) are intentionally LEFT
//    OUT of the loop because they rate-limit per user — 150 VUs sharing one
//    user.id would just produce a flood of 429s, not real distinct-player
//    write traffic. To simulate that we'd need N real session tokens.
//    Pass several cookies with `-e COOKIES="ck1;;ck2"` to round-robin.
// 2) Read endpoints don't rate-limit per user, so the loop below DOES
//    represent credible concurrent read traffic from 150 active players.
//
// How to run
//   k6 run -e SESSION_ID=<uuid> -e COOKIE="<full Cookie header value>" \
//          -e TARGET=150 scripts/loadtest.k6.js
//
// Watch Supabase → Database (CPU / IO / Disk IO budget) during the run.

import http from 'k6/http'
import { check, sleep, group } from 'k6'

const BASE = __ENV.BASE_URL || 'https://wild-catch.vercel.app'
const SESSION_ID = __ENV.SESSION_ID || ''
const COOKIES = (__ENV.COOKIES || __ENV.COOKIE || '').split(';;').filter(Boolean)
const TARGET = Number(__ENV.TARGET || 150)

export const options = {
  stages: [
    { duration: '30s', target: Math.max(1, Math.ceil(TARGET * 0.33)) }, // first wave
    { duration: '1m',  target: TARGET },                                  // everyone joins
    { duration: '3m',  target: TARGET },                                  // sustained gameplay
    { duration: '30s', target: 0 },                                       // drain
  ],
  thresholds: {
    http_req_failed:    ['rate<0.02'],
    http_req_duration:  ['p(95)<1500'],
    // Per-endpoint visibility in the summary — each shows up as its own row.
    'http_req_duration{name:profile-account}': ['p(95)<500'],
    'http_req_duration{name:profile-game}':    ['p(95)<700'],
    'http_req_duration{name:squad}':           ['p(95)<400'],
    'http_req_duration{name:starters}':        ['p(95)<500'],
    'http_req_duration{name:map-pins}':        ['p(95)<1500'],
    'http_req_duration{name:eggs}':            ['p(95)<400'],
    'http_req_duration{name:leaderboard}':     ['p(95)<600'],
    'http_req_duration{name:map-pins-poll}':   ['p(95)<1500'],
  },
}

export function setup() {
  if (!SESSION_ID || COOKIES.length === 0) {
    throw new Error('Missing config. Pass -e SESSION_ID=<uuid> -e COOKIE="<Cookie header>". See file header.')
  }
  return {}
}

export default function () {
  const cookie = COOKIES[__VU % COOKIES.length]
  const headers = { Cookie: cookie, Accept: 'application/json' }

  // 1) Initial dashboard load — fires when the player opens the app. The
  //    React tree mounts and these four come up front.
  group('open', () => {
    const r1 = http.get(`${BASE}/api/profile`, { headers, tags: { name: 'profile-account' } })
    check(r1, { 'profile-account 2xx': r => r.status >= 200 && r.status < 300 })
    const r2 = http.get(`${BASE}/api/game/profile?sessionId=${SESSION_ID}`, { headers, tags: { name: 'profile-game' } })
    check(r2, { 'profile-game 2xx': r => r.status >= 200 && r.status < 300 })
    const r3 = http.get(`${BASE}/api/game/squad?sessionId=${SESSION_ID}`, { headers, tags: { name: 'squad' } })
    check(r3, { 'squad 2xx': r => r.status >= 200 && r.status < 300 })
    const r4 = http.get(`${BASE}/api/game/starters?sessionId=${SESSION_ID}`, { headers, tags: { name: 'starters' } })
    check(r4, { 'starters 2xx': r => r.status >= 200 && r.status < 300 })
  })

  sleep(1)

  // 2) Map screen — the heaviest read (map-pins does the most DB work,
  //    eggs is light). What every player sees most of the time.
  group('map', () => {
    const r5 = http.get(`${BASE}/api/game/map-pins?sessionId=${SESSION_ID}`, { headers, tags: { name: 'map-pins' } })
    check(r5, { 'map-pins 200': r => r.status === 200 })
    const r6 = http.get(`${BASE}/api/game/eggs?sessionId=${SESSION_ID}`, { headers, tags: { name: 'eggs' } })
    check(r6, { 'eggs 2xx': r => r.status >= 200 && r.status < 300 })
  })

  sleep(2 + Math.random() * 3)

  // 3) Leaderboard glance — players check rankings periodically.
  const r7 = http.get(`${BASE}/api/game/leaderboard?sessionId=${SESSION_ID}`, { headers, tags: { name: 'leaderboard' } })
  check(r7, { 'leaderboard 2xx': r => r.status >= 200 && r.status < 300 })

  sleep(4 + Math.random() * 4)

  // 4) Player walked, map refreshes (the typical polling rhythm).
  const r8 = http.get(`${BASE}/api/game/map-pins?sessionId=${SESSION_ID}`, { headers, tags: { name: 'map-pins-poll' } })
  check(r8, { 'map-pins-poll 200': r => r.status === 200 })

  // Idle time — total iteration ~20-30s → 150 VU ≈ 5-7 iter/s ≈ 40-55 req/s
  // aggregate. Realistic "150 players just exploring" load.
  sleep(5 + Math.random() * 5)
}
