export interface AssessmentVariable {
  id: string
  name: string
  unit: string
  subSamples: number // how many readings per plot for this variable
}

export interface TrialConfig {
  id: string
  name: string
  totalPlots: number
  plotsPerRow: number
  serpentine: boolean
  variables: AssessmentVariable[]
  createdAt: number
}

export interface PlotData {
  plotNumber: number
  /** readings[variableId][subSampleIndex] = value or null */
  readings: Record<string, (number | null)[]>
}

export interface TrialSession {
  config: TrialConfig
  data: PlotData[]
  currentPlotIndex: number
  currentVariableIndex: number
  currentSubSampleIndex: number
  startedAt: number
  completedAt: number | null
}

/** Returns plot numbers in serpentine walk order */
export function getSerpentineOrder(totalPlots: number, plotsPerRow: number): number[] {
  const order: number[] = []
  const totalRows = Math.ceil(totalPlots / plotsPerRow)

  for (let row = 0; row < totalRows; row++) {
    const start = row * plotsPerRow + 1
    const end = Math.min(start + plotsPerRow - 1, totalPlots)
    const rowPlots: number[] = []

    for (let p = start; p <= end; p++) {
      rowPlots.push(p)
    }

    // Even rows (0, 2, 4...) go forward, odd rows go backward
    if (row % 2 === 1) {
      rowPlots.reverse()
    }

    order.push(...rowPlots)
  }

  return order
}

/** Returns sequential order */
export function getSequentialOrder(totalPlots: number): number[] {
  return Array.from({ length: totalPlots }, (_, i) => i + 1)
}

export function getPlotOrder(config: TrialConfig): number[] {
  if (config.serpentine) {
    return getSerpentineOrder(config.totalPlots, config.plotsPerRow)
  }
  return getSequentialOrder(config.totalPlots)
}
