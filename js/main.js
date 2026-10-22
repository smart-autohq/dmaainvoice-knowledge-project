  function renderFacilitators() {
    if (!facilitatorsContainer) return;

    if (liveFacilitators.length === 0) {
      facilitatorsContainer.innerHTML = '<p class="empty-state-desc">Facilitators roster will be announced shortly.</p>';
      return;
    }

    facilitatorsContainer.innerHTML = liveFacilitators.map(f => {
      const hasPhoto = Boolean(f.photoUrl && String(f.photoUrl).trim());
      const initials = escapeHTML(f.initials || 'DM');
      const photoUrl = escapeHTML(f.photoUrl || '');
      const name = escapeHTML(f.name || 'D Maain Voice Facilitator');

      return `
        <div class="facilitator-card" id="${escapeHTML(f.id)}">
          <div class="facilitator-header">
            <div class="facilitator-avatar-box ${hasPhoto ? 'has-photo' : 'fallback'}" aria-hidden="true">
              ${hasPhoto ? `
                <img
                  src="${photoUrl}"
                  alt="${name} profile photo"
                  loading="lazy"
                  onerror="this.remove(); this.parentElement.classList.add('fallback'); this.parentElement.classList.remove('has-photo');"
                >
              ` : ''}
              <span class="facilitator-avatar-fallback">${initials}</span>
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
      `;
    }).join('');
  }
