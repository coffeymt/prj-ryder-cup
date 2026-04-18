import { requireRole } from '$lib/auth/guards'
import { generateUniqueCode } from '$lib/auth/tournamentCode'
import { getTournamentById, listTournamentsByCommissioner } from '$lib/db/tournaments'
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

type CreateTournamentPayload = {
  name: string
  startDate: string
  endDate: string
  pointsToWin: number
  publicTickerEnabled?: boolean
  publicTickerRequiresCode?: boolean
  allowanceScrambleLow?: number
  allowanceScrambleHigh?: number
  allowancePinehurstLow?: number
  allowancePinehurstHigh?: number
  allowanceShamble?: number
  allowanceFourball?: number
  allowanceSingles?: number
}

const NAME_MAX_LENGTH = 100
const MIN_ALLOWANCE_RATIO = 0
const MAX_ALLOWANCE_RATIO = 1.5
const DEFAULT_ALLOWANCES = {
  allowanceScrambleLow: 0.35,
  allowanceScrambleHigh: 0.15,
  allowancePinehurstLow: 0.6,
  allowancePinehurstHigh: 0.4,
  allowanceShamble: 0.85,
  allowanceFourball: 1,
  allowanceSingles: 1
} as const

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

function readRequiredString(body: Record<string, unknown>, fieldName: keyof CreateTournamentPayload): string {
  const value = body[fieldName]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw error(400, `${String(fieldName)} must be a non-empty string.`)
  }

  const trimmedValue = value.trim()

  if (fieldName === 'name' && trimmedValue.length > NAME_MAX_LENGTH) {
    throw error(400, `name must be ${NAME_MAX_LENGTH} characters or fewer.`)
  }

  return trimmedValue
}

function readRequiredPositiveNumber(
  body: Record<string, unknown>,
  fieldName: keyof CreateTournamentPayload
): number {
  const value = body[fieldName]

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw error(400, `${String(fieldName)} must be a positive number.`)
  }

  return value
}

function readOptionalRatio(
  body: Record<string, unknown>,
  fieldName: keyof CreateTournamentPayload,
  defaultValue: number
): number {
  const value = body[fieldName]

  if (value === undefined) {
    return defaultValue
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw error(400, `${String(fieldName)} must be a number when provided.`)
  }

  if (value < MIN_ALLOWANCE_RATIO || value > MAX_ALLOWANCE_RATIO) {
    throw error(
      400,
      `${String(fieldName)} must be between ${MIN_ALLOWANCE_RATIO} and ${MAX_ALLOWANCE_RATIO} when provided.`
    )
  }

  return value
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

async function generateTournamentCode(db: D1Database): Promise<string> {
  const existingCodeRows = await db.prepare('SELECT code FROM tournaments').all<{ code: string }>()
  const existingCodes = new Set(existingCodeRows.results.map((row) => row.code))

  return generateUniqueCode(existingCodes)
}

export const GET: RequestHandler = async (event) => {
  const db = getDb(event)
  const commissionerUserId = requireCommissionerUserId(event)
  const tournaments = await listTournamentsByCommissioner(db, commissionerUserId)

  return json(tournaments.map(toApiTournament))
}

export const POST: RequestHandler = async (event) => {
  const db = getDb(event)
  const commissionerUserId = requireCommissionerUserId(event)
  const body = await parseJsonBody(event.request)

  const name = readRequiredString(body, 'name')
  const startDate = readRequiredString(body, 'startDate')
  const endDate = readRequiredString(body, 'endDate')
  const pointsToWin = readRequiredPositiveNumber(body, 'pointsToWin')
  const publicTickerEnabled = resolvePublicTickerEnabled(
    body.publicTickerEnabled,
    body.publicTickerRequiresCode,
    false
  )
  const allowanceScrambleLow = readOptionalRatio(
    body,
    'allowanceScrambleLow',
    DEFAULT_ALLOWANCES.allowanceScrambleLow
  )
  const allowanceScrambleHigh = readOptionalRatio(
    body,
    'allowanceScrambleHigh',
    DEFAULT_ALLOWANCES.allowanceScrambleHigh
  )
  const allowancePinehurstLow = readOptionalRatio(
    body,
    'allowancePinehurstLow',
    DEFAULT_ALLOWANCES.allowancePinehurstLow
  )
  const allowancePinehurstHigh = readOptionalRatio(
    body,
    'allowancePinehurstHigh',
    DEFAULT_ALLOWANCES.allowancePinehurstHigh
  )
  const allowanceShamble = readOptionalRatio(
    body,
    'allowanceShamble',
    DEFAULT_ALLOWANCES.allowanceShamble
  )
  const allowanceFourball = readOptionalRatio(
    body,
    'allowanceFourball',
    DEFAULT_ALLOWANCES.allowanceFourball
  )
  const allowanceSingles = readOptionalRatio(body, 'allowanceSingles', DEFAULT_ALLOWANCES.allowanceSingles)

  if (startDate > endDate) {
    throw error(400, 'startDate must be before or equal to endDate.')
  }

  const tournamentCode = await generateTournamentCode(db)

  const insertResult = await db
    .prepare(
      `
        INSERT INTO tournaments (
          code,
          name,
          start_date,
          end_date,
          points_to_win,
          commissioner_email,
          public_ticker_enabled,
          allowance_scramble_low,
          allowance_scramble_high,
          allowance_pinehurst_low,
          allowance_pinehurst_high,
          allowance_shamble,
          allowance_fourball,
          allowance_singles
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      `
    )
    .bind(
      tournamentCode,
      name,
      startDate,
      endDate,
      pointsToWin,
      commissionerUserId,
      publicTickerEnabled ? 1 : 0,
      allowanceScrambleLow,
      allowanceScrambleHigh,
      allowancePinehurstLow,
      allowancePinehurstHigh,
      allowanceShamble,
      allowanceFourball,
      allowanceSingles
    )
    .run()

  const createdTournamentId = String(insertResult.meta.last_row_id)
  const createdTournament = await getTournamentById(db, createdTournamentId)

  if (!createdTournament) {
    throw error(500, 'Tournament was created but could not be loaded.')
  }

  return json(toApiTournament(createdTournament), { status: 201 })
}
