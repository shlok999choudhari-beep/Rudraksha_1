/**
 * Synthetic identities and ICAO 9303 MRZ construction for the demo fixtures.
 *
 * Every identity here is invented. Nothing in this file is derived from real
 * travel documents or real people.
 */

import { hashString, makeRng, rngInt, rngPick } from './seed';

export interface SyntheticIdentity {
  surname: string;
  givenNames: string;
  /** ISO date. */
  dateOfBirth: string;
  nationality: string;
  sex: 'M' | 'F';
  placeOfBirth: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
}

const SURNAMES = [
  'SHARMA', 'IYER', 'KHAN', 'REDDY', 'BANERJEE', 'PATEL', 'NAIR', 'GHOSH',
  'CHOPRA', 'DESAI', 'MEHTA', 'RAO', 'SINGH', 'VERMA', 'JOSHI', 'KAPOOR',
  'PILLAI', 'BOSE', 'TRIVEDI', 'DUTTA',
] as const;

const GIVEN_NAMES_M = [
  'ARJUN', 'ROHAN', 'KARTIK', 'ADITYA', 'VIKRAM', 'ISHAAN', 'NIKHIL', 'SIDDHARTH',
  'RAHUL DEV', 'ANAND KUMAR',
] as const;

const GIVEN_NAMES_F = [
  'ANANYA', 'MEERA', 'PRIYA', 'DIVYA', 'SNEHA', 'KAVYA', 'NANDINI', 'ISHITA',
  'RIYA SEN', 'AARADHYA',
] as const;

const PLACES = [
  'NEW DELHI', 'MUMBAI', 'CHENNAI', 'KOLKATA', 'BENGALURU', 'HYDERABAD',
  'PUNE', 'AHMEDABAD', 'KOCHI', 'JAIPUR',
] as const;

const AUTHORITIES = [
  'MINISTRY OF EXTERNAL AFFAIRS',
  'RPO NEW DELHI',
  'RPO MUMBAI',
  'RPO CHENNAI',
  'RPO BENGALURU',
] as const;

/** Deterministically build an identity from any seed string. */
export function makeIdentity(seedStr: string): SyntheticIdentity {
  const rng = makeRng(hashString(seedStr));
  const sex = rng() > 0.5 ? 'M' : 'F';
  const surname = rngPick(rng, SURNAMES);
  const givenNames = rngPick(rng, sex === 'M' ? GIVEN_NAMES_M : GIVEN_NAMES_F);

  const birthYear = rngInt(rng, 1972, 2004);
  const birthMonth = rngInt(rng, 1, 12);
  const birthDay = rngInt(rng, 1, 28);

  const issueYear = rngInt(rng, 2018, 2024);
  const issueMonth = rngInt(rng, 1, 12);
  const issueDay = rngInt(rng, 1, 28);

  const letter = String.fromCharCode(65 + rngInt(rng, 0, 25));
  const digits = String(rngInt(rng, 1000000, 9999999));

  return {
    surname,
    givenNames,
    dateOfBirth: iso(birthYear, birthMonth, birthDay),
    nationality: 'IND',
    sex,
    placeOfBirth: rngPick(rng, PLACES),
    documentNumber: `${letter}${digits}`,
    issueDate: iso(issueYear, issueMonth, issueDay),
    // Indian passports run ten years from issue.
    expiryDate: iso(issueYear + 10, issueMonth, issueDay),
    issuingAuthority: rngPick(rng, AUTHORITIES),
  };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/* MRZ construction (ICAO 9303 TD3 / MRVB)                                    */
/* -------------------------------------------------------------------------- */

const MRZ_WEIGHTS = [7, 3, 1];

function charValue(ch: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55;
  return 0; // '<' and any filler
}

/** ICAO 9303 check digit: weighted 7-3-1 sum, modulo 10. */
export function mrzCheckDigit(input: string): string {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    sum += charValue(input[i]) * MRZ_WEIGHTS[i % 3];
  }
  return String(sum % 10);
}

