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

const NAME_MAX_LENGTH = 100
const MIN_ALLOWANCE_RATIO = 0
const MAX_ALLOWANCE_RATIO = 1.5

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

function resolvePublicTickerEnabled(
  publicTickerEnabled: unknown,
  publicTickerRequiresCode: unknown,
  defaultValue: boolean
): boolean {
  const hasEnabled = publicTickerEnabled !== undefined
  const hasRequiresCode = publicTickerRequiresCode !== undefined

  let enabled = defaultValue

  if (hasEnabled) {
    if (typeof publicTickerEnabled !== 'boolean') {
      throw error(400, 'publicTickerEnabled must be a boolean when provided.')
    }

    enabled = publicTickerEnabled
  }

  if (hasRequiresCode) {
    if (typeof publicTickerRequiresCode !== 'boolean') {
      throw error(400, 'publicTickerRequiresCode must be a boolean when provided.')
    }

    if (hasEnabled && enabled === publicTickerRequiresCode) {
      throw error(
        400,
        'publicTickerEnabled and publicTickerRequiresCode conflict. They must represent opposite states.'
      )
    }

    if (!hasEnabled) {
      enabled = !publicTickerRequiresCode
    }
  }

  return enabled
}

function readOptionalRatio(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw error(400, `${fieldName} must be a number when provided.`)
  }

  if (value < MIN_ALLOWANCE_RATIO || value > MAX_ALLOWANCE_RATIO) {
    throw error(
      400,
      `${fieldName} must be between ${MIN_ALLOWANCE_RATIO} and ${MAX_ALLOWANCE_RATIO} when provided.`
    )
  }

  return value
}

export const GET: RequestHandler = async (event) => {
  const tournament = await requireOwnedTournament(event)
  return json(toApiTournament(tournament))
}

export const PATCH: RequestHandler = async (event) => {
  const currentTournament = await requireOwnedTournament(event)
  const db = getDb(event)
  const body = await parseJsonBody(event.request)

  const updates: Partial<Tournament> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw error(400, 'name must be a non-empty string when provided.')
    }

    const trimmedName = body.name.trim()

    if (trimmedName.length > NAME_MAX_LENGTH) {
      throw error(400, `name must be ${NAME_MAX_LENGTH} characters or fewer when provided.`)
    }

    updates.name = trimmedName
  }

  if (body.startDate !== undefined) {
    if (typeof body.startDate !== 'string' || body.startDate.trim().length === 0) {
      throw error(400, 'startDate must be a non-empty string when provided.')
    }

    updates.start_date = body.startDate.trim()
  }

  if (body.endDate !== undefined) {
    if (typeof body.endDate !== 'string' || body.endDate.trim().length === 0) {
      throw error(400, 'endDate must be a non-empty string when provided.')
    }

    updates.end_date = body.endDate.trim()
  }

  if (body.pointsToWin !== undefined) {
    if (typeof body.pointsToWin !== 'number' || !Number.isFinite(body.pointsToWin) || body.pointsToWin <= 0) {
      throw error(400, 'pointsToWin must be a positive number when provided.')
    }

    updates.points_to_win = body.pointsToWin
  }

  if (body.publicTickerEnabled !== undefined || body.publicTickerRequiresCode !== undefined) {
    const publicTickerEnabled = resolvePublicTickerEnabled(
      body.publicTickerEnabled,
      body.publicTickerRequiresCode,
      currentTournament.public_ticker_enabled === 1
    )
    updates.public_ticker_enabled = publicTickerEnabled ? 1 : 0
  }

  if (body.allowanceScrambleLow !== undefined) {
    updates.allowance_scramble_low = readOptionalRatio(body.allowanceScrambleLow, 'allowanceScrambleLow')
  }

  if (body.allowanceScrambleHigh !== undefined) {
    updates.allowance_scramble_high = readOptionalRatio(body.allowanceScrambleHigh, 'allowanceScrambleHigh')
  }

  if (body.allowancePinehurstLow !== undefined) {
    updates.allowance_pinehurst_low = readOptionalRatio(
      body.allowancePinehurstLow,
      'allowancePinehurstLow'
    )
  }

  if (body.allowancePinehurstHigh !== undefined) {
    updates.allowance_pinehurst_high = readOptionalRatio(
      body.allowancePinehurstHigh,
      'allowancePinehurstHigh'
    )
  }

  if (body.allowanceShamble !== undefined) {
    updates.allowance_shamble = readOptionalRatio(body.allowanceShamble, 'allowanceShamble')
  }

  if (body.allowanceFourball !== undefined) {
    updates.allowance_fourball = readOptionalRatio(body.allowanceFourball, 'allowanceFourball')
  }

  if (body.allowanceSingles !== undefined) {
    updates.allowance_singles = readOptionalRatio(body.allowanceSingles, 'allowanceSingles')
  }

  if (body.status !== undefined && body.status === 'archived') {
    throw error(400, 'Tournament archiving is not supported yet.')
  }

  if (Object.keys(updates).length === 0) {
    throw error(400, 'Provide at least one field to update.')
  }

  const nextStartDate = updates.start_date ?? currentTournament.start_date
  const nextEndDate = updates.end_date ?? currentTournament.end_date

  if (nextStartDate > nextEndDate) {
    throw error(400, 'startDate must be before or equal to endDate.')
  }

  const updatedTournament = await updateTournament(db, currentTournament.id, updates)

  if (!updatedTournament) {
    throw error(404, 'Tournament not found.')
  }

  return json(toApiTournament(updatedTournament))
}
