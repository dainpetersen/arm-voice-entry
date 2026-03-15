import type { DashboardTrial, Client } from '../types'
import { TRIAL_STATUS_COLORS, TRIAL_STATUS_LABELS } from '../types'

interface TrialListProps {
  trials: DashboardTrial[]
  clients: Client[]
  onSelect: (id: string) => void
  onDelete?: (id: string) => void
}

export function TrialList({ trials, clients, onSelect, onDelete }: TrialListProps) {
  const clientMap = new Map(clients.map(c => [c.id, c.name]))

  if (trials.length === 0) {
    return (
      <div className="dash-empty" style={{ padding: 40 }}>
        <div className="dash-empty-icon">&#128203;</div>
        <div className="dash-empty-text">No trials yet</div>
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>
          Create your first trial to get started.
        </p>
      </div>
    )
  }

  return (
    <table className="dash-table">
      <thead>
        <tr>
          <th>Protocol</th>
          <th>Name</th>
          <th>Client</th>
          <th>Crop</th>
          <th>Status</th>
          <th style={{ textAlign: 'right' }}>Contract Value</th>
          {onDelete && <th style={{ width: 60 }}></th>}
        </tr>
      </thead>
      <tbody>
        {trials.map(t => (
          <tr key={t.id} onClick={() => onSelect(t.id)} style={{ cursor: 'pointer' }}>
            <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{t.protocolCode}</td>
            <td style={{ fontWeight: 600 }}>{t.name}</td>
            <td>{clientMap.get(t.clientId) ?? '—'}</td>
            <td>{t.cropType}</td>
            <td>
              <span
                className="status-badge"
                style={{ background: TRIAL_STATUS_COLORS[t.status] }}
              >
                {TRIAL_STATUS_LABELS[t.status]}
              </span>
            </td>
            <td style={{ textAlign: 'right' }}>
              {t.contractValue != null
                ? `$${t.contractValue.toLocaleString()}`
                : '—'}
            </td>
            {onDelete && (
              <td style={{ textAlign: 'center' }}>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '2px 6px',
                  }}
                  title="Delete trial"
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`Delete trial "${t.name}"?`)) onDelete(t.id)
                  }}
                >
                  {'\u2715'}
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
