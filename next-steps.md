# App Evolution Plan

## Critical Constraint: Preserve the Existing Interface

The current app's UI, recipes, and meal plan / grocery list features stay **exactly as they are**. This is not a redesign. It is a framework lift and SEO enrichment of the existing product. The meal plan builder, grocery list copy, servings scaling, and recipe browsing are already built and working in the current `index.html`. They get carried over 1:1.

---

## Current State

The app is a single `index.html` file (~6000 lines) — a static SPA with recipe cards, cuisine filters, a meal plan builder with grocery list aggregation, servings scaling, and copy-to-clipboard. Vanilla JS/HTML/CSS, DM Sans + Raleway fonts. No routing, no backend, no database. The meal plan and grocery list features are **already functional**.

---

## What Needs to Happen (and What Doesn't)

**Immediate work (Phases 1–3):** Build the infrastructure shell around the existing app so it can have real URLs, structured data, and SEO.

**Already done (Phase 4):** Meal plan builder, grocery list aggregation, servings, copy features — these exist in the current interface and just need to be carried into the new framework.

**Future work (Phases 5–8):** Monetization, AI features, and category expansion come later, built on top of the foundation from Phases 1–3.

---

## Phase 1: Framework Lift into Next.js

**Goal:** Get the exact same app running in Next.js with real URL routing. The user should not be able to tell the difference visually.

- Initialize a Next.js project (App Router, TypeScript) in this repo
- Decompose the monolith `index.html` into React components that **reproduce the current UI exactly**: RecipeCard, RecipeDetail, FilterNav, MealPlanBar, HeroSection, etc.
- Port all existing CSS (the custom properties, typography, accent colors, layouts) faithfully — use CSS modules or a global stylesheet, not a Tailwind rewrite
- Port all existing JS logic (filtering, meal plan state, grocery aggregation, servings scaling, copy-to-clipboard) into React state and effects
- Implement URL routing for the filter taxonomy: `/{category}/{filter-type}/{filter-value}` (e.g. `/salads/cuisine/mediterranean`)
- Each filter state becomes a real, server-renderable page that shows the same filtered view currently driven by JS click handlers
- The existing cuisine filters (American, Italian, French, etc.) map to URLs immediately
- Keep the current recipe data inline initially — just move the existing JS recipe objects into a data file that the components import

**What stays the same:** Every visual element, every interaction, every recipe, the meal plan bar at the bottom, the recipe detail panel, the filter pills, the servings modal, the copy buttons.

---

## Phase 2: Structured Recipe Data + Diet System

**Goal:** Enrich the recipe data model to support diet filtering and future AI features, without changing the existing recipes or UI.

- Extract the inline recipe data into structured JSON files (one per recipe or a single `recipes.json`)
- Add new fields per recipe: `diet` array, `flavor` array, `season` array (the existing `cuisine` field is already there)
- Add per-recipe `dressing` object with diet-specific variants (vegan, vegetarian, high-protein, keto, paleo)
- Add per-recipe `optionalProtein` array with diet-compatibility tags
- Add `omitFor` arrays on ingredients that should be hidden under certain diets
- Implement diet-swap rendering: when a diet filter is active, the recipe detail seamlessly shows the correct dressing, hides omitted ingredients, and shows diet-appropriate protein options — as if the recipe was always written for that diet
- Add the `/salads/diet/{diet}` URL routes
- This is primarily a **content authoring** task for the existing recipes — the code changes are the filtering logic and new URL routes
- The base recipes (title, core ingredients, steps, images) do not change

### Recipe Data Model (Target Schema)

