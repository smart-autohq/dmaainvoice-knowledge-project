/**
 * ============================================================================
 * D MAAIN VOICE KNOWLEDGE PROJECT — ORGANIZER PORTAL CONTROLLER
 * Full management of Sessions, Facilitators, Attendees, Campaigns, and Content
 * ============================================================================
 */

(function () {
  'use strict';

  let currentOrganizer = null;
  let allFacilitatorsList = [];
  let allSessionsList = [];

  // DOM Elements
  const authWrapper = document.getElementById('auth-wrapper');
  const dashboardShell = document.getElementById('dashboard-shell');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const authAlert = document.getElementById('auth-alert');
  const btnLogout = document.getElementById('btn-logout');

  const dashUserName = document.getElementById('dash-user-name');
  const dashUserRole = document.getElementById('dash-user-role');
  const navTabs = document.querySelectorAll('.dash-nav-item');
  const panels = document.querySelectorAll('.dash-panel');

  // Modals
  const sessionModal = document.getElementById('admin-session-modal');
  const sessionModalTitle = document.getElementById('session-modal-title');
  const sessionForm = document.getElementById('admin-session-form');
  const btnCloseSessionModal = document.getElementById('btn-close-session-modal');
  const btnCancelSession = document.getElementById('btn-cancel-session');

  const facilitatorModal = document.getElementById('admin-facilitator-modal');
  const facilitatorModalTitle = document.getElementById('facilitator-modal-title');
  const facilitatorForm = document.getElementById('admin-facilitator-form');
  const btnCloseFacilitatorModal = document.getElementById('btn-close-facilitator-modal');
  const btnCancelFacilitator = document.getElementById('btn-cancel-facilitator');

  const campaignModal = document.getElementById('admin-campaign-modal');
  const campaignForm = document.getElementById('admin-campaign-form');
  const btnCloseCampaignModal = document.getElementById('btn-close-campaign-modal');
  const btnCancelCampaign = document.getElementById('btn-cancel-campaign');

  const adminToast = document.getElementById('admin-toast');

  /* --------------------------------------------------------------------------
     1. UTILITIES
     -------------------------------------------------------------------------- */
  function showToast(msg) {
    if (!adminToast) return;
    adminToast.textContent = msg;
    adminToast.hidden = false;
    setTimeout(() => { adminToast.hidden = true; }, 3500);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Safe shared response parser for Organizer Portal API calls:
   * - Reads response body stream exactly once via text()
   * - Safely verifies presence of content before parsing JSON
   * - Gracefully extracts structured error details or provides clear HTTP messages
   * - Never throws "Unexpected end of JSON input" on empty/HTML responses
   */
  async function parseApiResponse(response, endpointName = 'Admin API') {
    let rawText = '';
    try {
      rawText = await response.text();
    } catch (readErr) {
      console.error(`[${endpointName}] Failed to read response stream:`, readErr);
      return {
        ok: false,
        status: response.status,
        data: null,
        error: `Network error reading response from ${endpointName} (HTTP ${response.status}).`,
      };
    }

    const trimmed = (rawText || '').trim();

    // 1. Handle empty response body
    if (!trimmed) {
      if (!response.ok) {
        console.warn(`[${endpointName}] Received empty response with HTTP status ${response.status}`);
        return {
          ok: false,
          status: response.status,
          data: null,
          error: `Server returned an empty response (HTTP ${response.status}). Please try again.`,
        };
      }
      return {
        ok: true,
        status: response.status,
        data: {},
        error: null,
      };
    }

    // 2. Attempt JSON parse
    let jsonData = null;
    try {
      jsonData = JSON.parse(trimmed);
    } catch (parseErr) {
      console.warn(`[${endpointName}] Received non-JSON response (HTTP ${response.status}):`, trimmed.slice(0, 150));
      return {
        ok: false,
        status: response.status,
        data: null,
        error: `Unexpected server response format (HTTP ${response.status}). Please try again.`,
      };
    }

    // 3. Check for non-2xx HTTP status
    if (!response.ok) {
      const errorMsg = (jsonData && (jsonData.message || jsonData.error)) || `Request failed with status ${response.status}.`;
      return {
        ok: false,
        status: response.status,
        data: jsonData,
        error: errorMsg,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: jsonData,
      error: null,
    };
  }

  async function apiFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    options.headers = headers;
    const res = await fetch(url, options);
    if (res.status === 401) {
      showLoggedOutState();
      throw new Error('Session expired. Please sign in again.');
    }

    // Wrap res.json() so existing dashboard callers safely read the body once without throwing Unexpected end of JSON
    res.json = async function () {
      const parsed = await parseApiResponse(res, url);
      if (!parsed.ok) {
        throw new Error(parsed.error || `Request to ${url} failed`);
      }
      return parsed.data || {};
    };

    return res;
  }

  /* --------------------------------------------------------------------------
     2. AUTHENTICATION LIFECYCLE
     -------------------------------------------------------------------------- */
  async function checkAuthSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const parsed = await parseApiResponse(res, 'Session Validation');
        if (parsed.ok && parsed.data && parsed.data.success && parsed.data.organizer) {
          showLoggedInState(parsed.data.organizer);
          return;
        }
      }
      showLoggedOutState();
    } catch (e) {
      showLoggedOutState();
    }
  }

  function showLoggedInState(organizer) {
    currentOrganizer = organizer;
    if (dashUserName) dashUserName.textContent = (organizer && organizer.name) || 'Organizer';
    if (dashUserRole) dashUserRole.textContent = ((organizer && organizer.role) || 'ADMIN').toUpperCase();

    if (authWrapper) {
      authWrapper.hidden = true;
      authWrapper.style.setProperty('display', 'none', 'important');
    }
    if (dashboardShell) {
      dashboardShell.hidden = false;
      dashboardShell.style.setProperty('display', 'flex', 'important');
    }

    // Load initial data safely
    try {
      loadOverviewData();
    } catch (err) {
      console.warn('Overview data loading issue:', err);
    }
    try {
      loadFacilitatorsForDropdowns();
    } catch (err) {
      console.warn('Facilitator dropdown loading issue:', err);
    }
  }

  function showLoggedOutState() {
    currentOrganizer = null;
    try {
      localStorage.removeItem('dm_organizer_token');
    } catch (e) {}

    if (dashboardShell) {
      dashboardShell.hidden = true;
      dashboardShell.style.setProperty('display', 'none', 'important');
    }
    if (authWrapper) {
      authWrapper.hidden = false;
      authWrapper.style.setProperty('display', 'flex', 'important');
    }
    if (loginPassword) loginPassword.value = '';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authAlert) authAlert.hidden = true;

      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      if (!email || !password) {
        showAuthAlert('Please enter your email and password.');
        return;
      }

      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.querySelector('.btn-text').textContent = 'Authenticating...';
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const parsed = await parseApiResponse(res, 'Organizer Login');
        if (!parsed.ok) {
          throw new Error(parsed.error || 'Authentication failed');
        }

        const data = parsed.data || {};
        showLoggedInState(data.organizer);
        showToast(`Welcome back, ${(data.organizer && data.organizer.name) || 'Organizer'}`);
      } catch (err) {
        showAuthAlert(err.message);
      } finally {
        if (loginSubmitBtn) {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.querySelector('.btn-text').textContent = 'Authenticate & Open Portal';
        }
      }
    });
  }

  function showAuthAlert(msg) {
    if (!authAlert) return;
    authAlert.textContent = msg;
    authAlert.hidden = false;
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      showLoggedOutState();
      showToast('Signed out.');
    });
  }

  /* --------------------------------------------------------------------------
     3. TAB NAVIGATION
     -------------------------------------------------------------------------- */
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      navTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach(p => {
        p.hidden = p.getAttribute('id') !== `panel-${targetTab}`;
        p.classList.toggle('active', p.getAttribute('id') === `panel-${targetTab}`);
      });

      // Lazy load tab data
      if (targetTab === 'overview') loadOverviewData();
      else if (targetTab === 'sessions') loadSessionsList();
      else if (targetTab === 'facilitators') loadFacilitatorsList();
      else if (targetTab === 'participants') loadParticipantsList();
      else if (targetTab === 'campaigns') loadCampaignsList();
      else if (targetTab === 'content') loadWebsiteContent();
    });
  });

  /* --------------------------------------------------------------------------
     4. OVERVIEW METRICS
     -------------------------------------------------------------------------- */
  async function loadOverviewData() {
    try {
      const res = await apiFetch('/api/admin/overview');
      const json = await res.json();
      if (!json.success) return;

      const { metrics, recentRegistrations, upcomingSessions } = json.data;

      document.getElementById('stat-total-registrations').textContent = metrics.totalRegistrations;
      document.getElementById('stat-attendance-rate').textContent = `${metrics.attendanceRate}% attendance recorded`;
      document.getElementById('stat-total-participants').textContent = metrics.totalParticipants;
      document.getElementById('stat-subscribers').textContent = `${metrics.activeSubscribers} subscribed to updates`;
      document.getElementById('stat-total-sessions').textContent = metrics.totalSessions;
      document.getElementById('stat-upcoming-sessions').textContent = `${metrics.upcomingSessionsCount} scheduled`;
      document.getElementById('stat-total-facilitators').textContent = metrics.totalFacilitators;

      // Recent Registrations Table
      const regTbody = document.querySelector('#recent-registrations-table tbody');
      if (regTbody) {
        if (recentRegistrations.length === 0) {
          regTbody.innerHTML = '<tr><td colspan="3" class="text-muted text-center">No registrations recorded yet.</td></tr>';
        } else {
          regTbody.innerHTML = recentRegistrations.map(r => `
            <tr>
              <td>
                <strong>${escapeHTML(`${r.participant.firstName || ''} ${r.participant.lastName || ''}`.trim())}</strong><br>
                <small class="text-muted">${escapeHTML(r.participant.email)}</small>
              </td>
              <td>${escapeHTML(r.session.title)}</td>
              <td>${new Date(r.registeredAt).toLocaleDateString()}</td>
            </tr>
          `).join('');
        }
      }

      // Upcoming Sessions Table
      const sesTbody = document.querySelector('#upcoming-sessions-table tbody');
      if (sesTbody) {
        if (upcomingSessions.length === 0) {
          sesTbody.innerHTML = '<tr><td colspan="3" class="text-muted text-center">No upcoming sessions.</td></tr>';
        } else {
          sesTbody.innerHTML = upcomingSessions.map(s => `
            <tr>
              <td><strong>${escapeHTML(s.title)}</strong></td>
              <td>${new Date(s.sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              <td><span class="badge-status badge-upcoming">${s._count.registrations} RSVPs</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Error loading overview:', e);
    }
  }

  const btnRefreshOverview = document.getElementById('btn-refresh-overview');
  if (btnRefreshOverview) btnRefreshOverview.addEventListener('click', loadOverviewData);

  /* --------------------------------------------------------------------------
     5. SESSIONS MANAGEMENT
     -------------------------------------------------------------------------- */
  async function loadSessionsList() {
    const tbody = document.querySelector('#admin-sessions-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Loading sessions...</td></tr>';

    try {
      const res = await apiFetch('/api/admin/sessions');
      const json = await res.json();
      allSessionsList = json.data || [];

      if (allSessionsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No sessions found. Click "+ Create New Session" to schedule one.</td></tr>';
        return;
      }

      tbody.innerHTML = allSessionsList.map(s => {
        const dateStr = new Date(s.sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const facilitatorName = s.facilitator ? s.facilitator.name : '<span class="text-muted">Unassigned</span>';
        const capacityDisplay = s.capacity ? `${s._count.registrations} / ${s.capacity}` : `${s._count.registrations} (Open)`;
        
        let statusBadge = `badge-${s.status.toLowerCase()}`;

        const catLabel = s.categoryLabel || (s.category ? (s.category.charAt(0).toUpperCase() + s.category.slice(1)) : 'Technology');

        return `
          <tr>
            <td>
              <strong>${escapeHTML(s.title)}</strong><br>
              <span class="badge" style="font-size: 0.725rem; background: #EEF2F6; color: #1E293B; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 3px;">${escapeHTML(catLabel)}</span>
              <small class="text-muted" style="margin-left: 6px;">${escapeHTML(s.venue || 'Virtual')}</small>
            </td>
            <td>${dateStr}</td>
            <td>${facilitatorName}</td>
            <td><strong>${capacityDisplay}</strong></td>
            <td><span class="badge-status ${statusBadge}">${s.status}</span></td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.editSession('${s.id}')">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" style="color: #D9381E;" onclick="window.deleteSession('${s.id}', '${escapeHTML(s.title)}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center">Error loading sessions: ${escapeHTML(e.message)}</td></tr>`;
    }
  }

  // Create / Edit Session Modal
  const btnOpenCreateSession = document.getElementById('btn-open-create-session');
  if (btnOpenCreateSession) {
    btnOpenCreateSession.addEventListener('click', () => {
      if (sessionForm) sessionForm.reset();
      document.getElementById('admin-session-id').value = '';
      const catSelect = document.getElementById('as-category');
      if (catSelect) catSelect.value = 'technology';
      if (sessionModalTitle) sessionModalTitle.textContent = 'Create Knowledge Session';
      if (sessionModal) sessionModal.showModal();
    });
  }

  if (btnCloseSessionModal) btnCloseSessionModal.addEventListener('click', () => sessionModal.close());
  if (btnCancelSession) btnCancelSession.addEventListener('click', () => sessionModal.close());

  window.editSession = function (sessionId) {
    const s = allSessionsList.find(x => x.id === sessionId);
    if (!s || !sessionModal) return;

    document.getElementById('admin-session-id').value = s.id;
    document.getElementById('as-title').value = s.title;
    document.getElementById('as-description').value = s.description;

    const catSelect = document.getElementById('as-category');
    if (catSelect) {
      if (s.category) {
        let found = false;
        for (const opt of catSelect.options) {
          if (opt.value.toLowerCase() === s.category.toLowerCase()) {
            catSelect.value = opt.value;
            found = true;
            break;
          }
        }
        if (!found) {
          const lower = s.category.toLowerCase();
          if (lower.includes('finance')) catSelect.value = 'finance';
          else if (lower.includes('develop')) catSelect.value = 'personal-development';
          else if (lower.includes('business')) catSelect.value = 'business';
          else if (lower.includes('speak')) catSelect.value = 'public-speaking';
          else if (lower.includes('career')) catSelect.value = 'career';
          else catSelect.value = s.category;
        }
      } else {
        catSelect.value = 'technology';
      }
    }
    
    // Format to datetime-local
    const dt = new Date(s.sessionDate);
    const pad = n => String(n).padStart(2, '0');
    const localIso = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    document.getElementById('as-date').value = localIso;

    if (s.endTime) {
      const edt = new Date(s.endTime);
      document.getElementById('as-end-date').value = `${edt.getFullYear()}-${pad(edt.getMonth() + 1)}-${pad(edt.getDate())}T${pad(edt.getHours())}:${pad(edt.getMinutes())}`;
    } else {
      document.getElementById('as-end-date').value = '';
    }

    document.getElementById('as-facilitator').value = s.facilitatorId || '';
    document.getElementById('as-capacity').value = s.capacity || '';
    document.getElementById('as-venue').value = s.venue || '';
    document.getElementById('as-status').value = s.status || 'UPCOMING';
    document.getElementById('as-meeting-link').value = s.meetingLink || '';
    document.getElementById('as-passcode').value = s.passcode || '';

    if (sessionModalTitle) sessionModalTitle.textContent = 'Edit Knowledge Session';
    sessionModal.showModal();
  };

  window.deleteSession = async function (sessionId, title) {
    if (!confirm(`Are you sure you want to delete session "${title}"? This will remove all associated registrations.`)) return;

    try {
      const res = await apiFetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      showToast('Session deleted.');
      loadSessionsList();
    } catch (err) {
      alert(err.message);
    }
  };

  if (sessionForm) {
    sessionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('admin-session-id').value;
      const catEl = document.getElementById('as-category');
      const selectedCategory = catEl ? catEl.value : 'technology';

      const payload = {
        title: document.getElementById('as-title').value,
        description: document.getElementById('as-description').value,
        category: selectedCategory,
        sessionDate: document.getElementById('as-date').value,
        endTime: document.getElementById('as-end-date').value || null,
        facilitatorId: document.getElementById('as-facilitator').value || null,
        capacity: document.getElementById('as-capacity').value || null,
        venue: document.getElementById('as-venue').value || null,
        status: document.getElementById('as-status').value,
        meetingLink: document.getElementById('as-meeting-link').value || null,
        passcode: document.getElementById('as-passcode').value || null,
      };

      try {
        const url = id ? `/api/admin/sessions/${id}` : '/api/admin/sessions';
        const method = id ? 'PUT' : 'POST';
        const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Operation failed');

        sessionModal.close();
        showToast(id ? 'Session updated.' : 'Session created.');
        loadSessionsList();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  /* --------------------------------------------------------------------------
     6. FACILITATORS MANAGEMENT
     -------------------------------------------------------------------------- */
  async function loadFacilitatorsList() {
    const tbody = document.querySelector('#admin-facilitators-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">Loading facilitators...</td></tr>';

    try {
      const res = await apiFetch('/api/admin/facilitators');
      const json = await res.json();
      allFacilitatorsList = json.data || [];

      if (allFacilitatorsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No facilitators added yet.</td></tr>';
        return;
      }

      tbody.innerHTML = allFacilitatorsList.map(f => `
        <tr>
          <td>
            <strong>${escapeHTML(f.name)}</strong>
            ${f.linkedinUrl ? `<br><a href="${escapeHTML(f.linkedinUrl)}" target="_blank" class="text-muted" style="font-size: 11px;">LinkedIn &rarr;</a>` : ''}
          </td>
          <td>${escapeHTML(f.title)}</td>
          <td>${(f.expertise || []).map(t => `<span class="facilitator-topic-tag" style="display:inline-block; margin:2px;">${escapeHTML(t)}</span>`).join('')}</td>
          <td><strong>${f._count?.sessions || 0}</strong></td>
          <td>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.editFacilitator('${f.id}')">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm" style="color: #D9381E;" onclick="window.deleteFacilitator('${f.id}', '${escapeHTML(f.name)}')">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center">Error: ${escapeHTML(e.message)}</td></tr>`;
    }
  }

  async function loadFacilitatorsForDropdowns() {
    try {
      const res = await apiFetch('/api/admin/facilitators');
      const json = await res.json();
      allFacilitatorsList = json.data || [];

      const select = document.getElementById('as-facilitator');
      if (select) {
        select.innerHTML = '<option value="">-- Unassigned --</option>' +
          allFacilitatorsList.map(f => `<option value="${f.id}">${escapeHTML(f.name)} (${escapeHTML(f.title)})</option>`).join('');
      }
    } catch (e) {}
  }

  const btnOpenCreateFacilitator = document.getElementById('btn-open-create-facilitator');
  if (btnOpenCreateFacilitator) {
    btnOpenCreateFacilitator.addEventListener('click', () => {
      if (facilitatorForm) facilitatorForm.reset();
      document.getElementById('admin-facilitator-id').value = '';
      if (facilitatorModalTitle) facilitatorModalTitle.textContent = 'Add Knowledge Facilitator';
      if (facilitatorModal) facilitatorModal.showModal();
    });
  }

  if (btnCloseFacilitatorModal) btnCloseFacilitatorModal.addEventListener('click', () => facilitatorModal.close());
  if (btnCancelFacilitator) btnCancelFacilitator.addEventListener('click', () => facilitatorModal.close());

  window.editFacilitator = function (facId) {
    const f = allFacilitatorsList.find(x => x.id === facId);
    if (!f || !facilitatorModal) return;

    document.getElementById('admin-facilitator-id').value = f.id;
    document.getElementById('af-name').value = f.name;
    document.getElementById('af-title').value = f.title;
    document.getElementById('af-bio').value = f.bio;
    document.getElementById('af-expertise').value = (f.expertise || []).join(', ');
    document.getElementById('af-linkedin').value = f.linkedinUrl || '';

    if (facilitatorModalTitle) facilitatorModalTitle.textContent = 'Edit Facilitator';
    facilitatorModal.showModal();
  };

  window.deleteFacilitator = async function (facId, name) {
    if (!confirm(`Are you sure you want to delete facilitator "${name}"?`)) return;

    try {
      const res = await apiFetch(`/api/admin/facilitators?id=${facId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      showToast('Facilitator removed.');
      loadFacilitatorsList();
      loadFacilitatorsForDropdowns();
    } catch (err) {
      alert(err.message);
    }
  };

  if (facilitatorForm) {
    facilitatorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('admin-facilitator-id').value;
      const payload = {
        id: id || undefined,
        name: document.getElementById('af-name').value,
        title: document.getElementById('af-title').value,
        bio: document.getElementById('af-bio').value,
        expertise: document.getElementById('af-expertise').value,
        linkedinUrl: document.getElementById('af-linkedin').value || null,
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const res = await apiFetch('/api/admin/facilitators', { method, body: JSON.stringify(payload) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Operation failed');

        facilitatorModal.close();
        showToast(id ? 'Facilitator updated.' : 'Facilitator profile created.');
        loadFacilitatorsList();
        loadFacilitatorsForDropdowns();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  /* --------------------------------------------------------------------------
     7. PARTICIPANTS & ATTENDANCE MANAGEMENT
     -------------------------------------------------------------------------- */
  async function loadParticipantsList(search = '') {
    const tbody = document.querySelector('#admin-participants-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Loading participants...</td></tr>';

    try {
      const url = search ? `/api/admin/participants?search=${encodeURIComponent(search)}` : '/api/admin/participants';
      const res = await apiFetch(url);
      const json = await res.json();
      const participants = json.data || [];

      if (participants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No participants found matching criteria.</td></tr>';
        return;
      }

      tbody.innerHTML = participants.map(p => `
        <tr>
          <td><strong>${escapeHTML(`${p.firstName || ''} ${p.lastName || ''}`.trim())}</strong></td>
          <td>
            ${escapeHTML(p.email)}<br>
            <small class="text-muted">${escapeHTML(p.phone || '—')}</small>
          </td>
          <td>
            ${escapeHTML(p.occupation || '—')}<br>
            <small class="text-muted">${escapeHTML(p.organization || '—')}</small>
          </td>
          <td>${escapeHTML(p.state || '—')}</td>
          <td>
            ${p.registrations.map(r => `
              <div style="margin-bottom: 4px;">
                <span class="badge-status ${r.attended ? 'badge-attended' : 'badge-absent'}" onclick="window.toggleAttendance('${r.id}', ${!r.attended})" title="Click to toggle attendance">
                  ${r.attended ? '✓ Attended' : '○ Registered'}
                </span>
                <small style="margin-left: 4px;">${escapeHTML(r.session.title.slice(0, 30))}...</small>
              </div>
            `).join('')}
          </td>
          <td>${p.subscribed ? '<span style="color:#00873E; font-weight:600;">Community (Subscribed)</span>' : '<span class="text-muted" title="Registered for individual session only">Session Only</span>'}</td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center">Error: ${escapeHTML(e.message)}</td></tr>`;
    }
  }

  window.toggleAttendance = async function (registrationId, newStatus) {
    try {
      const res = await apiFetch(`/api/admin/registrations/${registrationId}`, {
        method: 'PUT',
        body: JSON.stringify({ attended: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      showToast(json.message);
      loadParticipantsList(document.getElementById('participant-search-input')?.value.trim() || '');
    } catch (err) {
      alert(err.message);
    }
  };

  const searchInput = document.getElementById('participant-search-input');
  let searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        loadParticipantsList(searchInput.value.trim());
      }, 350);
    });
  }

  const btnExport = document.getElementById('btn-export-participants');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      window.location.href = '/api/admin/participants?format=csv';
    });
  }

  /* --------------------------------------------------------------------------
     8. EMAIL CAMPAIGNS & ANNOUNCEMENTS
     -------------------------------------------------------------------------- */
  async function loadCampaignsList() {
    const tbody = document.querySelector('#admin-campaigns-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Loading broadcasts...</td></tr>';

    try {
      const res = await apiFetch('/api/admin/campaigns');
      const json = await res.json();
      const campaigns = json.data || [];

      if (campaigns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No broadcasts drafted yet.</td></tr>';
        return;
      }

      tbody.innerHTML = campaigns.map(c => `
        <tr>
          <td><strong>${escapeHTML(c.subject)}</strong></td>
          <td>${c.session ? escapeHTML(c.session.title) : 'All Subscribed Cohorts'}</td>
          <td><span class="badge-status badge-${c.status.toLowerCase()}">${c.status}</span></td>
          <td><strong>${c._count?.deliveries || 0}</strong></td>
          <td>${c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
          <td>
            ${c.status === 'DRAFT' ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="window.sendCampaign('${c.id}', '${escapeHTML(c.subject)}')">Send Now</button>
            ` : '<span class="text-muted" style="font-size:12px;">Dispatched</span>'}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center">Error: ${escapeHTML(e.message)}</td></tr>`;
    }
  }

  const btnOpenCreateCampaign = document.getElementById('btn-open-create-campaign');
  if (btnOpenCreateCampaign) {
    btnOpenCreateCampaign.addEventListener('click', () => {
      if (campaignForm) campaignForm.reset();

      // Populate session audience options
      const sel = document.getElementById('ac-session');
      if (sel) {
        sel.innerHTML = '<option value="">All Subscribed Participants (Broadcast)</option>' +
          allSessionsList.map(s => `<option value="${s.id}">Attendees of: ${escapeHTML(s.title)}</option>`).join('');
      }

      if (campaignModal) campaignModal.showModal();
    });
  }

  if (btnCloseCampaignModal) btnCloseCampaignModal.addEventListener('click', () => campaignModal.close());
  if (btnCancelCampaign) btnCancelCampaign.addEventListener('click', () => campaignModal.close());

  if (campaignForm) {
    campaignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        sessionId: document.getElementById('ac-session').value || null,
        subject: document.getElementById('ac-subject').value,
        body: document.getElementById('ac-body').value,
      };

      try {
        const res = await apiFetch('/api/admin/campaigns', { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to draft');

        campaignModal.close();
        showToast('Campaign draft created.');
        loadCampaignsList();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  window.sendCampaign = async function (campaignId, subject) {
    if (!confirm(`Are you ready to broadcast "${subject}" to all eligible recipients?`)) return;

    try {
      showToast('Dispatching broadcast queue...');
      const res = await apiFetch(`/api/admin/campaigns/${campaignId}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to dispatch');

      showToast(json.message);
      loadCampaignsList();
    } catch (err) {
      alert(err.message);
    }
  };

  /* --------------------------------------------------------------------------
     9. WEBSITE CONTENT & ANNOUNCEMENTS CMS
     -------------------------------------------------------------------------- */
  async function loadWebsiteContent() {
    try {
      const res = await apiFetch('/api/admin/content');
      const json = await res.json();
      if (!json.success || !json.data) return;

      const data = json.data;

      if (data.announcement) {
        document.getElementById('cms-announcement-enabled').checked = Boolean(data.announcement.enabled);
        document.getElementById('cms-announcement-text').value = data.announcement.text || '';
        document.getElementById('cms-announcement-linktext').value = data.announcement.linkText || '';
        document.getElementById('cms-announcement-linkurl').value = data.announcement.linkUrl || '';
      }

      if (data.hero) {
        document.getElementById('cms-hero-headline').value = data.hero.headline || '';
        document.getElementById('cms-hero-lead').value = data.hero.lead || '';
      }

      if (data.mission) {
        document.getElementById('cms-mission-quote').value = data.mission.quote || '';
      }
    } catch (e) {
      console.error('Error loading CMS content:', e);
    }
  }

  const btnSaveContent = document.getElementById('btn-save-content');
  if (btnSaveContent) {
    btnSaveContent.addEventListener('click', async () => {
      const payload = {
        announcement: {
          enabled: document.getElementById('cms-announcement-enabled').checked,
          text: document.getElementById('cms-announcement-text').value.trim(),
          linkText: document.getElementById('cms-announcement-linktext').value.trim(),
          linkUrl: document.getElementById('cms-announcement-linkurl').value.trim(),
        },
        hero: {
          eyebrow: 'KNOWLEDGE · COMMUNITY · GROWTH',
          tagline: 'BE THE VOICE',
          headline: document.getElementById('cms-hero-headline').value.trim(),
          lead: document.getElementById('cms-hero-lead').value.trim(),
        },
        mission: {
          quote: document.getElementById('cms-mission-quote').value.trim(),
          citation: '— D Maain Voice Charter',
        },
        contact: {
          secretariat: 'D Maain Voice Organizing Committee',
          email: 'inquiries@dmaainvoice.org',
          notes: 'Session announcements are broadcasted through SMART NACOS channels.',
        },
      };

      try {
        btnSaveContent.disabled = true;
        btnSaveContent.textContent = 'Saving...';
        const res = await apiFetch('/api/admin/content', { method: 'PUT', body: JSON.stringify(payload) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to save');
        showToast('Website content updated successfully.');
      } catch (err) {
        alert(err.message);
      } finally {
        btnSaveContent.disabled = false;
        btnSaveContent.textContent = 'Save Website Changes';
      }
    });
  }

  // Initial Check
  checkAuthSession();
})();
