import { supabase } from './supabase.js'
import { icon } from './icons.js'
import { formatBytes, formatDate, daysUntil, escapeHtml } from './utils.js'
import { renderAuth } from './auth.js'

let currentUser = null
let currentView = 'dashboard'
let allDocuments = []
let personalInfoData = null

export async function renderApp(user) {
  currentUser = user
  const app = document.querySelector('#app')
  app.innerHTML = buildShell()

  setupNavigation()
  setupSidebarToggle()
  setupLogout()

  await loadAndRender(currentView)
}

function buildShell() {
  const email = currentUser ? escapeHtml(currentUser.email) : ''
  return `
    <div class="app-layout">
      <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle menu">${icon('menu')}</button>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">${icon('lock')}</div>
          <div>
            <h2>Digital Locker</h2>
            <span class="sidebar-brand-sub">Student Edition</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a class="nav-item active" data-view="dashboard" id="nav-dashboard">
            <span class="nav-icon">${icon('home')}</span>
            <span>Dashboard</span>
          </a>
          <a class="nav-item" data-view="documents" id="nav-documents">
            <span class="nav-icon">${icon('folder')}</span>
            <span>Documents</span>
          </a>
          <a class="nav-item" data-view="personal" id="nav-personal">
            <span class="nav-icon">${icon('user')}</span>
            <span>Personal Info</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-user-avatar">${icon('user')}</div>
            <div class="sidebar-user-email" title="${email}">${email}</div>
          </div>
          <button class="nav-item logout-btn" id="logout-btn">
            <span class="nav-icon">${icon('logout')}</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main class="main-content" id="main-content">
        <div class="content-area" id="content-area"></div>
      </main>
    </div>
  `
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault()
      const view = item.dataset.view
      if (view !== currentView) {
        switchView(view)
      }
      document.getElementById('sidebar').classList.remove('open')
    })
  })
}

function switchView(view) {
  currentView = view
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view)
  })
  loadAndRender(view)
}

function setupSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle')
  const sidebar = document.getElementById('sidebar')
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'))
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open')
    }
  })
}

function setupLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut()
    currentUser = null
    const app = document.querySelector('#app')
    app.innerHTML = ''
    renderAuth(handleAuthSuccess)
  })
}

function handleAuthSuccess(user) {
  renderApp(user)
}

async function loadAndRender(view) {
  const content = document.getElementById('content-area')
  if (!content) return

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`

  if (view === 'dashboard') {
    await loadDocuments()
    await loadPersonalInfo()
    renderDashboard(content)
  } else if (view === 'documents') {
    await loadDocuments()
    renderDocumentsView(content)
  } else if (view === 'personal') {
    await loadPersonalInfo()
    renderPersonalInfoView(content)
  }
}

async function loadDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    allDocuments = []
    return
  }
  allDocuments = data || []
}

async function loadPersonalInfo() {
  const { data, error } = await supabase
    .from('personal_info')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle()

  if (error || !data) {
    personalInfoData = null
  } else {
    personalInfoData = data
  }
}

function renderDashboard(content) {
  const counts = countByCategory(allDocuments)
  const expiryWarnings = getExpiryWarnings(allDocuments)

  content.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p class="page-subtitle">Welcome back! Here's an overview of your digital locker.</p>
    </div>

    <div class="status-container" id="status-container"></div>

    ${expiryWarnings.length > 0 ? renderExpiryAlerts(expiryWarnings) : ''}

    <div class="stat-grid">
      <div class="stat-card stat-primary">
        <div class="stat-icon">${icon('folder')}</div>
        <div class="stat-body">
          <span class="stat-value">${allDocuments.length}</span>
          <span class="stat-label">Total Documents</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-blue">${icon('idCard')}</div>
        <div class="stat-body">
          <span class="stat-value">${counts['College ID'] || 0}</span>
          <span class="stat-label">College IDs</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-green">${icon('award')}</div>
        <div class="stat-body">
          <span class="stat-value">${counts['Certificates'] || 0}</span>
          <span class="stat-label">Certificates</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-orange">${icon('book')}</div>
        <div class="stat-body">
          <span class="stat-value">${counts['Marksheets'] || 0}</span>
          <span class="stat-label">Marksheets</span>
        </div>
      </div>
    </div>

    <div class="card-grid">
      <div class="action-card" data-view="documents">
        <div class="action-card-icon">${icon('folder')}</div>
        <h3>Documents</h3>
        <p>Upload and manage your college ID, certificates, marksheets, resume and other files.</p>
        <span class="action-card-count">${allDocuments.length} document${allDocuments.length !== 1 ? 's' : ''} stored</span>
      </div>
      <div class="action-card" data-view="documents">
        <div class="action-card-icon">${icon('award')}</div>
        <h3>Certificates</h3>
        <p>Keep all your achievement certificates safe and easily downloadable when needed.</p>
        <span class="action-card-count">${counts['Certificates'] || 0} certificate${(counts['Certificates'] || 0) !== 1 ? 's' : ''} stored</span>
      </div>
      <div class="action-card" data-view="personal">
        <div class="action-card-icon">${icon('user')}</div>
        <h3>Personal Information</h3>
        <p>Store your basic details like name, course, branch, roll number and contact info.</p>
        <span class="action-card-count">${personalInfoData ? 'Profile completed' : 'Not yet filled'}</span>
      </div>
    </div>
  `

  document.querySelectorAll('.action-card[data-view]').forEach((card) => {
    card.addEventListener('click', () => switchView(card.dataset.view))
  })
}

