# Brand & Design System — mantranex CRM

> Distilled from the live `lextalkworld.in` CSS bundles (Apr 2026). The CRM is internal but should feel like an extension of the public brand. Everything in this doc maps to a Tailwind token we'll define in Step 2.

---

## 1. Color Palette

### Brand colors (extracted from CSS bundles)

| Role | Hex | Tailwind token (planned) | Usage |
|---|---|---|---|
| **Primary accent** | `#f99c00` | `brand` (amber-500 family) | Primary CTAs, status highlights, key UI emphasis |
| **Primary darker** | `#dd7400` | `brand-600` | Button hover stop, focus ring |
| **Gold accent** | `#d4a843` | `gold-500` | Award/luxury moments, secondary highlight |
| **Gold deep** | `#cfa45a` | `gold-600` | Hover, dark-on-light gold |
| **Bright yellow** | `#fcbb00` | `amber-400` | Subtle highlights |
| **Dark navy** | `#0f172b` | `ink-900` | Primary text, dark surfaces, button hover stop |
| **Mid navy** | `#1e2848` | `ink-800` | Mid-depth surfaces |
| **Deepest navy** | `#050a15` | `ink-950` | Highest-contrast dark |
| **Warm cream** | `#fcfbf9` | `cream` | Soft warm-white backgrounds |

### Neutral scale (Tailwind slate — they use this directly)

`bg-slate-50` (`#f8fafc`) is their page background; `text-slate-900` is their body text. We'll keep Tailwind's stock slate scale and use these defaults.

### Status chip palette (CRM-specific)

Curated for the lead-status pipeline. Each chip uses a light tint on a saturated bar:

| Status | bg | text | border |
|---|---|---|---|
| NEW | `bg-blue-50` | `text-blue-700` | `border-blue-200` |
| CONTACTED | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| FOLLOWUP_SCHEDULED | `bg-indigo-50` | `text-indigo-700` | `border-indigo-200` |
| INTERESTED | `bg-cyan-50` | `text-cyan-700` | `border-cyan-200` |
| NEGOTIATION | `bg-violet-50` | `text-violet-700` | `border-violet-200` |
| WON | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |
| LOST | `bg-rose-50` | `text-rose-700` | `border-rose-200` |

---

## 2. Typography

| Role | Font | Source |
|---|---|---|
| Headings | **Playfair Display** | `next/font/google` |
| Body & UI | **DM Sans** | `next/font/google` |

The public site uses these via Next.js font optimization. We'll do the same.

### Type scale (planned)

| Class | Use |
|---|---|
| `font-heading` (Playfair) | Page titles, KPI numbers, marketing-style emphasis |
| `font-sans` / default (DM Sans) | All body, labels, table cells, form inputs |
| `text-xs` 12px | Helper labels, badges |
| `text-sm` 14px | Buttons, table cells, form inputs (default size) |
| `text-base` 16px | Body paragraphs |
| `text-lg` / `text-xl` | Section headings |
| `text-2xl` / `text-3xl` | Page titles, KPI values |
| `tracking-wide` on buttons | Matches their brand button styling |

---

## 3. Buttons (matching their flagship CTA)

The "Secure Pass" CTA on lextalkworld.in is the canonical brand button. Recreate it as our **primary** Button variant.

### Primary

```jsx
<button className="
  px-6 py-2.5
  bg-gradient-to-r from-amber-500 to-amber-600
  hover:from-slate-800 hover:to-slate-900
  text-white text-sm font-bold tracking-wide
  rounded-lg
  shadow-sm hover:shadow-md
  transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Secure Pass
</button>
```

The amber → slate **color flip on hover** is brand-distinctive — keep it.

### Secondary

```jsx
<button className="
  px-6 py-2.5
  bg-white hover:bg-slate-50
  text-slate-900 text-sm font-semibold
  border border-slate-300 hover:border-slate-400
  rounded-lg
  transition-colors duration-150
">
  View Details
</button>
```

### Ghost / icon

```jsx
<button className="
  p-2 rounded-lg
  text-slate-600 hover:text-slate-900 hover:bg-slate-100
  transition-colors duration-150
">
```

### Destructive

```jsx
<button className="
  px-6 py-2.5
  bg-rose-600 hover:bg-rose-700
  text-white text-sm font-bold tracking-wide
  rounded-lg
">
  Delete
</button>
```

---

## 4. Cards & surfaces

