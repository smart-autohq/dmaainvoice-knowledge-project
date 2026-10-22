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
  let activeSessionSchema = null;
  let currentStepIndex = 0;
  let registrationAnswers = {};
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
  const regProgressWrapper = document.getElementById('reg-progress-wrapper');
  const regStepIndicators = document.getElementById('reg-step-indicators');
  const regStepFill = document.getElementById('reg-step-fill');
  const regStepContent = document.getElementById('reg-step-content');
  const regPrevBtn = document.getElementById('reg-prev-btn');
  const regNextBtn = document.getElementById('reg-next-btn');
  const regFormAlert = document.getElementById('reg-form-alert');
  const regSubmitBtn = document.getElementById('reg-submit-btn');
  const regSuccessCard = document.getElementById('reg-success-card');
  const regSuccessMessage = document.getElementById('reg-success-message');
  const successSessionTitle = document.getElementById('success-session-title');
  const successAttendeeName = document.getElementById('success-attendee-name');
  const successSessionMeta = document.getElementById('success-session-meta');
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
      const firstInput = regStepContent ? regStepContent.querySelector('input, textarea, select') : null;
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  async function openSessionModal(sessionId, initialTab = 'overview') {
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

    // Fetch and initialize dynamic registration questions
    loadSessionQuestions(session.id);

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
    activeSessionSchema = null;
  }

  /* --------------------------------------------------------------------------
     7. MULTI-STEP DATA-DRIVEN REGISTRATION ENGINE
     -------------------------------------------------------------------------- */
  async function loadSessionQuestions(sessionId) {
    if (regStepContent) {
      regStepContent.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--color-muted);"><span class="btn-spinner" style="display:inline-block; margin-right: 8px;"></span>Loading registration details...</div>';
    }

    try {
      const res = await fetch(`/api/questions?sessionId=${encodeURIComponent(sessionId)}`);
      const parsed = await parseApiResponse(res, 'Session Questions Schema');
      const schemaData = (parsed && parsed.data && (parsed.data.data || parsed.data)) || null;

      if (parsed && parsed.ok && schemaData && Array.isArray(schemaData.steps) && schemaData.steps.length > 0) {
        activeSessionSchema = schemaData;
      } else {
        // Fallback schema if API fails
        activeSessionSchema = getDefaultRegistrationSchema(activeModalSession);
      }
    } catch (err) {
      console.warn('Using default registration schema fallback:', err.message);
      activeSessionSchema = getDefaultRegistrationSchema(activeModalSession);
    }

    initMultiStepRegistration();
  }

  function getDefaultRegistrationSchema(session) {
    const cat = (session?.category || '').toLowerCase();
    const customQuestions = [];
    if (cat === 'finance' || cat === 'islamic-finance' || cat === 'islamic finance') {
      customQuestions.push({
        id: 'q_finance_familiarity',
        label: 'Level of Familiarity with Islamic Finance & Ethical Wealth',
        type: 'radio',
        helperText: 'Select the option that best reflects your current knowledge.',
        required: true,
        options: [
          'Beginner — Completely new to Halal & Islamic finance concepts',
          'Intermediate — Familiar with core principles (avoiding Riba, Gharar, and Maisir)',
          'Advanced — Actively investing in or managing Shariah-compliant assets'
        ]
      });
      customQuestions.push({
        id: 'q_finance_interests',
        label: 'Which Halal Wealth topics are you most eager to explore?',
        type: 'checkbox',
        helperText: 'Select all areas of interest that apply.',
        required: false,
        allowOther: true,
        options: [
          'Halal Equities Screening & Shariah Stock Criteria',
          'Sukuk (Islamic Fixed Income Bonds) & Sovereign Issues',
          'Ethical Real Estate & Asset-Backed Financing',
          'Takaful (Islamic Cooperative Insurance) Models',
          'Zakat Calculation, Purification & Islamic Wealth Planning'
        ]
      });
      customQuestions.push({
        id: 'q_giveaway',
        label: 'Would you like to participate in the interactive session airtime giveaway?',
        type: 'radio',
        helperText: 'Active live participants qualify for special cohort airtime rewards.',
        required: true,
        options: ['Yes', 'No']
      });
      customQuestions.push({
        id: 'q_giveaway_details',
        label: 'Giveaway Phone Number & Network Provider',
        type: 'text',
        placeholder: 'e.g. 08031234567 - MTN',
        helperText: 'Please provide the number and telecom network to receive the airtime.',
        required: true,
        dependsOn: { questionId: 'q_giveaway', value: 'Yes' }
      });
      customQuestions.push({
        id: 'q_facilitator_qa',
        label: 'Specific Question for the Facilitator',
        type: 'textarea',
        placeholder: 'What question or real-world scenario would you like the facilitator to address?',
        helperText: 'Curated questions will be prioritized during the dedicated Q&A session.',
        required: false
      });
    }

    const steps = [
      {
        id: 'step_profile',
        title: 'Participant Profile',
        subtitle: 'Basic details for communication & event coordinates',
        questions: [
          { id: 'fullName', label: 'Full Name', type: 'text', placeholder: 'e.g. Amina Bello', required: true },
          { id: 'email', label: 'Email Address', type: 'email', placeholder: 'name@domain.com', required: true },
          { id: 'phone', label: 'WhatsApp / Mobile Number', type: 'tel', placeholder: '+234 803 123 4567', required: true },
          { id: 'occupation', label: 'Occupation / Field of Practice', type: 'text', placeholder: 'e.g. Software Engineer, Student', required: false },
          { id: 'organization', label: 'Organization / Institution', type: 'text', placeholder: 'e.g. University of Lagos', required: false },
          { id: 'state', label: 'State of Residence', type: 'text', placeholder: 'e.g. Lagos, Abuja', required: false },
        ],
      }
    ];

    if (customQuestions.length > 0) {
      steps.push({
        id: 'step_questions',
        title: 'Session & Track Focus',
        subtitle: `Specific questions for the ${getCategoryLabel(session?.category)} track`,
        questions: customQuestions,
      });
    }

    steps.push({
      id: 'step_review',
      title: 'Review & Confirmation',
      subtitle: 'Confirm your registration details before submitting',
      questions: [],
    });

    return {
      session: {
        id: session?.id || '',
        title: session?.title || 'Session',
        category: session?.category || 'general',
        facilitator: session?.facilitator || null,
      },
      steps,
    };
  }

  function initMultiStepRegistration() {
    currentStepIndex = 0;
    registrationAnswers = {};

    renderStepIndicators();
    renderCurrentStepView();
  }

  function renderStepIndicators() {
    if (!regStepIndicators || !activeSessionSchema || !activeSessionSchema.steps) return;

    const steps = activeSessionSchema.steps;
    regStepIndicators.innerHTML = steps.map((step, idx) => {
      let statusClass = '';
      if (idx === currentStepIndex) statusClass = 'active';
      else if (idx < currentStepIndex) statusClass = 'completed';

      let shortLabel = (step.title || '').split(' ')[0];
      if (step.id === 'step_questions') shortLabel = 'Track Focus';
      else if (step.id === 'step_profile') shortLabel = 'Participant';
      else if (step.id === 'step_review') shortLabel = 'Review';

      return `
        <div class="step-indicator-item ${statusClass}">
          <div class="step-circle">${idx < currentStepIndex ? '✓' : idx + 1}</div>
          <span class="step-label">${escapeHTML(shortLabel)}</span>
        </div>
      `;
    }).join('');

    if (regStepFill) {
      const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;
      regStepFill.style.width = `${progressPercent}%`;
    }
  }

  function renderCurrentStepView() {
    if (!regStepContent || !activeSessionSchema || !activeSessionSchema.steps) return;

    if (regFormAlert) regFormAlert.hidden = true;

    const step = activeSessionSchema.steps[currentStepIndex];
    const isReviewStep = currentStepIndex === activeSessionSchema.steps.length - 1;

    // Header
    let html = `
      <div class="step-header">
        <h4 class="step-title">${escapeHTML(step.title)}</h4>
        <p class="step-subtitle">${escapeHTML(step.subtitle)}</p>
      </div>
    `;

    if (isReviewStep) {
      html += renderReviewStepView();
    } else {
      html += `
        <div class="questions-list" style="display: flex; flex-direction: column; gap: var(--space-md);">
          ${step.questions.map(q => renderQuestionField(q, registrationAnswers[q.id])).join('')}
        </div>
      `;
    }

    regStepContent.innerHTML = html;

    // Setup conditionality listeners
    if (!isReviewStep) {
      setupConditionalFields(step.questions);
      // Focus first input
      const firstInput = regStepContent.querySelector('input, textarea, select');
      if (firstInput) setTimeout(() => firstInput.focus(), 80);
    }

    // Update navigation buttons
    if (regPrevBtn) {
      regPrevBtn.style.display = currentStepIndex > 0 ? 'inline-flex' : 'none';
    }
    if (regNextBtn) {
      regNextBtn.style.display = isReviewStep ? 'none' : 'inline-flex';
    }
    if (regSubmitBtn) {
      regSubmitBtn.style.display = isReviewStep ? 'inline-flex' : 'none';
    }
  }

  function renderQuestionField(q, currentValue) {
    const isConditional = !!q.dependsOn;
    let initialHidden = false;

    if (isConditional) {
      const parentVal = registrationAnswers[q.dependsOn.questionId];
      const expected = q.dependsOn.value;
      const isMet = Array.isArray(parentVal) ? parentVal.includes(expected) : parentVal === expected;
      if (!isMet) initialHidden = true;
    }

    let inputMarkup = '';
    const qId = escapeHTML(q.id);

    switch (q.type) {
      case 'textarea':
        inputMarkup = `
          <textarea id="q_${qId}" name="${qId}" class="form-input" rows="3"
            placeholder="${escapeHTML(q.placeholder || '')}">${escapeHTML(currentValue || '')}</textarea>
        `;
        break;

      case 'radio':
        inputMarkup = `
          <div class="choice-cards-group" role="radiogroup" aria-labelledby="lbl_${qId}">
            ${(q.options || []).map((opt, i) => {
              const optVal = typeof opt === 'object' ? opt.value : opt;
              const optLabel = typeof opt === 'object' ? opt.label : opt;
              const isChecked = currentValue === optVal;
              return `
                <label class="choice-card-label ${isChecked ? 'selected' : ''}">
                  <input type="radio" name="${qId}" value="${escapeHTML(optVal)}" ${isChecked ? 'checked' : ''} ${q.required ? 'required' : ''}>
                  <span>${escapeHTML(optLabel)}</span>
                </label>
              `;
            }).join('')}
          </div>
        `;
        break;

      case 'checkbox':
        const checkedList = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
        const otherChecked = checkedList.some(v => v.startsWith('Other: '));
        const otherText = otherChecked ? checkedList.find(v => v.startsWith('Other: ')).replace(/^Other:\s*/, '') : '';

        inputMarkup = `
          <div class="choice-cards-group">
            ${(q.options || []).map((opt, i) => {
              const optVal = typeof opt === 'object' ? opt.value : opt;
              const optLabel = typeof opt === 'object' ? opt.label : opt;
              const isChecked = checkedList.includes(optVal);
              return `
                <label class="choice-card-label ${isChecked ? 'selected' : ''}">
                  <input type="checkbox" name="${qId}" value="${escapeHTML(optVal)}" ${isChecked ? 'checked' : ''}>
                  <span>${escapeHTML(optLabel)}</span>
                </label>
              `;
            }).join('')}
            ${q.allowOther ? `
              <div class="other-choice-wrapper" style="margin-top: 4px;">
                <label class="choice-card-label ${otherChecked ? 'selected' : ''}">
                  <input type="checkbox" class="other-checkbox-toggle" data-qid="${qId}" ${otherChecked ? 'checked' : ''}>
                  <span>Other (Please specify)</span>
                </label>
                <div class="other-input-box" style="margin-top: 6px; padding-left: 1.5rem; ${otherChecked ? '' : 'display: none;'}">
                  <input type="text" class="form-input other-writein-input" data-qid="${qId}"
                    placeholder="Enter other details..." value="${escapeHTML(otherText)}">
                </div>
              </div>
            ` : ''}
          </div>
        `;
        break;

      case 'select':
        inputMarkup = `
          <select id="q_${qId}" name="${qId}" class="form-input">
            <option value="">— Select an option —</option>
            ${(q.options || []).map(opt => {
              const optVal = typeof opt === 'object' ? opt.value : opt;
              const optLabel = typeof opt === 'object' ? opt.label : opt;
              return `<option value="${escapeHTML(optVal)}" ${currentValue === optVal ? 'selected' : ''}>${escapeHTML(optLabel)}</option>`;
            }).join('')}
          </select>
        `;
        break;

      case 'rating':
        inputMarkup = `
          <div class="rating-scale-group" data-qid="${qId}">
            <input type="hidden" name="${qId}" id="q_${qId}" value="${escapeHTML(currentValue || '')}">
            ${[1, 2, 3, 4, 5].map(n => `
              <button type="button" class="rating-btn ${String(currentValue) === String(n) ? 'active' : ''}" data-val="${n}">${n}</button>
            `).join('')}
          </div>
        `;
        break;

      default: // text, email, tel
        inputMarkup = `
          <input type="${q.type || 'text'}" id="q_${qId}" name="${qId}" class="form-input"
            value="${escapeHTML(currentValue || '')}"
            placeholder="${escapeHTML(q.placeholder || '')}"
            ${q.required ? 'required' : ''}
            autocomplete="${q.type === 'email' ? 'email' : (q.type === 'tel' ? 'tel' : 'on')}">
        `;
    }

    return `
      <div class="question-field ${initialHidden ? 'conditional-hidden' : ''}" id="field_${qId}"
        ${isConditional ? `data-depends-on="${escapeHTML(q.dependsOn.questionId)}" data-depends-val="${escapeHTML(q.dependsOn.value)}"` : ''}>
        <label id="lbl_${qId}" for="q_${qId}" class="question-label">
          ${escapeHTML(q.label)} ${q.required ? '<span class="required" aria-hidden="true">*</span>' : '<span class="optional">(Optional)</span>'}
        </label>
        ${q.helperText ? `<span class="question-helper">${escapeHTML(q.helperText)}</span>` : ''}
        ${inputMarkup}
      </div>
    `;
  }

  function setupConditionalFields(questions) {
    if (!regStepContent) return;

    // 1. Radio / Checkbox styling and conditionality
    regStepContent.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        // Update label card highlight
        const parentGroup = input.closest('.choice-cards-group');
        if (parentGroup) {
          parentGroup.querySelectorAll('.choice-card-label').forEach(lbl => {
            const radioOrBox = lbl.querySelector('input');
            if (radioOrBox && radioOrBox.checked) {
              lbl.classList.add('selected');
            } else {
              lbl.classList.remove('selected');
            }
          });
        }

        // Check if any conditional fields depend on this
        const qName = input.name;
        const val = input.value;
        const dependents = regStepContent.querySelectorAll(`[data-depends-on="${qName}"]`);

        dependents.forEach(dep => {
          const reqVal = dep.getAttribute('data-depends-val');
          if (input.checked && val === reqVal) {
            dep.classList.remove('conditional-hidden');
          } else if (input.type === 'radio' && input.checked && val !== reqVal) {
            dep.classList.add('conditional-hidden');
          }
        });
      });
    });

    // 2. Rating Scale buttons
    regStepContent.querySelectorAll('.rating-scale-group').forEach(group => {
      const hiddenInput = group.querySelector('input[type="hidden"]');
      group.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (hiddenInput) hiddenInput.value = btn.getAttribute('data-val');
        });
      });
    });

    // 3. Checkbox "Other" toggle
    regStepContent.querySelectorAll('.other-checkbox-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const qId = chk.getAttribute('data-qid');
        const writeInBox = regStepContent.querySelector(`.other-writein-input[data-qid="${qId}"]`)?.closest('.other-input-box');
        if (writeInBox) {
          writeInBox.style.display = chk.checked ? 'block' : 'none';
          if (chk.checked) {
            const textInp = writeInBox.querySelector('input');
            if (textInp) textInp.focus();
          }
        }
      });
    });
  }

  function renderReviewStepView() {
    const session = (activeSessionSchema && activeSessionSchema.session) || activeModalSession;

    const commonAnswers = [
      { label: 'Full Name', value: registrationAnswers.fullName },
      { label: 'Email Address', value: registrationAnswers.email },
      { label: 'WhatsApp / Phone', value: registrationAnswers.phone },
      { label: 'Occupation', value: registrationAnswers.occupation },
      { label: 'Organization', value: registrationAnswers.organization },
      { label: 'State / Location', value: registrationAnswers.state },
    ].filter(item => item.value);

    // Collect custom track answers
    const customItems = [];
    if (activeSessionSchema && activeSessionSchema.steps) {
      for (const st of activeSessionSchema.steps) {
        if (st.id === 'step_review' || st.id === 'step_profile') continue;
        for (const q of st.questions) {
          const ans = registrationAnswers[q.id];
          if (ans !== undefined && ans !== null && ans !== '') {
            let displayVal = ans;
            if (Array.isArray(ans)) {
              displayVal = ans.join(', ');
            }
            customItems.push({ label: q.label, value: displayVal });
          }
        }
      }
    }

    return `
      <div class="review-summary-card">
        <div class="review-section">
          <div class="review-section-title">Selected Session</div>
          <div class="review-item">
            <span class="review-item-label">Title</span>
            <span class="review-item-value">${escapeHTML(session.title)}</span>
          </div>
          <div class="review-item">
            <span class="review-item-label">Track & Category</span>
            <span class="review-item-value">${escapeHTML(session.categoryLabel || getCategoryLabel(session.category))}</span>
          </div>
          <div class="review-item">
            <span class="review-item-label">Facilitator</span>
            <span class="review-item-value">${escapeHTML(session.facilitator?.name || 'Knowledge Facilitator')}</span>
          </div>
          <div class="review-item">
            <span class="review-item-label">Format / Venue</span>
            <span class="review-item-value">${escapeHTML(session.venue || session.format || 'Virtual Seminar')}</span>
          </div>
        </div>

        <div class="review-section">
          <div class="review-section-title">Your Contact & Profile</div>
          ${commonAnswers.map(a => `
            <div class="review-item">
              <span class="review-item-label">${escapeHTML(a.label)}</span>
              <span class="review-item-value">${escapeHTML(a.value)}</span>
            </div>
          `).join('')}
        </div>

        ${customItems.length > 0 ? `
          <div class="review-section">
            <div class="review-section-title">Track Specifics & Inquiries</div>
            ${customItems.map(c => `
              <div class="review-item">
                <span class="review-item-label">${escapeHTML(c.label)}</span>
                <span class="review-item-value">${escapeHTML(c.value)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <p class="form-privacy-note" style="margin: 0;">
          <strong>Consent Confirmation:</strong> By clicking "Confirm Seat", you confirm your attendance and agree to receive joining links and cohort materials.
        </p>
      </div>
    `;
  }

  function collectCurrentStepAnswers() {
    if (!regStepContent || !activeSessionSchema || !activeSessionSchema.steps) return;
    const step = activeSessionSchema.steps[currentStepIndex];
    if (!step || !step.questions) return;

    for (const q of step.questions) {
      const qId = q.id;
      const fieldWrapper = regStepContent.querySelector(`#field_${qId}`);

      // If hidden conditionally, leave answer or clear
      if (fieldWrapper && fieldWrapper.classList.contains('conditional-hidden')) {
        delete registrationAnswers[qId];
        continue;
      }

      if (q.type === 'radio') {
        const checked = regStepContent.querySelector(`input[name="${qId}"]:checked`);
        if (checked) registrationAnswers[qId] = checked.value;
      } else if (q.type === 'checkbox') {
        const checkedBoxes = Array.from(regStepContent.querySelectorAll(`input[name="${qId}"]:checked`)).map(c => c.value);
        const otherToggle = regStepContent.querySelector(`.other-checkbox-toggle[data-qid="${qId}"]`);
        if (otherToggle && otherToggle.checked) {
          const writeIn = regStepContent.querySelector(`.other-writein-input[data-qid="${qId}"]`)?.value?.trim();
          if (writeIn) {
            checkedBoxes.push(`Other: ${writeIn}`);
          }
        }
        registrationAnswers[qId] = checkedBoxes;
      } else if (q.type === 'rating') {
        const hiddenInp = regStepContent.querySelector(`#q_${qId}`);
        if (hiddenInp) registrationAnswers[qId] = hiddenInp.value;
      } else {
        const inp = regStepContent.querySelector(`#q_${qId}`);
        if (inp) registrationAnswers[qId] = inp.value.trim();
      }
    }
  }

  function validateCurrentStep() {
    collectCurrentStepAnswers();

    if (!activeSessionSchema || !activeSessionSchema.steps) return true;
    const step = activeSessionSchema.steps[currentStepIndex];
    if (!step || !step.questions) return true;

    for (const q of step.questions) {
      const fieldWrapper = regStepContent.querySelector(`#field_${q.id}`);
      if (fieldWrapper && fieldWrapper.classList.contains('conditional-hidden')) {
        continue;
      }

      const val = registrationAnswers[q.id];

      // Required check
      if (q.required) {
        if (val === undefined || val === null || val === '') {
          showFormAlert(`Please provide an answer for: ${q.label}`, 'error');
          const inp = regStepContent.querySelector(`#q_${q.id}`) || regStepContent.querySelector(`input[name="${q.id}"]`);
          if (inp) inp.focus();
          return false;
        }
        if (Array.isArray(val) && val.length === 0) {
          showFormAlert(`Please select at least one option for: ${q.label}`, 'error');
          return false;
        }
      }

      // Format validations
      if (val) {
        if (q.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) {
            showFormAlert('Please enter a valid email address (e.g. name@domain.com).', 'error');
            const inp = regStepContent.querySelector(`#q_${q.id}`);
            if (inp) inp.focus();
            return false;
          }
        } else if (q.type === 'tel') {
          if (String(val).length < 7) {
            showFormAlert('Please provide a valid contact/WhatsApp phone number.', 'error');
            const inp = regStepContent.querySelector(`#q_${q.id}`);
            if (inp) inp.focus();
            return false;
          }
        }
      }
    }

    if (regFormAlert) regFormAlert.hidden = true;
    return true;
  }

  // Setup Step Buttons Navigation
  if (regNextBtn) {
    regNextBtn.addEventListener('click', () => {
      if (validateCurrentStep()) {
        if (activeSessionSchema && currentStepIndex < activeSessionSchema.steps.length - 1) {
          currentStepIndex++;
          renderStepIndicators();
          renderCurrentStepView();
        }
      }
    });
  }

  if (regPrevBtn) {
    regPrevBtn.addEventListener('click', () => {
      collectCurrentStepAnswers();
      if (currentStepIndex > 0) {
        currentStepIndex--;
        renderStepIndicators();
        renderCurrentStepView();
      }
    });
  }

  /* --------------------------------------------------------------------------
     8. REGISTRATION FORM SUBMISSION
     -------------------------------------------------------------------------- */
  async function handleRegistrationSubmit(e) {
    e.preventDefault();
    if (!registrationForm || !activeModalSession) return;

    collectCurrentStepAnswers();

    // Reset alert
    if (regFormAlert) {
      regFormAlert.hidden = true;
      regFormAlert.className = 'form-alert';
    }

    const sessionId = (activeSessionSchema && activeSessionSchema.session?.id) || activeModalSession.id;
    const fullName = registrationAnswers.fullName || '';
    const email = registrationAnswers.email || '';

    // Quick client sanity check
    if (!fullName || fullName.length < 2) {
      showFormAlert('Please provide your full name (at least 2 characters).', 'error');
      currentStepIndex = 0;
      renderStepIndicators();
      renderCurrentStepView();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showFormAlert('Please provide a valid email address.', 'error');
      currentStepIndex = 0;
      renderStepIndicators();
      renderCurrentStepView();
      return;
    }

    const payload = {
      sessionId,
      fullName,
      email,
      phone: registrationAnswers.phone || null,
      occupation: registrationAnswers.occupation || null,
      organization: registrationAnswers.organization || null,
      state: registrationAnswers.state || null,
      answers: registrationAnswers,
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
      const registeredTitle = activeModalSession.title;

      // Update local registration counter
      if (typeof activeModalSession.registrationsCount === 'number') {
        activeModalSession.registrationsCount++;
      }

      // Close modal and return participant directly to the website
      closeSessionModal();

      // Show confirmation toast notification on website
      showToast(result.message || `Seat confirmed for "${registeredTitle}"! A confirmation has been dispatched to ${email}.`);

      // Re-render sessions so updated registration count is immediately visible
      renderSessions(activeCategory);
    } catch (err) {
      showFormAlert(err.message, 'error');
    } finally {
      if (regSubmitBtn) {
        regSubmitBtn.disabled = false;
        const textSpan = regSubmitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Confirm Seat';
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

      // Close participant modal and return directly to website
      closeParticipantModal();

      showToast(result.message || `Welcome to the community, ${fullName}! You are now registered.`);
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
