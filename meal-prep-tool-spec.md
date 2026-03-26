# Meal Prep Tool — Product & SEO Spec
*A reference document for building out the full feature set and SEO architecture.*

---

## 1. Product Vision

A healthy meal planning tool that lets users browse a curated pool of salads, entrees, snacks, and desserts — filtered by diet, cuisine, flavor, or season — add favorites to a weekly plan, and instantly copy a consolidated grocery list or full recipe set.

**The core value proposition:** The gap between "I want to eat healthy this week" and "I have a grocery list in my hand" is enormous. This tool closes it in three clicks. No editing, no searching, no friction.

**This is a tool, not a food blog.** Content exists to surface the tool via search. The meal plan feature is the retention and monetization mechanism.

---

## 2. URL Architecture & SEO Page Map

### 2.1 Core Taxonomy

Every URL follows this pattern:
```
/{food-category}/{filter-type}/{filter-value}
```

Filter types:
- `cuisine` — italian, mediterranean, french, mexican, asian, american
- `flavor` — spicy, smoky, savory, creamy
- `season` — spring, summer, fall, winter
- `diet` — vegan, vegetarian, high-protein, keto, paleo

### 2.2 Full URL Map (Prioritized by SEO Opportunity)

#### TIER 1 — Highest Priority (build first)
These are high volume, low KD, and map directly to existing filters.

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

#### TIER 2 — Medium Priority
| URL | Target Keyword | Volume | KD |
|-----|---------------|--------|----|
| `/meal-prep/diet/high-protein` | high protein meal prep | 12.1K | 36 |
| `/meal-prep/salads` | salad meal prep | 1.0K | 10 |
| `/meal-prep/diet/keto` | keto meal prep ideas | 1.3K | 26 |
| `/salads/flavor/spicy` | spicy salads | 50 | 16 |
| `/salads/flavor/savory` | savory salads | 70 | 11 |
| `/salads/flavor/creamy` | creamy salads | 30 | n/a |

#### TIER 3 — Future (when entrees/snacks are added)
| URL | Target Keyword | Volume | KD |
|-----|---------------|--------|----|
| `/meal-prep` | healthy meal prep ideas | 18.1K | 43 |
| `/snacks/diet/high-protein` | high protein snacks | 110K | 28 |
| `/meal-prep/diet/vegan` (expanded) | vegan meal prep ideas | 60.5K | 18 |
| `/entrees/cuisine/mediterranean` | mediterranean meals | — | — |
| `/meal-prep/season/summer` | summer meal prep | — | low |

---

## 3. Filter & URL Implementation

### 3.1 How Filters Map to URLs

When a user changes a filter, the URL must update to reflect the active filter state. This makes each filter state indexable by search engines.

```
User clicks "Mediterranean" under Cuisine tab
→ URL updates to /salads/cuisine/mediterranean
→ Page title updates to "Mediterranean Salads"
→ Intro copy updates to mediterranean-specific text
→ Recipe cards filter to mediterranean recipes only
```

### 3.2 Filter Categories to Build

```
Cuisine:    american | mediterranean | french | mexican | asian | italian | indian
Flavor:     spicy | smoky | savory | creamy
Season:     spring | summer | fall | winter
Diet:       vegan | vegetarian | high-protein | keto | paleo  ← NEW, build this
```

### 3.3 URL Routing Logic

- `/salads` → show all salads, no filter active
- `/salads/cuisine/italian` → filter by cuisine=italian
- `/salads/diet/vegan` → filter by diet=vegan
- `/meal-prep` → meal prep landing page, tool loads in meal prep mode
- `/meal-prep/diet/vegan` → meal prep page, tool pre-filtered to vegan

Only one filter active at a time for now. Combination filters (`/salads/diet/vegan/cuisine/italian`) are a future enhancement.

---

## 4. Recipe Data Model

### 4.1 Current Structure (assumed)
```json
{
  "id": "chipotle-black-bean",
  "title": "Chipotle Black Bean",
  "cuisine": "mexican",
  "ingredients": [...],
  "steps": [...]
}
```

### 4.2 Updated Structure Needed

