# BGM asset

Drop a single ambient loop here named **`bgm.mp3`** (or `bgm.ogg` — both
are tried in order). The `<BgmController>` component (see
`src/components/BgmController.tsx`) plays it at low volume across the
whole `/game` route group with a mute toggle in the bottom-left corner.

Recommended specs:
- 60–120 s, seamlessly loopable
- ≤300 KB at 96 kbps mono / 128 kbps stereo
- Quiet so it doesn't fight with action SFX (component already drops
  `volume` to ~0.35 and ducks further when a modal is open)

Suggested search (Pixabay Music, royalty-free, no attribution needed):
`mystical forest loop`, `fantasy ambient loop`, `cinematic exploration`.

If `bgm.mp3` is missing the controller silently no-ops — the toggle
won't appear, no console errors.
