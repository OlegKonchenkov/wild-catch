/**
 * Pergamene — logica pura (Wave 2 / Territorio Vivo).
 *
 * Camminare produce pergamene: 1 ogni PERGAMENA_STEP_INTERVAL passi cumulativi.
 * Il conteggio è un crossing tra il contatore passi precedente e quello nuovo,
 * calcolato nel position route: niente cron, niente stato extra.
 */

export const PERGAMENA_STEP_INTERVAL = 250
/** Anti-burst: un singolo aggiornamento GPS non può fruttarne più di 3. */
export const PERGAMENE_MAX_PER_UPDATE = 3

/** Quante pergamene matura il passaggio prevSteps → newSteps (capped). */
export function pergameneEarned(prevSteps: number, newSteps: number): number {
  if (newSteps <= prevSteps) return 0
  const before = Math.floor(Math.max(0, prevSteps) / PERGAMENA_STEP_INTERVAL)
  const after = Math.floor(Math.max(0, newSteps) / PERGAMENA_STEP_INTERVAL)
  return Math.min(Math.max(0, after - before), PERGAMENE_MAX_PER_UPDATE)
}
