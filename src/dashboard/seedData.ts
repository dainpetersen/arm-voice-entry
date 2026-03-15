import type { DashboardData, Client, DashboardTrial, Field, Plot, Season, TreatmentDescription, ScheduledActivity, ActivityType, TrialStatus } from './types'

// Farm center: near St Cloud, MN
const FARM_LAT = 45.5707
const FARM_LNG = -94.0621

const CLIENTS: Omit<Client, 'id' | 'createdAt'>[] = [
  { name: 'Syngenta', contactName: 'Sarah Mitchell', contactEmail: 'sarah.mitchell@syngenta.com', contactPhone: '(320) 555-1201', address: '3500 Paramount Pkwy, Morrisville, NC' },
  { name: 'BASF Ag Solutions', contactName: 'Tom Keller', contactEmail: 'tom.keller@basf.com', contactPhone: '(320) 555-1202', address: '26 Davis Dr, Research Triangle Park, NC' },
  { name: 'Corteva Agriscience', contactName: 'Lisa Chen', contactEmail: 'lisa.chen@corteva.com', contactPhone: '(320) 555-1203', address: '9330 Zionsville Rd, Indianapolis, IN' },
  { name: 'Bayer CropScience', contactName: 'Mark Johansen', contactEmail: 'mark.johansen@bayer.com', contactPhone: '(320) 555-1204', address: '800 N Lindbergh Blvd, St. Louis, MO' },
  { name: 'FMC Corporation', contactName: 'Rachel Torres', contactEmail: 'rachel.torres@fmc.com', contactPhone: '(320) 555-1205', address: '2929 Walnut St, Philadelphia, PA' },
  { name: 'AMVAC Chemical', contactName: 'Dave Larson', contactEmail: 'dave.larson@amvac.com', contactPhone: '(320) 555-1206', address: '4695 MacArthur Ct, Newport Beach, CA' },
  { name: 'Nufarm Americas', contactName: 'Jennifer Park', contactEmail: 'jennifer.park@nufarm.com', contactPhone: '(320) 555-1207', address: '11901 S Austin Ave, Alsip, IL' },
  { name: 'Valent USA', contactName: 'Brian Olson', contactEmail: 'brian.olson@valent.com', contactPhone: '(320) 555-1208', address: '1600 Riviera Ave, Walnut Creek, CA' },
  { name: 'UPL Ltd', contactName: 'Priya Sharma', contactEmail: 'priya.sharma@upl-ltd.com', contactPhone: '(320) 555-1209', address: '630 Freedom Business Ctr, King of Prussia, PA' },
  { name: 'Winfield United', contactName: 'Mike Petersen', contactEmail: 'mike.petersen@winfield.com', contactPhone: '(320) 555-1210', address: '1080 County Rd F, Shoreview, MN' },
]

