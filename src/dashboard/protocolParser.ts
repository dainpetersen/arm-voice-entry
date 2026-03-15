/**
 * ARM Protocol (.prt / .prt0) file parser
 *
 * Handles TWO formats:
 * 1. .prt0 — ARM's native binary format with UTF-16LE encoded strings,
 *    \x80\x00 field markers, and binary treatment record separators
 * 2. .prt / .txt — plain text protocol exports
 *
 * Extracts:
 * - Protocol/Trial metadata
 * - Treatment table (including tank mixes with adjuvants/additives)
 * - Plot dimensions and replications
 * - Study design
 * - Objectives
 * - Crop information
 * - Investigator / Study Director / Sponsor contacts
 * - Maintenance products (system-wide applications)
 * - Data collection requirements (assessment schedules, photo requirements)
 */

import type {
  DashboardTrial, TreatmentDescription, ScheduledActivity,
  AssessmentVariable, ActivityType,
} from './types'

export interface ParsedProtocol {
  protocolId: string
  trialId: string
  trialYear: number
  sponsor: string
  title: string
  studyDirector?: string
  sponsorContact?: string
  investigator?: string
  investigatorEmail?: string
  investigatorPhone?: string

  // Trial setup
  treatments: ParsedTreatment[]
  replications: number
  studyDesign: string
  plotWidthFt: number
  plotLengthFt: number

  // Crop
  cropType: string
  cropCode?: string
  cropStageScale?: string

  // Regulatory
  conductedUnderGLP: boolean
  conductedUnderGEP: boolean

  // Objectives
  objectives: string[]

  // Data collection
  dataDeadline?: string
  assessmentSchedules: ParsedAssessmentSchedule[]
  photoRequirements: string[]

  // Application details
  applicationRate?: string
  mixSize?: string

  // Maintenance products (applied across all treatments)
  maintenanceProducts: MaintenanceProduct[]

  // Study requirements (free text)
  studyRequirements?: string
}

export interface ParsedTreatment {
  number: number
  components: {
    type: string     // HERB, ADJ, CHK, FUNG, INSECT, FERT, ADDI
    name: string     // product name
    rate: number
    rateUnit: string // fl oz/a, % v/v, pt/a, etc.
    applCode: string // A, B, C
    applDescription: string // POST, PRE, PREPLA, V6, etc.
    formulation?: string    // 28-0-0, 12-0-0-26S, etc.
    nRate?: string          // e.g. "0.3 lbs. N per Bu."
  }[]
}

export interface MaintenanceProduct {
  type: string       // FERT, ADJ
  name: string
  rate: string
  rateUnit: string
  applCode: string
  description: string
  timing: string
}

export interface ParsedAssessmentSchedule {
  name: string
  type: 'phytotoxicity' | 'weed_control' | 'disease' | 'insect' | 'other'
  timings: { days: number; anchor: 'DAE' | 'DAT' | 'DAP' }[]
  scale?: string
  description: string
  photoTimings?: { days: number; anchor: 'DAE' | 'DAT' | 'DAP' }[]
  photoConditional?: string
}

// ─── Detection: binary .prt0 vs text .prt ─────────────────────────────────────

function isBinaryPrt(rawBytes: Uint8Array): boolean {
  // Binary .prt0 files start with "ARM 20xx.x" in ASCII
  const header = new TextDecoder('ascii').decode(rawBytes.slice(0, 20))
  if (/^ARM 20\d\d\.\d/.test(header)) return true
  return false
}

// ─── Binary Field Extractor ───────────────────────────────────────────────────

/**
 * Extract a UTF-16LE encoded field value from a .prt0 binary file.
 *
 * Field markers in .prt0 are:
 *   \x80 + byte + field code (2-4 ASCII chars) + space padding + UTF-16LE value
 *
 * The second byte is usually \x00 but can be \x28 '(' for some fields (e.g. CRA1).
 * Values are terminated by null bytes, next marker, or separator bytes.
 */
function extractBinaryFieldFromBytes(buf: Uint8Array, fieldCode: string): string | undefined {
  const codeBytes = [...fieldCode].map(c => c.charCodeAt(0))

  for (let i = 0; i < buf.length - 10; i++) {
    if (buf[i] !== 0x80) continue
    // Second byte can be \x00, \x08, \x20, \x28, or other control values
    const secondByte = buf[i + 1]!
    if (secondByte > 0x28) continue  // Must be a low control byte

    // Check if field code matches at position i+2
    let match = true
    for (let c = 0; c < codeBytes.length; c++) {
      if (buf[i + 2 + c] !== codeBytes[c]) { match = false; break }
    }
    if (!match) continue

    // Skip spaces after field code
    let j = i + 2 + codeBytes.length
    while (j < buf.length && buf[j] === 0x20) j++

    // Read UTF-16LE value
    let val = ''
    for (let k = 0; k < 200; k++) {
      const offset = j + k * 2
      if (offset + 1 >= buf.length) break
      const lo = buf[offset]!
      const hi = buf[offset + 1]!
      // Stop conditions
      if (lo === 0 && hi === 0) break
      if (lo === 0 && hi === 0x80) break // next field marker
      const ch = lo + hi * 256
      if (ch < 32 || ch > 126) break
      val += String.fromCharCode(ch)
    }

    if (val.length > 0) return val.trim()
  }

  return undefined
}