/** ISO `2000-01-12` -> MRZ `000112` (YYMMDD). */
export function toMrzDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${y.slice(2)}${m}${d}`;
}

/** MRZ `000112` -> ISO `2000-01-12`, pivoting two-digit years like ICAO readers do. */
export function fromMrzDate(mrz: string, pivot = 30): string {
  const yy = Number(mrz.slice(0, 2));
  const century = yy <= pivot ? 2000 : 1900;
  return `${century + yy}-${mrz.slice(2, 4)}-${mrz.slice(4, 6)}`;
}

function padTo(value: string, length: number): string {
  return value.slice(0, length).padEnd(length, '<');
}

export interface MrzBuildOptions {
  /** Override the DOB written into the MRZ, to script an OCR/MRZ mismatch. */
  overrideDateOfBirth?: string;
  /** Deliberately corrupt a check digit, to script an MRZ validation failure. */
  breakCheckDigit?: 'documentNumber' | 'dateOfBirth' | 'expiryDate' | 'composite';
}

export interface MrzBuildResult {
  lines: string[];
  format: 'TD3' | 'MRVB';
  checkDigits: {
    documentNumber: string;
    dateOfBirth: string;
    expiryDate: string;
    composite: string;
  };
  /** The DOB actually encoded, which may differ from the printed value. */
  encodedDateOfBirth: string;
}

/** Build a TD3 (passport) two-line MRZ. */
export function buildTd3Mrz(
  identity: SyntheticIdentity,
  options: MrzBuildOptions = {},
): MrzBuildResult {
  const nameField = padTo(
    `${identity.surname}<<${identity.givenNames.replace(/\s+/g, '<')}`,
    39,
  );
  const line1 = `P<${identity.nationality}${nameField}`;

  const docNo = padTo(identity.documentNumber, 9);
  const encodedDob = options.overrideDateOfBirth ?? identity.dateOfBirth;
  const dob = toMrzDate(encodedDob);
  const exp = toMrzDate(identity.expiryDate);

  const bump = (digit: string) => String((Number(digit) + 1) % 10);

  let docCd = mrzCheckDigit(docNo);
  let dobCd = mrzCheckDigit(dob);
  let expCd = mrzCheckDigit(exp);

  if (options.breakCheckDigit === 'documentNumber') docCd = bump(docCd);
  if (options.breakCheckDigit === 'dateOfBirth') dobCd = bump(dobCd);
  if (options.breakCheckDigit === 'expiryDate') expCd = bump(expCd);

  const optionalData = padTo('', 14);
  const optionalCd = mrzCheckDigit(optionalData);

  const compositeInput = `${docNo}${docCd}${dob}${dobCd}${exp}${expCd}${optionalData}${optionalCd}`;
  let compositeCd = mrzCheckDigit(compositeInput);
  if (options.breakCheckDigit === 'composite') compositeCd = bump(compositeCd);

  const line2 =
    `${docNo}${docCd}${identity.nationality}${dob}${dobCd}${identity.sex}` +
    `${exp}${expCd}${optionalData}${optionalCd}${compositeCd}`;

  return {
    lines: [padTo(line1, 44), padTo(line2, 44)],
    format: 'TD3',
    checkDigits: {
      documentNumber: docCd,
      dateOfBirth: dobCd,
      expiryDate: expCd,
      composite: compositeCd,
    },
    encodedDateOfBirth: encodedDob,
  };
}

/** Build an MRVB (machine-readable visa, type B) two-line MRZ. */
export function buildMrvbMrz(
  identity: SyntheticIdentity,
  options: MrzBuildOptions = {},
): MrzBuildResult {
  const nameField = padTo(`${identity.surname}<<${identity.givenNames.replace(/\s+/g, '<')}`, 28);
  const line1 = `V<${identity.nationality}${nameField}`;

  const docNo = padTo(identity.documentNumber, 9);
  const encodedDob = options.overrideDateOfBirth ?? identity.dateOfBirth;
  const dob = toMrzDate(encodedDob);
  const exp = toMrzDate(identity.expiryDate);

  const bump = (digit: string) => String((Number(digit) + 1) % 10);
  let docCd = mrzCheckDigit(docNo);
  let dobCd = mrzCheckDigit(dob);
  let expCd = mrzCheckDigit(exp);
  if (options.breakCheckDigit === 'documentNumber') docCd = bump(docCd);
  if (options.breakCheckDigit === 'dateOfBirth') dobCd = bump(dobCd);
  if (options.breakCheckDigit === 'expiryDate') expCd = bump(expCd);

  const line2 = padTo(
    `${docNo}${docCd}${identity.nationality}${dob}${dobCd}${identity.sex}${exp}${expCd}`,
    36,
  );

  return {
    lines: [padTo(line1, 36), line2],
    format: 'MRVB',
    checkDigits: {
      documentNumber: docCd,
      dateOfBirth: dobCd,
      expiryDate: expCd,
      composite: '—',
    },
    encodedDateOfBirth: encodedDob,
  };
}
