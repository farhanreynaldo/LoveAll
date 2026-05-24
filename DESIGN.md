---
name: LoveAll
description: Tennis session manager — a quiet courtside notebook that does the math.
colors:
  paper-cream: "oklch(98% 0.003 95)"
  surface-white: "oklch(100% 0 0)"
  taupe-border: "oklch(91.5% 0.006 90)"
  taupe-border-soft: "oklch(94% 0.005 90)"
  ink: "oklch(20% 0.003 95)"
  ink-quiet: "oklch(60% 0.004 95)"
  shadow-soft: "oklch(0% 0 0 / 0.06)"
  night-navy: "oklch(12% 0.02 260)"
  night-surface: "oklch(18% 0.03 260)"
  night-border: "oklch(30% 0.04 260)"
  night-border-soft: "oklch(22% 0.04 260)"
  night-text: "oklch(100% 0 0)"
  night-text-quiet: "oklch(63% 0.02 250)"
  court-lime: "oklch(93% 0.27 122)"
  court-lime-ink: "oklch(0% 0 0)"
  shadow-night: "oklch(0% 0 0 / 0.3)"
typography:
  title:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  setting-name:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.3
  control:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
  label-small:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "1px"
  label-micro:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "1px"
  score:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 300
    lineHeight: 1
    fontFeature: "tnum"
  summary-numeral:
    fontFamily: "-apple-system, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 300
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  pill: "16px"
  card: "12px"
  control: "8px"
  score-key: "6px"
  circle: "50%"
spacing:
  hairline: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-white}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "14px"
  button-ghost:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "14px"
  button-small:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-white}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.card}"
    padding: "12px"
  chip-default:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px"
  stepper-button:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "32px"
---

# Design System: LoveAll

## 1. Overview

**Creative North Star: "The Courtside Notebook"**

A paper-warm light theme for daylight matches paired with a confident, deep-navy dark theme for evening play under floodlights. The system reads less like a piece of software and more like a Moleskine that happens to do the math — disciplined typography, no decorative weight, scores rendered with the same care a stopwatch gives the seconds. The product is a tool for an organizer mid-session; the visual system stays quiet so the social moment around it can stay loud.

The light theme is built on a single warm off-white (`oklch(98% 0.003 95)`) tinted barely toward yellow so it never reads as clinical, with surfaces lifted one tonal step to pure white. Type and primary controls share a single ink color — the same near-black runs from headings to button fills — which gives the interface its monochromatic discipline. The dark theme is its peer, not an afterthought: a deep navy-black base for evening readability, with one electric **Court Lime** accent (`oklch(93% 0.27 122)`) that does the work the light theme's ink does. Every neutral is tinted toward its theme's hue family; no pure greys, no pure whites in either palette.

This system explicitly rejects four things, carried forward from PRODUCT.md: generic sports-app chrome (no turf green, no scoreboard look, no ball yellow used decoratively), enterprise SaaS gradients and identical card grids, playful gamification, and heavy marketing brand surfaces. The accent appears in dark mode only and is always functional, never decorative.

**Key Characteristics:**
- Mobile-first single column, 480px max width, system font stack only
- Warm-neutral monochrome by default; one functional accent in dark theme
- Tabular numerals on every numeric surface (scores, stats, settings, leaderboards)
- Generous radii (12px cards, 8px controls, 16px chips) softened further by circular steppers
- Flat surfaces with hairline borders; shadows are ambient and rare
- Strong typographic hierarchy via weight (300/400/500/600/700) and scale, never via color

## 2. Colors

A two-theme palette built on tinted neutrals: warm paper for daylight, deep navy for floodlights. The single saturated color, Court Lime, exists only in the dark theme as the functional accent — its rarity is the point.

### Primary
- **Ink** (`oklch(20% 0.003 95)`, `#1a1a1a`): The single dark color in the light theme. Used as body text, headings, primary button fills, and chip selection. Faintly warm so it never reads as forensic black against the cream paper.
- **Court Lime** (`oklch(93% 0.27 122)`, `#d4ff00`): The dark theme's voice. Used on primary button fills, selected chips, and active-state accents — always functional, never decorative. Its complement is pure black for legibility against the high-chroma yellow-green.