```json
{
  "id": "chipotle-black-bean",
  "title": "Chipotle Black Bean",
  "cuisine": "mexican",
  "flavor": ["spicy", "smoky"],
  "season": ["spring", "summer", "fall"],
  "diet": ["vegan", "vegetarian"],
  "ingredients": [
    {
      "name": "spring mix",
      "tags": ["base", "vegan", "vegetarian"]
    },
    {
      "name": "black beans, drained",
      "tags": ["protein", "vegan", "vegetarian", "high-protein"]
    },
    {
      "name": "sweet potato, roasted and cubed",
      "tags": ["vegan", "vegetarian"]
    }
  ],
  "optionalProtein": [
    { "name": "grilled chicken", "diet": ["high-protein"] },
    { "name": "chickpeas", "diet": ["vegan", "vegetarian", "high-protein"] },
    { "name": "hard boiled egg", "diet": ["vegetarian", "high-protein"] },
    { "name": "tofu", "diet": ["vegan", "vegetarian"] }
  ],
  "steps": [...],
  "dressing": {
    "name": "chipotle crema",
    "recipe": "Greek yogurt + chipotle in adobo + lime + garlic",
    "veganSwap": "cashew cream + chipotle in adobo + lime + garlic"
  }
}
```

### 4.3 Diet Tag Logic

Recipes get diet tags based on their ingredients:
- `vegan` — no meat, dairy, eggs, honey
- `vegetarian` — no meat, but dairy/eggs allowed
- `high-protein` — contains high-protein ingredients OR has a high-protein optional protein
- `keto` — low carb, high fat ingredients
- `paleo` — no grains, legumes, dairy

When the active diet filter is `vegan`:
- Hide any ingredient tagged with `meat | dairy | egg`
- Show vegan dressing swap if available
- Show only vegan optional proteins
- If a recipe has a `veganSwap` for dressing, display that instead

### 4.4 Recipe Title Convention

Titles should be **ingredient-agnostic** — no protein in the title. This allows the same recipe to appear on all diet surfaces without feeling wrong.

```
❌ Chicken Caesar Salad
✅ Caesar Salad

❌ Grilled Salmon Nicoise
✅ Nicoise Salad
```

---

## 5. Page Structure & Components

### 5.1 Every Filter Page Shares This Structure

```
[Hero / Intro Section]         ← changes based on URL context
[Filter Navigation]            ← cuisine | flavor | season | diet tabs
[Recipe Cards Grid]            ← filtered based on active URL
[Active Recipe Detail]         ← ingredients + steps
[This Week's Meal Plan]        ← always visible at bottom
```

### 5.2 Hero / Intro Section

This section is the only part of the page that is URL-specific. It contains:
- H1 page title (keyword-targeted)
- 2-3 sentence description (for SEO + user context)
- No other content needed

Each URL needs its own title and description. Examples:

**`/salads/cuisine/mediterranean`**
```
H1: Mediterranean Salads
Description: Fresh, vibrant, and packed with flavor — browse our collection of 
Mediterranean salads. Add your favorites to this week's meal plan and copy your 
grocery list in one click.
```

**`/meal-prep/diet/vegan`**
```
H1: Vegan Meal Prep Ideas
Description: Planning a week of vegan meals has never been easier. Browse our 
vegan-friendly recipes, build your weekly meal plan, and get your full grocery 
list instantly.
```

**`/salads/diet/high-protein`**
```
H1: High Protein Salads
Description: Fuel your week with high-protein salads that actually taste good. 
Pick your recipes, add your optional protein, and copy your meal prep grocery 
list in seconds.
```

### 5.3 Filter Navigation

The filter nav tabs should reflect the current category context:

- On `/salads/*` → show Cuisine | Flavor | Season | Diet tabs
- On `/meal-prep/*` → show Diet | Cuisine | Season tabs (diet first, most relevant)
- Active filter tab and sub-filter should be visually highlighted
- Clicking a different filter updates the URL

### 5.4 Recipe Cards

- All recipes always visible (never gated)
- Cards filter based on active URL/filter
- When diet filter is active, optional protein suggestion appears on card or in recipe detail
- Card title uses ingredient-agnostic naming convention