// ─── Binary Treatment Parser ──────────────────────────────────────────────────

interface RawTreatmentRecord {
  trtNum: number
  type: string
  fields: string[]  // all tab-separated fields
}

function extractBinaryTreatmentRecords(buf: Uint8Array): RawTreatmentRecord[] {
  const records: RawTreatmentRecord[] = []

  for (let i = 0; i < buf.length - 10; i++) {
    const lo = buf[i]!
    const hi = buf[i + 1]!

    // Look for: digit(00) tab(00) — treatment number followed by tab in UTF-16LE
    if (lo < 0x31 || lo > 0x39 || hi !== 0x00) continue  // '1'-'9'
    if (buf[i + 2] !== 0x09 || buf[i + 3] !== 0x00) continue  // tab

    // Verify this is preceded by separator bytes (FF, FE, 7F patterns)
    let hasSep = false
    for (let b = Math.max(0, i - 10); b < i; b++) {
      if (buf[b]! === 0xFF || buf[b]! === 0x7F || buf[b]! === 0xFE || buf[b]! === 0xF6) {
        hasSep = true
        break
      }
    }
    if (!hasSep) continue

    // Read the full record as UTF-16LE until next separator
    let val = ''
    for (let k = 0; k < 400; k++) {
      const offset = i + k * 2
      if (offset + 1 >= buf.length) break
      const rlo = buf[offset]!
      const rhi = buf[offset + 1]!
      const ch = rlo + rhi * 256
      // Stop at separator patterns
      if (ch === 0xFFFE || ch === 0xFFFF) break
      if (ch === 0x7F7F) break
      if (ch === 0) break
      if (ch === 0x09) val += '\t'
      else if (ch >= 32 && ch < 127) val += String.fromCharCode(ch)
    }

    if (val.length < 3) continue

    const fields = val.split('\t')
    const trtNum = parseInt(fields[0] || '')
    const type = (fields[1] || '').trim()

    if (!isNaN(trtNum) && type.length >= 2) {
      records.push({ trtNum, type, fields })
    }
  }

  return records
}

// ─── Binary .prt0 Parser ──────────────────────────────────────────────────────

function parseBinaryPrt(buf: Uint8Array): ParsedProtocol {
  // Line 1 = ARM version, Line 2 = title (plain ASCII)
  const headerText = new TextDecoder('ascii').decode(buf.slice(0, 2000))
  const headerLines = headerText.split(/\r?\n/)
  const titleLine = headerLines[1]?.trim() || ''

  // Extract fields using binary field markers
  const field = (code: string) => extractBinaryFieldFromBytes(buf, code)

  const binaryTitle = field('TT')
  const title = binaryTitle || titleLine || 'Untitled Protocol'
  const protocolId = field('#P') || ''
  const trialYear = parseInt(field('YR') || '') || new Date().getFullYear()

  // Investigator
  const investigator = field('H^') || field('IW1') || undefined
  const investigatorEmail = field('@M1') || undefined
  const investigatorPhone = field('MO1') || undefined

  // Plot dimensions
  const plotWidth = parseFloat(field('PW') || '10')
  const plotLength = parseFloat(field('PL') || '40')
  const reps = parseInt(field('#R') || '4')

  // Study design
  const designCode = field('ED') || ''
  const designDesc = field('E9') || ''
  // Clean trailing special chars from design code
  const cleanDesignCode = designCode.replace(/[^A-Za-z0-9 ]/g, '').trim()
  const studyDesign = designDesc || mapDesignCode(cleanDesignCode)

  // GLP / GEP
  const glpStr = field('GN') || 'N'
  const gepStr = field('GE') || 'N'

  // Crop
  const cropCode = field('CRA1') || ''
  const cropCommon = field('CGA1') || extractCropFromTitle(title)
  const cropStageScale = field('UIA1') || undefined
  const cropType = cropCommon || extractCropFromTitle(title)

  // Objectives
  const obj1 = field('OB1')
  const objectives = obj1 ? [obj1] : []

  // Contacts — look for role markers
  const studyDirectorName = field('IN1')
  const studyDirectorTitle = field('TN1')
  const studyDirector = studyDirectorName
    ? (studyDirectorTitle ? `${studyDirectorName} (${studyDirectorTitle})` : studyDirectorName)
    : undefined

  // Sponsor — try IN3 (sponsor contact name), TN3 (sponsor org), or infer from email domain
  const sponsorName = field('IN3') || field('TN3')
  let sponsor = sponsorName || ''
  if (!sponsor && investigatorEmail) {
    // Extract org name from email domain: "user@nutrien.com" → "Nutrien"
    const domainMatch = investigatorEmail.match(/@([^.]+)\./)
    if (domainMatch) {
      sponsor = domainMatch[1]!.charAt(0).toUpperCase() + domainMatch[1]!.slice(1)
    }
  }
  if (!sponsor) sponsor = studyDirectorTitle || 'Unknown Sponsor'

  // ── Treatments ──
  const rawRecords = extractBinaryTreatmentRecords(buf)
  const treatments = groupTreatmentRecords(rawRecords)

  // ── Maintenance products ──
  const maintenanceProducts = extractMaintenanceFromBytes(buf)

  // ── Study requirements ──
  const studyReqs = field('YE')
  const maintenanceNotes = field('YC')
  const applicationNotes = field('FZ')
  const studyRequirements = [studyReqs, maintenanceNotes, applicationNotes]
    .filter(Boolean)
    .join('\n\n')

  // ── Assessment schedules (from text if present) ──
  const { assessmentSchedules, photoRequirements, dataDeadline } =
    extractDataRequirements(studyRequirements)

  return {
    protocolId: protocolId.trim(),
    trialId: protocolId.trim(),
    trialYear,
    sponsor: sponsor.trim(),
    title: title.trim(),
    studyDirector,
    investigator,
    investigatorEmail,
    investigatorPhone,
    treatments,
    replications: isNaN(reps) ? 4 : reps,
    studyDesign,
    plotWidthFt: isNaN(plotWidth) ? 10 : plotWidth,
    plotLengthFt: isNaN(plotLength) ? 40 : plotLength,
    cropType,
    cropCode,
    cropStageScale,
    conductedUnderGLP: glpStr.toUpperCase().startsWith('Y'),
    conductedUnderGEP: gepStr.toUpperCase().startsWith('Y'),
    objectives,
    dataDeadline,
    assessmentSchedules,
    photoRequirements,
    maintenanceProducts,
    studyRequirements: studyRequirements || undefined,
  }
}

