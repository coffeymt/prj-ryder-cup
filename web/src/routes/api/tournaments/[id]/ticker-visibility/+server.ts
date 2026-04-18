import { requireRole } from '$lib/auth/guards'
import { getTournamentById, updateTournament } from '$lib/db/tournaments'
import type { Tournament } from '$lib/db/types'
import { error, json, type RequestHandler } from '@sveltejs/kit'

type TournamentApiModel = {
  id: string
  code: string
  name: string
  startDate: string
  endDate: string
  pointsToWin: number
  commissionerUserId: string
  publicTickerEnabled: boolean
  publicTickerRequiresCode: boolean
  allowanceScrambleLow: number
  allowanceScrambleHigh: number
  allowancePinehurstLow: number
  allowancePinehurstHigh: number
  allowanceShamble: number
  allowanceFourball: number
  allowanceSingles: number
  createdAt: string
  updatedAt: string
}

function getDb(event: Parameters<RequestHandler>[0]): D1Database {
  const db = event.platform?.env?.DB

  if (!db) {
    throw error(500, 'Database binding is not configured.')
  }

  return db
}

function requireCommissionerUserId(event: Parameters<RequestHandler>[0]): string {
  requireRole(event.locals, 'commissioner')

  if (!event.locals.userId) {
    throw error(401, 'Unauthorized')
  }

  return event.locals.userId
}

function requireTournamentId(event: Parameters<RequestHandler>[0]): string {
  const tournamentId = event.params.id

  if (!tournamentId) {
    throw error(400, 'Tournament id is required.')
  }

  return tournamentId
}

async function requireOwnedTournament(event: Parameters<RequestHandler>[0]): Promise<Tournament> {
  const db = getDb(event)
  const tournamentId = requireTournamentId(event)
  const commissionerUserId = requireCommissionerUserId(event)
  const tournament = await getTournamentById(db, tournamentId)

  if (!tournament) {
    throw error(404, 'Tournament not found.')
  }

  if (tournament.commissioner_email !== commissionerUserId) {
    throw error(403, 'Forbidden')
  }

  return tournament
}

function toApiTournament(tournament: Tournament): TournamentApiModel {
  const publicTickerEnabled = tournament.public_ticker_enabled === 1

  return {
    id: tournament.id,
    code: tournament.code,
    name: tournament.name,
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    pointsToWin: tournament.points_to_win,
    commissionerUserId: tournament.commissioner_email,
    publicTickerEnabled,
    publicTickerRequiresCode: !publicTickerEnabled,
    allowanceScrambleLow: tournament.allowance_scramble_low,
    allowanceScrambleHigh: tournament.allowance_scramble_high,
    allowancePinehurstLow: tournament.allowance_pinehurst_low,
    allowancePinehurstHigh: tournament.allowance_pinehurst_high,
    allowanceShamble: tournament.allowance_shamble,
    allowanceFourball: tournament.allowance_fourball,
    allowanceSingles: tournament.allowance_singles,
    createdAt: tournament.created_at,
    updatedAt: tournament.updated_at
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw error(400, 'Request body must be valid JSON.')
  }

  if (!isObject(body)) {
    throw error(400, 'Request body must be a JSON object.')
  }

  return body
}

function resolvePublicTickerEnabled(publicTickerEnabled: unknown, publicTickerRequiresCode: unknown): boolean {
  if (typeof publicTickerEnabled !== 'boolean') {
    throw error(400, 'publicTickerEnabled must be a boolean.')
  }

  if (publicTickerRequiresCode !== undefined) {
    if (typeof publicTickerRequiresCode !== 'boolean') {
      throw error(400, 'publicTickerRequiresCode must be a boolean when provided.')
    }

    if (publicTickerEnabled === publicTickerRequiresCode) {
      throw error(
        400,
        'publicTickerEnabled and publicTickerRequiresCode conflict. They must represent opposite states.'
      )
    }
  }

  return publicTickerEnabled
}

export const PATCH: RequestHandler = async (event) => {
  const currentTournament = await requireOwnedTournament(event)
  const db = getDb(event)
  const body = await parseJsonBody(event.request)
  const publicTickerEnabled = resolvePublicTickerEnabled(
    body.publicTickerEnabled,
    body.publicTickerRequiresCode
  )
  const updatedTournament = await updateTournament(db, currentTournament.id, {
    public_ticker_enabled: publicTickerEnabled ? 1 : 0
  })

  if (!updatedTournament) {
    throw error(404, 'Tournament not found.')
  }

  return json(toApiTournament(updatedTournament))
}
