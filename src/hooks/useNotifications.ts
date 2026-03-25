'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface GameNotification {
  id: string
  title: string
  body: string
  type: 'broadcast' | 'encounter' | 'duel' | 'mission' | 'system'
  createdAt: number   // Date.now()
  read: boolean
}

interface UseNotificationsOptions {
  sessionId: string | null
  userId: string | null
}

interface UseNotificationsResult {
  notifications: GameNotification[]
  unreadCount: number
  latest: GameNotification | null
  markRead: (id: string) => void
  markAllRead: () => void
  dismiss: (id: string) => void
}

export function useNotifications({ sessionId, userId }: UseNotificationsOptions): UseNotificationsResult {
  const [notifications, setNotifications] = useState<GameNotification[]>([])
  const supabase = useMemo(() => createClient(), [])

  const addNotification = useCallback((n: Omit<GameNotification, 'id' | 'createdAt' | 'read'>) => {
    setNotifications(prev => [{
      ...n,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      read: false,
    }, ...prev].slice(0, 50)) // keep last 50
  }, [])

  // Subscribe to broadcast notifications via Supabase Realtime
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`notifications:${sessionId}`)
      .on('broadcast', { event: 'admin_notify' }, ({ payload }) => {
        addNotification({
          title: payload.title ?? 'Avviso',
          body: payload.body ?? '',
          type: 'broadcast',
        })
      })
      .on('broadcast', { event: 'session_event' }, ({ payload }) => {
        addNotification({
          title: payload.title ?? 'Evento',
          body: payload.body ?? '',
          type: payload.type ?? 'system',
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, supabase, addNotification])

  // Subscribe to personal duel challenges
  useEffect(() => {
    if (!userId || !sessionId) return

    const channel = supabase
      .channel(`player_notify:${userId}`)
      .on('broadcast', { event: 'duel_challenge' }, ({ payload }) => {
        addNotification({
          title: '⚔️ Sfida Duello!',
          body: payload.challengerName ? `${payload.challengerName} ti ha sfidato!` : 'Sei stato sfidato a duello!',
          type: 'duel',
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, sessionId, supabase, addNotification])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length
  const latest = notifications.find(n => !n.read) ?? null

  return { notifications, unreadCount, latest, markRead, markAllRead, dismiss }
}
