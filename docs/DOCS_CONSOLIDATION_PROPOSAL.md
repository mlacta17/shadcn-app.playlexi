# Documentation Consolidation Proposal

> **Date:** January 20, 2026
> **Status:** COMPLETED (archived)
> **Purpose:** Review documentation structure and propose consolidation while preserving accuracy

---

## User Decisions

| Question | Decision |
|----------|----------|
| ADR extraction | **Separate ADR.md file** — Extract all Architecture Decision Records |
| Vision content | **Keep in ARCHITECTURE.md** — Keep Sections 2.2-2.3 labeled as "Planned" |
| STYLE_GUIDE.md | **Move to docs/ folder** — Found at root, will consolidate with other docs |

---

## Current State

| Document | Lines | Size | Primary Purpose |
|----------|-------|------|-----------------|
| ARCHITECTURE.md | ~3,800+ | 149KB | Technical architecture, decisions, implementation details |
| PRD.md | 1,396 | 58KB | Product requirements, game mechanics, user flows |
| COMPONENT_INVENTORY.md | 461 | 20KB | UI component tracking, status, patterns |
| ROADMAP.md | 486 | 20KB | Technical roadmap, Safari issues, phonetic learning |
| SETUP.md | 504 | 18KB | Development setup, deployment |
| STYLE_GUIDE.md (root) | 1,142 | 47KB | Design system, component styling, patterns |

**Total: ~7,800 lines across 6 documents**

---

## Analysis & Recommendations

### 1. ARCHITECTURE.md — NEEDS CONSOLIDATION

**Current Issues:**
- 20 sections covering everything from tech stack to ADRs
- Includes "Full Vision Structure" that's aspirational, not current
- Section 2 has 2.0, 2.1, 2.2, 2.3 with overlapping content
- Some sections are implementation guides (should be in code comments)

**Recommendation: Split into 2 documents**

| New Document | Content | Lines (Est.) |
|--------------|---------|--------------|
| **ARCHITECTURE.md** (lean) | Tech stack, project structure (current only), database schema, key patterns | ~400 |
| **ADR.md** (new) | All Architecture Decision Records (ADR-001 to ADR-013) | ~800 |

**Sections to KEEP in ARCHITECTURE.md:**
- 1. Tech Stack (trimmed)
- 2. Project Structure (Section 2.0 and 2.1 only — current implementation)
- 4. Database Schema
- 7. Real-Time Architecture (essential for multiplayer)
- 8. Voice Recognition (core feature)
- 9. Authentication

**Sections to MOVE to ADR.md:**
- 19. Architecture Decision Records (all ADRs)

**Sections to REMOVE (redundant or aspirational):**
- 2.2, 2.3 Full Vision Structure — move to GitHub Issues or remove
- 3. Component Architecture — redundant with COMPONENT_INVENTORY.md
- 10. Design System — redundant with STYLE_GUIDE.md (if exists) or globals.css
- 11-17. Testing, Deployment, Security, etc. — standard practices, not project-specific
- 18. Developer Guide — belongs in README.md or SETUP.md
- 20. Implementation Roadmap — redundant with ROADMAP.md

---

### 2. PRD.md — KEEP AS-IS

**Rationale:** This is the single source of truth for product decisions. It's well-organized with:
- Game mechanics
- User flows
- XP/ranking system
- Privacy/compliance
- Edge cases

**No changes recommended.** This document serves its purpose well.

---

### 3. COMPONENT_INVENTORY.md — KEEP BUT TRIM

**Current Value:**
- Tracks component implementation status
- Documents patterns (wrapper components, hooks)
- Useful for onboarding new developers

**Recommendation:**
- KEEP Sections 1-10 (component tables)
- KEEP Section 11 (Custom Hooks)
- KEEP Architecture Decisions section
- REMOVE Design System Notes (lines 380-430) — duplicates globals.css and should live in code
- REMOVE Changelog (lines 434-457) — Git history serves this purpose