function mapDesignCode(code: string): string {
  const map: Record<string, string> = {
    'RACOBL': 'Randomized Complete Block (RCB)',
    'CRD': 'Completely Randomized Design',
    'SPLIT': 'Split Plot',
    'STRIP': 'Strip Plot',
    'LATINSQ': 'Latin Square',
  }
  return map[code.toUpperCase()] || code || 'RCB'
}

function groupTreatmentRecords(records: RawTreatmentRecord[]): ParsedTreatment[] {
  const treatments: ParsedTreatment[] = []
  let currentTrt: ParsedTreatment | null = null

  for (const rec of records) {
    const component = parseBinaryComponent(rec)
    if (!component) continue

    if (currentTrt && currentTrt.number === rec.trtNum) {
      currentTrt.components.push(component)
    } else {
      if (currentTrt) treatments.push(currentTrt)
      currentTrt = { number: rec.trtNum, components: [component] }
    }
  }

  if (currentTrt) treatments.push(currentTrt)
  return treatments
}

function parseBinaryComponent(rec: RawTreatmentRecord): ParsedTreatment['components'][0] | null {
  const { type, fields } = rec
  // FERT layout: [0]=trtNum, [1]=type, [2]=(blank), [3]=product, [4]=rate, [5]=unit, [6]=form, ...
  // ADDI layout: [0]=trtNum, [1]=type, [2]=(blank), [3]=product, [4..26]=(blank), [27]=rate, [28]=unit, [32]=applCode, [33]=applDesc, [35]=timing
  // CHK layout:  [0]=trtNum, [1]=type, [2]=(blank), [3..]=name parts

  if (type === 'CHK') {
    const name = fields.slice(2).map(f => f.trim()).filter(f => f.length > 0).join(' ')
    return {
      type: 'CHK',
      name: name || 'Nontreated Check',
      rate: 0,
      rateUnit: '',
      applCode: '',
      applDescription: '',
    }
  }

  const product = (fields[3] || '').trim()

  // For FERT, rate is at field 4; for ADDI, rate is later (field 27+)
  let rate = 0
  let rateUnit = ''
  let applCode = ''
  let applDescription = ''
  let formulation = ''
  let nRate = ''

  // First try fields 4-5 for rate/unit (FERT pattern)
  const earlyRate = parseFloat((fields[4] || '').trim())
  const earlyUnit = (fields[5] || '').trim()
  if (!isNaN(earlyRate) && earlyUnit.length > 0) {
    rate = earlyRate
    rateUnit = earlyUnit
  }

  // Scan all fields for the remaining info
  for (let j = 6; j < fields.length; j++) {
    const val = (fields[j] || '').trim()
    if (!val) continue

    // Formulation: "28-0-0" or "12-0-0-26S"
    if (/^\d+-\d+-\d+/.test(val) && !formulation) {
      formulation = val
      continue
    }

    // Tank Mix Indicator
    if (val === 'TKI') continue

    // Numeric value: could be rate (ADDI pattern) or N-rate
    if (/^\d+\.?\d*$/.test(val)) {
      const nextVal = (fields[j + 1] || '').trim()

      // N rate check first: number followed by "lbs. N per Bu." or similar
      if (nextVal && (/per\s+bu/i.test(nextVal) || /lbs.*N/i.test(nextVal))) {
        nRate = `${val} ${nextVal}`
        j++
        continue
      }

      // If we haven't found a rate yet (ADDI pattern), this is the product rate
      if (rate === 0 && nextVal) {
        if (nextVal.includes('/') || nextVal.includes('%') || nextVal === '+' || /^[A-Z]$/i.test(nextVal)) {
          rate = parseFloat(val)
          rateUnit = nextVal
          j++
          continue
        }
      }
    }

    // Single letter A-E = application code (but not if we already matched it as a unit)
    if (/^[A-E]$/.test(val) && !applCode && val !== rateUnit) {
      applCode = val
      continue
    }

    // Application description (multi-word string with lowercase letters)
    if (val.length > 3 && !applDescription && /[a-z]/.test(val)) {
      applDescription = val
      continue
    }

    // Timing codes
    if (/^(V\d|VT|R\d|PREPLA|POST|PRE|PPI|ATPLAN|VT-R\d)$/i.test(val)) {
      if (!applDescription) applDescription = val
      continue
    }
  }

  return {
    type,
    name: product || 'Unknown',
    rate,
    rateUnit,
    applCode,
    applDescription,
    formulation: formulation || undefined,
    nRate: nRate || undefined,
  }
}

