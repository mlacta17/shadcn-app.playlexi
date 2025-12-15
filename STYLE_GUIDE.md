# Style Guide

This document captures the custom styling decisions for this project. Most styles are automatically applied through the design system, but some require manual implementation when adding new components.

## Automatic Styles (No Action Needed)

These are built into the codebase and apply automatically to all components:

### 1. Typography - Poppins Font
- **Location:** [app/layout.tsx](app/layout.tsx)
- **Applied via:** CSS variable `--font-sans`
- **Weights available:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- **Action:** None - automatically applied to all text

### 2. Border Radius Scale
- **Location:** [app/globals.css:52-58](app/globals.css:52-58)
- **Base:** `--radius: 0.625rem` (10px)
- **Available utilities:**
  - `rounded-md` = 6px (Tailwind default) - **for tab triggers**
  - `rounded-lg` = 8px (Tailwind default) - **for inputs, dropdowns, menu items**
  - `rounded-3xl` = 24px (Tailwind default) - **for cards**
  - `rounded-full` = 9999px (Tailwind default) - **for buttons, badges**
- **Visual hierarchy:**
  - Extra Subtle (6px): Tab triggers - minimal, clean
  - Subtle (8px): Form inputs, dropdown containers, menu items - cohesive, functional
  - Medium (24px): Cards - structured, contained
  - Bold (fully rounded): Buttons, badges - distinctive, pill-shaped
- **Action:**
  - Use `rounded-md` for tab triggers
  - Use `rounded-lg` for:
    - Form inputs (input, textarea, select trigger, combobox chips container)
    - Dropdown content (select dropdown, dropdown menu, combobox popup)
    - Tab list containers
    - All menu items (dropdown items, select items, combobox items)
  - Use `rounded-3xl` for cards
  - Use `rounded-full` for buttons, badges, individual combobox chips

### 3. Component Padding Scale
- **Pattern:** ~33% increase from shadcn defaults
- **Implementation:** Achieved via larger border radius utilities
- **Action:** None - use the rounded utilities above

### 4. Focus Ring System
- **Location:** [app/globals.css:269-302](app/globals.css:269-302)
- **Style:** 2px solid blue outline with 2px offset
- **Light mode:** `oklch(0.5 0.25 252)` (blue)
- **Dark mode:** `oklch(0.6 0.25 252)` (lighter blue)
- **Destructive states:** Automatically use red outline
- **Action:** None - automatically applied to all interactive elements

### 4.1. Focus Ring for Container Components
- **Pattern:** Use `focus-within` for containers that don't receive focus themselves
- **Applies to:** InputGroup, ComboboxChips (containers wrapping focusable children)
- **Implementation:**
  ```
  focus-within:outline
  focus-within:outline-[length:var(--focus-ring-width)]
  focus-within:outline-[var(--focus-ring-color)]
  focus-within:outline-offset-[var(--focus-ring-offset)]
  aria-invalid:focus-within:outline-[var(--destructive)]
  ```
- **Why?** Container `<div>` elements don't receive focus - their child `<input>` elements do. `focus-within` shows outline when any descendant is focused.
- **Action:** Use this pattern for any new composite form components

### 4.2. Error States (Form Validation)
- **Pattern:** `aria-invalid:border-destructive dark:aria-invalid:border-destructive/50`
- **Applies to:** Input, Textarea, Select, InputGroup, ComboboxChips
- **Usage:** Add `aria-invalid="true"` to the component
- **Visual effects:**
  1. Border changes to red (`--destructive` color)
  2. Focus ring changes to red (automatic via global CSS)
- **Dark mode:** 50% opacity for better visibility
- **Companion element:** Use `<p className="text-destructive text-sm">Error message</p>` below the input
- **Action:** Set `aria-invalid="true"` on form fields with validation errors

### 5. SVG Icon Sizing
- **Pattern:** `[&_svg:not([class*='size-'])]:size-4`
- **Default size:** 16px (size-4)
- **Small buttons:** 12px (size-3)
- **Action:** None - SVG sizing is automatic via CSS selectors

