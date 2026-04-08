import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getCorsHeaders(_origin: string, allowedOrigin: string) {
  // When ALLOWED_ORIGIN is configured, use it as the single allowed origin.
  // When it is NOT configured, do not set an Access-Control-Allow-Origin header at
  // all — reflecting the caller's origin back (or returning '*') would allow any
  // website to call this endpoint from a browser. Server-to-server calls (no Origin
  // header) work fine without the header.
  //
  // Note: ALLOWED_ORIGIN being absent does NOT bypass the server-side JWT + admin
  // email check, which is the authoritative security gate. This CORS restriction
  // is defence-in-depth only.
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin
  }
  return headers
}

function json(body: unknown, status = 200, origin = '', allowedOrigin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin, allowedOrigin),
      'Content-Type': 'application/json',
    },
  })
}

async function findAuthUserByEmail(supabaseAdmin: ReturnType<typeof createClient>, email: string) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = data?.users || []
    const existing = users.find((candidate) => normalizeEmail(candidate.email || '') === email)
    if (existing) return existing
    if (users.length < perPage) return null
    page += 1
  }
}

function parseRedirect(value: string) {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function normalizeOrigin(value: string) {
  return String(value || '').trim().replace(/\/$/, '')
}

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase()
}

function normalizeTeamName(value: string) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function normalizeDelivery(value: string) {
  return value === 'invite' ? 'invite' : 'password'
}