function extractMaintenanceFromBytes(buf: Uint8Array): MaintenanceProduct[] {
  const products: MaintenanceProduct[] = []
  const field = (code: string) => extractBinaryFieldFromBytes(buf, code)

  for (let i = 1; i <= 20; i++) {
    const name = field(`T~${i}`)
    if (!name) break

    const type = field(`J^${i}`) || 'FERT'
    const rate = field(`RY${i}`) || ''
    const rateUnit = field(`RZ${i}`) || ''
    const timing = field(`FB${i}`) || ''
    const kDesc = field(`K^${i}`) || ''

    products.push({
      type,
      name,
      rate,
      rateUnit,
      applCode: String.fromCharCode(64 + i),
      description: timing || kDesc,
      timing,
    })
  }

  return products
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse raw content from an ARM protocol file.
 * Auto-detects binary .prt0 vs plain text .prt formats.
 *
 * For .prt0 files, pass the raw ArrayBuffer for best results.
 * Also accepts string input for backwards compatibility.
 */
export function parseProtocolText(input: string | ArrayBuffer): ParsedProtocol {
  if (input instanceof ArrayBuffer) {
    const bytes = new Uint8Array(input)
    if (isBinaryPrt(bytes)) {
      return parseBinaryPrt(bytes)
    }
    // Fall through to text parsing
    const text = new TextDecoder('utf-8').decode(bytes)
    return parseTextPrt(text)
  }

  // String input — check if it looks like binary content read as string
  // (this happens when file.text() is used on a binary .prt0 file)
  if (/^ARM 20\d\d\.\d/.test(input)) {
    // The file was read as text but is actually binary.
    // Use the text-based binary parser as a fallback.
    return parseBinaryPrtFromText(input)
  }

  return parseTextPrt(input)
}

/**
 * Parse a .prt0 file that was read as text via file.text().
 * The binary content gets UTF-8 decoded, which mangles some bytes but
 * the spaced text (null-byte separated ASCII) becomes "X\0Y\0Z\0" which
 * in UTF-8 shows as single chars with replacement characters.
 *
 * This fallback handles the case where the file was read as text instead
 * of as an ArrayBuffer.
 */
function parseBinaryPrtFromText(text: string): ParsedProtocol {
  // When file.text() reads a .prt0 file, null bytes between ASCII chars
  // get preserved as \0 characters in the string. We can use this.

  const lines = text.split(/\r?\n/)
  const title = lines[1]?.trim() || 'Untitled Protocol'

  // Helper: extract field by finding \x80\x00 + fieldCode + spaces + UTF-16LE value
  // In the text representation, \x80 becomes a special char and \x00 stays as null
  function extractFieldFromText(fieldCode: string): string | undefined {
    // The field code appears as ASCII chars after the marker
    // The value is UTF-16LE which becomes alternating char+\0 patterns
    const codeIdx = findFieldCodeInText(text, fieldCode)
    if (codeIdx < 0) return undefined

    // Skip spaces after field code
    let j = codeIdx + fieldCode.length
    while (j < text.length && text[j] === ' ') j++

    // Read UTF-16LE value: alternating printable char + null byte
    let val = ''
    for (let k = 0; k < 200; k++) {
      const pos = j + k * 2
      if (pos >= text.length) break
      const ch = text.charCodeAt(pos)
      const next = pos + 1 < text.length ? text.charCodeAt(pos + 1) : -1

      // Stop conditions
      if (ch === 0 && next === 0) break
      if (next === 0x80) break // next marker

      // Valid char: printable ASCII followed by null
      if (ch >= 32 && ch < 127 && (next === 0 || next === -1)) {
        val += String.fromCharCode(ch)
      } else if (ch >= 32 && ch < 127) {
        val += String.fromCharCode(ch)
      } else {
        break
      }
    }
    return val.trim() || undefined
  }

  function findFieldCodeInText(text: string, code: string): number {
    // Look for the pattern: high-byte + \0 + fieldCode
    for (let i = 0; i < text.length - code.length - 3; i++) {
      const charCode = text.charCodeAt(i)
      const nextCode = text.charCodeAt(i + 1)
      if (charCode === 0x80 && nextCode === 0) {
        // Check if field code follows at i+2
        let match = true
        for (let c = 0; c < code.length; c++) {
          if (text.charCodeAt(i + 2 + c) !== code.charCodeAt(c)) {
            match = false
            break
          }
        }
        if (match) return i + 2
      }
    }
    return -1
  }

  const protocolId = extractFieldFromText('#P') || ''
  const trialYear = parseInt(extractFieldFromText('YR') || '') || new Date().getFullYear()
  const investigator = extractFieldFromText('H^') || extractFieldFromText('IW1') || undefined
  const investigatorEmail = extractFieldFromText('@M1') || undefined
  const investigatorPhone = extractFieldFromText('MO1') || undefined
  const plotWidth = parseFloat(extractFieldFromText('PW') || '10')
  const plotLength = parseFloat(extractFieldFromText('PL') || '40')
  const reps = parseInt(extractFieldFromText('#R') || '4')
  const designDesc = extractFieldFromText('E9') || ''
  const designCode = (extractFieldFromText('ED') || '').replace(/[^A-Za-z0-9 ]/g, '')
  const studyDesign = designDesc || mapDesignCode(designCode)
  const glpStr = extractFieldFromText('GN') || 'N'
  const gepStr = extractFieldFromText('GE') || 'N'
  const cropCommon = extractFieldFromText('CGA1') || extractCropFromTitle(title)
  const cropCode = extractFieldFromText('CRA1') || ''
  const cropStageScale = extractFieldFromText('UIA1') || undefined
  const obj1 = extractFieldFromText('OB1')
  const studyDirectorName = extractFieldFromText('IN1')
  const studyDirectorTitle = extractFieldFromText('TN1')
  const studyDirector = studyDirectorName || undefined
  const sponsor = studyDirectorTitle || 'Unknown Sponsor'

  // For treatments from text-encoded binary, use the tab-separated spaced patterns
  const treatments = extractTreatmentsFromBinaryText(text)

  // Maintenance products
  const maintenanceProducts: MaintenanceProduct[] = []
  for (let i = 1; i <= 20; i++) {
    const name = extractFieldFromText(`T~${i}`)
    if (!name) break
    maintenanceProducts.push({
      type: extractFieldFromText(`J^${i}`) || 'FERT',
      name,
      rate: extractFieldFromText(`RY${i}`) || '',
      rateUnit: extractFieldFromText(`RZ${i}`) || '',
      applCode: String.fromCharCode(64 + i),
      description: extractFieldFromText(`FB${i}`) || '',
      timing: extractFieldFromText(`FB${i}`) || '',
    })
  }

  const studyReqs = extractFieldFromText('YE')
  const studyRequirements = studyReqs || undefined
  const { assessmentSchedules, photoRequirements, dataDeadline } =
    extractDataRequirements(studyRequirements || '')

  return {
    protocolId: protocolId.trim(),
    trialId: protocolId.trim(),
    trialYear,
    sponsor,
    title,
    studyDirector,
    investigator,
    investigatorEmail,
    investigatorPhone,
    treatments,
    replications: isNaN(reps) ? 4 : reps,
    studyDesign,
    plotWidthFt: isNaN(plotWidth) ? 10 : plotWidth,
    plotLengthFt: isNaN(plotLength) ? 40 : plotLength,
    cropType: cropCommon,
    cropCode,
    cropStageScale,
    conductedUnderGLP: glpStr.toUpperCase().startsWith('Y'),
    conductedUnderGEP: gepStr.toUpperCase().startsWith('Y'),
    objectives: obj1 ? [obj1] : [],
    dataDeadline,
    assessmentSchedules,
    photoRequirements,
    maintenanceProducts,
    studyRequirements,
  }
}

/**
 * Extract treatments from a .prt0 file that was read as text.
 * Treatment records are separated by sequences of replacement chars (U+FFFD)
 * and contain tab-separated fields where values are null-byte interleaved.
 */
function extractTreatmentsFromBinaryText(text: string): ParsedTreatment[] {
  const treatments: ParsedTreatment[] = []
  let currentTrt: ParsedTreatment | null = null

  // Split on the treatment separator pattern (sequences of U+FFFD or high bytes)
  const sepPattern = /[\uFFFD\x7F\xFE\xFF]{3,}/g
  const chunks = text.split(sepPattern)

  for (const chunk of chunks) {
    // Each chunk should start with: trtNum \t TYPE \t ...
    // But characters may be null-interleaved (UTF-16LE read as UTF-8)

    // Try to decode: strip null bytes to get plain text
    const decoded = chunk.replace(/\0/g, '')
    const trimmed = decoded.trim()

    // Match: starts with digit, then tab, then type code
    const match = trimmed.match(/^(\d)\t([A-Z]{2,5})\t(.*)$/s)
    if (!match) continue

    const trtNum = parseInt(match[1]!)
    const type = match[2]!.trim()
    const rest = match[3]!

    // Parse the tab-separated fields
    const fields = rest.split('\t').map(f => f.trim())

    // Build the component
    const component = parseBinaryTextComponent(type, fields)
    if (!component) continue

    if (currentTrt && currentTrt.number === trtNum) {
      currentTrt.components.push(component)
    } else {
      if (currentTrt) treatments.push(currentTrt)
      currentTrt = { number: trtNum, components: [component] }
    }
  }

  if (currentTrt) treatments.push(currentTrt)
  return treatments
}

function parseBinaryTextComponent(type: string, fields: string[]): ParsedTreatment['components'][0] | null {
  if (type === 'CHK') {
    const name = fields.filter(f => f.length > 0).join(' ') || 'Nontreated Check'
    return { type: 'CHK', name, rate: 0, rateUnit: '', applCode: '', applDescription: '' }
  }

  // fields: [0]=(blank), [1]=product, [2]=rate, [3]=unit, [4]=form, ...
  const product = fields[1] || fields[0] || 'Unknown'
  const rate = parseFloat(fields[2] || fields[1] || '0') || 0
  const rateUnit = fields[3] || ''

  let applCode = ''
  let applDescription = ''
  let formulation = ''

  for (let j = 4; j < fields.length; j++) {
    const val = fields[j] || ''
    if (!val) continue
    if (/^\d+-\d+-\d+/.test(val) && !formulation) { formulation = val; continue }
    if (/^[A-Z]$/.test(val) && !applCode) { applCode = val; continue }
    if (val.length > 3 && !applDescription && /[a-z]/i.test(val)) { applDescription = val; continue }
  }

  return {
    type,
    name: product,
    rate,
    rateUnit,
    applCode,
    applDescription,
    formulation: formulation || undefined,
  }
}

// ─── Plain Text Parser (original .prt/.txt) ──────────────────────────────────

function parseTextPrt(text: string): ParsedProtocol {
  const lines = text.split('\n').map(l => l.trim())

  const sponsor = extractBetween(text, '', 'Evaluation of') ??
    extractLine(lines, /^(.+?),?\s*(LLC|Inc|Corp)/i) ?? 'Unknown Sponsor'

  const title = extractLine(lines, /^(Evaluation of .+)$/i) ??
    extractLine(lines, /^(Assessment of .+)$/i) ?? 'Untitled Protocol'

  const protocolId = extractTextField(text, 'Protocol ID') ?? ''
  const trialId = extractTextField(text, 'Trial ID') ?? protocolId
  const trialYear = parseInt(extractTextField(text, 'Trial Year') ?? new Date().getFullYear().toString())
  const studyDirector = extractTextField(text, 'Study Director')
  const sponsorContact = extractTextField(text, 'Sponsor Contact')
  const investigator = extractTextField(text, 'Investigator')

  const plotWidth = parseFloat(extractTextField(text, 'Treated Plot Width') ?? '10')
  const plotLength = parseFloat(extractTextField(text, 'Treated Plot Length') ?? '40')
  const reps = parseInt(extractTextField(text, 'Replications') ?? '4')

  const studyDesignMatch = text.match(/Study Design:\s*(\S+)\s+(.+?)(?:\n|$)/i)
  const studyDesign = studyDesignMatch ? `${studyDesignMatch[1]} ${studyDesignMatch[2]}`.trim() : 'RCB'

  const cropMatch = text.match(/Crop\s*1:\s*\w+\s+(\w+)\s+.+?\s+(.+?)$/m)
  const cropCode = cropMatch?.[1] ?? ''
  const cropType = cropMatch?.[2]?.trim() ?? extractCropFromTitle(title)
  const cropStageMatch = text.match(/Stage Scale:\s*(\w+)/i)
  const cropStageScale = cropStageMatch?.[1]

  const glp = /Conducted Under GLP:\s*Yes/i.test(text)
  const gep = /Conducted Under GEP:\s*Yes/i.test(text)

  const objectives = extractObjectives(text)
  const treatments = extractTextTreatments(text)
  const { assessmentSchedules, photoRequirements, dataDeadline } = extractDataRequirements(text)

  return {
    protocolId: protocolId.trim(),
    trialId: trialId.trim(),
    trialYear: isNaN(trialYear) ? new Date().getFullYear() : trialYear,
    sponsor: sponsor.trim(),
    title: title.trim(),
    studyDirector: studyDirector?.trim(),
    sponsorContact: sponsorContact?.trim(),
    investigator: investigator?.trim(),
    treatments,
    replications: isNaN(reps) ? 4 : reps,
    studyDesign,
    plotWidthFt: isNaN(plotWidth) ? 10 : plotWidth,
    plotLengthFt: isNaN(plotLength) ? 40 : plotLength,
    cropType,
    cropCode,
    cropStageScale,
    conductedUnderGLP: glp,
    conductedUnderGEP: gep,
    objectives,
    dataDeadline,
    assessmentSchedules,
    photoRequirements,
    maintenanceProducts: [],
  }
}

// ─── Text Format Helpers ──────────────────────────────────────────────────────

function extractTextField(text: string, fieldName: string): string | undefined {
  const re = new RegExp(`${fieldName}[:\\s]+(.+?)(?:\\s{2,}|\\n|$)`, 'im')
  const m = text.match(re)
  return m?.[1]?.trim() || undefined
}

function extractLine(lines: string[], pattern: RegExp): string | undefined {
  for (const line of lines) {
    const m = line.match(pattern)
    if (m) return m[1] ?? m[0]
  }
  return undefined
}

function extractBetween(text: string, _start: string, end: string): string | undefined {
  const idx = text.indexOf(end)
  if (idx < 0) return undefined
  const before = text.slice(0, idx).split('\n').map(l => l.trim()).filter(l => l.length > 0)
  return before[before.length - 1]
}

function extractCropFromTitle(title: string): string {
  const crops = ['Corn', 'Seed Corn', 'Soybean', 'Wheat', 'Barley', 'Sugar Beet', 'Oats', 'Canola', 'Alfalfa', 'Sunflower', 'Cotton', 'Rice', 'Sorghum']
  for (const crop of crops) {
    if (title.toLowerCase().includes(crop.toLowerCase())) return crop
  }
  return 'Unknown'
}

function extractObjectives(text: string): string[] {
  const objectives: string[] = []
  const objSection = text.match(/Objectives:\s*\n([\s\S]*?)(?=\n\s*(?:Crop Description|Trial Establishment|Data to Collect|$))/i)
  if (!objSection) return objectives

  const content = objSection[1]!
  const numbered = content.matchAll(/\d+\.\s*(.+?)(?=\n\s*\d+\.|\n\s*$)/gs)
  for (const m of numbered) {
    objectives.push(m[1]!.replace(/\n/g, ' ').trim())
  }

  if (objectives.length === 0) {
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length > 0) objectives.push(trimmed)
    }
  }

  return objectives
}

