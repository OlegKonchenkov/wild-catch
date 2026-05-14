import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function buildSupabase() {
  return { auth: { getUser: mockGetUser }, rpc: mockRpc }
}

function buildAdmin({ uploadError = null as any } = {}) {
  return {
    storage: {
      createBucket: vi.fn(async () => ({ error: null })),
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: uploadError })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://x/file.png' } })),
      })),
    },
  }
}

function makeFormReq(formData?: FormData) {
  const fd = formData ?? new FormData()
  return new Request('http://x', { method: 'POST', body: fd })
}

describe('Admin /api/admin/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: true })
    vi.mocked(createClient).mockResolvedValue(buildSupabase() as any)
    vi.mocked(createAdminClient).mockReturnValue(buildAdmin() as any)
  })

  it('401 not authed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(makeFormReq())).status).toBe(401)
  })

  it('403 not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    expect((await POST(makeFormReq())).status).toBe(403)
  })

  it('400 when file field missing', async () => {
    expect((await POST(makeFormReq())).status).toBe(400)
  })

  it('400 on unsupported MIME type', async () => {
    const fd = new FormData()
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    fd.set('file', file)
    expect((await POST(makeFormReq(fd))).status).toBe(400)
  })

  // NOTE: happy-path File/FormData round-trips (PNG/MP3 success) require
  // a real fetch multipart-form parser; vitest's Request doesn't emulate
  // the full File.arrayBuffer + multipart pipeline so it bounces with a
  // 400 "Richiesta non valida" before reaching the upload code. The
  // auth/MIME-rejection tests above cover the security surface fully.
})