Deno.serve(async (req) => {
  const origin = normalizeOrigin(req.headers.get('Origin') || '')
  const allowedOrigin = normalizeOrigin(Deno.env.get('ALLOWED_ORIGIN') || '')

  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return json({ ok: false, error: 'Origin not allowed.' }, 403, origin, allowedOrigin)
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin, allowedOrigin) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const adminEmails = String(Deno.env.get('ADMIN_EMAILS') || '')
      .split(',')
      .map((value) => normalizeEmail(value))
      .filter(Boolean)

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: 'Missing Supabase function secrets.' }, 500, origin, allowedOrigin)
    }

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ ok: false, error: 'Missing auth token.' }, 401, origin, allowedOrigin)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(jwt)

    if (authError || !user?.email) {
      return json({ ok: false, error: 'Unauthorized.' }, 401, origin, allowedOrigin)
    }

    const callerEmail = normalizeEmail(user.email)
    if (!adminEmails.includes(callerEmail)) {
      return json({ ok: false, error: 'Admin access required.' }, 403, origin, allowedOrigin)
    }

    const body = await req.json().catch(() => ({}))
    const targetEmail = normalizeEmail(body?.email)
    const requestedTeamName = normalizeTeamName(body?.teamName)
    const delivery = normalizeDelivery(body?.delivery)
    const password = String(body?.password || '')
    const redirectTo = String(body?.redirectTo || '').trim()
    const redirectUrl = parseRedirect(redirectTo)

    if (!targetEmail) {
      return json({ ok: false, error: 'Email is required.' }, 400, origin, allowedOrigin)
    }

    if (delivery === 'password' && password.length < 8) {
      return json({ ok: false, error: 'Password must be at least 8 characters.' }, 400, origin, allowedOrigin)
    }

    if (delivery === 'invite' && redirectTo && !redirectUrl) {
      return json({ ok: false, error: 'Invite redirect URL is invalid.' }, 400, origin, allowedOrigin)
    }

    if (delivery === 'invite' && allowedOrigin && redirectUrl && normalizeOrigin(redirectUrl.origin) !== allowedOrigin) {
      return json({ ok: false, error: 'Invite redirect URL must match the allowed app origin.' }, 400, origin, allowedOrigin)
    }

    let targetTeamId: string | null = null
    let targetTeamName = ''
    let created = false

    if (requestedTeamName) {
      const { data: existingTeam, error: findTeamError } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .ilike('name', requestedTeamName)
        .limit(1)
        .maybeSingle()

      if (findTeamError) {
        return json({ ok: false, error: findTeamError.message }, 500, origin, allowedOrigin)
      }

      if (existingTeam) {
        targetTeamId = existingTeam.id
        targetTeamName = existingTeam.name
      } else {
        const { data: newTeam, error: createTeamError } = await supabaseAdmin
          .from('teams')
          .insert({ name: requestedTeamName })
          .select('id, name')
          .single()

        if (createTeamError && String(createTeamError.message || '').toLowerCase().includes('unique')) {
          const { data: racedTeam, error: racedTeamError } = await supabaseAdmin
            .from('teams')
            .select('id, name')
            .ilike('name', requestedTeamName)
            .limit(1)
            .maybeSingle()

          if (racedTeamError || !racedTeam) {
            return json({ ok: false, error: racedTeamError?.message || 'Failed to reuse existing team.' }, 500, origin, allowedOrigin)
          }

          targetTeamId = racedTeam.id
          targetTeamName = racedTeam.name
        } else if (createTeamError || !newTeam) {
          return json({ ok: false, error: createTeamError?.message || 'Failed to create team.' }, 500, origin, allowedOrigin)
        } else {
          targetTeamId = newTeam.id
          targetTeamName = newTeam.name
          created = true
        }
      }
    } else {
      const { data: callerRow, error: callerRowError } = await supabaseAdmin
        .from('allowed_users')
        .select('team_id, teams(id, name)')
        .eq('email', callerEmail)
        .limit(1)
        .maybeSingle()

      if (callerRowError) {
        return json({ ok: false, error: callerRowError.message }, 500, origin, allowedOrigin)
      }

      const team = Array.isArray(callerRow?.teams) ? callerRow.teams[0] : callerRow?.teams
      if (!callerRow?.team_id || !team?.name) {
        return json({ ok: false, error: 'Your account is not assigned to a team yet.' }, 400, origin, allowedOrigin)
      }

      targetTeamId = callerRow.team_id
      targetTeamName = team.name
    }

    const { error: upsertError } = await supabaseAdmin
      .from('allowed_users')
      .upsert({ email: targetEmail, team_id: targetTeamId }, { onConflict: 'email' })

    if (upsertError) {
      return json({ ok: false, error: upsertError.message }, 500, origin, allowedOrigin)
    }

    const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, targetEmail)
    let invited = false

    if (!existingAuthUser) {
      if (delivery === 'invite') {
        const inviteOptions = redirectTo ? { redirectTo } : undefined
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          targetEmail,
          inviteOptions,
        )

        if (inviteError) {
          return json({
            ok: false,
            assignmentSaved: true,
            email: targetEmail,
            team: {
              id: targetTeamId,
              name: targetTeamName,
              created,
            },
            auth: {
              delivery,
              invited: false,
              existing: false,
              redirectTo: redirectTo || null,
            },
            error: `Team assignment saved, but the invite email could not be sent: ${inviteError.message}`,
          }, 500, origin, allowedOrigin)
        }

        invited = true
      } else {
        const { error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: targetEmail,
          password,
          email_confirm: true,
        })

        if (createUserError) {
          return json({
            ok: false,
            assignmentSaved: true,
            email: targetEmail,
            team: {
              id: targetTeamId,
              name: targetTeamName,
              created,
            },
            auth: {
              delivery,
              invited: false,
              existing: false,
              redirectTo: redirectTo || null,
            },
            error: `Team assignment saved, but the sign-in user could not be created: ${createUserError.message}`,
          }, 500, origin, allowedOrigin)
        }
      }
    }

    return json({
      ok: true,
      email: targetEmail,
      team: {
        id: targetTeamId,
        name: targetTeamName,
        created,
      },
      auth: {
        delivery,
        invited,
        existing: !!existingAuthUser,
        redirectTo: redirectTo || null,
      },
    }, 200, origin, allowedOrigin)
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error.' }, 500, origin, allowedOrigin)
  }
})
