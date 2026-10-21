# D Maain Voice Knowledge Project

> **"BE THE VOICE"**  
> An educational knowledge-sharing initiative in association with the **SMART NACOS Public Speaking Track**.

---

## 1. Project Overview

The **D Maain Voice Knowledge Project** is a recurring online knowledge-sharing initiative that brings people together to learn, exchange ideas, develop useful skills, and hear from knowledgeable facilitators. 

The initiative spans multiple core disciplines:
- Public Speaking & Articulate Discourse
- Software Engineering & Emerging Technology
- Career Development & Leadership Capital
- Ethical Wealth & Islamic Finance

This repository houses **Phase 1: Premium Minimalist Homepage**, designed with an editorial, publication-grade aesthetic that honors the official branding and establishes a foundation for subsequent backend integrations.

---

## 2. Technology Stack & Constraints

In strict adherence to Phase 1 guidelines:
- **HTML5**: Semantic landmark architecture (`<header>`, `<main>`, `<section>`, `<article>`, `<dialog>`, `<footer>`).
- **CSS3**: Vanilla CSS with custom properties (tokens), CSS Grid, Flexbox, fluid `clamp()` typography, and zero third-party framework dependencies.
- **Vanilla JavaScript**: Lightweight, modular ES6+ handling dynamic session filtering, accessible modal dialogs, mobile navigation, and calendar preview helpers.
- **Zero Build Tools**: Runs directly in any modern browser without npm build steps or transpilations.

---

## 3. Brand Identity & Design Tokens

### Color Palette
- **Warm Ivory (`#F7F6F2`)**: Primary atmospheric background, creating an editorial, paper-like warmth.
- **Charcoal (`#252525`)**: Primary typography and high-contrast dark sections. The D Maain Voice logo is housed within a tailored charcoal container to seamlessly integrate its dark background.
- **Brand Yellow (`#F2C94C`)**: Selective accent for key calls-to-action, highlights, active states, and motto emphasis.
- **Pure White (`#FFFFFF`)**: Section cards and modal containers for visual crispness.
- **Muted Text (`#6B6963`)**: Body copy and secondary metadata.
- **Light Border (`#E5E2DA`)**: Subtle dividers and card outlines.
- **NACOS Green (`#00873E`)**: Reserved strictly for the official affiliation section featuring the Nigerian Association of Computing Students (NACOS) emblem.

### Typography
- **Headings**: *Manrope* (Weights: 600, 700) — Modern, authoritative editorial typography for all titles and section headings.
- **Body & UI**: *DM Sans* (Weights: 400, 500, 600) — Refined geometric legibility across paragraphs, navigation links, buttons, and metadata.

---

## 4. Folder Structure

```
dmainvoice/
├── index.html              # Main semantic HTML5 homepage
├── css/
│   └── style.css           # Modular editorial stylesheet & design tokens
├── js/
│   └── main.js             # Client-side dynamic rendering & interactive logic
├── assets/
│   ├── dmaainvoice_logo.png # Official D Maain Voice logo
│   ├── nacos_logo.jpg       # Official NACOS emblem
│   └── logos/               # Mirrored high-res asset folder
└── README.md               # Project documentation & architectural roadmap
```

---

## 5. Key Features Implemented

1. **Editorial Hero Section**:
   - Eyebrow tag: `KNOWLEDGE · COMMUNITY · GROWTH`
   - Official Tagline badge: `BE THE VOICE`
   - Primary Headline: *"Every voice has something valuable to share."*
   - Interactive editorial manifesto card with active cohort indicators and initiative pillars.

2. **Curated Upcoming Sessions (Dynamic)**:
   - Dynamic JavaScript rendering from `SESSIONS_DATA`.
   - Topic category filtering (Public Speaking, Technology, Career & Personal Growth, Islamic Finance).
   - Graceful empty states with reset filters.
   - Accessible `<dialog>` modal with full session breakdown, takeaways, and registration timelines.

3. **Mission & Core Principles**:
   - The Three Core Pillars: **Learn**, **Share**, and **Grow**.
   - Balanced editorial layout with distinct typography.

4. **Facilitator Highlights**:
   - Dynamic rendering of sample facilitator profiles.
   - Transparent disclaimer noting that sample profiles preview upcoming calendar topics.

5. **SMART NACOS Affiliation Section**:
   - Official circular emblem of the Nigerian Association of Computing Students.
   - Narrative detailing how the initiative builds verbal eloquence and presentation confidence among computing students.

6. **Accessibility & Responsive Precision**:
   - Skip-to-content keyboard anchor.
   - Visible `:focus-visible` outlines.
   - ARIA states (`aria-expanded`, `aria-controls`, `aria-hidden`, `aria-selected`, `aria-live`).
   - `prefers-reduced-motion` compliance.
   - Mobile navigation drawer with backdrop blur and escape key trap.

---

## 6. How to Run Locally

You can run the project using any local HTTP server (such as Python, Node `http-server`, or VS Code Live Server):

### Using Node.js:
```bash
npx serve -l 3000 .
```
or with Python:
```bash
python -m http.server 3000
```

Open your browser to:
`http://localhost:3000`

---

---

## 7. Organizer Portal & Account Management

The Organizer Portal is available locally at:
`http://localhost:3000/admin.html`

### Administrator Account CLI Tool
Organizers and administrators can be managed locally via the CLI utility:

```bash
# 1. List existing organizer accounts (never displays hashes or credentials)
npm run organizer:list

# 2. Reset an organizer's password securely (interactive masked prompt or --password flag)
npm run organizer:reset-password -- --email admin@dmaainvoice.org

# 3. Create a new organizer account
npm run organizer:create -- --email neworganizer@dmaainvoice.org --name "Firstname Lastname" --role admin
```

Passwords can also be passed via the `ORGANIZER_PASSWORD` environment variable to avoid logging secrets in terminal history.

---

## 8. Next Phases Roadmap

- **Phase 2**: Neon PostgreSQL database integration and API schema design for sessions, facilitator applications, and attendee RSVPs.
- **Phase 3**: Automated notification engine, email confirmations, and Google Meet/Zoom calendar integrations.
- **Phase 4**: Administrator dashboard for managing sessions and cohort registrations.
