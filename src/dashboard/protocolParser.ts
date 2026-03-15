/**
 * ARM Protocol (.prt) file parser
 *
 * Parses the text export of ARM protocol files to extract:
 * - Protocol/Trial metadata
 * - Treatment table (including tank mixes with adjuvants)
 * - Plot dimensions and replications
 * - Study design
 * - Data collection requirements (assessment schedules, photo requirements)
 * - Objectives
 * - Crop information
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
}

export interface ParsedTreatment {
  number: number
  components: {
    type: string     // HERB, ADJ, CHK, FUNG, INSECT
    name: string     // product name (e.g. HM-2592)
    rate: number
    rateUnit: string // fl oz/a, % v/v, pt/a, etc.
    applCode: string // A, B, C
    applDescription: string // POST, PRE, etc.
  }[]
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

/**
 * Parse raw text content from an ARM .prt protocol file
 */
export function parseProtocolText(text: string): ParsedProtocol {
  const lines = text.split('\n').map(l => l.trim())

  // Extract sponsor (first large text line or header)
  const sponsor = extractBetween(text, '', 'Evaluation of') ??
    extractLine(lines, /^(.+?),?\s*(LLC|Inc|Corp)/i) ?? 'Unknown Sponsor'

  // Title
  const title = extractLine(lines, /^(Evaluation of .+)$/i) ??
    extractLine(lines, /^(Assessment of .+)$/i) ?? 'Untitled Protocol'

  // Protocol & Trial IDs
  const protocolId = extractField(text, 'Protocol ID') ?? ''
  const trialId = extractField(text, 'Trial ID') ?? protocolId
  const trialYear = parseInt(extractField(text, 'Trial Year') ?? new Date().getFullYear().toString())
  const studyDirector = extractField(text, 'Study Director')
  const sponsorContact = extractField(text, 'Sponsor Contact')
  const investigator = extractField(text, 'Investigator')

  // Plot dimensions
  const plotWidth = parseFloat(extractField(text, 'Treated Plot Width') ?? '10')
  const plotLength = parseFloat(extractField(text, 'Treated Plot Length') ?? '40')
  const reps = parseInt(extractField(text, 'Replications') ?? '4')

  // Study design
  const studyDesignMatch = text.match(/Study Design:\s*(\S+)\s+(.+?)(?:\n|$)/i)
  const studyDesign = studyDesignMatch ? `${studyDesignMatch[1]} ${studyDesignMatch[2]}`.trim() : 'RCB'

  // Crop
  const cropMatch = text.match(/Crop\s*1:\s*\w+\s+(\w+)\s+.+?\s+(.+?)$/m)
  const cropCode = cropMatch?.[1] ?? ''
  const cropType = cropMatch?.[2]?.trim() ?? extractCropFromTitle(title)
  const cropStageMatch = text.match(/Stage Scale:\s*(\w+)/i)
  const cropStageScale = cropStageMatch?.[1]

  // GLP/GEP
  const glp = /Conducted Under GLP:\s*Yes/i.test(text)
  const gep = /Conducted Under GEP:\s*Yes/i.test(text)

  // Objectives
  const objectives = extractObjectives(text)

  // Treatments
  const treatments = extractTreatments(text)

  // Data collection requirements
  const { assessmentSchedules, photoRequirements, dataDeadline } = extractDataRequirements(text)

  // Application details
  const appRateMatch = text.match(/Appl\.\s*Amount:\s*(.+?)(?:\s{2,}|$)/m)
  const mixSizeMatch = text.match(/Mix Size:\s*(.+?)(?:\s{2,}|\n|$)/m)

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
    applicationRate: appRateMatch?.[1]?.trim(),
    mixSize: mixSizeMatch?.[1]?.trim(),
  }
}

/**
 * Convert a parsed protocol into a DashboardTrial
 */