```json
{
  "id": "caesar",
  "title": "Caesar Salad",
  "cuisine": "italian",
  "flavor": ["savory", "creamy"],
  "season": ["spring", "summer", "fall", "winter"],
  "diet": ["vegan", "vegetarian", "high-protein", "keto", "paleo"],
  "ingredients": [
    { "name": "romaine lettuce, chopped" },
    { "name": "croutons", "omitFor": ["keto", "paleo"] },
    { "name": "shaved parmesan", "omitFor": ["vegan", "paleo"] }
  ],
  "dressing": {
    "default": {
      "name": "classic caesar",
      "recipe": "anchovy paste + parmesan + lemon + garlic + olive oil + egg yolk"
    },
    "vegan": {
      "name": "vegan caesar",
      "recipe": "white miso + capers + lemon + garlic + olive oil + dijon"
    },
    "vegetarian": {
      "name": "vegetarian caesar",
      "recipe": "parmesan + lemon + garlic + olive oil + dijon (no anchovy)"
    },
    "high-protein": {
      "name": "high protein caesar",
      "recipe": "greek yogurt + anchovy paste + lemon + garlic + parmesan"
    },
    "keto": {
      "name": "keto caesar",
      "recipe": "anchovy paste + parmesan + lemon + garlic + olive oil + egg yolk"
    },
    "paleo": {
      "name": "paleo caesar",
      "recipe": "anchovy paste + lemon + garlic + olive oil + egg yolk (no parmesan)"
    }
  },
  "optionalProtein": [
    { "name": "grilled chicken breast", "diet": ["high-protein", "keto", "paleo"] },
    { "name": "chickpeas, roasted", "diet": ["vegan", "vegetarian"] },
    { "name": "hard boiled egg", "diet": ["vegetarian", "high-protein", "keto", "paleo"] },
    { "name": "tofu, pan-fried", "diet": ["vegan", "vegetarian"] },
    { "name": "salmon, grilled", "diet": ["high-protein", "keto", "paleo"] },
    { "name": "shrimp, grilled", "diet": ["high-protein", "keto", "paleo"] }
  ],
  "steps": ["..."]
}
```

### Diet-Swap Rendering Rules

When a user is on a diet-filtered page (e.g. `/salads/diet/vegan`):

1. **Dressing** — display the diet-specific version, not the default. No mention of swapping.
2. **Ingredients with `omitFor`** — if the active diet is in the `omitFor` array, hide that ingredient entirely. No mention of removal.
3. **Optional protein** — show only proteins whose `diet` array includes the active filter.
4. **No diet filter active** — show default dressing, all ingredients, all optional proteins.

The experience should feel like the recipe was always written for that diet.

### Diet Definitions

**`vegan`** — No meat, poultry, seafood, dairy, eggs, or honey. Dressing swaps: replace anchovy with capers or miso, replace parmesan with nutritional yeast, replace dairy with cashew/coconut cream, replace egg yolk with dijon. Protein options: chickpeas, lentils, tofu, tempeh, edamame, roasted seeds.

**`vegetarian`** — No meat, poultry, or seafood. Dairy and eggs allowed. Dressing swaps: replace anchovy/fish sauce with soy sauce or omit. Protein options: hard boiled egg, halloumi, paneer, chickpeas, lentils, tofu.

**`high-protein`** — Emphasize protein-dense ingredients. No restrictions on food groups. Dressing swaps: replace oil-heavy dressings with greek yogurt base where possible. Protein options: grilled chicken, salmon, shrimp, tuna, hard boiled egg, steak strips, edamame. Boost with hemp seeds, parmesan, or legumes.

**`keto`** — No grains, no legumes, low sugar, high fat. Omit: croutons, corn, beans, most fruit, high-sugar dressings. Dressing swaps: full-fat olive oil or avocado oil bases, no honey or maple syrup. Protein options: grilled chicken, salmon, shrimp, steak, hard boiled egg, bacon bits.

**`paleo`** — No grains, no legumes, no dairy, no refined sugar. Omit: croutons, corn, beans, any cheese, yogurt-based dressings. Dressing swaps: olive oil or avocado oil base, lemon, garlic, fresh herbs. No dairy, no soy. Protein options: grilled chicken, salmon, shrimp, steak, hard boiled egg.

