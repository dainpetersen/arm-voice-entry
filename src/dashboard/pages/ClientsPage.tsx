import { useState } from 'react'
import { useDashboard } from '../components/DashboardLayout'
import { ClientForm } from '../components/ClientForm'
import type { Client } from '../types'

export function ClientsPage() {
  const { data, saveClient, deleteClient } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | undefined>()

  const handleSave = (client: Client) => {
    saveClient(client)
    setShowForm(false)
    setEditing(undefined)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditing(undefined)
  }

  const handleDelete = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation()
    if (confirm(`Delete client "${client.name}"? This cannot be undone.`)) {
      deleteClient(client.id)
    }
  }

  const handleEdit = (client: Client) => {
    setEditing(client)
    setShowForm(true)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-800)' }}>
          Clients
        </h1>
        <button className="btn btn-primary" onClick={() => { setEditing(undefined); setShowForm(true) }}>
          + Add Client
        </button>
      </div>

      <div className="dash-card">
        {data.clients.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">&#128101;</div>
            <div className="dash-empty-text">No clients yet</div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => setShowForm(true)}
            >
              Add Your First Client
            </button>
          </div>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map(client => (
                <tr key={client.id} onClick={() => handleEdit(client)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{client.name}</td>
                  <td>{client.contactName ?? '\u2014'}</td>
                  <td>{client.contactEmail ?? '\u2014'}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={e => handleDelete(e, client)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ClientForm
          existing={editing}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </>
  )
}
