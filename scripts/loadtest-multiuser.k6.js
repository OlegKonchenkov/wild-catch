// k6 multi-user load test. Each VU uses a DIFFERENT seeded user (round-robin
// from scripts/.loadtest-users.json) — eliminates the synthetic row-hotspot
// the single-cookie test created. This reflects a real event where 100 players
// each have their own profile / player_session / etc.
//
// Seed first:
//   node --env-file=.env.local scripts/.loadtest-seed.mjs --count 100
//
// Run (TARGET <= number of seeded users for a true 1:1 mapping):
//   k6 run -e TARGET=100 scripts/loadtest-multiuser.k6.js
//
// Cleanup after:
//   node --env-file=.env.local scripts/.loadtest-cleanup.mjs

import http from 'k6/http'
import { check, sleep, group } from 'k6'

const BUNDLE = JSON.parse(open('./.loadtest-users.json'))
const USERS    = BUNDLE.users
const SESSION  = BUNDLE.sessionId

const BASE     = __ENV.BASE_URL || 'https://wild-catch.vercel.app'
const TARGET   = Number(__ENV.TARGET || Math.min(100, USERS.length))

if (USERS.length === 0) {
  throw new Error('No users in .loadtest-users.json — run the seed script first.')
}
if (TARGET > USERS.length) {
  console.warn(`TARGET (${TARGET}) > seeded users (${USERS.length}) — VUs will share cookies.`)
}

export const options = {
  stages: [
    { duration: '30s', target: Math.max(1, Math.ceil(TARGET * 0.33)) },
    { duration: '1m',  target: TARGET },
    { duration: '3m',  target: TARGET },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed:    ['rate<0.02'],
    http_req_duration:  ['p(95)<1500'],
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

function picker() {
  // 1-based __VU. Map onto the user pool round-robin. With TARGET <= USERS the
  // mapping is 1:1 and each VU sticks with its own user for the whole run.
  return USERS[(__VU - 1) % USERS.length]
}

function H(cookie) {
  return {
    Cookie: cookie,
    'User-Agent': 'k6-loadtest',
    Accept: 'application/json',
  }
}

function gget(name, url, headers) {
  const r = http.get(url, { headers, tags: { name } })
  check(r, { [`${name} 2xx`]: x => x.status >= 200 && x.status < 300 })
  return r
}

export default function () {
  const user = picker()
  const headers = H(user.cookie)

  // 1) Open the app — dashboard fetch wave
  group('open', () => {
    gget('profile-account', `${BASE}/api/profile`, headers)
    gget('profile-game',    `${BASE}/api/game/profile?sessionId=${SESSION}`, headers)
    gget('squad',           `${BASE}/api/game/squad?sessionId=${SESSION}`, headers)
    gget('starters',        `${BASE}/api/game/starters?sessionId=${SESSION}`, headers)
  })
  sleep(Math.random() * 1.5 + 0.5)

  // 2) Land on the map — pin list + eggs
  group('map', () => {
    gget('map-pins', `${BASE}/api/game/map-pins?sessionId=${SESSION}`, headers)
    gget('eggs',     `${BASE}/api/game/eggs?sessionId=${SESSION}`, headers)
  })
  sleep(Math.random() * 1.5 + 0.5)

  // 3) Peek at leaderboard
  gget('leaderboard', `${BASE}/api/game/leaderboard?sessionId=${SESSION}`, headers)
  sleep(Math.random() * 1.5 + 0.5)

  // 4) Map poll (player wandering)
  gget('map-pins-poll', `${BASE}/api/game/map-pins?sessionId=${SESSION}`, headers)
  sleep(Math.random() * 2 + 1)
}
