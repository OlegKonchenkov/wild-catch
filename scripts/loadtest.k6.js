// Load test for wild-catch — simulate ~100 concurrent players on the read-heavy
// authenticated endpoints, to validate the NANO Supabase instance holds up
// before the first events.
//
// ── How to run ────────────────────────────────────────────────────────────────
// 1) Install k6:  https://grafana.com/docs/k6/latest/set-up/install-k6/
//      Windows:   winget install k6  (or  choco install k6)
// 2) Log into the app in your browser (https://wild-catch.vercel.app), open
//    DevTools → Network → click any /api/* request → Request Headers → copy the
//    full value of the `Cookie` header (it carries the Supabase auth session).
// 3) Grab the current SESSION_ID (localStorage `current_session_id`, or admin).
// 4) Run:
//      k6 run -e SESSION_ID=<uuid> -e COOKIE="<cookie header value>" scripts/loadtest.k6.js
//    Optional: -e BASE_URL=... -e THINK=3 -e TARGET=100
//
// ── While it runs ─────────────────────────────────────────────────────────────
//  • Watch Supabase → Database → metrics (CPU / Disk IO) AND the Disk IO budget.
//  • Pass criteria: error rate ~0% and p95 < 1s at 100 VUs, IO budget not draining.
//  • Run it when NO real players are active (it hits production / the NANO DB).
//
// ── Caveats ───────────────────────────────────────────────────────────────────
//  • All virtual users share ONE auth cookie (one player). The DB still does the
//    full per-request query work, so this is a fair first-order capacity test,
//    but slightly optimistic on cache locality vs 100 distinct users. For more
//    realism, pass several cookies (see COOKIES below) — the script rotates them.
//  • Supabase access tokens expire (~1h). If you start seeing 401s, refresh the
//    cookie and re-run.

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.BASE_URL || 'https://wild-catch.vercel.app'
const SESSION_ID = __ENV.SESSION_ID || ''
// One cookie, or several separated by ';;' to simulate distinct users.
const COOKIES = (__ENV.COOKIES || __ENV.COOKIE || '').split(';;').filter(Boolean)
const THINK = Number(__ENV.THINK || 3) // seconds of "think time" between a player's requests
const TARGET = Number(__ENV.TARGET || 100)

export const options = {
  stages: [
    { duration: '30s', target: Math.ceil(TARGET * 0.2) }, // warm up
    { duration: '1m', target: TARGET }, // ramp to ~100 players
    { duration: '2m', target: TARGET }, // hold
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% errors
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
  },
}

export function setup() {
  if (!SESSION_ID || COOKIES.length === 0) {
    throw new Error('Missing config. Pass -e SESSION_ID=<uuid> -e COOKIE="<cookie header>". See header comment.')
  }
  return {}
}

export default function () {
  const cookie = COOKIES[__VU % COOKIES.length]
  const headers = { Cookie: cookie, Accept: 'application/json' }

  // Heaviest realistic read: map pins (several DB queries per call, incl. claims
  // + enigma lookups) — the best stress signal for the DB.
  const pins = http.get(`${BASE}/api/game/map-pins?sessionId=${SESSION_ID}`, { headers, tags: { name: 'map-pins' } })
  check(pins, { 'map-pins 200': (r) => r.status === 200 })

  // Light read: profile.
  const profile = http.get(`${BASE}/api/profile`, { headers, tags: { name: 'profile' } })
  check(profile, { 'profile 200': (r) => r.status === 200 })

  // Player "think time" — real players don't hammer; this keeps the aggregate
  // request rate realistic (~TARGET / THINK rps). Lower THINK to stress harder.
  sleep(THINK + Math.random() * 2)
}
