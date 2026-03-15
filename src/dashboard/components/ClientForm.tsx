import { useState } from 'react'
import type { Client } from '../types'

interface ClientFormProps {
  existing?: Client
  onSave: (client: Client) => void
  onClose: () => void
}

export function ClientForm({ existing, onSave, onClose }: ClientFormProps) {
  const [name, setName] = useState(existing?.name ?? '')
  const [contactName, setContactName] = useState(existing?.contactName ?? '')
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    })
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={e => e.stopPropagation()}>
        <h2 className="dash-modal-title">{existing ? 'Edit Client' : 'New Client'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="dash-form-row">
            <div className="field">
              <label>Contact Name</label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="dash-form-row">
            <div className="field">
              <label>Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Address</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="dash-form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {existing ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