const TRIAL_NAMES: { name: string; crop: string; status: TrialStatus; treatments: number; reps: number; contractValue: number; estimatedCost: number }[] = [
  { name: 'Corn Herbicide Efficacy', crop: 'Corn', status: 'active', treatments: 6, reps: 4, contractValue: 18000, estimatedCost: 12500 },
  { name: 'Soybean Fungicide Timing', crop: 'Soybean', status: 'active', treatments: 4, reps: 4, contractValue: 14000, estimatedCost: 9800 },
  { name: 'Wheat Variety Trial', crop: 'Wheat', status: 'active', treatments: 8, reps: 3, contractValue: 22000, estimatedCost: 15000 },
  { name: 'Corn Insecticide Evaluation', crop: 'Corn', status: 'planned', treatments: 5, reps: 4, contractValue: 16500, estimatedCost: 11200 },
  { name: 'Soybean Herbicide Resistance', crop: 'Soybean', status: 'active', treatments: 6, reps: 3, contractValue: 19000, estimatedCost: 13400 },
  { name: 'Sugar Beet Nematicide', crop: 'Sugar Beet', status: 'active', treatments: 4, reps: 4, contractValue: 15000, estimatedCost: 10500 },
  { name: 'Corn Nitrogen Rate Study', crop: 'Corn', status: 'planned', treatments: 7, reps: 3, contractValue: 12000, estimatedCost: 8900 },
  { name: 'Soybean Seed Treatment', crop: 'Soybean', status: 'draft', treatments: 5, reps: 4, contractValue: 13500, estimatedCost: 9200 },
  { name: 'Barley Foliar Disease', crop: 'Barley', status: 'active', treatments: 4, reps: 4, contractValue: 11000, estimatedCost: 7800 },
  { name: 'Corn Growth Regulator', crop: 'Corn', status: 'completed', treatments: 3, reps: 4, contractValue: 9500, estimatedCost: 6800 },
  { name: 'Soybean Iron Chlorosis', crop: 'Soybean', status: 'active', treatments: 5, reps: 3, contractValue: 14500, estimatedCost: 10100 },
  { name: 'Wheat Fungicide Efficacy', crop: 'Wheat', status: 'planned', treatments: 6, reps: 4, contractValue: 17000, estimatedCost: 11800 },
  { name: 'Corn Pre-Emerge Herbicide', crop: 'Corn', status: 'active', treatments: 8, reps: 3, contractValue: 21000, estimatedCost: 14500 },
  { name: 'Sunflower Sclerotinia', crop: 'Sunflower', status: 'draft', treatments: 4, reps: 4, contractValue: 10000, estimatedCost: 7200 },
  { name: 'Sugar Beet Cercospora', crop: 'Sugar Beet', status: 'active', treatments: 5, reps: 4, contractValue: 16000, estimatedCost: 11000 },
  { name: 'Alfalfa Weevil Control', crop: 'Alfalfa', status: 'completed', treatments: 3, reps: 4, contractValue: 8500, estimatedCost: 6100 },
  { name: 'Corn Rootworm Trait Eval', crop: 'Corn', status: 'active', treatments: 4, reps: 4, contractValue: 20000, estimatedCost: 13800 },
  { name: 'Soybean White Mold', crop: 'Soybean', status: 'planned', treatments: 5, reps: 3, contractValue: 13000, estimatedCost: 9400 },
  { name: 'Oat Crown Rust', crop: 'Oats', status: 'draft', treatments: 4, reps: 3, contractValue: 9000, estimatedCost: 6500 },
  { name: 'Corn Tar Spot Fungicide', crop: 'Corn', status: 'active', treatments: 6, reps: 4, contractValue: 18500, estimatedCost: 12800 },
  { name: 'Canola Blackleg Resistance', crop: 'Canola', status: 'planned', treatments: 5, reps: 3, contractValue: 12500, estimatedCost: 8700 },
  { name: 'Soybean Aphid Threshold', crop: 'Soybean', status: 'invoiced', treatments: 4, reps: 4, contractValue: 11500, estimatedCost: 8000 },
  { name: 'Wheat Head Scab', crop: 'Wheat', status: 'active', treatments: 5, reps: 4, contractValue: 15500, estimatedCost: 10800 },
  { name: 'Corn Foliar Fertilizer', crop: 'Corn', status: 'completed', treatments: 3, reps: 4, contractValue: 7500, estimatedCost: 5400 },
  { name: 'Sugar Beet Herbicide Tank Mix', crop: 'Sugar Beet', status: 'active', treatments: 6, reps: 3, contractValue: 17500, estimatedCost: 12200 },
  { name: 'Soybean Biological Seed Treat', crop: 'Soybean', status: 'draft', treatments: 4, reps: 4, contractValue: 10500, estimatedCost: 7600 },
  { name: 'Corn Dicamba Tolerance', crop: 'Corn', status: 'invoiced', treatments: 5, reps: 4, contractValue: 19500, estimatedCost: 13500 },
  { name: 'Barley Stripe Rust', crop: 'Barley', status: 'planned', treatments: 4, reps: 3, contractValue: 10000, estimatedCost: 7100 },
  { name: 'Soybean Sudden Death Syndrome', crop: 'Soybean', status: 'active', treatments: 5, reps: 4, contractValue: 16500, estimatedCost: 11500 },
  { name: 'Corn Stalk Rot Resistance', crop: 'Corn', status: 'planned', treatments: 4, reps: 4, contractValue: 13000, estimatedCost: 9000 },
]

const HERBICIDE_PRODUCTS = ['Acuron', 'Halex GT', 'Resicore', 'SureStart II', 'Verdict', 'Authority Elite', 'Engenia', 'Tavium', 'Warrant', 'Zidua']
const FUNGICIDE_PRODUCTS = ['Miravis Neo', 'Trivapro', 'Delaro Complete', 'Revytek', 'Veltyma', 'Aproach Prima', 'Headline AMP', 'Priaxor']
const INSECTICIDE_PRODUCTS = ['Prevathon', 'Besiege', 'Warrior II', 'Fastac CS', 'Hero', 'Stallion']

