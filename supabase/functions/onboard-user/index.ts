import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const adminEmails = String(Deno.env.get('ADMIN_EMAILS') || '')
      .split(',')
      .map((value) => normalizeEmail(value))
      .filter(Boolean)

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: 'Missing Supabase function secrets.' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ ok: false, error: 'Missing auth token.' }, 401)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(jwt)

    if (authError || !user?.email) {
      return json({ ok: false, error: 'Unauthorized.' }, 401)
    }

    const callerEmail = normalizeEmail(user.email)
    if (!adminEmails.includes(callerEmail)) {
      return json({ ok: false, error: 'Admin access required.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const targetEmail = normalizeEmail(body?.email)
    const requestedTeamName = String(body?.teamName || '').trim()

    if (!targetEmail) {
      return json({ ok: false, error: 'Email is required.' }, 400)
    }

    let targetTeamId: string | null = null
    let targetTeamName = ''
    let created = false

    if (requestedTeamName) {
      const { data: existingTeam, error: findTeamError } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .eq('name', requestedTeamName)
        .limit(1)
        .maybeSingle()

      if (findTeamError) {
        return json({ ok: false, error: findTeamError.message }, 500)
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

        if (createTeamError || !newTeam) {
          return json({ ok: false, error: createTeamError?.message || 'Failed to create team.' }, 500)
        }

        targetTeamId = newTeam.id
        targetTeamName = newTeam.name
        created = true
      }
    } else {
      const { data: callerRow, error: callerRowError } = await supabaseAdmin
        .from('allowed_users')
        .select('team_id, teams(id, name)')
        .eq('email', callerEmail)
        .limit(1)
        .maybeSingle()

      if (callerRowError) {
        return json({ ok: false, error: callerRowError.message }, 500)
      }

      const team = Array.isArray(callerRow?.teams) ? callerRow.teams[0] : callerRow?.teams
      if (!callerRow?.team_id || !team?.name) {
        return json({ ok: false, error: 'Your account is not assigned to a team yet.' }, 400)
      }

      targetTeamId = callerRow.team_id
      targetTeamName = team.name
    }

    const { error: upsertError } = await supabaseAdmin
      .from('allowed_users')
      .upsert({ email: targetEmail, team_id: targetTeamId }, { onConflict: 'email' })

    if (upsertError) {
      return json({ ok: false, error: upsertError.message }, 500)
    }

    return json({
      ok: true,
      email: targetEmail,
      team: {
        id: targetTeamId,
        name: targetTeamName,
        created,
      },
    })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