### Neutral — Light Theme (Paper)
- **Paper Cream** (`oklch(98% 0.003 95)`, `#fafaf7`): The base canvas. Warm off-white tinted toward yellow. Replaces what most apps would render as pure white.
- **Surface White** (`oklch(100% 0 0)`, `#ffffff`): Lifted surface for cards and inputs. The one place pure white appears, and only to create a tonal step above paper.
- **Taupe Border** (`oklch(91.5% 0.006 90)`, `#e8e6df`): Hairline borders on cards, buttons, and inputs. Warm enough to read as continuous with the paper canvas.
- **Taupe Border Soft** (`oklch(94% 0.005 90)`, `#f0eee7`): Internal dividers between rows and list items. One step softer than the outer border.
- **Ink Quiet** (`oklch(60% 0.004 95)`, `#8a8a85`): Secondary text, labels, metadata, hints. Warm grey, never blue-grey.

### Neutral — Dark Theme (Floodlight)
- **Night Navy** (`oklch(12% 0.02 260)`, `#0a0e1a`): The base canvas. Deep navy-black, not pure black; the slight blue chroma keeps it from feeling forensic at low ambient light.
- **Night Surface** (`oklch(18% 0.03 260)`, `#131a2e`): Lifted card and input surface. One tonal step above the navy base.
- **Night Border** (`oklch(30% 0.04 260)`, `#2a3550`): Hairline borders. Same hue as the surface, two steps lighter.
- **Night Border Soft** (`oklch(22% 0.04 260)`, `#1a2540`): Internal dividers.
- **Night Text** (`oklch(100% 0 0)`, `#ffffff`): Primary text against navy. Pure white is acceptable here because the high-chroma navy base provides the tinting on its side of the contrast.
- **Night Text Quiet** (`oklch(63% 0.02 250)`, `#8a93a8`): Secondary text. Cool grey matched to the navy hue.

### Named Rules

**The One Accent Rule.** Court Lime appears in dark theme only, and only as the fill for primary actions or the selected state of interactive elements. Never used as a decorative wash, never used as text on a neutral surface, never used to color borders, icons, or chrome. If the lime is on the screen, it is something the user can press or has just pressed.

**The Tinted Neutral Rule.** Pure greys are forbidden. Every neutral is tinted toward its theme's hue family — warm-yellow in light, cool-blue in dark. Pure `#000` and `#fff` appear only where contrast against an already-tinted base does the warming on the other side of the pair.

**The Lime-Off-Light Rule.** Court Lime is never permitted in the light theme. The light theme's accent is Ink. Introducing the lime into paper-warm surroundings reads as sporty and breaks the notebook metaphor.

## 3. Typography

**Display, Body, and Label Font:** `-apple-system, system-ui, sans-serif`

A single system font stack carries every weight and size. The native system font on each platform (San Francisco on iOS / macOS, Segoe on Windows, Roboto on Android) is itself a quiet, high-quality choice; loading custom fonts would betray the "notebook, not app" principle and add courtside-irrelevant weight.

**Character:** Disciplined and unembellished. Hierarchy comes from weight contrast (300/400/500/600/700) and a 1.25+ scale ratio between steps, never from color. Numerals always render with `font-variant-numeric: tabular-nums` so scores and stats align in columns and don't jitter when they update.

### Hierarchy

- **Summary Numeral** (300, 38px, line-height 1, tabular): The hero number on the post-session summary screen. The thinnest weight in the system; the size carries the voice.
- **Score** (300, 32px, line-height 1, tabular): The live match score. Same thin weight as the summary numeral, one step smaller. Anchors the live screen.
- **Title** (700, 18px, line-height 1.2): Screen titles in the top header. The boldest weight in the system, used sparingly.
- **Body** (400, 15px, line-height 1.4): Default text. Player names, match metadata, settings descriptions. Caps at one card width — line lengths never approach 65ch on a 480px viewport.
- **Setting Name** (500, 14px, line-height 1.3): Setting row primary text. One weight up from body to distinguish the label from its hint.
- **Control** (600, 14px, line-height 1.2): Button labels and CTAs. The single weight reserved for things the user can press.
- **Label Small** (400, 11px, line-height 1.2, +1px tracking, uppercase): Section labels above lists. The visual punctuation between groups.
- **Label Micro** (400, 10px, line-height 1.2, +1px tracking, uppercase): Editor inline labels. One step quieter than the section label.