function renderExpiryAlerts(warnings) {
  return `
    <div class="expiry-alerts">
      <div class="expiry-alerts-header">
        ${icon('bell')}
        <h3>Document Expiry Reminders</h3>
      </div>
      ${warnings
        .map((w) => {
          const cls = w.days < 0 ? 'expired' : w.days <= 7 ? 'urgent' : 'soon'
          const label = w.days < 0 ? `Expired ${Math.abs(w.days)} day${Math.abs(w.days) !== 1 ? 's' : ''} ago` : `Expires in ${w.days} day${w.days !== 1 ? 's' : ''}`
          return `
            <div class="expiry-item ${cls}">
              <div class="expiry-item-icon">${icon('calendar')}</div>
              <div class="expiry-item-body">
                <span class="expiry-item-name">${escapeHtml(w.name)}</span>
                <span class="expiry-item-date">${label} — ${formatDate(w.expiry_date)}</span>
              </div>
            </div>
          `
        })
        .join('')}
    </div>
  `
}

function getExpiryWarnings(docs) {
  return docs
    .filter((d) => d.expiry_date)
    .map((d) => ({ name: d.name, expiry_date: d.expiry_date, days: daysUntil(d.expiry_date) }))
    .filter((d) => d.days <= 30)
    .sort((a, b) => a.days - b.days)
}

function countByCategory(docs) {
  return docs.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1
    return acc
  }, {})
}

function renderDocumentsView(content) {
  content.innerHTML = `
    <div class="page-header">
      <h1>My Documents</h1>
      <p class="page-subtitle">Upload, search, and manage your important documents.</p>
    </div>

    <div class="status-container" id="status-container"></div>

    <div class="upload-section">
      <button class="btn btn-primary" id="upload-btn">${icon('upload')} Upload New Document</button>
    </div>

    <div class="filter-bar">
      <div class="search-box">
        ${icon('search')}
        <input type="text" id="doc-search" placeholder="Search by document name..." />
      </div>
      <select id="doc-category-filter">
        <option value="all">All Categories</option>
        <option value="College ID">College ID</option>
        <option value="Certificates">Certificates</option>
        <option value="Marksheets">Marksheets</option>
        <option value="Resume">Resume</option>
        <option value="Other">Other</option>
      </select>
    </div>

    <div class="doc-count-bar" id="doc-count-bar"></div>

    <div class="doc-grid" id="doc-grid"></div>
  `

  document.getElementById('upload-btn').addEventListener('click', openUploadModal)

  const searchInput = document.getElementById('doc-search')
  const categoryFilter = document.getElementById('doc-category-filter')

  searchInput.addEventListener('input', () => renderFilteredDocs())
  categoryFilter.addEventListener('change', () => renderFilteredDocs())

  renderFilteredDocs()
}