### 5.5 Recipe Detail

When diet filter is active:
- Ingredients filtered to show only diet-appropriate items
- Dressing shows vegan/diet-appropriate swap if available
- Optional protein section appears: "Add a protein: [chickpeas] [tofu] [grilled chicken]" with diet-appropriate options highlighted

---

## 6. Meal Plan Feature

### 6.1 Free vs Paid Feature Boundary

```
FREE (always available):
✅ Browse all recipes
✅ Filter by any category
✅ View full recipe detail
✅ Add up to 3 items to weekly meal plan
✅ View meal plan summary

PAID:
🔒 Unlimited meal plan slots (4+)
🔒 Copy consolidated grocery list
🔒 Copy all recipes at once
🔒 Save multiple weekly plans
🔒 Smart Picks / recommendations
```

### 6.2 Upgrade Prompt

When user tries to add a 4th item to their meal plan, show:

```
"You've built a great start. Upgrade to unlock unlimited meal planning 
and copy your full grocery list instantly."

[Start Free Trial]  [Maybe later]
```

This should feel like a natural next step, not a hard block.

### 6.3 Meal Plan UI (Current — keep as is)
- Lives at bottom of page
- Shows selected recipe pills with remove (×) button
- "Show amounts" toggle
- "Copy all ingredients" button (gated)
- "Copy all recipes" button (gated)
- "Clear plan" button

---

## 7. SEO Technical Requirements

### 7.1 Every Filter URL Must Have

- Unique `<title>` tag: `{Filter} Salads | Simple Healthy Meal Prep`
- Unique `<meta description>`: 150-160 chars, keyword-inclusive
- Unique `<h1>` on page matching target keyword
- Canonical URL set to the filter URL (not the base URL)
- Recipe cards rendered server-side or statically for indexability

### 7.2 Sitemap

Auto-generate sitemap.xml that includes every filter URL combination:
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

### 7.3 Structured Data

Add Recipe schema markup to each recipe detail view:
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

---

## 8. Future Expansion — Beyond Salads

When ready to expand to entrees, snacks, desserts:

### 8.1 New Top-Level Categories
```
/salads        ← current
/entrees       ← next
/snacks        ← next
/desserts      ← later
/meal-prep     ← cross-category view (already exists conceptually)
```

### 8.2 Meal Prep as Cross-Category Surface

`/meal-prep` becomes the most important page on the site — it pulls from ALL food categories filtered by diet/cuisine/season. This is where the highest-volume keywords live and where the tool's full value is realized.

### 8.3 Dynamic Protein Logic for Entrees

Unlike salads where protein is optional, entrees are built around a protein source. The diet filter drives what protein is shown:

```
Mediterranean Bowl
- /entrees/diet/vegan → built around chickpeas
- /entrees/diet/high-protein → built around grilled chicken
- /entrees/diet/vegetarian → built around falafel
```

The base recipe (sauce, grains, vegetables) stays the same. Only the protein component changes based on diet context.

---

## 9. Site Naming & Positioning

Current name "Super Simple Meal Prep Salads" undersells the full vision. Consider:

**Recommended positioning:**
```
Simple Healthy Meal Prep
Plan your week in minutes.
```

This captures the full product vision (not just salads), targets high-volume keywords naturally, and frames it as a tool rather than a recipe site.

---

## 10. Implementation Order (Recommended)

1. **Make filter states into real URLs** — biggest SEO win, minimal build effort
2. **Add diet filter category** — vegan, vegetarian, high-protein, keto
3. **Update recipe data model** — add diet tags, optional proteins, dressing swaps
4. **Build per-URL hero/intro section** — H1 + 2-3 sentence description per filter URL
5. **Implement ingredient filtering logic** — show/hide ingredients based on active diet filter
6. **Implement free/paid feature boundary** — gate grocery list copy at 3-item plan limit
7. **Generate sitemap.xml** — auto-generated from filter taxonomy
8. **Add meta tags per URL** — title, description, canonical
9. **Add Recipe structured data** — schema markup on recipe detail
10. **Expand to entrees** — repeat the same taxonomy and logic