function extractTextTreatments(text: string): ParsedTreatment[] {
  const treatments: ParsedTreatment[] = []
  let currentTrt: ParsedTreatment | null = null

  const lines = text.split('\n')
  for (const line of lines) {
    const checkMatch = line.match(/^\s*(\d+)\s+CHK\s+(.+?)$/)
    if (checkMatch) {
      const trtNum = parseInt(checkMatch[1]!)
      if (currentTrt && currentTrt.number !== trtNum) treatments.push(currentTrt)
      currentTrt = {
        number: trtNum,
        components: [{
          type: 'CHK', name: checkMatch[2]!.trim(),
          rate: 0, rateUnit: '', applCode: '', applDescription: '',
        }],
      }
      continue
    }

    const trtMatch = line.match(/^\s*(\d+)?\s*(CHK|HERB|ADJ|FUNG|INSECT|PGR|FERT|SEED|NEM|ADDI)\s+(\S+)\s+([\d.]+)\s+(fl oz\/a|pt\/a|lb\/a|oz\/a|qt\/a|gal\/a|g\/ha|mL\/ha|%\s*v\/v|%\s*w\/w)\s*(\w+)?\s*(POST|PRE|PPI|SEED|AT PLANT|PREPLANT)?/i)

    if (trtMatch) {
      const trtNum = trtMatch[1] ? parseInt(trtMatch[1]) : undefined
      const component = {
        type: trtMatch[2]!.toUpperCase(),
        name: trtMatch[3]!.trim(),
        rate: parseFloat(trtMatch[4]!),
        rateUnit: trtMatch[5]!.trim(),
        applCode: trtMatch[6]?.trim() ?? 'A',
        applDescription: trtMatch[7]?.trim() ?? '',
      }

      if (trtNum !== undefined) {
        if (currentTrt) treatments.push(currentTrt)
        currentTrt = { number: trtNum, components: [component] }
      } else if (currentTrt) {
        currentTrt.components.push(component)
      }
    }
  }

  if (currentTrt) treatments.push(currentTrt)
  return treatments
}

