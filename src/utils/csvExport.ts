import type { TrialSession, TrialConfig } from '../types'
import { getPlotOrder } from '../types'

/**
 * Export trial data as CSV formatted for ARM import.
 *
 * Format:
 * Plot, Variable1_1, Variable1_2, ..., Variable2_1, ...
 * 1, 12.5, 13.0, ..., 3, ...
 */
export function generateCSV(session: TrialSession): string {
  const { config, data } = session

  // Build header row
  const headers = ['Plot']
  for (const variable of config.variables) {
    if (variable.subSamples === 1) {
      headers.push(variable.name)
    } else {
      for (let s = 1; s <= variable.subSamples; s++) {
        headers.push(`${variable.name}_${s}`)
      }
    }
  }
  headers.push('Notes')

  // Build data rows in plot-number order (1, 2, 3... not serpentine walk order)
  const sortedData = [...data].sort((a, b) => a.plotNumber - b.plotNumber)
  const rows = [headers.join(',')]

  for (const plot of sortedData) {
    const cells: string[] = [String(plot.plotNumber)]

    for (const variable of config.variables) {
      const readings = plot.readings[variable.id] ?? []
      for (let s = 0; s < variable.subSamples; s++) {
        const val = readings[s]
        cells.push(val === null || val === undefined ? '' : String(val))
      }
    }

    // Notes column — join multiple notes with semicolons, quote if contains commas
    const notesText = (plot.notes ?? []).map(n => n.text).join('; ')
    cells.push(notesText.includes(',') || notesText.includes('"') ? `"${notesText.replace(/"/g, '""')}"` : notesText)

    rows.push(cells.join(','))
  }

  return rows.join('\n')
}

/** Generate a filename for the CSV export */
export function generateFilename(config: TrialConfig): string {
  const date = new Date().toISOString().split('T')[0]
  const safeName = config.name.replace(/[^a-zA-Z0-9]/g, '_')
  return `${safeName}_${date}.csv`
}

/** Trigger a file download in the browser */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Get plot order for display purposes */
export { getPlotOrder }