### Recipe Title Convention

Titles should be ingredient-agnostic — no protein in the title. This allows the same recipe to appear on all diet surfaces without feeling wrong.

- Use "Caesar Salad" not "Chicken Caesar Salad"
- Use "Nicoise Salad" not "Grilled Salmon Nicoise"

---

## Phase 3: SEO Infrastructure

**Goal:** Make every filter page rank-ready.

- Per-URL `<title>`, `<meta description>`, and `<h1>` with keyword-targeted copy
- Per-URL hero/intro section with 2–3 sentence description
- Auto-generated `sitemap.xml` from the full filter taxonomy (~20 URLs initially)
- `schema.org/Recipe` structured data on recipe detail views
- `BreadcrumbList` structured data
- Canonical URL tags on every filter page
- SSR/SSG so all content is indexable by search engines and LLM crawlers
- Open Graph and Twitter Card meta tags for social sharing

### URL Architecture

Every URL follows this pattern: `/{food-category}/{filter-type}/{filter-value}`

Filter types:
- `cuisine` — italian, mediterranean, french, mexican, asian, american
- `flavor` — spicy, smoky, savory, creamy
- `season` — spring, summer, fall, winter
- `diet` — vegan, vegetarian, high-protein, keto, paleo

### URL Priority by SEO Opportunity

**Tier 1 — Highest Priority (build first)**

| URL | Target Keyword | Volume | KD |
|-----|---------------|--------|----|
| `/meal-prep/diet/vegan` | vegan meal prep ideas | 60.5K | 18 |
| `/meal-prep/diet/vegetarian` | vegetarian meal prep ideas | 8.1K | 17 |
| `/salads/diet/vegan` | vegan salads | — | low |
| `/salads/cuisine/mediterranean` | mediterranean salads | 2.4K | 39 |
| `/salads/cuisine/mexican` | mexican salads | 1.6K | 15 |
| `/salads/cuisine/italian` | italian salads | 2.9K | 43 |
| `/salads/cuisine/asian` | asian salads | 1.3K | 29 |
| `/salads/cuisine/french` | french salads | 1.0K | 22 |
| `/salads/diet/high-protein` | high protein salads | — | low |

**Tier 2 — Medium Priority**

| URL | Target Keyword | Volume | KD |
|-----|---------------|--------|----|
| `/meal-prep/diet/high-protein` | high protein meal prep | 12.1K | 36 |
| `/meal-prep/salads` | salad meal prep | 1.0K | 10 |
| `/meal-prep/diet/keto` | keto meal prep ideas | 1.3K | 26 |
| `/salads/flavor/spicy` | spicy salads | 50 | 16 |
| `/salads/flavor/savory` | savory salads | 70 | 11 |
| `/salads/flavor/creamy` | creamy salads | 30 | n/a |

**Tier 3 — Future (when entrees/snacks are added)**

| URL | Target Keyword | Volume | KD |
|-----|---------------|--------|----|
| `/meal-prep` | healthy meal prep ideas | 18.1K | 43 |
| `/snacks/diet/high-protein` | high protein snacks | 110K | 28 |
| `/entrees/cuisine/mediterranean` | mediterranean meals | — | — |
| `/meal-prep/season/summer` | summer meal prep | — | low |

### Per-URL Hero Copy Examples

**`/salads/cuisine/mediterranean`**
> **Mediterranean Salads** — Fresh, vibrant, and packed with flavor — browse our collection of Mediterranean salads. Add your favorites to this week's meal plan and copy your grocery list in one click.

**`/meal-prep/diet/vegan`**
> **Vegan Meal Prep Ideas** — Planning a week of vegan meals has never been easier. Browse our vegan-friendly recipes, build your weekly meal plan, and get your full grocery list instantly.