**Estimated reduction: ~80 lines**

---

### 4. ROADMAP.md — KEEP AS-IS

**Rationale:** This document serves a unique purpose:
- Captures Safari audio issues (browser-specific problems)
- Documents the phonetic learning system (Phase 4)
- Records decisions with rationale
- Links technical context to product goals

**No changes recommended.** This is valuable institutional knowledge.

---

### 5. SETUP.md — KEEP AS-IS

**Rationale:** Clean, focused setup guide with:
- Required accounts
- Local development
- Testing
- Deployment
- Troubleshooting

**No changes recommended.** This is exactly what a setup guide should be.

---

### 6. STYLE_GUIDE.md — STATUS UNKNOWN

The file doesn't exist at the expected path. Either:
1. It was deleted in a previous session
2. It's located elsewhere
3. It was never created

**Recommendation:** If design system documentation is needed, it should be:
- Minimal (colors, typography, spacing)
- Reference globals.css as source of truth
- Not duplicate what's in globals.css

---

## Proposed New Structure

```
docs/
├── README.md              # Quick links to all docs
├── SETUP.md               # Development setup (unchanged)
├── ARCHITECTURE.md        # Lean technical overview (~400 lines)
├── ADR.md                 # Architecture Decision Records (~800 lines)
├── PRD.md                 # Product requirements (unchanged)
├── COMPONENT_INVENTORY.md # Component tracking (trimmed ~80 lines)
└── ROADMAP.md             # Technical roadmap (unchanged)
```

**Net result:** ~3,200 lines removed from ARCHITECTURE.md, documentation is more focused.

---

## What Gets Preserved

All decisions, rationale, and technical context remains accessible:
- ADRs move to dedicated ADR.md file (not deleted)
- Aspirational structures move to GitHub Issues (not deleted)
- Design system info stays in globals.css (already there)

---

## What Gets Removed

Only removing:
1. **Duplicate information** — things documented in multiple places
2. **Aspirational content** — "Full Vision Structure" that's not implemented
3. **Standard practices** — Testing, Security, Performance sections that don't add project-specific value
4. **Changelogs** — Git history serves this purpose better

---

## Implementation Steps (If Approved)

1. **Create ADR.md** — Extract all ADR sections from ARCHITECTURE.md
2. **Trim ARCHITECTURE.md** — Remove sections per above analysis
3. **Trim COMPONENT_INVENTORY.md** — Remove Design System Notes and Changelog
4. **Create docs/README.md** — Quick links to all documentation
5. **Update cross-references** — Ensure all links still work

---

## Implementation Plan

Based on approved decisions:

1. ✅ **Move STYLE_GUIDE.md** — From root to docs/ folder
2. ✅ **Create ADR.md** — Extract all ADR sections from ARCHITECTURE.md
3. ✅ **Trim ARCHITECTURE.md** — Remove extracted ADRs, keep vision sections
4. ✅ **Trim COMPONENT_INVENTORY.md** — Remove Design System Notes and Changelog
5. ✅ **Create docs/README.md** — Quick links to all documentation

---

## Implementation Complete ✅

**Date:** January 20, 2026

All consolidation tasks have been completed:

| Task | Status | Notes |
|------|--------|-------|
| Move STYLE_GUIDE.md to docs/ | ✅ Done | Moved from root directory |
| Create ADR.md | ✅ Done | Extracted all 13 ADRs with full context |
| Trim ARCHITECTURE.md | ✅ Done | Removed ~240 lines of duplicate ADR content, kept summary table |
| Trim COMPONENT_INVENTORY.md | ✅ Done | Removed ~80 lines (Design System Notes + Changelog) |
| Create docs/README.md | ✅ Done | Quick links to all documentation |
| Update root README.md | ✅ Done | Added documentation table with all docs |

**Result:** Documentation is now more focused and maintainable. All decisions and rationale have been preserved in ADR.md.

---

*This proposal preserves all decisions and rationale while making documents more focused and maintainable.*