### Named Rules

**The Numeral-Is-The-Hero Rule.** Scores, summary stats, and any tabular numeric readout are rendered at weight 300 with `font-variant-numeric: tabular-nums`. The thin weight is non-negotiable: it's what gives the numbers their clock-like character. Bolding a score breaks the system.

**The One Bold Rule.** Weight 600 is reserved for interactive labels (buttons, controls). Weight 700 is reserved for the screen title in the header. Body text, list items, and metadata never exceed 500. If a body element needs more weight to read, the hierarchy is wrong upstream.

## 4. Elevation

This system is **flat by default with one ambient shadow available**. Depth is conveyed primarily through tonal layering (Paper Cream → Surface White in light; Night Navy → Night Surface in dark) and hairline borders, not through stacked shadows. The notebook metaphor demands honesty about layers: things are on the page, not floating above it.

### Shadow Vocabulary

- **Shadow Soft** (`box-shadow: 0 4px 16px oklch(0% 0 0 / 0.06)` light, `... / 0.3` dark): Ambient, diffuse, never sharp. Reserved for the modal bottom-sheet menu and, sparingly, lifted hero surfaces. The light-theme variant is barely visible by design — it's an atmospheric warmth, not a depth cue.

### Named Rules

**The Flat-By-Default Rule.** Cards, inputs, buttons, and rows sit on the canvas with a 1px tinted border. They do not lift. Hover and active states change tonal value (background tint), not elevation. The only exception is the bottom-sheet menu, which uses Shadow Soft to read as overlaid.

**The Hairline-Border Rule.** Borders are 1px. Anywhere a 2px or thicker border would be tempting, the answer is either a tonal step (lift the surface) or a typographic weight change (bold the label), not a thicker stroke. Side-stripe borders (a thick colored accent on one edge of a card or row) are forbidden.

## 5. Components

Components are flat, hairline-bordered, generous in radius, and operated by one thumb. The system is small — eight or nine canonical primitives carry every screen.

### Buttons
- **Shape:** Softly rounded rectangles (radius 8px). Full-width on primary actions.
- **Primary:** Ink fill on Surface White text in light theme; Court Lime fill on black text in dark theme. Padding 14px all sides. Weight 600 label. Disabled state drops to 40% opacity, never grey.
- **Ghost:** Surface White fill with hairline Taupe Border in light theme; Night Surface fill with Night Border in dark theme. Same padding and label weight as primary.
- **Small:** Same color treatment as primary but tighter padding (6px / 12px) and 13px label. Used for inline secondary actions.
- **Hover / Focus:** No transform. State changes are limited to background tint shifts and (on focus-visible) a 2px ring at 50% accent opacity. No transitions on layout properties.

### Icon Button
- **Style:** Transparent background, no border, 20px glyph, 8px padding (tap target stays ≥44×44). Inherits Ink (light) or Night Text (dark) color. Used in the screen header and inline controls.

### Cards / Containers
- **Corner Style:** Generously rounded (12px radius). The card radius is one tier larger than the control radius to keep cards feeling like surfaces and controls feeling like inputs.
- **Background:** Surface White (light) / Night Surface (dark).
- **Border:** 1px Taupe Border (light) / Night Border (dark). No shadow.
- **Internal Padding:** 12px standard; 18px on the summary hero card.
- **Nested cards are forbidden.** If a section needs grouping inside a card, use a tonal row divider, not another card.

### Rows
- **Style:** Flex justify-between, 10px vertical / 4px horizontal padding. Separated by 1px Taupe Border Soft dividers; the last row in a card has no divider.
- **State variants:** `.completed` and `.skipped` drop to 45% opacity (carry the skipped reason as a suffix). `.locked` becomes weight 600. `.edited` appends a ✎ glyph in Ink Quiet. State is never communicated by color alone.

### Inputs
- **Style:** Surface White (light) / Night Surface (dark) background. 1px Taupe / Night Border. Radius 8px. 10px padding. 14px text in Ink / Night Text.
- **Focus:** Border shifts to Ink (light) / Court Lime (dark) at full opacity. No glow, no shadow, no border thickness change.