Tokens (from the live CSS):
- Light `--background: #fff`
- Light `--foreground: #0f172a`
- Dark `--background: #030712`
- Dark `--foreground: #f8fafc`

### Card

```jsx
<div className="
  bg-white
  border border-slate-200
  rounded-xl
  shadow-sm
  p-6
">
```

For elevated cards (hover, focus, active state):
- `shadow-md` on hover, `shadow-lg` on drag/active
- Optional `ring-1 ring-slate-200` for crisper edges

### Modal

```jsx
<div className="
  bg-white
  rounded-2xl
  shadow-2xl
  p-6 max-w-lg w-full
">
```

---

## 5. Borders & radii

| Token | Value | Use |
|---|---|---|
| `rounded-md` | 6px | Inputs, small buttons |
| `rounded-lg` | 8px | Buttons (matches brand), small cards |
| `rounded-xl` | 12px | Cards, panels |
| `rounded-2xl` | 16px | Modals, hero cards |
| `rounded-3xl` | 24px | Marketing-style large surfaces (sparingly) |
| `rounded-full` | — | Avatars, pill chips |

Border colors:
- Default: `border-slate-200` (`#e2e8f0`)
- Hover: `border-slate-300`
- Focused/active: `border-amber-500` (matches brand)

---

## 6. Shadows

Match the public site's restrained shadow style. From the CSS we saw:
- `box-shadow: 0 1px 2px #00000080` → maps to Tailwind `shadow-sm`
- `box-shadow: 0 5px 10px #0003` → maps to `shadow-md`

Use:
- `shadow-sm` for cards at rest
- `shadow-md` for hover lift
- `shadow-lg` for popovers
- `shadow-2xl` for modals
- No drop-shadows on everything — keep surfaces clean.

---

## 7. Inputs

```jsx
<input className="
  w-full
  px-3 py-2
  bg-white
  border border-slate-300
  rounded-md
  text-sm text-slate-900 placeholder:text-slate-400
  focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500
  transition
"/>
```

Selects use the same shell. Disabled inputs: `bg-slate-50 text-slate-500 cursor-not-allowed`.

---

## 8. Layout & spacing

- Page max-width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Section spacing: `py-8` between major sections
- Form field gap: `space-y-4`
- Card grid gap: `gap-4` or `gap-6`
- Sidebar width on edit page: `w-80` (320px)

---

## 9. Logo & brand mark

- Source: `https://lextalkworld.in/logo/lextalkworld_logo.png`
- We'll download a copy into `frontend/public/brand/` during Step 2 so the CRM doesn't depend on the public CDN at runtime.
- Top nav uses the logo at ~32px height; login screen uses ~48px.

---

## 10. Iconography

Use **Lucide React** (`lucide-react`) — clean, consistent, free, plays well with Tailwind. Default size `w-5 h-5`, color via `text-*`.

---

## 11. Motion

Conservative — this is an internal tool, not a marketing page.

- `transition-colors duration-150` on hover state changes
- `transition-all duration-200` on buttons
- `animate-pulse` on skeleton loaders
- Avoid scroll-triggered animations.

---

## 12. Accessibility & dark mode

- All interactive elements need a visible focus ring (`focus:ring-2 focus:ring-amber-500/40`).
- Color contrast: `text-slate-900` on `bg-slate-50` is fine; never put `text-slate-400` on `bg-white` for primary content.
- **Dark mode is out of scope for v1.** The public site supports it (we saw `prefers-color-scheme: dark` rules), but we'll ship light-only and add later if requested.

---

## 13. Tailwind config preview (will land in Step 2)

```ts
// tailwind.config.ts
export default {
  content: [...],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#f99c00",
          50: "#fffbeb",
          100: "#fef3c6",
          200: "#fee685",
          300: "#ffd236",
          400: "#fcbb00",
          500: "#f99c00",
          600: "#dd7400",
          700: "#b75000",
          800: "#953d00",
          900: "#7b3306",
          950: "#461901",
        },
        gold: {
          400: "#d4a843",
          500: "#cfa45a",
          600: "#b08a45",
        },
        ink: {
          800: "#1e2848",
          900: "#0f172b",
          950: "#050a15",
        },
        cream: "#fcfbf9",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-playfair)", "Georgia", "serif"],
      },
    },
  },
};
```

Fonts will be loaded in `app/layout.tsx`:

```ts
import { DM_Sans, Playfair_Display } from "next/font/google";
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
```