function extractDataRequirements(text: string): {
  assessmentSchedules: ParsedAssessmentSchedule[]
  photoRequirements: string[]
  dataDeadline?: string
} {
  const schedules: ParsedAssessmentSchedule[] = []
  const photoRequirements: string[] = []
  let dataDeadline: string | undefined

  const deadlineMatch = text.match(/DATA\s+Should\s+be\s+returned\s+by\s+(\w+\s+\d+(?:st|nd|rd|th)?)/i)
    ?? text.match(/data\s+(?:due|returned?\s+by)\s+(\w+\s+\d+)/i)
  if (deadlineMatch) dataDeadline = deadlineMatch[1]

  const phytoMatch = text.match(/(?:Crop\s+)?Phyto(?:toxicity|toxicty)\s*(?:\(.*?\))?\s*(?:should\s+be\s+)?(?:recorded|evaluated|rated)?\s*(?:at\s+)?([\d,\s]+and\s+\d+)\s+days?\s+after\s+(\w+)/i)
  if (phytoMatch) {
    const days = parseDaysList(phytoMatch[1]!)
    const anchor = phytoMatch[2]!.toLowerCase().includes('emerg') ? 'DAE' as const : 'DAP' as const
    schedules.push({
      name: 'Crop Phytotoxicity', type: 'phytotoxicity',
      timings: days.map(d => ({ days: d, anchor })),
      scale: '0-100%', description: 'Stunting, necrosis, or both',
    })
  }

  const weedMatch = text.match(/(?:Evaluate\s+)?weed\s+control\s*(?:at\s+)?([\d,\s]+and\s+\d+)\s+days?\s+after\s+(\w+)/i)
  if (weedMatch) {
    const days = parseDaysList(weedMatch[1]!)
    const anchor = weedMatch[2]!.toLowerCase().includes('treat') ? 'DAT' as const : 'DAP' as const
    schedules.push({
      name: 'Weed Control', type: 'weed_control',
      timings: days.map(d => ({ days: d, anchor })),
      scale: '0-100%', description: '0 = No reduction, 100 = Complete reduction vs. nontreated check',
    })
  }

  const phytoPhotoMatch = text.match(/Phyto(?:toxicity|toxicty)\s+photos?\s+(?:should\s+be\s+)?taken\s+.*?(?:at\s+)?([\d,\s]+(?:and\s+)?\d+)\s+days?\s+after\s+(\w+)/i)
  if (phytoPhotoMatch) {
    const days = parseDaysList(phytoPhotoMatch[1]!)
    const anchor = phytoPhotoMatch[2]!.toLowerCase().includes('emerg') ? 'DAE' as const : 'DAP' as const
    const phytoSched = schedules.find(s => s.type === 'phytotoxicity')
    if (phytoSched) phytoSched.photoTimings = days.map(d => ({ days: d, anchor }))
    photoRequirements.push(`Phytotoxicity photos at ${days.join(', ')} ${anchor}`)
  }

  const conditionalMatch = text.match(/(?:If\s+)?no\s+phyto(?:toxicity|toxicty)\s+is\s+(?:observed|obeserved),?\s+photos?\s+(?:are|is)\s+not\s+needed/i)
  if (conditionalMatch) {
    const phytoSched = schedules.find(s => s.type === 'phytotoxicity')
    if (phytoSched) phytoSched.photoConditional = 'If no phytotoxicity is observed, photos are not needed'
  }

  return { assessmentSchedules: schedules, photoRequirements, dataDeadline }
}