### 6. Semantic Color System
- **Location:** [app/globals.css:63-233](app/globals.css:63-233)
- **Format:** OKLCH color space
- **Pattern:** Background + foreground pairs for proper contrast
- **Available tokens:**
  - `bg-primary` / `text-primary-foreground`
  - `bg-secondary` / `text-secondary-foreground`
  - `bg-destructive` / `text-destructive-foreground`
  - `bg-muted` / `text-muted-foreground`
  - `bg-accent` / `text-accent-foreground`
- **Hover states:** `--primary-hover`, `--secondary-hover`, `--destructive-hover`
- **Action:** Use semantic tokens instead of arbitrary colors

### 7. Button Hover States
- **Pattern:** Darker shades on hover (not lighter)
- **Implementation:** `hover:bg-[var(--primary-hover)]`
- **Action:** None - already built into button component

## Manual Implementation Required

These require action when adding new components:

### 1. Icons - Use Nucleo Instead of Lucide
**IMPORTANT:** Always import from `nucleo-core-outline-24`, never from `lucide-react`

#### Pattern:
```typescript
import {
  IconNameOutline24 as AliasName,
} from "nucleo-core-outline-24"
```

#### Common Icon Mappings:
| Lucide Name | Nucleo Name | Alias |
|-------------|-------------|-------|
| X | IconXmarkOutline24 | XIcon |
| Check | IconCheckOutline24 | CheckIcon |
| ChevronDown | IconChevronDownOutline24 | ChevronDownIcon |
| ChevronUp | IconChevronUpOutline24 | ChevronUpIcon |
| ChevronRight | IconChevronRightOutline24 | ChevronRightIcon |
| Plus | IconPlusOutline24 | PlusIcon |
| Mail | IconEnvelopeOutline24 | MailIcon |
| Settings | IconGearOutline24 | SettingsIcon |
| Save | IconFloppyDiskOutline24 | SaveIcon |
| HelpCircle | IconCircleQuestionOutline24 | HelpCircleIcon |
| LogOut | IconCircleLogoutOutline24 | LogOutIcon |

#### Finding Nucleo Icons:
1. Search pattern: `Icon{Name}Outline24`
2. Browse: `node_modules/nucleo-core-outline-24/dist/components/`
3. Search command: `ls node_modules/nucleo-core-outline-24/dist/components/ | grep -i "search-term"`

#### Deployment:
Add to environment variables (Vercel/Netlify/etc.):
```
NUCLEO_LICENSE_KEY=d6tpflas8rzd0l58ik7fiy1jt3wqti
```

## Component Checklist

When adding a new shadcn component:

- [ ] Replace all `lucide-react` imports with `nucleo-core-outline-24`
- [ ] Use `rounded-full` for buttons, badges
- [ ] Use `rounded-3xl` for cards
- [ ] Use `rounded-lg` for inputs, dropdowns, menu items
- [ ] Use `rounded-md` for tab triggers
- [ ] Verify semantic color tokens are used (not arbitrary colors)
- [ ] Confirm SVG sizing selector `[&_svg:not([class*='size-'])]:size-4` is present
- [ ] Test keyboard navigation to verify focus rings appear
- [ ] For form inputs: Add error state support (`aria-invalid:border-destructive dark:aria-invalid:border-destructive/50`)
- [ ] For container components: Use `focus-within` pattern for focus rings (see 4.1 above)

## Reference Files

- **Color system:** [app/globals.css](app/globals.css)
- **Font setup:** [app/layout.tsx](app/layout.tsx)
- **Button example:** [components/ui/button.tsx](components/ui/button.tsx)
- **Example with icons:** [components/component-example.tsx](components/component-example.tsx)
- **Showcase page:** [app/showcase/page.tsx](app/showcase/page.tsx)

## Design Philosophy

**Goal:** Create a distinctive UI that feels cohesive and polished while maintaining compatibility with shadcn's component additions.

**Achieved through:**
1. Scaled padding via border radius system (not hardcoded values)
2. Custom font (Poppins) via CSS variables
3. Nucleo icons for visual differentiation
4. Consistent semantic color system
5. Accessible focus ring system

**Result:** New shadcn components automatically inherit most styling. Only icon imports need manual updates.
