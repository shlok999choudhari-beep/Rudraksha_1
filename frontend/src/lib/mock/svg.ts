/**
 * Inline SVG imagery for the self-contained demo.
 *
 * Generating the specimen document and face crops as data-URIs keeps the demo
 * dependency-free (no binary assets to ship or fetch) while still giving the
 * tamper overlay, face-comparison and document-preview components real pixels
 * to work with. In non-demo mode these are replaced by backend image URLs.
 */

import { hashString, makeRng } from './seed';

function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

/* -------------------------------------------------------------------------- */
/* Passport-photo style face crop                                             */
/* -------------------------------------------------------------------------- */

export interface FaceSvgOptions {
  /** Any stable string — the same seed always yields the same face. */
  seed: string;
  /** Slight pose shift, used so the live capture differs from the document photo. */
  variant?: 'document' | 'live';
  /** Lower quality renders softer/darker, for POOR quality demos. */
  quality?: 'GOOD' | 'ACCEPTABLE' | 'POOR';
}

/**
 * A stylised head-and-shoulders silhouette in the framing of an ICAO photo.
 * Deliberately abstract: no attempt to depict a real person.
 */
export function faceSvgDataUri({ seed, variant = 'document', quality = 'GOOD' }: FaceSvgOptions): string {
  const rng = makeRng(hashString(`${seed}:${variant}`));
  const hue = Math.floor(rng() * 40) + 12; // warm skin-ish hues
  const skin = `hsl(${hue} ${28 + rng() * 12}% ${52 + rng() * 14}%)`;
  const skinShade = `hsl(${hue} ${26 + rng() * 10}% ${38 + rng() * 10}%)`;
  const hair = `hsl(${Math.floor(rng() * 24) + 14} ${18 + rng() * 22}% ${12 + rng() * 14}%)`;
  const cloth = `hsl(${Math.floor(rng() * 60) + 200} ${16 + rng() * 20}% ${20 + rng() * 14}%)`;
  const bg = variant === 'live' ? '#1b2230' : '#e9ecef';

  // The live capture is nudged off-centre so the two crops are visibly distinct.
  const shift = variant === 'live' ? (rng() > 0.5 ? 4 : -4) : 0;
  const blur = quality === 'POOR' ? 2.4 : quality === 'ACCEPTABLE' ? 0.9 : 0;
  const dim = quality === 'POOR' ? 0.72 : 1;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${variant === 'live' ? '#0f141d' : '#cfd5db'}"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="${blur}"/></filter>
    <clipPath id="frame"><rect x="0" y="0" width="200" height="240" rx="4"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="200" height="240" fill="url(#bg)"/>
    <g filter="url(#soft)" opacity="${dim}" transform="translate(${shift} 0)">
      <ellipse cx="100" cy="248" rx="86" ry="88" fill="${cloth}"/>
      <path d="M100 230 C64 230 52 208 52 190 L148 190 C148 208 136 230 100 230 Z" fill="${skinShade}"/>
      <ellipse cx="100" cy="118" rx="50" ry="60" fill="${skin}"/>
      <path d="M50 112 C50 74 70 54 100 54 C130 54 150 74 150 112 C150 96 138 84 100 84 C62 84 50 96 50 112 Z" fill="${hair}"/>
      <ellipse cx="82" cy="116" rx="5.5" ry="3.6" fill="#1c2028" opacity="0.85"/>
      <ellipse cx="118" cy="116" rx="5.5" ry="3.6" fill="#1c2028" opacity="0.85"/>
      <path d="M92 140 L100 146 L108 140" fill="none" stroke="${skinShade}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M86 162 Q100 170 114 162" fill="none" stroke="${skinShade}" stroke-width="3" stroke-linecap="round"/>
    </g>
    ${
      variant === 'live'
        ? '<rect width="200" height="240" fill="none" stroke="#38bdf8" stroke-opacity="0.28" stroke-width="2"/>'
        : ''
    }
  </g>
</svg>`;
  return toDataUri(svg);
}

/* -------------------------------------------------------------------------- */
/* Specimen passport / visa data page                                         */
/* -------------------------------------------------------------------------- */

export interface DocumentSvgOptions {
  documentType: 'PASSPORT' | 'VISA';
  surname: string;
  givenNames: string;
  dateOfBirth: string;
  nationality: string;
  documentNumber: string;
  sex: string;
  placeOfBirth: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
  mrzLines: string[];
  /** Draws faint splice/retouch artefacts for the tampered scenario. */
  tamperHints?: { dob?: boolean; photo?: boolean };
}

/**
 * A clearly-marked SPECIMEN data page. Layout follows ICAO 9303 zoning (visual
 * inspection zone above, machine-readable zone in a fixed-width band below) so
 * that region overlays land where an officer expects them.
 */
export function documentSvgDataUri(opts: DocumentSvgOptions): string {
  const {
    documentType,
    surname,
    givenNames,
    dateOfBirth,
    nationality,
    documentNumber,
    sex,
    placeOfBirth,
    issueDate,
    expiryDate,
    issuingAuthority,
    mrzLines,
    tamperHints,
  } = opts;

  const isVisa = documentType === 'VISA';
  const paper = isVisa ? '#e8eef3' : '#f0ece2';
  const paperEdge = isVisa ? '#cbd9e4' : '#ded7c6';
  const ink = '#1d2430';
  const inkSoft = '#5c6675';
  const accent = isVisa ? '#1b4f7a' : '#2f4f3a';
  const face = faceSvgDataUri({ seed: documentNumber, variant: 'document' });

  const field = (x: number, y: number, label: string, value: string, size = 13) => `
    <text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="7.5" letter-spacing="0.8" fill="${inkSoft}">${label}</text>
    <text x="${x}" y="${y + 13}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="600" letter-spacing="0.4" fill="${ink}">${value}</text>`;

  const mrz = mrzLines
    .map(
      (line, i) =>
        `<text x="34" y="${472 + i * 24}" font-family="'Courier New',Courier,monospace" font-size="17.5" letter-spacing="2.1" fill="${ink}">${line}</text>`,
    )
    .join('');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 500" width="760" height="500">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${paper}"/>
      <stop offset="1" stop-color="${paperEdge}"/>
    </linearGradient>
    <pattern id="guilloche" width="26" height="26" patternUnits="userSpaceOnUse">
      <path d="M0 13 Q6.5 0 13 13 T26 13" fill="none" stroke="${accent}" stroke-opacity="0.13" stroke-width="0.8"/>
      <path d="M0 20 Q6.5 7 13 20 T26 20" fill="none" stroke="${accent}" stroke-opacity="0.09" stroke-width="0.8"/>
    </pattern>
    <clipPath id="photoClip"><rect x="34" y="112" width="150" height="188" rx="3"/></clipPath>
  </defs>

  <rect width="760" height="500" fill="url(#paper)"/>
  <rect width="760" height="500" fill="url(#guilloche)"/>

  <!-- Header band -->
  <rect x="0" y="0" width="760" height="62" fill="${accent}" fill-opacity="0.9"/>
  <text x="34" y="27" font-family="Helvetica,Arial,sans-serif" font-size="11" letter-spacing="3.4" fill="#ffffff" fill-opacity="0.85">REPUBLIC OF ${nationality === 'IND' ? 'INDIA' : nationality}</text>
  <text x="34" y="48" font-family="Helvetica,Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="4.2" fill="#ffffff">${isVisa ? 'VISA' : 'PASSPORT'}</text>
  <text x="726" y="41" text-anchor="end" font-family="Helvetica,Arial,sans-serif" font-size="10" letter-spacing="2.6" fill="#ffffff" fill-opacity="0.7">SPECIMEN</text>

  <!-- Photograph -->
  <rect x="30" y="108" width="158" height="196" rx="4" fill="#ffffff" stroke="${inkSoft}" stroke-opacity="0.4"/>
  <g clip-path="url(#photoClip)"><image href="${face}" x="34" y="112" width="150" height="188" preserveAspectRatio="xMidYMid slice"/></g>
  ${
    tamperHints?.photo
      ? `<rect x="34" y="112" width="150" height="188" fill="none" stroke="#b91c1c" stroke-opacity="0.32" stroke-width="2" stroke-dasharray="5 4"/>
         <path d="M34 190 L184 184" stroke="#b91c1c" stroke-opacity="0.24" stroke-width="1.4"/>`
      : ''
  }
  <text x="34" y="320" font-family="Helvetica,Arial,sans-serif" font-size="7" letter-spacing="1.2" fill="${inkSoft}">HOLDER PHOTOGRAPH</text>

  <!-- Visual inspection zone -->
  ${field(224, 122, 'TYPE / TYPE', isVisa ? 'V' : 'P', 13)}
  ${field(300, 122, 'CODE / CODE', nationality, 13)}
  ${field(400, 122, `${isVisa ? 'VISA' : 'PASSPORT'} NO.`, documentNumber, 15)}

  ${field(224, 170, 'SURNAME / NOM', surname, 15)}
  ${field(224, 214, 'GIVEN NAMES / PRENOMS', givenNames, 15)}

  ${field(224, 258, 'NATIONALITY', nationality === 'IND' ? 'INDIAN' : nationality, 13)}
  ${field(400, 258, 'SEX / SEXE', sex, 13)}
  ${field(478, 258, 'DATE OF BIRTH', dateOfBirth, 13)}
  ${
    tamperHints?.dob
      ? `<rect x="472" y="248" width="132" height="26" fill="#fbbf24" fill-opacity="0.16" stroke="#b45309" stroke-opacity="0.4" stroke-width="1.2" stroke-dasharray="4 3"/>`
      : ''
  }

  ${field(224, 302, 'PLACE OF BIRTH', placeOfBirth, 12)}
  ${field(224, 346, 'DATE OF ISSUE', issueDate, 13)}
  ${field(400, 346, 'DATE OF EXPIRY', expiryDate, 13)}
  ${field(560, 346, 'AUTHORITY', issuingAuthority, 11)}

  <!-- Machine readable zone -->
  <rect x="0" y="440" width="760" height="60" fill="#ffffff" fill-opacity="0.62"/>
  <line x1="0" y1="440" x2="760" y2="440" stroke="${inkSoft}" stroke-opacity="0.35"/>
  ${mrz}
</svg>`;
  return toDataUri(svg);
}

/** Neutral placeholder used when an image is unavailable. */
export function placeholderDocumentDataUri(message = 'IMAGE UNAVAILABLE'): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 500" width="760" height="500">
  <rect width="760" height="500" fill="#11182a"/>
  <rect x="12" y="12" width="736" height="476" rx="8" fill="none" stroke="#243049" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="380" y="256" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="16" letter-spacing="3" fill="#5b6a80">${message}</text>
</svg>`;
  return toDataUri(svg);
}
