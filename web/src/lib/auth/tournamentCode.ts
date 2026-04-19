const TOURNAMENT_CODE_LENGTH = 6;
const TOURNAMENT_CODE_CHARACTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CHARACTER_SET_SIZE = TOURNAMENT_CODE_CHARACTERS.length;

const CODE_PATTERN = new RegExp(
  `^[${TOURNAMENT_CODE_CHARACTERS}]{${TOURNAMENT_CODE_LENGTH}}$`,
  'u'
);

function mapByteToCharacter(byteValue: number): string {
  const characterIndex = byteValue % CHARACTER_SET_SIZE;
  return TOURNAMENT_CODE_CHARACTERS[characterIndex];
}

export function generateTournamentCode(): string {
  const randomBytes = new Uint8Array(TOURNAMENT_CODE_LENGTH);
  crypto.getRandomValues(randomBytes);

  let code = '';

  for (const byteValue of randomBytes) {
    code += mapByteToCharacter(byteValue);
  }

  return code;
}

export function isValidTournamentCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function generateUniqueCode(existingCodes: Set<string>): string {
  let candidateCode = generateTournamentCode();

  while (existingCodes.has(candidateCode)) {
    candidateCode = generateTournamentCode();
  }

  return candidateCode;
}
