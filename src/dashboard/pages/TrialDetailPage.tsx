import { useParams, useNavigate } from 'react-router-dom'
import { useDashboard } from '../components/DashboardLayout'
import { TRIAL_STATUS_COLORS, TRIAL_STATUS_LABELS, ACTIVITY_TYPES } from '../types'

export function TrialDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data } = useDashboard()

  const trial = data.trials.find(t => t.id === id)
  if (!trial) {
    return (
      <div className="dash-empty">
        <div className="dash-empty-text">Trial not found</div>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/trials')}>Back to Trials</button>
      </div>
    )
  }

  const client = data.clients.find(c => c.id === trial.clientId)
  const field = data.fields.find(f => f.id === trial.fieldId)
  const margin = (trial.contractValue ?? 0) - (trial.estimatedCost ?? 0)

  const getTypeLabel = (type: string) =>
    ACTIVITY_TYPES.find(t => t.value === type)?.label ?? type

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/trials')}>
          &lsaquo; Back
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-800)', flex: 1 }}>
          {trial.name}
        </h1>
        <span className="status-badge" style={{ background: TRIAL_STATUS_COLORS[trial.status] }}>
          {TRIAL_STATUS_LABELS[trial.status]}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div>
          {/* Basic Info */}
          <div className="dash-card">
            <div className="dash-card-title" style={{ marginBottom: 12 }}>Trial Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
              <div><strong>Protocol:</strong> {trial.protocolCode}</div>
              <div><strong>Crop:</strong> {trial.cropType}</div>
              <div><strong>Client:</strong> {client?.name ?? '—'}</div>
              <div><strong>Field:</strong> {field?.name ?? '—'}</div>
              <div><strong>Treatments:</strong> {trial.treatments}</div>
              <div><strong>Replications:</strong> {trial.replications}</div>
              <div><strong>Planting:</strong> {trial.plantingDate ?? '—'}</div>
              <div><strong>Harvest:</strong> {trial.harvestDate ?? '—'}</div>
            </div>
            {trial.notes && (
              <div style={{ marginTop: 12, fontSize: 14, color: 'var(--gray-600)' }}>
                <strong>Notes:</strong> {trial.notes}
              </div>
            )}
          </div>

          {/* Treatments */}
          {trial.treatmentDescriptions.length > 0 && (
            <div className="dash-card">
              <div className="dash-card-title" style={{ marginBottom: 12 }}>Treatments</div>
              <table className="dash-table">
                <thead>
                  <tr><th>#</th><th>Name</th><th>Product</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {trial.treatmentDescriptions.map(td => (
                    <tr key={td.number} style={{ cursor: 'default' }}>
                      <td>{td.number}</td>
                      <td>{td.name}</td>
                      <td>{td.product ?? '—'}</td>
                      <td>{td.rate ? `${td.rate} ${td.rateUnit ?? ''}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Activities */}
          <div className="dash-card">
            <div className="dash-card-title" style={{ marginBottom: 12 }}>Scheduled Activities</div>
            {trial.scheduledActivities.length === 0 ? (
              <div style={{ fontSize: 14, color: 'var(--gray-400)' }}>No activities scheduled</div>
            ) : (
              trial.scheduledActivities
                .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
                .map(act => (
                  <div key={act.id} className="activity-item">
                    <div className={`activity-dot ${act.status}`} />
                    <div className="activity-info">
                      <div className="activity-title">{getTypeLabel(act.type)}: {act.description}</div>
                      <div className="activity-meta">
                        {new Date(act.scheduledDate + 'T00:00:00').toLocaleDateString()}
                        {act.assignedTo && <> &middot; {act.assignedTo}</>}
                        {act.daysAfterPlanting != null && <> &middot; {act.daysAfterPlanting} DAP</>}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Right column - Financial */}
        <div>
          <div className="dash-card">
            <div className="dash-card-title" style={{ marginBottom: 12 }}>Financial</div>
            <div style={{ fontSize: 14 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>Contract Value</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  ${(trial.contractValue ?? 0).toLocaleString()}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>Estimated Cost</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  ${(trial.estimatedCost ?? 0).toLocaleString()}
                </div>
              </div>
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--gray-200)' }}>
                <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>Margin</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: margin >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
                  ${margin.toLocaleString()}
                </div>
              </div>
              {trial.purchaseOrderNumber && (
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--gray-500)' }}>
                  PO: {trial.purchaseOrderNumber}
                </div>
              )}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-title" style={{ marginBottom: 12 }}>Contract Dates</div>
            <div style={{ fontSize: 14 }}>
              <div style={{ marginBottom: 6 }}><strong>Start:</strong> {trial.contractStartDate ?? '—'}</div>
              <div><strong>End:</strong> {trial.contractEndDate ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