export function protocolToTrial(
  parsed: ParsedProtocol,
  clientId: string,
  seasonId: string,
): DashboardTrial {
  const trialId = `trial-${Date.now()}`

  // Convert parsed treatments to TreatmentDescription[]
  const treatmentDescriptions: TreatmentDescription[] = parsed.treatments.map(t => {
    const mainProduct = t.components.find(c => c.type !== 'ADJ' && c.type !== 'CHK')
    const isCheck = t.components.some(c => c.type === 'CHK')

    let description = ''
    if (isCheck) {
      description = 'Nontreated Control'
    } else {
      description = t.components
        .map(c => `${c.name} ${c.rate} ${c.rateUnit}`)
        .join(' + ')
    }

    return {
      number: t.number,
      name: isCheck ? 'Nontreated Check' : (mainProduct?.name ?? `Treatment ${t.number}`),
      description,
      product: mainProduct?.name,
      rate: mainProduct?.rate.toString(),
      rateUnit: mainProduct?.rateUnit,
    }
  })

  // Convert assessment schedules to assessment variables
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

  // Generate scheduled activities from assessment schedules
  const scheduledActivities: ScheduledActivity[] = []
  let actCounter = 0

  for (const sched of parsed.assessmentSchedules) {
    for (const timing of sched.timings) {
      actCounter++
      const anchorLabel = timing.anchor === 'DAE' ? 'emergence'
        : timing.anchor === 'DAT' ? 'treatment'
        : 'planting'

      const photoReq = sched.photoTimings?.some(pt => pt.days === timing.days && pt.anchor === timing.anchor)

      scheduledActivities.push({
        id: `prt-${trialId}-${actCounter}`,
        trialId,
        type: 'assessment' as ActivityType,
        description: `${sched.name} — ${timing.days} ${timing.anchor}`,
        scheduledDate: '', // will be calculated when anchor dates are set
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
        notes: `Blocked until ${timing.anchor === 'DAE' ? 'emergence' : timing.anchor === 'DAT' ? 'application' : 'planting'} date is set`,
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
    notes: `Imported from protocol: ${parsed.protocolId}\nSponsor: ${parsed.sponsor}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ─── Internal Parsing Helpers ─────────────────────────────────────────────────

function extractField(text: string, fieldName: string): string | undefined {
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
  // Get lines before 'end', take the last non-empty one
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
  // Match numbered objectives
  const numbered = content.matchAll(/\d+\.\s*(.+?)(?=\n\s*\d+\.|\n\s*$)/gs)
  for (const m of numbered) {
    objectives.push(m[1]!.replace(/\n/g, ' ').trim())
  }

  if (objectives.length === 0) {
    // Fallback: just grab non-empty lines
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length > 0) objectives.push(trimmed)
    }
  }

  return objectives
}

function extractTreatments(text: string): ParsedTreatment[] {
  const treatments: ParsedTreatment[] = []

  let currentTrt: ParsedTreatment | null = null

  const lines = text.split('\n')
  for (const line of lines) {
    // Check for untreated check
    const checkMatch = line.match(/^\s*(\d+)\s+CHK\s+(.+?)$/)
    if (checkMatch) {
      const trtNum = parseInt(checkMatch[1]!)
      if (currentTrt && currentTrt.number !== trtNum) {
        treatments.push(currentTrt)
      }
      currentTrt = {
        number: trtNum,
        components: [{
          type: 'CHK',
          name: checkMatch[2]!.trim(),
          rate: 0,
          rateUnit: '',
          applCode: '',
          applDescription: '',
        }],
      }
      continue
    }

    // Check for treatment/adjuvant line
    const trtMatch = line.match(/^\s*(\d+)?\s*(CHK|HERB|ADJ|FUNG|INSECT|PGR|FERT|SEED|NEM)\s+(\S+)\s+([\d.]+)\s+(fl oz\/a|pt\/a|lb\/a|oz\/a|qt\/a|gal\/a|g\/ha|mL\/ha|%\s*v\/v|%\s*w\/w)\s*(\w+)?\s*(POST|PRE|PPI|SEED|AT PLANT|PREPLANT)?/i)

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
        // New treatment number
        if (currentTrt) treatments.push(currentTrt)
        currentTrt = { number: trtNum, components: [component] }
      } else if (currentTrt) {
        // Continuation (adjuvant) — same treatment number
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

  // Data deadline
  const deadlineMatch = text.match(/DATA\s+Should\s+be\s+returned\s+by\s+(\w+\s+\d+(?:st|nd|rd|th)?)/i)
    ?? text.match(/data\s+(?:due|returned?\s+by)\s+(\w+\s+\d+)/i)
  if (deadlineMatch) {
    dataDeadline = deadlineMatch[1]
  }

  // Phytotoxicity schedule
  const phytoMatch = text.match(/(?:Crop\s+)?Phyto(?:toxicity|toxicty)\s*(?:\(.*?\))?\s*(?:should\s+be\s+)?(?:recorded|evaluated|rated)?\s*(?:at\s+)?([\d,\s]+and\s+\d+)\s+days?\s+after\s+(\w+)/i)
  if (phytoMatch) {
    const days = parseDaysList(phytoMatch[1]!)
    const anchor = phytoMatch[2]!.toLowerCase().includes('emerg') ? 'DAE' as const : 'DAP' as const
    schedules.push({
      name: 'Crop Phytotoxicity',
      type: 'phytotoxicity',
      timings: days.map(d => ({ days: d, anchor })),
      scale: '0-100%',
      description: 'Stunting, necrosis, or both',
    })
  }

  // Weed control schedule
  const weedMatch = text.match(/(?:Evaluate\s+)?weed\s+control\s*(?:at\s+)?([\d,\s]+and\s+\d+)\s+days?\s+after\s+(\w+)/i)
  if (weedMatch) {
    const days = parseDaysList(weedMatch[1]!)
    const anchor = weedMatch[2]!.toLowerCase().includes('treat') ? 'DAT' as const : 'DAP' as const
    schedules.push({
      name: 'Weed Control',
      type: 'weed_control',
      timings: days.map(d => ({ days: d, anchor })),
      scale: '0-100%',
      description: '0 = No reduction in weed cover, 100 = Complete reduction vs. nontreated check',
    })
  }

  // Photo requirements - phytotoxicity
  const phytoPhotoMatch = text.match(/Phyto(?:toxicity|toxicty)\s+photos?\s+(?:should\s+be\s+)?taken\s+.*?(?:at\s+)?([\d,\s]+(?:and\s+)?\d+)\s+days?\s+after\s+(\w+)/i)
  if (phytoPhotoMatch) {
    const days = parseDaysList(phytoPhotoMatch[1]!)
    const anchor = phytoPhotoMatch[2]!.toLowerCase().includes('emerg') ? 'DAE' as const : 'DAP' as const
    // Attach to phytotoxicity schedule
    const phytoSched = schedules.find(s => s.type === 'phytotoxicity')
    if (phytoSched) {
      phytoSched.photoTimings = days.map(d => ({ days: d, anchor }))
    }
    photoRequirements.push(`Phytotoxicity photos at ${days.join(', ')} ${anchor}`)
  }

  // Check for conditional photo requirement
  const conditionalMatch = text.match(/(?:If\s+)?no\s+phyto(?:toxicity|toxicty)\s+is\s+(?:observed|obeserved),?\s+photos?\s+(?:are|is)\s+not\s+needed/i)
  if (conditionalMatch) {
    const phytoSched = schedules.find(s => s.type === 'phytotoxicity')
    if (phytoSched) {
      phytoSched.photoConditional = 'If no phytotoxicity is observed, photos are not needed'
    }
  }

  // Photo requirements - weed control
  const weedPhotoMatch = text.match(/Weed\s+control\s+photos?\s+(?:should\s+be\s+)?taken\s+.*?(?:at\s+)?([\d,\s]+(?:and\s+)?\d+)\s+days?\s+after\s+(\w+)/i)
  if (weedPhotoMatch) {
    const days = parseDaysList(weedPhotoMatch[1]!)
    const anchor = weedPhotoMatch[2]!.toLowerCase().includes('treat') ? 'DAT' as const : 'DAP' as const
    const weedSched = schedules.find(s => s.type === 'weed_control')
    if (weedSched) {
      weedSched.photoTimings = days.map(d => ({ days: d, anchor }))
    }
    photoRequirements.push(`Weed control photos at ${days.join(', ')} ${anchor}`)
  }

  return { assessmentSchedules: schedules, photoRequirements, dataDeadline }
}

function parseDaysList(text: string): number[] {
  // Parse "3, 7, 10, 14, and 21" or "14, 28, 35, 42, and 56"
  return text
    .replace(/and\s+/gi, ', ')
    .split(/[,\s]+/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n))
}
