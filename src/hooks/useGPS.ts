'use client'
import { useState, useEffect, useRef } from 'react'

export interface GPSPosition {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export function useGPS(onPosition?: (pos: GPSPosition) => void) {
  const [position, setPosition] = useState<GPSPosition | null>(null)
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
        setPosition(gpsPos)
        onPositionRef.current?.(gpsPos)
      },
      (err) => {
        switch (err.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            setError('Abilita il GPS per giocare')
            break
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            setError('GPS non disponibile. Spostati in un luogo aperto')
            break
          default:
            setError('Errore GPS')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { position, error }
}
