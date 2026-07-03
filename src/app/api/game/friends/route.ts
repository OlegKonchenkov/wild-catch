import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth-fast'
import { createAdminClient } from '@/lib/supabase/admin'

export interface FriendEntry {
  friendshipId: string
  userId: string
  nickname: string | null
  avatarUrl: string | null
}

// GET /api/game/friends → { friends, pendingIn, pendingOut }
export async function GET() {
  const { supabase, user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: rows, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const all = rows ?? []
  const otherIds = [...new Set(all.map(r => r.requester_id === user.id ? r.addressee_id : r.requester_id))]

  // Nickname/avatar via admin client: i profili altrui non sono leggibili da RLS.
  const admin = createAdminClient()
  const { data: profs } = otherIds.length > 0
    ? await admin.from('profiles').select('user_id, nickname, avatar_url').in('user_id', otherIds)
    : { data: [] as Array<{ user_id: string; nickname: string | null; avatar_url: string | null }> }
  const profById = new Map((profs ?? []).map(p => [p.user_id, p]))

  const toEntry = (r: { id: string; requester_id: string; addressee_id: string }): FriendEntry => {
    const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id
    const prof = profById.get(otherId)
    return { friendshipId: r.id, userId: otherId, nickname: prof?.nickname ?? null, avatarUrl: prof?.avatar_url ?? null }
  }

  return NextResponse.json({
    friends: all.filter(r => r.status === 'accepted').map(toEntry),
    pendingIn: all.filter(r => r.status === 'pending' && r.addressee_id === user.id).map(toEntry),
    pendingOut: all.filter(r => r.status === 'pending' && r.requester_id === user.id).map(toEntry),
  })
}