function pickProduct(trialName: string): string[] {
  if (trialName.toLowerCase().includes('herbicide') || trialName.toLowerCase().includes('pre-emerge') || trialName.toLowerCase().includes('dicamba')) return HERBICIDE_PRODUCTS
  if (trialName.toLowerCase().includes('fungicide') || trialName.toLowerCase().includes('rust') || trialName.toLowerCase().includes('scab') || trialName.toLowerCase().includes('mold') || trialName.toLowerCase().includes('cercospora') || trialName.toLowerCase().includes('sclerotinia') || trialName.toLowerCase().includes('blackleg') || trialName.toLowerCase().includes('tar spot')) return FUNGICIDE_PRODUCTS
  if (trialName.toLowerCase().includes('insect') || trialName.toLowerCase().includes('rootworm') || trialName.toLowerCase().includes('aphid') || trialName.toLowerCase().includes('weevil')) return INSECTICIDE_PRODUCTS
  return ['Treatment Product A', 'Treatment Product B', 'Treatment Product C']
}


function generateFields(): Field[] {
  // Create 6 fields around the farm center
  const fields: { name: string; offsetLat: number; offsetLng: number; sizeAcres: number }[] = [
    { name: 'North 40', offsetLat: 0.006, offsetLng: -0.002, sizeAcres: 42 },
    { name: 'South Quarter', offsetLat: -0.005, offsetLng: -0.001, sizeAcres: 38 },
    { name: 'East Field', offsetLat: 0.001, offsetLng: 0.006, sizeAcres: 35 },
    { name: 'West Bottom', offsetLat: -0.001, offsetLng: -0.008, sizeAcres: 28 },
    { name: 'Home Quarter', offsetLat: 0.002, offsetLng: 0.001, sizeAcres: 45 },
    { name: 'River Field', offsetLat: -0.007, offsetLng: 0.004, sizeAcres: 32 },
  ]

  return fields.map((f, i) => {
    const lat = FARM_LAT + f.offsetLat
    const lng = FARM_LNG + f.offsetLng
    const halfW = 0.0015
    const halfH = 0.001
    return {
      id: `field-${i + 1}`,
      farmId: 'farm-1',
      name: f.name,
      boundary: [
        [lng - halfW, lat - halfH],
        [lng + halfW, lat - halfH],
        [lng + halfW, lat + halfH],
        [lng - halfW, lat + halfH],
        [lng - halfW, lat - halfH],
      ],
      areaSqMeters: f.sizeAcres * 4046.86,
      createdAt: Date.now() - 86400000 * 60,
    }
  })
}

function generateActivities(trialId: string, status: TrialStatus): ScheduledActivity[] {
  if (status === 'draft') return []
  const activities: ScheduledActivity[] = []
  const baseDate = new Date('2026-04-15')

  const types: { type: ActivityType; desc: string; dayOffset: number }[] = [
    { type: 'soil_sampling', desc: 'Pre-plant soil sampling', dayOffset: -10 },
    { type: 'planting', desc: 'Plant trial plots', dayOffset: 0 },
    { type: 'spray_application', desc: 'Pre-emerge application', dayOffset: 3 },
    { type: 'assessment', desc: 'Emergence assessment', dayOffset: 14 },
    { type: 'fertilizer_application', desc: 'Side-dress nitrogen', dayOffset: 35 },
    { type: 'spray_application', desc: 'Post-emerge application', dayOffset: 21 },
    { type: 'assessment', desc: 'Mid-season assessment', dayOffset: 60 },
    { type: 'assessment', desc: 'Pre-harvest assessment', dayOffset: 120 },
    { type: 'harvest', desc: 'Harvest trial plots', dayOffset: 140 },
  ]

  for (const t of types) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + t.dayOffset)
    const dateStr = date.toISOString().split('T')[0]!
    const today = new Date().toISOString().split('T')[0]!
    const isCompleted = status === 'completed' || status === 'invoiced' || dateStr < today
    const isOverdue = !isCompleted && dateStr < today

    activities.push({
      id: `act-${trialId}-${t.dayOffset}`,
      trialId,
      type: t.type,
      description: t.desc,
      scheduledDate: dateStr,
      completedDate: isCompleted ? dateStr : undefined,
      status: isCompleted ? 'completed' : isOverdue ? 'overdue' : 'scheduled',
      daysAfterPlanting: t.dayOffset,
    })
  }

  return activities
}