**`/salads/diet/high-protein`**
> **High Protein Salads** — Fuel your week with high-protein salads that actually taste good. Pick your recipes, add your optional protein, and copy your meal prep grocery list in seconds.

### Structured Data Example

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Chipotle Black Bean Salad",
  "recipeCategory": "Salad",
  "recipeCuisine": "Mexican",
  "keywords": "vegan salad, mexican salad, meal prep salad"
}
```

### Sitemap Coverage

Auto-generate `sitemap.xml` including every filter URL:

```
/salads
/salads/cuisine/italian
/salads/cuisine/mediterranean
/salads/cuisine/french
/salads/cuisine/mexican
/salads/cuisine/asian
/salads/flavor/spicy
/salads/flavor/smoky
/salads/flavor/savory
/salads/flavor/creamy
/salads/diet/vegan
/salads/diet/vegetarian
/salads/diet/high-protein
/salads/diet/keto
/meal-prep
/meal-prep/diet/vegan
/meal-prep/diet/vegetarian
/meal-prep/diet/high-protein
/meal-prep/diet/keto
/meal-prep/salads
```

---

## Phase 4: Already Built

The current `index.html` already has:
- Meal plan builder (add/remove recipes, visible at bottom of page)
- Grocery list aggregation across selected recipes
- Servings scaling
- Copy-to-clipboard for ingredients and full recipes
- Recipe detail view with ingredients and steps

These features carry over as-is during Phase 1. No new work needed beyond the React port.

---

## Phase 5: Monetization Layer (Future)

- Free tier: browse all recipes, filter freely, add up to 3 items to meal plan, view plan summary
- Paid tier: unlimited slots, copy grocery list, copy all recipes, save multiple plans, Smart Picks
- Soft upgrade prompt at the 3-item boundary
- Stripe integration

### Upgrade Prompt Copy

When a user tries to add a 4th item:

> You've built a great start. Upgrade to unlock unlimited meal planning and copy your full grocery list instantly.
>
> [Start Free Trial] [Maybe later]

---

## Phase 6: AI Intent Parsing + Recipe Adaptation (Future)

**Goal:** Add an AI layer that interprets user intent and adapts recipes, without replacing the visual UI.

- Prompt bar for natural language queries
- AI maps "high-protein vegetarian lunches" to structured filter state
- Recipe adaptation: canonical recipe + constraints produces a validated variant JSON
- Substitution rules for AI-assisted swaps beyond hand-authored ones
- Validation layer: all AI output passes through code-based checks before rendering
- Canonical recipes are **never mutated** — AI creates transient variants

### AI Architecture Principles

The AI layer should:
- Interpret user goals and map natural language to structured constraints
- Recommend recipes from the existing inventory
- Generate meal plans from known recipe candidates only
- Explain substitutions and adaptations
- Summarize grocery needs

The AI layer should NOT:
- Invent nutritional facts without grounding
- Invent ingredients not in the system
- Silently change canonical recipes
- Bypass validation rules
- Act as the database or source of truth

Chat should be an **entry point**, not the only interface. Users express intent in natural language; the app turns that into structured selections and visual tools.

### Canonical vs Variant Model

- A **canonical recipe** is the trusted base version — the version users browse and search engines index
- A **variant** is derived from a canonical recipe (e.g. higher-protein, vegan, no-oven, faster prep)
- AI never overwrites canonical recipes — it creates transient variant objects
- Users can save a variant if desired; some may later be promoted to permanent content

### AI Output Validation

All AI output must be validated before rendering:
- Recipe IDs exist
- Ingredients exist or are explicitly user-added
- Servings are positive, steps are non-empty
- Substitutions are permitted
- Meal plan dates are valid
- Macros are recalculated by code where possible

### Example AI Output Schema (Recipe Adaptation)

```json
{
  "variant_title": "High-Protein Vegan Mediterranean Salad",
  "based_on_recipe_id": "recipe_123",
  "changes_summary": [
    "Replaced feta with marinated tofu",
    "Added chickpeas for extra protein"
  ],
  "ingredient_changes": [
    {
      "remove": "feta",
      "add": "marinated tofu",
      "reason": "vegan substitution"
    }
  ],
  "updated_steps": [
    "Whisk dressing in a small bowl.",
    "Combine greens, chickpeas, cucumber, tomatoes, and tofu.",
    "Toss with dressing and serve."
  ],
  "nutrition_notes": [
    "Estimated protein increased by approximately 8-12g depending on tofu portion."
  ]
}
```

---

## Phase 7: AI Meal Plan Generation (Future)

- Candidate retrieval and scoring by nutrition diversity, cuisine variety, prep efficiency
- LLM assembles plans from known recipes only (no hallucinated meals)
- Visual plan editor with swap suggestions and "why this recipe?" explainability
- Cooking mode with step-by-step view, timers, checkboxes, prep-ahead panel

### Suggested API Routes (Phases 6–7)

- `GET /api/recipes` — list recipes
- `GET /api/recipes/:id` — single recipe
- `POST /api/recipes/parse-intent` — natural language to structured filter state
- `POST /api/recipes/:id/adapt` — canonical recipe + constraints to variant JSON
- `POST /api/meal-plans` — create meal plan
- `POST /api/meal-plans/generate` — AI-generated plan from candidate recipes
- `POST /api/meal-plans/:id/swap-item` — swap a recipe in a plan
- `POST /api/grocery-lists/generate` — aggregate ingredients from plan

---

## Phase 8: Expand Beyond Salads (Future)

- Add entrees, snacks, desserts as new top-level categories
- `/meal-prep` becomes the cross-category hub for highest-volume keywords
- Dynamic protein logic for entrees (protein is core to the dish, not optional like salads)
- Same taxonomy, same diet-swap system, same UI patterns

### New Top-Level Categories

```
/salads        ← current
/entrees       ← next
/snacks        ← next
/desserts      ← later
/meal-prep     ← cross-category view (pulls from all categories)
```

---

## Key Principles

- **Preserve the existing UI** — this is a framework lift, not a redesign
- **Existing recipes are the canonical source of truth** — they don't change
- **Existing meal plan/grocery features carry over as-is** — already built
- **Every filter state becomes a real URL** — the single biggest SEO win
- **Deterministic logic first, AI second** — grocery math and filtering stay code-driven
- **Hand-authored diet variants over AI generation** — quality control on every recipe
- **This is a tool, not a food blog** — content exists to surface the tool via search; the meal plan feature is the retention and monetization mechanism

### Product Rules

1. Canonical recipes are never mutated by AI
2. AI variants must be based on existing recipes unless "experimental generation" is explicitly enabled
3. All AI outputs must be validated before rendering
4. Grocery math and serving math should be code-driven, not LLM-driven
5. Chat should trigger or refine UI states, not replace the visual interface
6. Dynamic results are features; canonical pages remain the SEO and trust layer
7. Saved variants should be traceable back to their source recipe
8. If AI confidence is low, fall back to deterministic recommendations

---

## Tech Stack

- **Framework:** Next.js (App Router), TypeScript, React
- **Styling:** Port existing CSS faithfully (CSS modules or global stylesheet — not a Tailwind rewrite)
- **Data:** Structured JSON files for recipes (graduating to Postgres when AI features arrive)
- **Hosting:** Vercel (SSR/SSG, edge rendering for SEO)
- **Future backend:** Next.js API routes, Zod validation, LLM provider abstraction
- **Future payments:** Stripe

---

## Site Naming & Positioning

Current name "Super Simple Meal Prep Salads" undersells the full vision. Recommended:

> **Simple Healthy Meal Prep** — Plan your week in minutes.

This captures the full product vision (not just salads), targets high-volume keywords naturally, and frames it as a tool rather than a recipe site.
