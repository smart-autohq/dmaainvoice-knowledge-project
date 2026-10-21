/**
 * ============================================================================
 * D MAAIN VOICE KNOWLEDGE PROJECT — CLIENT JAVASCRIPT
 * Phase 2: Live Database-Backed Public Application & Registration Engine
 * ============================================================================
 */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     1. APPLICATION STATE
     -------------------------------------------------------------------------- */
  let liveSessions = [];
  let liveFacilitators = [];
  let activeCategory = 'all';
  let activeModalSession = null;
  let lastFocusedElement = null;

  /* --------------------------------------------------------------------------
     2. DOM ELEMENTS CACHE
     -------------------------------------------------------------------------- */
  const header = document.getElementById('site-header');
  const navLinks = document.querySelectorAll('.nav-link');
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const menuCloseBtn = document.getElementById('menu-close-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileNavBackdrop = document.getElementById('mobile-nav-backdrop');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link, .mobile-cta');
  
  // Announcement banner
  const announcementBar = document.getElementById('announcement-bar');
  const announcementText = document.getElementById('announcement-text');
  const announcementLink = document.getElementById('announcement-link');

  // Sessions
  const sessionsContainer = document.getElementById('sessions-container');
  const sessionsEmptyState = document.getElementById('sessions-empty-state');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const resetFilterBtn = document.getElementById('reset-filter-btn');

  // Facilitators
  const facilitatorsContainer = document.getElementById('facilitators-container');
  
  // Modal & Tabs
  const sessionModal = document.getElementById('session-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalDismissBtn = document.getElementById('modal-dismiss-btn');
  const modalSwitchRegisterBtn = document.getElementById('modal-switch-register-btn');
  
  const modalTabOverview = document.getElementById('modal-tab-overview');
  const modalTabRegister = document.getElementById('modal-tab-register');
  const modalViewOverview = document.getElementById('modal-view-overview');
  const modalViewRegister = document.getElementById('modal-view-register');

  const modalTitle = document.getElementById('modal-session-title');
  const modalCategory = document.getElementById('modal-session-category');
  const modalBadge = document.getElementById('modal-session-badge');
  const modalDateTime = document.getElementById('modal-session-datetime');
  const modalFormat = document.getElementById('modal-session-format');
  const modalFacilitator = document.getElementById('modal-session-facilitator');
  const modalStatus = document.getElementById('modal-session-status');
  const modalDescription = document.getElementById('modal-session-description');
  const modalTakeaways = document.getElementById('modal-session-takeaways');

  // Session Registration Form
  const registrationForm = document.getElementById('registration-form');
  const regSessionIdInput = document.getElementById('reg-session-id');
  const regSessionTitlePlaceholder = document.getElementById('reg-session-title-placeholder');
  const regFormAlert = document.getElementById('reg-form-alert');
  const regSubmitBtn = document.getElementById('reg-submit-btn');
  const regSuccessCard = document.getElementById('reg-success-card');
  const regSuccessMessage = document.getElementById('reg-success-message');
  const successSessionTitle = document.getElementById('success-session-title');
  const successAttendeeName = document.getElementById('success-attendee-name');
  const regDoneBtn = document.getElementById('reg-done-btn');

  // Participant Registration (Become a Participant)
  const participantModal = document.getElementById('participant-modal');
  const participantModalCloseBtn = document.getElementById('participant-modal-close-btn');
  const headerBecomeParticipantBtn = document.getElementById('header-become-participant-btn');
  const mobileBecomeParticipantBtn = document.getElementById('mobile-become-participant-btn');
  const heroBecomeParticipantBtn = document.getElementById('hero-become-participant-btn');
  const participantRegistrationForm = document.getElementById('participant-registration-form');
  const participantFormAlert = document.getElementById('participant-form-alert');
  const participantSubmitBtn = document.getElementById('part-submit-btn');
  const participantViewForm = document.getElementById('participant-view-form');
  const participantSuccessCard = document.getElementById('participant-success-card');
  const participantSuccessMessage = document.getElementById('participant-success-message');
  const participantSuccessName = document.getElementById('participant-success-name');
  const participantBrowseSessionsBtn = document.getElementById('participant-browse-sessions-btn');
  const participantDoneBtn = document.getElementById('participant-done-btn');

  const currentYearSpan = document.getElementById('current-year');
  const toastBanner = document.getElementById('toast');

  /* --------------------------------------------------------------------------
     3. UTILITY FUNCTIONS
     -------------------------------------------------------------------------- */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let toastTimer = null;
  function showToast(message) {
    if (!toastBanner) return;
    toastBanner.textContent = message;
    toastBanner.hidden = false;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastBanner.hidden = true;
    }, 4500);
  }

  /**
   * Safe shared response parser for all frontend API calls:
   * - Reads response body stream exactly once via text()
   * - Safely verifies presence of content before parsing JSON
   * - Gracefully extracts structured error details or provides clear HTTP messages
   * - Never throws "Unexpected end of JSON input" on empty/HTML responses
   */
  async function parseApiResponse(response, endpointName = 'API') {
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

  /* --------------------------------------------------------------------------
     4. DATA FETCHING (API INTEGRATION)
     -------------------------------------------------------------------------- */
  async function loadAnnouncementContent() {
    try {
      const res = await fetch('/api/content');
      const parsed = await parseApiResponse(res, 'Announcement Content');
      if (!parsed.ok) return;

      const json = parsed.data;
      if (json && json.success && json.data && json.data.announcement && json.data.announcement.enabled) {
        if (announcementBar) announcementBar.hidden = false;
        if (announcementText) announcementText.textContent = json.data.announcement.text;
        if (announcementLink) {
          announcementLink.textContent = json.data.announcement.linkText || 'Explore Sessions →';
          announcementLink.setAttribute('href', json.data.announcement.linkUrl || '#sessions');
        }
      }
    } catch (e) {
      console.warn('Could not load announcement banner:', e);
    }
  }

  async function loadSessions() {
    if (sessionsContainer) {
      sessionsContainer.innerHTML = '<div class="empty-state-card"><p>Loading upcoming knowledge sessions...</p></div>';
    }

    try {
      const res = await fetch('/api/sessions');
      const parsed = await parseApiResponse(res, 'Sessions Calendar');
      if (!parsed.ok) throw new Error(parsed.error || `HTTP error ${res.status}`);

      const json = parsed.data;
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        liveSessions = json.data;
      } else {
        // Fallback to sample data if database is empty
        liveSessions = getSampleSessions();
      }
    } catch (err) {
      console.warn('Falling back to sample session calendar (offline or dev):', err.message);
      liveSessions = getSampleSessions();
    }

    renderSessions(activeCategory);
  }

  async function loadFacilitators() {
    try {
      const res = await fetch('/api/facilitators');
      const parsed = await parseApiResponse(res, 'Facilitators Roster');
      if (!parsed.ok) throw new Error(parsed.error || `HTTP error ${res.status}`);

      const json = parsed.data;
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        liveFacilitators = json.data;
      } else {
        liveFacilitators = getSampleFacilitators();
      }
    } catch (err) {
      console.warn('Falling back to sample facilitators roster:', err.message);
      liveFacilitators = getSampleFacilitators();
    }

    renderFacilitators();
  }

  /* --------------------------------------------------------------------------
     5. DYNAMIC RENDERING FUNCTIONS
     -------------------------------------------------------------------------- */
  function getCategoryLabel(cat) {
    if (!cat) return 'Knowledge Track';
    const c = String(cat).trim().toLowerCase();
    if (c === 'finance' || c === 'islamic-finance' || c === 'islamic finance') return 'Islamic Finance';
    if (c === 'business') return 'Business';
    if (c === 'personal-development' || c === 'personal development') return 'Personal Development';
    if (c === 'public-speaking' || c === 'public speaking') return 'Public Speaking';
    if (c === 'technology' || c === 'tech') return 'Technology';
    if (c === 'career' || c === 'career & growth' || c === 'career and growth') return 'Career & Growth';
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  function matchesCategory(sessionCat, filterCat) {
    if (!filterCat || filterCat === 'all') return true;
    if (!sessionCat) return false;
    const s = String(sessionCat).trim().toLowerCase();
    const f = String(filterCat).trim().toLowerCase();
    if (s === f) return true;
    if ((f === 'finance' || f === 'islamic-finance' || f === 'islamic finance') &&
        (s === 'finance' || s === 'islamic-finance' || s === 'islamic finance')) return true;
    if ((f === 'personal-development' || f === 'personal development') &&
        (s === 'personal-development' || s === 'personal development')) return true;
    if ((f === 'business') && (s === 'business')) return true;
    if ((f === 'technology' || f === 'tech') && (s === 'technology' || s === 'tech')) return true;
    if ((f === 'public-speaking' || f === 'public speaking') &&
        (s === 'public-speaking' || s === 'public speaking')) return true;
    if ((f === 'career' || f === 'career & growth') &&
        (s === 'career' || s === 'career & growth')) return true;
    return false;
  }

  function renderSessions(category = 'all') {
    if (!sessionsContainer) return;

    const filtered = (category === 'all')
      ? liveSessions
      : liveSessions.filter(s => matchesCategory(s.category, category));

    if (filtered.length === 0) {
      sessionsContainer.innerHTML = '';
      if (sessionsEmptyState) sessionsEmptyState.hidden = false;
      return;
    }

    if (sessionsEmptyState) sessionsEmptyState.hidden = true;

    sessionsContainer.innerHTML = filtered.map(session => {
      const facilitatorName = session.facilitator ? session.facilitator.name : 'Facilitator TBD';
      const statusLabel = session.statusText || 'Open for Registration';
      const statusClass = session.statusClass || 'status-open';
      const badgeLabel = session.categoryLabel || getCategoryLabel(session.category);

      return `
        <article class="session-card" data-category="${escapeHTML(session.category)}" id="${escapeHTML(session.id)}">
          <div class="session-card-header">
            <span class="session-category-badge">${escapeHTML(badgeLabel)}</span>
            <span class="session-status-badge ${escapeHTML(statusClass)}">${escapeHTML(statusLabel)}</span>
          </div>
          
          <h3 class="session-title">${escapeHTML(session.title)}</h3>
          <p class="session-description">${escapeHTML(session.description)}</p>
          
          <div class="session-meta-list">
            <div class="session-meta-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span><strong>Date:</strong> ${escapeHTML(session.date)}</span>
            </div>
            <div class="session-meta-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span><strong>Time:</strong> ${escapeHTML(session.time)}</span>
            </div>
            <div class="session-meta-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span><strong>Facilitator:</strong> ${escapeHTML(facilitatorName)}</span>
            </div>
          </div>

          <div class="session-card-footer" style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${session.isOpenForRegistration ? `
              <button 
                type="button" 
                class="btn btn-primary" 
                style="padding: 0.5rem 1rem; font-size: 0.8125rem;"
                data-action="register-now" 
                data-session-id="${escapeHTML(session.id)}"
                aria-label="Register for session: ${escapeHTML(session.title)}"
              >
                Register for Session
              </button>
            ` : ''}
            <button 
              type="button" 
              class="btn btn-secondary session-cta-btn" 
              data-action="view-details" 
              data-session-id="${escapeHTML(session.id)}"
              aria-label="View details for session: ${escapeHTML(session.title)}"
            >
              Session Details
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderFacilitators() {
    if (!facilitatorsContainer) return;

    if (liveFacilitators.length === 0) {
      facilitatorsContainer.innerHTML = '<p class="empty-state-desc">Facilitators roster will be announced shortly.</p>';
      return;
    }

    facilitatorsContainer.innerHTML = liveFacilitators.map(f => `
      <div class="facilitator-card" id="${escapeHTML(f.id)}">
        <div class="facilitator-header">
          <div class="facilitator-avatar-box" aria-hidden="true">
            ${escapeHTML(f.initials || 'DM')}
          </div>
          <div class="facilitator-titles">
            <h3 class="facilitator-name">${escapeHTML(f.name)}</h3>
            <span class="facilitator-role">${escapeHTML(f.role || f.title || '')}</span>
          </div>
        </div>
        <p class="facilitator-bio">${escapeHTML(f.bio)}</p>
        <div class="facilitator-topics">
          ${(f.topics || f.expertise || []).map(t => `<span class="facilitator-topic-tag">${escapeHTML(t)}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  /* --------------------------------------------------------------------------
     6. MODAL TABS & REGISTRATION FLOW
     -------------------------------------------------------------------------- */
  function switchModalTab(tabName) {
    if (tabName === 'overview') {
      if (modalTabOverview) {
        modalTabOverview.classList.add('active');
        modalTabOverview.setAttribute('aria-selected', 'true');
      }
      if (modalTabRegister) {
        modalTabRegister.classList.remove('active');
        modalTabRegister.setAttribute('aria-selected', 'false');
      }
      if (modalViewOverview) modalViewOverview.hidden = false;
      if (modalViewRegister) modalViewRegister.hidden = true;
      if (modalSwitchRegisterBtn) {
        modalSwitchRegisterBtn.textContent = 'Register for Session';
        modalSwitchRegisterBtn.style.display = (activeModalSession && activeModalSession.isOpenForRegistration) ? 'inline-flex' : 'none';
      }
    } else if (tabName === 'register') {
      if (modalTabRegister) {
        modalTabRegister.classList.add('active');
        modalTabRegister.setAttribute('aria-selected', 'true');
      }
      if (modalTabOverview) {
        modalTabOverview.classList.remove('active');
        modalTabOverview.setAttribute('aria-selected', 'false');
      }
      if (modalViewRegister) modalViewRegister.hidden = false;
      if (modalViewOverview) modalViewOverview.hidden = true;
      if (modalSwitchRegisterBtn) modalSwitchRegisterBtn.style.display = 'none';

      // Focus first input
      const firstInput = document.getElementById('reg-full-name');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  function openSessionModal(sessionId, initialTab = 'overview') {
    const session = liveSessions.find(s => s.id === sessionId);
    if (!session || !sessionModal) return;

    activeModalSession = session;
    lastFocusedElement = document.activeElement;

    // Reset Form state
    if (registrationForm) {
      registrationForm.reset();
      registrationForm.hidden = false;
    }
    if (regFormAlert) regFormAlert.hidden = true;
    if (regSuccessCard) regSuccessCard.hidden = true;
    if (regSessionIdInput) regSessionIdInput.value = session.id;
    if (regSessionTitlePlaceholder) regSessionTitlePlaceholder.textContent = session.title;

    // Populate Overview
    if (modalTitle) modalTitle.textContent = session.title;
    if (modalCategory) modalCategory.textContent = session.categoryLabel || getCategoryLabel(session.category) || 'Knowledge Track';
    if (modalBadge) {
      modalBadge.textContent = session.statusText || 'Upcoming';
      modalBadge.className = `modal-status-badge ${session.statusClass || ''}`;
    }
    if (modalDateTime) modalDateTime.textContent = `${session.date} | ${session.time}`;
    if (modalFormat) modalFormat.textContent = session.venue || session.format || 'Virtual Seminar';
    if (modalFacilitator) {
      const fName = session.facilitator ? `${session.facilitator.name} (${session.facilitator.role || ''})` : 'Knowledge Facilitator';
      modalFacilitator.textContent = fName;
    }
    if (modalStatus) {
      modalStatus.textContent = session.isFull ? 'Capacity Reached' : (session.isOpenForRegistration ? 'Open for Registration' : 'Upcoming');
    }
    if (modalDescription) modalDescription.textContent = session.description;

    // Takeaways list
    if (modalTakeaways) {
      const takeaways = session.takeaways || [
        'Interactive real-world case discussions and architectural insights',
        'Direct Q&A with experienced industry facilitators',
        'Actionable strategies for career capital and public eloquence',
        'Structured follow-up learning resources and reference materials'
      ];
      modalTakeaways.innerHTML = takeaways.map(t => `<li>${escapeHTML(t)}</li>`).join('');
    }

    // Tab button setup
    if (modalTabRegister) {
      if (session.isFull) {
        modalTabRegister.textContent = 'Capacity Reached';
        modalTabRegister.disabled = true;
      } else if (!session.isOpenForRegistration) {
        modalTabRegister.textContent = 'Registration Opening Soon';
        modalTabRegister.disabled = true;
      } else {
        modalTabRegister.textContent = 'Register for Session';
        modalTabRegister.disabled = false;
      }
    }

    switchModalTab(initialTab);

    // Native HTML5 dialog show
    if (typeof sessionModal.showModal === 'function') {
      sessionModal.showModal();
    } else {
      sessionModal.setAttribute('open', '');
    }

    document.body.style.overflow = 'hidden';
  }

  function closeSessionModal() {
    if (!sessionModal) return;

    if (typeof sessionModal.close === 'function') {
      sessionModal.close();
    } else {
      sessionModal.removeAttribute('open');
    }

    document.body.style.overflow = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    activeModalSession = null;
  }

  /* --------------------------------------------------------------------------
     7. REGISTRATION FORM SUBMISSION
     -------------------------------------------------------------------------- */
  async function handleRegistrationSubmit(e) {
    e.preventDefault();
    if (!registrationForm || !activeModalSession) return;

    // Reset alert
    if (regFormAlert) {
      regFormAlert.hidden = true;
      regFormAlert.className = 'form-alert';
    }

    const formData = new FormData(registrationForm);
    const fullName = formData.get('fullName')?.trim() || '';
    const email = formData.get('email')?.trim() || '';
    const sessionId = formData.get('sessionId') || activeModalSession.id;

    // Client-side quick check
    if (!fullName || fullName.length < 2) {
      showFormAlert('Please provide your full name (at least 2 characters).', 'error');
      const nameInput = document.getElementById('reg-full-name');
      if (nameInput) nameInput.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showFormAlert('Please provide a valid email address (e.g. name@domain.com).', 'error');
      const emailInput = document.getElementById('reg-email');
      if (emailInput) emailInput.focus();
      return;
    }

    const payload = {
      sessionId,
      fullName,
      email,
    };

    // Set loading state
    if (regSubmitBtn) {
      regSubmitBtn.disabled = true;
      const textSpan = regSubmitBtn.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Confirming Seat...';
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const parsed = await parseApiResponse(response, 'Session Registration');
      if (!parsed.ok) {
        throw new Error(parsed.error || 'Registration failed');
      }

      const result = parsed.data || {};

      // Success view
      if (registrationForm) registrationForm.hidden = true;
      if (regSuccessCard) regSuccessCard.hidden = false;
      if (successSessionTitle) successSessionTitle.textContent = activeModalSession.title;
      if (successAttendeeName) successAttendeeName.textContent = `${fullName} (${email})`;
      if (regSuccessMessage) {
        regSuccessMessage.textContent = result.message || `A confirmation email has been dispatched to ${email}. Your seat is confirmed.`;
      }

      showToast(`Registration confirmed for ${activeModalSession.title}!`);

      // Update local registration counter if applicable
      if (typeof activeModalSession.registrationsCount === 'number') {
        activeModalSession.registrationsCount++;
      }
    } catch (err) {
      showFormAlert(err.message, 'error');
    } finally {
      if (regSubmitBtn) {
        regSubmitBtn.disabled = false;
        const textSpan = regSubmitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Confirm Free Registration';
      }
    }
  }

  function showFormAlert(message, type = 'error') {
    if (!regFormAlert) return;
    regFormAlert.textContent = message;
    regFormAlert.className = `form-alert ${type === 'error' ? 'alert-error' : 'alert-success'}`;
    regFormAlert.hidden = false;
    regFormAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* --------------------------------------------------------------------------
     8. PARTICIPANT COMMUNITY REGISTRATION ("BECOME A PARTICIPANT")
     -------------------------------------------------------------------------- */
  function openParticipantModal() {
    if (!participantModal) return;
    lastFocusedElement = document.activeElement;

    // Reset Form state
    if (participantRegistrationForm) {
      participantRegistrationForm.reset();
    }
    if (participantViewForm) participantViewForm.hidden = false;
    if (participantSuccessCard) participantSuccessCard.hidden = true;
    if (participantFormAlert) {
      participantFormAlert.hidden = true;
      participantFormAlert.className = 'form-alert';
    }

    // Close mobile nav drawer if open
    if (mobileNav && mobileNav.classList.contains('is-open')) {
      mobileNav.classList.remove('is-open');
      if (menuToggleBtn) menuToggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (typeof participantModal.showModal === 'function') {
      participantModal.showModal();
    } else {
      participantModal.setAttribute('open', '');
    }

    document.body.style.overflow = 'hidden';

    // Auto-focus full name input
    const nameInput = document.getElementById('part-full-name');
    if (nameInput) setTimeout(() => nameInput.focus(), 80);
  }

  function closeParticipantModal() {
    if (!participantModal) return;

    if (typeof participantModal.close === 'function') {
      participantModal.close();
    } else {
      participantModal.removeAttribute('open');
    }

    document.body.style.overflow = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function showParticipantAlert(message, type = 'error') {
    if (!participantFormAlert) return;
    participantFormAlert.textContent = message;
    participantFormAlert.className = `form-alert ${type === 'error' ? 'alert-error' : 'alert-success'}`;
    participantFormAlert.hidden = false;
    participantFormAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleParticipantSubmit(e) {
    e.preventDefault();
    if (!participantRegistrationForm) return;

    if (participantFormAlert) {
      participantFormAlert.hidden = true;
      participantFormAlert.className = 'form-alert';
    }

    const formData = new FormData(participantRegistrationForm);
    const fullName = formData.get('fullName')?.trim() || '';
    const email = formData.get('email')?.trim() || '';

    // Validation
    if (!fullName || fullName.length < 2) {
      showParticipantAlert('Please provide your full name (at least 2 characters).', 'error');
      const input = document.getElementById('part-full-name');
      if (input) input.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showParticipantAlert('Please provide a valid email address (e.g. name@domain.com).', 'error');
      const input = document.getElementById('part-email');
      if (input) input.focus();
      return;
    }

    if (participantSubmitBtn) {
      participantSubmitBtn.disabled = true;
      const textSpan = participantSubmitBtn.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Joining Community...';
    }

    try {
      const response = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email }),
      });

      const parsed = await parseApiResponse(response, 'Community Registration');
      if (!parsed.ok) {
        throw new Error(parsed.error || 'Participant registration failed');
      }

      const result = parsed.data || {};

      // Success view
      if (participantViewForm) participantViewForm.hidden = true;
      if (participantSuccessCard) participantSuccessCard.hidden = false;
      if (participantSuccessName) participantSuccessName.textContent = `${fullName} (${email})`;
      if (participantSuccessMessage) {
        participantSuccessMessage.textContent = result.message || 'You are now officially registered as a participant in the D Maain Voice Knowledge Project.';
      }

      showToast('Welcome to the D Maain Voice community!');
    } catch (err) {
      showParticipantAlert(err.message, 'error');
    } finally {
      if (participantSubmitBtn) {
        participantSubmitBtn.disabled = false;
        const textSpan = participantSubmitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Join Community as Participant';
      }
    }
  }

  /* --------------------------------------------------------------------------
     8. SAMPLE FALLBACK DATA
     -------------------------------------------------------------------------- */
  function getSampleSessions() {
    return [
      {
        id: 'session-01',
        title: 'The Architecture of a Persuasive Talk: Finding Your Authentic Voice',
        category: 'public-speaking',
        categoryLabel: 'Public Speaking',
        date: 'Saturday, November 7, 2026',
        time: '4:00 PM – 5:30 PM WAT',
        format: 'Interactive Virtual Seminar',
        venue: 'Google Meet (Virtual)',
        facilitator: { name: 'Dr. Amina Bello', role: 'Communications Scholar & Speech Coach' },
        status: 'UPCOMING',
        statusText: 'Open for Registration',
        statusClass: 'status-open',
        isOpenForRegistration: true,
        isFull: false,
        description: 'Master the art of structuring complex thoughts into compelling spoken narratives. Learn how to connect with diverse audiences, overcome stage anxiety, and articulate your ideas with clarity and conviction.',
        takeaways: [
          'Overcoming public speaking anxiety using physiological breathing anchors',
          'The Three-Act structure for technical and keynote presentations',
          'Vocal variety, pacing, and intentional silence in delivery',
          'Hands-on Q&A with live speech critique exercises'
        ]
      },
      {
        id: 'session-02',
        title: 'Scaling Modern Web Applications on Serverless Architectures',
        category: 'technology',
        categoryLabel: 'Technology',
        date: 'Saturday, November 21, 2026',
        time: '5:00 PM – 6:30 PM WAT',
        format: 'Technical Masterclass',
        venue: 'Google Meet (Virtual)',
        facilitator: { name: 'Ibrahim Adeleke', role: 'Staff Software Architect & Tech Mentor' },
        status: 'UPCOMING',
        statusText: 'Upcoming',
        statusClass: 'status-upcoming',
        isOpenForRegistration: true,
        isFull: false,
        description: 'An actionable roadmap for emerging software developers and computing students. Go beyond syntax to understand architectural thinking, serverless scaling, and distributed reliability.',
        takeaways: [
          'Transitioning from monoliths to event-driven architectures',
          'Database connection pooling and edge compute paradigms',
          'Building resilient open-source technical portfolios',
          'Continuous learning strategies amidst rapid tooling evolution'
        ]
      },
      {
        id: 'session-03',
        title: 'Strategic Curiosity: Building Career Capital in Tech & Business',
        category: 'career',
        categoryLabel: 'Career & Growth',
        date: 'Saturday, December 5, 2026',
        time: '4:30 PM – 6:00 PM WAT',
        format: 'Panel & Discussion',
        venue: 'Zoom (Virtual)',
        facilitator: { name: 'Zainab Al-Hassan', role: 'People Operations Lead & Career Strategist' },
        status: 'UPCOMING',
        statusText: 'Upcoming',
        statusClass: 'status-upcoming',
        isOpenForRegistration: true,
        isFull: false,
        description: 'Uncover the principles behind sustainable professional growth. Discover how to identify high-leverage learning opportunities, cultivate executive presence, and create valuable professional networks.',
        takeaways: [
          'The concept of "Career Capital" and how rare skills compound',
          'Effective networking without transactional awkwardness',
          'Managing cross-functional communication and constructive feedback',
          'Crafting a 2-year personal professional development thesis'
        ]
      },
      {
        id: 'session-04',
        title: 'Principles of Ethical Wealth & Islamic Finance for Young Professionals',
        category: 'finance',
        categoryLabel: 'Islamic Finance',
        date: 'Saturday, December 19, 2026',
        time: '4:00 PM – 5:30 PM WAT',
        format: 'Foundational Workshop',
        venue: 'Google Meet (Virtual)',
        facilitator: { name: 'Farouk Usman', role: 'Ethical Finance Advisor & Research Fellow' },
        status: 'UPCOMING',
        statusText: 'Upcoming',
        statusClass: 'status-upcoming',
        isOpenForRegistration: true,
        isFull: false,
        description: 'A comprehensive, accessible exploration of ethical commerce and Shari’ah-compliant personal finance. Learn the foundations of Halal investments, wealth preservation, and purposeful philanthropy.',
        takeaways: [
          'Core tenets of Islamic commercial jurisprudence (avoidance of Riba, Gharar, and Maysir)',
          'Screening equities, mutual funds, and modern fintech products for compliance',
          'Long-term ethical wealth accumulation and budgeting frameworks',
          'The role of Zakat and Sadaqah in personal financial planning'
        ]
      }
    ];
  }

  function getSampleFacilitators() {
    return [
      {
        id: 'facilitator-01',
        name: 'Dr. Amina Bello',
        role: 'Speech Coach & Communications Scholar',
        initials: 'AB',
        bio: 'Over a decade of experience guiding university leaders, researchers, and early-career professionals in mastering persuasive rhetoric and authoritative public delivery.',
        topics: ['Public Speaking', 'Rhetoric', 'Stage Presence']
      },
      {
        id: 'facilitator-02',
        name: 'Ibrahim Adeleke',
        role: 'Staff Software Architect & Open Source Contributor',
        initials: 'IA',
        bio: 'Leading backend engineering teams and mentoring university computing communities across Nigeria in distributed systems, clean architecture, and career sustainability.',
        topics: ['System Design', 'Tech Careers', 'Cloud Computing']
      },
      {
        id: 'facilitator-03',
        name: 'Farouk Usman',
        role: 'Ethical Finance Advisor & Researcher',
        initials: 'FU',
        bio: 'Advising young professionals on Halal asset allocation, ethical investment evaluation, and the intersection of modern technology and Islamic financial principles.',
        topics: ['Islamic Finance', 'Ethical Wealth', 'Fintech']
      }
    ];
  }

  /* --------------------------------------------------------------------------
     9. EVENT LISTENERS & INITIALIZATION
     -------------------------------------------------------------------------- */
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }

  // Load live data from API
  loadAnnouncementContent();
  loadSessions();
  loadFacilitators();

  // Category filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const category = this.getAttribute('data-category');
      activeCategory = category;

      filterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });

      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');

      renderSessions(category);
    });
  });

  // Reset filter button
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      activeCategory = 'all';
      filterTabs.forEach(t => {
        const isAll = t.getAttribute('data-category') === 'all';
        t.classList.toggle('active', isAll);
        t.setAttribute('aria-selected', isAll ? 'true' : 'false');
      });
      renderSessions('all');
    });
  }

  // Session card action delegation (Details vs Register)
  if (sessionsContainer) {
    sessionsContainer.addEventListener('click', (e) => {
      const detailsBtn = e.target.closest('[data-action="view-details"]');
      if (detailsBtn) {
        const sessionId = detailsBtn.getAttribute('data-session-id');
        openSessionModal(sessionId, 'overview');
        return;
      }

      const registerBtn = e.target.closest('[data-action="register-now"]');
      if (registerBtn) {
        const sessionId = registerBtn.getAttribute('data-session-id');
        openSessionModal(sessionId, 'register');
        return;
      }
    });
  }

  // Modal tab switching
  if (modalTabOverview) {
    modalTabOverview.addEventListener('click', () => switchModalTab('overview'));
  }
  if (modalTabRegister) {
    modalTabRegister.addEventListener('click', () => switchModalTab('register'));
  }
  if (modalSwitchRegisterBtn) {
    modalSwitchRegisterBtn.addEventListener('click', () => switchModalTab('register'));
  }

  // Modal close handlers
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeSessionModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeSessionModal);
  if (regDoneBtn) regDoneBtn.addEventListener('click', closeSessionModal);

  // Registration form submission
  if (registrationForm) {
    registrationForm.addEventListener('submit', handleRegistrationSubmit);
  }

  // Close modal when clicking backdrop
  if (sessionModal) {
    sessionModal.addEventListener('click', (e) => {
      if (e.target === sessionModal) {
        closeSessionModal();
      }
    });

    sessionModal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeSessionModal();
    });
  }

  // Participant Registration ("Become a Participant") CTA listeners
  if (headerBecomeParticipantBtn) {
    headerBecomeParticipantBtn.addEventListener('click', openParticipantModal);
  }
  if (mobileBecomeParticipantBtn) {
    mobileBecomeParticipantBtn.addEventListener('click', openParticipantModal);
  }
  if (heroBecomeParticipantBtn) {
    heroBecomeParticipantBtn.addEventListener('click', openParticipantModal);
  }
  if (participantModalCloseBtn) {
    participantModalCloseBtn.addEventListener('click', closeParticipantModal);
  }
  if (participantDoneBtn) {
    participantDoneBtn.addEventListener('click', closeParticipantModal);
  }
  if (participantBrowseSessionsBtn) {
    participantBrowseSessionsBtn.addEventListener('click', () => {
      closeParticipantModal();
      const sessionsSection = document.getElementById('sessions');
      if (sessionsSection) {
        sessionsSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
  if (participantRegistrationForm) {
    participantRegistrationForm.addEventListener('submit', handleParticipantSubmit);
  }
  if (participantModal) {
    participantModal.addEventListener('click', (e) => {
      if (e.target === participantModal) {
        closeParticipantModal();
      }
    });

    participantModal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeParticipantModal();
    });
  }

  // Mobile menu handlers
  if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', () => {
      const isOpen = mobileNav && mobileNav.classList.contains('is-open');
      if (isOpen) {
        mobileNav.classList.remove('is-open');
        menuToggleBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      } else {
        mobileNav.classList.add('is-open');
        menuToggleBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  if (menuCloseBtn) {
    menuCloseBtn.addEventListener('click', () => {
      if (mobileNav) mobileNav.classList.remove('is-open');
      if (menuToggleBtn) menuToggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  }

  if (mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener('click', () => {
      if (mobileNav) mobileNav.classList.remove('is-open');
      if (menuToggleBtn) menuToggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  }

  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileNav) mobileNav.classList.remove('is-open');
      if (menuToggleBtn) menuToggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Keyboard navigation: Escape key closes modal or mobile nav
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (sessionModal && sessionModal.open) {
        closeSessionModal();
      } else if (mobileNav && mobileNav.classList.contains('is-open')) {
        mobileNav.classList.remove('is-open');
        if (menuToggleBtn) menuToggleBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    }
  });

  // Footer Learning Track links click filter
  document.querySelectorAll('[data-filter]').forEach(trackLink => {
    trackLink.addEventListener('click', function () {
      const targetCategory = this.getAttribute('data-filter');
      const matchingTab = Array.from(filterTabs).find(t => t.getAttribute('data-category') === targetCategory);
      if (matchingTab) {
        matchingTab.click();
      }
    });
  });

  // Expose API for testing
  window.DMaainVoiceApp = {
    getSessions: () => liveSessions,
    getFacilitators: () => liveFacilitators,
    reload: () => { loadSessions(); loadFacilitators(); },
    openModal: (id, tab) => openSessionModal(id, tab),
  };

  console.log('D Maain Voice Knowledge Project: Phase 2 initialized with Neon live backend.');
})();