function parseDaysList(text: string): number[] {
  return text.replace(/and\s+/gi, ', ').split(/[,\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n))
}

// ─── Converter: ParsedProtocol → DashboardTrial ──────────────────────────────

export function protocolToTrial(
  parsed: ParsedProtocol,
  clientId: string,
  seasonId: string,
): DashboardTrial {
  const trialId = `trial-${Date.now()}`

  const treatmentDescriptions: TreatmentDescription[] = parsed.treatments.map(t => {
    const mainProduct = t.components.find(c => c.type !== 'ADJ' && c.type !== 'CHK' && c.type !== 'ADDI')
    const isCheck = t.components.some(c => c.type === 'CHK')

    let description = ''
    if (isCheck) {
      description = t.components[0]?.name || 'Nontreated Control'
    } else {
      description = t.components
        .map(c => {
          const ratePart = c.rate ? ` ${c.rate} ${c.rateUnit}` : ''
          return `${c.name}${ratePart}`
        })
        .join(' + ')
    }

    return {
      number: t.number,
      name: isCheck ? 'Nontreated Check' : (mainProduct?.name ?? `Treatment ${t.number}`),
      description,
      product: mainProduct?.name,
      rate: mainProduct?.rate?.toString(),
      rateUnit: mainProduct?.rateUnit,
    }
  })

  const assessmentVariables: AssessmentVariable[] = parsed.assessmentSchedules.map((sched, i) => ({
    id: `var-${i}`,
    name: sched.name,
    scaleType: 'percent' as const,
    scaleMin: 0,
    scaleMax: 100,
    scaleUnit: '%',
    description: sched.description,
    compareToCheck: sched.type === 'weed_control',
  }))

  const scheduledActivities: ScheduledActivity[] = []
  let actCounter = 0

  for (const sched of parsed.assessmentSchedules) {
    for (const timing of sched.timings) {
      actCounter++
      const anchorLabel = timing.anchor === 'DAE' ? 'emergence'
        : timing.anchor === 'DAT' ? 'treatment' : 'planting'

      const photoReq = sched.photoTimings?.some(pt => pt.days === timing.days && pt.anchor === timing.anchor)

      scheduledActivities.push({
        id: `prt-${trialId}-${actCounter}`,
        trialId,
        type: 'assessment' as ActivityType,
        description: `${sched.name} — ${timing.days} ${timing.anchor}`,
        scheduledDate: '',
        status: 'scheduled',
        offsetAnchor: anchorLabel,
        offsetDays: timing.days,
        assessmentVariables: [{
          id: `var-${sched.type}`,
          name: sched.name,
          scaleType: 'percent',
          scaleMin: 0,
          scaleMax: 100,
          scaleUnit: '%',
          description: sched.description,
          compareToCheck: sched.type === 'weed_control',
        }],
        photoRequirement: photoReq ? {
          required: true,
          description: 'Full plot photo from most representative rep',
          scope: 'per_rep',
          conditional: sched.photoConditional,
        } : undefined,
        notes: `Blocked until ${anchorLabel} date is set`,
      })
    }
  }

  return {
    id: trialId,
    protocolCode: parsed.protocolId || parsed.trialId,
    name: parsed.title,
    clientId,
    seasonId,
    cropType: parsed.cropType,
    status: 'draft',
    treatments: parsed.treatments.length,
    replications: parsed.replications,
    treatmentDescriptions,
    plotIds: [],
    currency: 'USD',
    plotWidthFt: parsed.plotWidthFt,
    plotLengthFt: parsed.plotLengthFt,
    studyDesign: parsed.studyDesign,
    objectives: parsed.objectives,
    cropCode: parsed.cropCode,
    cropStageScale: parsed.cropStageScale,
    conductedUnderGLP: parsed.conductedUnderGLP,
    conductedUnderGEP: parsed.conductedUnderGEP,
    assessmentVariables,
    dataReturnDeadline: parsed.dataDeadline,
    scheduledActivities,
    notes: [
      `Imported from protocol: ${parsed.protocolId}`,
      parsed.sponsor ? `Sponsor: ${parsed.sponsor}` : '',
      parsed.investigator ? `Investigator: ${parsed.investigator}` : '',
      parsed.investigatorEmail ? `Email: ${parsed.investigatorEmail}` : '',
      parsed.investigatorPhone ? `Phone: ${parsed.investigatorPhone}` : '',
    ].filter(Boolean).join('\n'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