export function generateSeedData(): DashboardData {
  const season: Season = {
    id: 'season-2026',
    year: 2026,
    name: 'Season 2026',
    startDate: '2026-03-01',
    endDate: '2026-11-30',
    createdAt: Date.now() - 86400000 * 30,
  }

  const clients: Client[] = CLIENTS.map((c, i) => ({
    ...c,
    id: `client-${i + 1}`,
    createdAt: Date.now() - 86400000 * (60 - i),
  }))

  const fields = generateFields()

  const trials: DashboardTrial[] = TRIAL_NAMES.map((t, i) => {
    const clientIndex = i % clients.length
    const fieldIndex = i % fields.length
    const products = pickProduct(t.name)

    const treatmentDescriptions: TreatmentDescription[] = Array.from({ length: t.treatments }, (_, j) => ({
      number: j + 1,
      name: j === 0 ? 'Untreated Check' : `Treatment ${j + 1}`,
      description: j === 0 ? 'No application' : `${products[j % products.length]} applied at label rate`,
      product: j === 0 ? undefined : products[j % products.length],
      rate: j === 0 ? undefined : `${(Math.random() * 20 + 4).toFixed(1)}`,
      rateUnit: j === 0 ? undefined : 'oz/ac',
    }))

    const trialId = `trial-${i + 1}`
    const plantingDate = `2026-04-${String(10 + (i % 20)).padStart(2, '0')}`
    const harvestDate = `2026-09-${String(5 + (i % 25)).padStart(2, '0')}`

    return {
      id: trialId,
      protocolCode: `CRO-2026-${String(100 + i).padStart(3, '0')}`,
      name: t.name,
      clientId: clients[clientIndex]!.id,
      seasonId: 'season-2026',
      cropType: t.crop,
      status: t.status,
      treatments: t.treatments,
      replications: t.reps,
      treatmentDescriptions,
      fieldId: fields[fieldIndex]!.id,
      plotIds: [],
      contractValue: t.contractValue,
      estimatedCost: t.estimatedCost,
      currency: 'USD',
      plantingDate,
      harvestDate,
      contractStartDate: '2026-03-01',
      contractEndDate: '2026-11-30',
      scheduledActivities: generateActivities(trialId, t.status),
      notes: undefined,
      createdAt: Date.now() - 86400000 * (30 - i),
      updatedAt: Date.now() - 86400000 * (15 - (i % 15)),
    }
  })

  // Generate some plots for the first few fields
  const plots: Plot[] = []
  let plotCounter = 0
  for (let fi = 0; fi < 3; fi++) {
    const field = fields[fi]!
    const fieldTrials = trials.filter(t => t.fieldId === field.id)
    if (fieldTrials.length === 0) continue

    const trial = fieldTrials[0]!
    const [lng0, lat0] = field.boundary[0]!
    const [lng2, lat2] = field.boundary[2]!
    const cols = trial.treatments
    const rows = trial.replications
    const cellW = (lng2 - lng0) / cols
    const cellH = (lat2 - lat0) / rows

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        plotCounter++
        const pLng = lng0 + c * cellW
        const pLat = lat0 + r * cellH
        plots.push({
          id: `plot-${plotCounter}`,
          fieldId: field.id,
          seasonId: 'season-2026',
          trialId: trial.id,
          label: `${trial.protocolCode}-R${r + 1}T${c + 1}`,
          boundary: [
            [pLng, pLat],
            [pLng + cellW, pLat],
            [pLng + cellW, pLat + cellH],
            [pLng, pLat + cellH],
            [pLng, pLat],
          ],
          treatmentNumber: c + 1,
          replicationNumber: r + 1,
          createdAt: Date.now() - 86400000 * 20,
        })
      }
    }

    // Update trial plotIds
    trial.plotIds = plots.filter(p => p.trialId === trial.id).map(p => p.id)
  }

  return {
    farm: {
      id: 'farm-1',
      name: 'Petersen Research Farm',
      centerLat: FARM_LAT,
      centerLng: FARM_LNG,
      defaultZoom: 15,
      createdAt: Date.now() - 86400000 * 90,
    },
    seasons: [season],
    fields,
    plots,
    clients,
    trials,
    workflowTemplates: [],
  }
}
