import { NavLink } from 'react-router-dom'

export function Sidebar() {
  return (
    <nav className="dashboard-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-label">Dashboard</div>
        <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">&#9634;</span>
          Overview
        </NavLink>
        <NavLink to="/dashboard/map" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">&#9672;</span>
          Farm Map
        </NavLink>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Management</div>
        <NavLink to="/dashboard/trials" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">&#9881;</span>
          Trials
        </NavLink>
        <NavLink to="/dashboard/clients" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">&#9679;</span>
          Clients
        </NavLink>
        <NavLink to="/dashboard/schedule" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-link-icon">&#9716;</span>
          Schedule
        </NavLink>
      </div>

      <div className="sidebar-spacer" />
      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <NavLink to="/" className="sidebar-link">
          <span className="sidebar-link-icon">&#9742;</span>
          Voice Entry
        </NavLink>
      </div>
    </nav>
  )
}