### Stepper (numeric increment)
- **Style:** Two 32×32 circular buttons (radius 50%) flanking a tabular-numeral value. Buttons are Surface White / Night Surface with hairline border; the central value is weight 600, 18px.
- **The circular stepper button is a signature shape in the system** — every other control is rectangular with an 8px radius. The circles read as "this is a one-thumb dial," not "this is a form field."

### Skill Dots
- **Style:** A horizontal row of 14px circular dots, 4px gap. Unfilled dots are Taupe Border; filled dots are Ink. Used for the per-player skill rating. Each dot carries an invisible 15px / 6px padded hit area (clipped via `background-clip: content-box`) so the visual mark stays small while the tap target meets the 44px floor.
- **Constraint:** The skill scale is 3 dots (Low / Mid / High). Three buckets are enough granularity for a casual social roster and avoid the false precision of a 5- or 10-step scale. If a future use case needs more granularity, switch to a stepper rather than adding dots.

### Chips (player filter)
- **Style:** Pill-radius (16px), 6px / 12px padding, 13px text. Surface White background with hairline border by default; Ink fill with Surface White text when selected (Court Lime fill in dark theme).
- **The single-tap commitment Rule.** Chip selection commits immediately; there is no separate "apply" button. Editing is inline.

### Bottom Sheet Menu
- **Style:** Pinned to the viewport bottom, 12px 12px 0 0 radius on the top corners only (sits flush against the safe area). Paper Cream / Night Navy fill (matches the canvas, not the surface). Each menu item is a full-width left-aligned 14px label with a hairline divider.
- **Use sparingly.** A bottom sheet is the only modal pattern allowed; full-screen modals are forbidden. Inline editing wins by default.

### Setting Row
- **Style:** A two-column layout: left column carries a 14px / weight-500 name and an 11px / Ink Quiet hint stacked below; right column carries an 80px right-aligned tabular-numeral input.
- **Hints are mandatory.** Every setting row carries a one-line hint in Ink Quiet explaining what the value controls. A bare number is forbidden.

## 6. Do's and Don'ts

### Do:
- **Do** use Court Lime (`oklch(93% 0.27 122)`) only in dark theme, and only as a functional fill for primary actions or selected state.
- **Do** render every numeric surface with `font-variant-numeric: tabular-nums` at weight 300 for scores and 400+ for inline values.
- **Do** keep the primary canvas Paper Cream (`oklch(98% 0.003 95)`), never pure white.
- **Do** convey state with tonal background tints, opacity changes, weight shifts, and glyph suffixes — color is never the sole carrier.
- **Do** use 12px card radius and 8px control radius. The two-tier hierarchy is intentional.
- **Do** keep tap targets ≥44×44 CSS pixels on every interactive element, including icon buttons.
- **Do** let inline editing replace modals wherever possible. The schedule-item editor and chip-row patterns are the model.
- **Do** respect `prefers-reduced-motion`: transitions degrade to instant state changes.
- **Do** quote PRODUCT.md's strategic principles when adding a new screen: courtside-first, glanceable-not-studied, notebook-not-app.

### Don't:
- **Don't** introduce court green, ball yellow, or any color associated with the sport of tennis. Court Lime is a signal color tuned to a deep navy backdrop, not a sport reference.
- **Don't** use enterprise-SaaS gradients, hero-metric templates with gradient accents, or identical card grids. PRODUCT.md rejects the SaaS dashboard look; the visual spec enforces it.
- **Don't** use mascots, achievement badges, confetti, or reward animations. This is not a gamified app.
- **Don't** use big marketing display type, scroll-driven hero sections, or splashy color washes. There is no marketing surface in this product.
- **Don't** use side-stripe borders (a thick colored accent on one edge of a card or row). Use a full hairline border or no border at all.
- **Don't** use gradient text (background-clip: text). Single solid color always.
- **Don't** use glassmorphism, backdrop-filter blurs, or floating glass cards. The system is flat and honest.
- **Don't** use pure greys. Every neutral is tinted toward its theme's hue family.
- **Don't** use full-screen modals. Bottom sheets are the only allowed modal pattern; inline editing is preferred.
- **Don't** nest cards inside cards. If a section needs grouping inside a card, use a tonal row divider.
- **Don't** use em dashes in UI copy or this spec. Commas, colons, semicolons, periods, parentheses only.
- **Don't** load custom web fonts. The system stack is the choice.
- **Don't** animate layout properties (width, height, padding, margin). Animate opacity and transform only.
