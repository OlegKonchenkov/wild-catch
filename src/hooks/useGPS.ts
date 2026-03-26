'use client'
import { useState, useEffect, useRef } from 'react'

export interface GPSPosition {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

// Module-level cache — survives component unmounts (e.g. navigating to encounter page and back).
// Without this, every remount starts with position=null and the marker disappears until the
// next GPS callback fires.
let cachedPosition: GPSPosition | null = null

export function useGPS(onPosition?: (pos: GPSPosition) => void) {
  // Initialise with cached value so the marker is visible immediately on remount
  const [position, setPosition] = useState<GPSPosition | null>(cachedPosition)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const onPositionRef = useRef(onPosition)

  useEffect(() => {
    onPositionRef.current = onPosition
  }, [onPosition])

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('GPS non disponibile su questo dispositivo')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const gpsPos: GPSPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
        cachedPosition = gpsPos        // persist for next mount
        setPosition(gpsPos)            // always update the map marker
        onPositionRef.current?.(gpsPos) // server call applies its own accuracy gate
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setError('Abilita il GPS per giocare')
        } else if (err.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
          setError('GPS non disponibile. Spostati in un luogo aperto')
        }
        // TIMEOUT: silently ignore — watchPosition will retry automatically
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,   // 30 s — avoids spurious TIMEOUT errors during GPS acquisition
        maximumAge: 3000, // accept positions up to 3 s old for instant display on remount
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { position, error }
}