function renderFilteredDocs() {
  const search = document.getElementById('doc-search').value.toLowerCase().trim()
  const category = document.getElementById('doc-category-filter').value

  let filtered = allDocuments
  if (category !== 'all') {
    filtered = filtered.filter((d) => d.category === category)
  }
  if (search) {
    filtered = filtered.filter((d) => d.name.toLowerCase().includes(search))
  }

  const grid = document.getElementById('doc-grid')
  const countBar = document.getElementById('doc-count-bar')

  countBar.innerHTML = `<span>${filtered.length} document${filtered.length !== 1 ? 's' : ''} found</span>`

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('folder')}</div>
        <h3>No documents found</h3>
        <p>${allDocuments.length === 0 ? 'Upload your first document to get started.' : 'Try a different search or filter.'}</p>
      </div>
    `
    return
  }

  grid.innerHTML = filtered.map((doc) => renderDocCard(doc)).join('')

  grid.querySelectorAll('[data-action="download"]').forEach((btn) => {
    btn.addEventListener('click', () => downloadDoc(btn.dataset.id))
  })
  grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteDoc(btn.dataset.id))
  })
}

function renderDocCard(doc) {
  const catIcon = getCategoryIcon(doc.category)
  const expiry = doc.expiry_date ? getExpiryBadge(doc.expiry_date) : ''
  return `
    <div class="doc-card">
      <div class="doc-card-top">
        <div class="doc-card-icon ${getCategoryClass(doc.category)}">${catIcon}</div>
        ${expiry}
      </div>
      <h3 class="doc-card-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</h3>
      <span class="doc-card-category">${escapeHtml(doc.category)}</span>
      <div class="doc-card-meta">
        <span>${icon('file')} ${escapeHtml(doc.file_name)}</span>
        <span>${formatBytes(doc.file_size)}</span>
        <span>${icon('calendar')} ${formatDate(doc.created_at)}</span>
      </div>
      <div class="doc-card-actions">
        <button class="btn btn-sm btn-outline" data-action="download" data-id="${doc.id}" title="Download">${icon('download')} Download</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${doc.id}" title="Delete">${icon('trash')} Delete</button>
      </div>
    </div>
  `
}

function getExpiryBadge(dateStr) {
  const d = daysUntil(dateStr)
  if (d === null) return ''
  if (d < 0) return `<span class="expiry-badge expired">${icon('clock')} Expired</span>`
  if (d <= 7) return `<span class="expiry-badge urgent">${icon('clock')} ${d}d left</span>`
  if (d <= 30) return `<span class="expiry-badge soon">${icon('clock')} ${d}d left</span>`
  return ''
}

function getCategoryIcon(cat) {
  const map = {
    'College ID': icon('idCard'),
    Certificates: icon('award'),
    Marksheets: icon('book'),
    Resume: icon('file'),
    Other: icon('folder'),
  }
  return map[cat] || icon('file')
}

function getCategoryClass(cat) {
  const map = {
    'College ID': 'cat-blue',
    Certificates: 'cat-green',
    Marksheets: 'cat-orange',
    Resume: 'cat-purple',
    Other: 'cat-gray',
  }
  return map[cat] || 'cat-gray'
}

function openUploadModal() {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.id = 'upload-modal'
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${icon('upload')} Upload Document</h2>
        <button class="modal-close" id="modal-close-x">${icon('x')}</button>
      </div>
      <form id="upload-form">
        <div class="form-group">
          <label for="upload-name">Document Name <span class="req">*</span></label>
          <input type="text" id="upload-name" placeholder="e.g. Semester 1 Marksheet" required maxlength="100" />
        </div>
        <div class="form-group">
          <label for="upload-category">Category <span class="req">*</span></label>
          <select id="upload-category" required>
            <option value="">Select a category</option>
            <option value="College ID">College ID</option>
            <option value="Certificates">Certificates</option>
            <option value="Marksheets">Marksheets</option>
            <option value="Resume">Resume</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="upload-expiry">Expiry Date <span class="opt">(optional)</span></label>
          <input type="date" id="upload-expiry" />
          <span class="form-hint">Set if this document has an expiry (e.g. ID card, license)</span>
        </div>
        <div class="form-group">
          <label for="upload-file">Select File <span class="req">*</span></label>
          <div class="file-drop" id="file-drop">
            <div class="file-drop-icon">${icon('upload')}</div>
            <p>Click to select a file or drag it here</p>
            <span class="form-hint">PDF, JPG, PNG, DOC, TXT — max 10MB</span>
            <input type="file" id="upload-file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt" required />
          </div>
          <div class="file-preview" id="file-preview"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modal-upload-btn">${icon('upload')} Upload Document</button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(modal)
  modal.classList.add('show')

  const fileInput = document.getElementById('upload-file')
  const fileDrop = document.getElementById('file-drop')
  const filePreview = document.getElementById('file-preview')

  fileDrop.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      filePreview.innerHTML = `<span class="file-chip">${icon('file')} ${escapeHtml(fileInput.files[0].name)} (${formatBytes(fileInput.files[0].size)})</span>`
    }
  })

  fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault()
    fileDrop.classList.add('drag-over')
  })
  fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag-over'))
  fileDrop.addEventListener('drop', (e) => {
    e.preventDefault()
    fileDrop.classList.remove('drag-over')
    if (e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files
      fileInput.dispatchEvent(new Event('change'))
    }
  })

  document.getElementById('modal-close-x').addEventListener('click', closeModal)
  document.getElementById('modal-cancel').addEventListener('click', closeModal)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  document.getElementById('upload-form').addEventListener('submit', handleUpload)
}

function closeModal() {
  const modal = document.getElementById('upload-modal')
  if (modal) {
    modal.remove()
  }
}

async function handleUpload(e) {
  e.preventDefault()
  const btn = document.getElementById('modal-upload-btn')
  const name = document.getElementById('upload-name').value.trim()
  const category = document.getElementById('upload-category').value
  const expiry = document.getElementById('upload-expiry').value || null
  const fileInput = document.getElementById('upload-file')

  if (!fileInput.files[0]) return

  const file = fileInput.files[0]

  if (file.size > 10 * 1024 * 1024) {
    showStatus('File is too large. Maximum size is 10MB.', 'error')
    return
  }

  btn.disabled = true
  btn.textContent = 'Uploading...'

  const fileExt = file.name.split('.').pop()
  const filePath = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('student-documents')
    .upload(filePath, file)

  if (uploadError) {
    showStatus('Upload failed: ' + uploadError.message, 'error')
    btn.disabled = false
    btn.innerHTML = `${icon('upload')} Upload Document`
    return
  }

  const { error: dbError } = await supabase.from('documents').insert({
    name,
    category,
    file_path: filePath,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
    expiry_date: expiry,
  })

  if (dbError) {
    showStatus('Failed to save document record: ' + dbError.message, 'error')
    btn.disabled = false
    btn.innerHTML = `${icon('upload')} Upload Document`
    return
  }

  closeModal()
  showStatus(`"${name}" uploaded successfully!`, 'success')
  await loadDocuments()
  renderFilteredDocs()
  updateDashboardIfVisible()
}

async function downloadDoc(docId) {
  const doc = allDocuments.find((d) => d.id === docId)
  if (!doc) return

  const { data, error } = await supabase.storage
    .from('student-documents')
    .createSignedUrl(doc.file_path, 3600)

  if (error || !data) {
    showStatus('Failed to get download link: ' + (error?.message || 'Unknown error'), 'error')
    return
  }

  const a = document.createElement('a')
  a.href = data.signedUrl
  a.download = doc.file_name
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
  showStatus(`Downloading "${doc.name}"...`, 'info')
}

async function deleteDoc(docId) {
  const doc = allDocuments.find((d) => d.id === docId)
  if (!doc) return

  if (!confirm(`Are you sure you want to delete "${doc.name}"? This cannot be undone.`)) return

  await supabase.storage.from('student-documents').remove([doc.file_path])

  const { error } = await supabase.from('documents').delete().eq('id', docId)

  if (error) {
    showStatus('Failed to delete document: ' + error.message, 'error')
    return
  }

  showStatus(`"${doc.name}" has been deleted.`, 'success')
  await loadDocuments()
  renderFilteredDocs()
  updateDashboardIfVisible()
}

function renderPersonalInfoView(content) {
  const p = personalInfoData
  content.innerHTML = `
    <div class="page-header">
      <h1>Personal Information</h1>
      <p class="page-subtitle">Keep your basic details up to date for quick reference.</p>
    </div>

    <div class="status-container" id="status-container"></div>

    <form class="personal-form" id="personal-form">
      <div class="form-row">
        <div class="form-group">
          <label for="pi-full-name">Full Name</label>
          <input type="text" id="pi-full-name" placeholder="e.g. Rahul Sharma" value="${escapeHtml(p?.full_name)}" maxlength="100" />
        </div>
        <div class="form-group">
          <label for="pi-dob">Date of Birth</label>
          <input type="date" id="pi-dob" value="${p?.date_of_birth || ''}" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="pi-phone">Phone Number</label>
          <input type="tel" id="pi-phone" placeholder="e.g. +91 9876543210" value="${escapeHtml(p?.phone)}" maxlength="20" />
        </div>
        <div class="form-group">
          <label for="pi-roll">Roll Number</label>
          <input type="text" id="pi-roll" placeholder="e.g. CS21B001" value="${escapeHtml(p?.roll_number)}" maxlength="50" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="pi-course">Course</label>
          <input type="text" id="pi-course" placeholder="e.g. B.Tech" value="${escapeHtml(p?.course)}" maxlength="100" />
        </div>
        <div class="form-group">
          <label for="pi-branch">Branch</label>
          <input type="text" id="pi-branch" placeholder="e.g. Computer Science" value="${escapeHtml(p?.branch)}" maxlength="100" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="pi-year">Year</label>
          <select id="pi-year">
            <option value="">Select year</option>
            ${['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => `<option value="${y}" ${p?.year === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="pi-address">Address</label>
          <textarea id="pi-address" rows="2" placeholder="Your current address" maxlength="300">${escapeHtml(p?.address)}</textarea>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="pi-save-btn">${icon('save')} ${p ? 'Update' : 'Save'} Information</button>
      </div>
    </form>
  `

  document.getElementById('personal-form').addEventListener('submit', handleSavePersonalInfo)
}

async function handleSavePersonalInfo(e) {
  e.preventDefault()
  const btn = document.getElementById('pi-save-btn')
  const payload = {
    full_name: document.getElementById('pi-full-name').value.trim() || null,
    date_of_birth: document.getElementById('pi-dob').value || null,
    phone: document.getElementById('pi-phone').value.trim() || null,
    roll_number: document.getElementById('pi-roll').value.trim() || null,
    course: document.getElementById('pi-course').value.trim() || null,
    branch: document.getElementById('pi-branch').value.trim() || null,
    year: document.getElementById('pi-year').value || null,
    address: document.getElementById('pi-address').value.trim() || null,
    updated_at: new Date().toISOString(),
  }

  btn.disabled = true
  btn.textContent = 'Saving...'

  if (personalInfoData) {
    const { error } = await supabase
      .from('personal_info')
      .update(payload)
      .eq('id', personalInfoData.id)

    if (error) {
      showStatus('Failed to update: ' + error.message, 'error')
      btn.disabled = false
      btn.innerHTML = `${icon('save')} Update Information`
      return
    }
    showStatus('Your personal information has been updated.', 'success')
  } else {
    const { error } = await supabase.from('personal_info').insert(payload)

    if (error) {
      showStatus('Failed to save: ' + error.message, 'error')
      btn.disabled = false
      btn.innerHTML = `${icon('save')} Save Information`
      return
    }
    showStatus('Your personal information has been saved.', 'success')
  }

  await loadPersonalInfo()
  renderPersonalInfoView(document.getElementById('content-area'))
}

function showStatus(message, type = 'info') {
  const container = document.getElementById('status-container')
  if (!container) return

  const id = 'status-' + Date.now()
  container.innerHTML = `<div class="status-message ${type}" id="${id}">
    <span class="status-icon">${type === 'success' ? icon('check') : type === 'error' ? icon('x') : icon('bell')}</span>
    <span>${escapeHtml(message)}</span>
  </div>`

  setTimeout(() => {
    const el = document.getElementById(id)
    if (el) {
      el.classList.add('fade-out')
      setTimeout(() => el.remove(), 400)
    }
  }, 4000)
}

function updateDashboardIfVisible() {
  if (currentView === 'dashboard') {
    loadAndRender('dashboard')
  }
}
