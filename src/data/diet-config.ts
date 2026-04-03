export const DIET_KEYS = ['Vegan', 'Vegetarian', 'High-Protein', 'Keto', 'Paleo'] as const;
export type DietKey = (typeof DIET_KEYS)[number];

export const DIET_SLUGS: Record<string, string> = {
  'Vegan': 'vegan',
  'Vegetarian': 'vegetarian',
  'High-Protein': 'high-protein',
  'Keto': 'keto',
  'Paleo': 'paleo',
};

export const DIET_FROM_SLUG: Record<string, string> = {
  'vegan': 'Vegan',
  'vegetarian': 'Vegetarian',
  'high-protein': 'High-Protein',
  'keto': 'Keto',
  'paleo': 'Paleo',
};

export const DIET_ACCENTS: Record<string, string> = {
  'Vegan': '#2d8650',
  'Vegetarian': '#4a9b6e',
  'High-Protein': '#c23b3b',
  'Keto': '#b57d1f',
  'Paleo': '#8b6f47',
};

export interface IngredientOmitRule {
  pattern: RegExp;
  diets: string[];
}

export const INGREDIENT_OMIT_RULES: IngredientOmitRule[] = [
  // Meat & poultry
  { pattern: /\bchicken\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\brotisserie\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bbeef\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bsteak\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bbulgogi\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bturkey\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bbacon\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bprosciutto\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bham\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bsalami\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bserrano\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bpepperoni\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bkaraage\b/i, diets: ['Vegan', 'Vegetarian'] },

  // Seafood
  { pattern: /\bshrimp\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bsalmon\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\btuna\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\bcrab\b/i, diets: ['Vegan', 'Vegetarian'] },
  { pattern: /\banchov/i, diets: ['Vegan', 'Vegetarian'] },

  // Dairy
  { pattern: /\bparmesan\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bpecorino\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bfeta\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bgoat cheese\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bmozzarella\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bblue cheese\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bcheddar\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bgouda\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bprovolone\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bmanchego\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bhalloumi\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bcotija\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bgorgonzola\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bcheese\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bsour cream\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bcrema\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bbuttermilk\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\byogurt\b/i, diets: ['Vegan', 'Paleo'] },
  { pattern: /\bmayo\b/i, diets: ['Vegan'] },
  { pattern: /\bbutter(?!\s+lettuce)\b/i, diets: ['Vegan'] },
  { pattern: /\bhummus\b/i, diets: ['Keto', 'Paleo'] },

  // Eggs
  { pattern: /\beggs?\b/i, diets: ['Vegan'] },
  { pattern: /\bhard-boiled\b/i, diets: ['Vegan'] },
  { pattern: /\bpoached\b/i, diets: ['Vegan'] },
  { pattern: /\bsoft-boiled\b/i, diets: ['Vegan'] },

  // Honey (strict vegan)
  { pattern: /\bhoney\b/i, diets: ['Vegan'] },

  // Grains
  { pattern: /\brice(?!\s+vinegar)\b/i, diets: ['Keto'] },
  { pattern: /\bfarro\b/i, diets: ['Keto'] },
  { pattern: /\bbulgur\b/i, diets: ['Keto'] },
  { pattern: /\bquinoa\b/i, diets: ['Keto'] },
  { pattern: /\bfreekeh\b/i, diets: ['Keto'] },
  { pattern: /\bcroutons?\b/i, diets: ['Keto', 'Paleo'] },
  { pattern: /\bpita\b/i, diets: ['Keto', 'Paleo'] },

  // Legumes
  { pattern: /\bchickpeas?\b/i, diets: ['Keto', 'Paleo'] },
  { pattern: /\bblack beans?\b/i, diets: ['Keto', 'Paleo'] },
  { pattern: /\blentils?\b/i, diets: ['Keto', 'Paleo'] },
  { pattern: /\bedamame\b/i, diets: ['Keto', 'Paleo'] },

  // Starchy vegetables
  { pattern: /\bsweet potato\b/i, diets: ['Keto'] },
  { pattern: /\bpotato(es)?\b/i, diets: ['Keto'] },
  { pattern: /\bcorn\b/i, diets: ['Keto'] },

  // Soy (paleo)
  { pattern: /\btofu\b/i, diets: ['Paleo'] },
  { pattern: /\btempeh\b/i, diets: ['Paleo'] },
  { pattern: /\bsoy sauce\b/i, diets: ['Paleo'] },
  { pattern: /\btamari\b/i, diets: ['Paleo'] },

  // Peanuts are legumes (paleo)
  { pattern: /\bpeanut/i, diets: ['Paleo'] },

  // High-sugar items (keto)
  { pattern: /\bcandied\b/i, diets: ['Keto'] },
  { pattern: /\bdried cranberries\b/i, diets: ['Keto'] },
  { pattern: /\bdates\b/i, diets: ['Keto'] },
  { pattern: /\bwatermelon\b/i, diets: ['Keto'] },
  { pattern: /\bmango\b/i, diets: ['Keto'] },
  { pattern: /\bpeach(es)?\b/i, diets: ['Keto'] },
  { pattern: /\borange segments\b/i, diets: ['Keto'] },
  { pattern: /\bgrapefruit\b/i, diets: ['Keto'] },
  { pattern: /\bfigs?\b/i, diets: ['Keto'] },
  { pattern: /\bplantain\b/i, diets: ['Keto'] },
  { pattern: /\bpomegranate\b/i, diets: ['Keto'] },
];

export interface DressingSub {
  from: RegExp;
  to: string;
}

export const DRESSING_SUBS: Record<string, DressingSub[]> = {
  'Vegan': [
    { from: /\bGreek yogurt\b/gi, to: 'coconut yogurt' },
    { from: /\byogurt\b/gi, to: 'coconut yogurt' },
    { from: /\bmayo(nnaise)?\b/gi, to: 'vegan mayo' },
    { from: /\bsour cream\b/gi, to: 'cashew cream' },
    { from: /\bcrema\b/gi, to: 'cashew cream' },
    { from: /\bbuttermilk\b/gi, to: 'oat milk + vinegar' },
    { from: /\banchov\w*/gi, to: 'white miso' },
    { from: /\bfish sauce\b/gi, to: 'soy sauce + lime' },
    { from: /\bparmesan\b/gi, to: 'nutritional yeast' },
    { from: /\bpecorino\b/gi, to: 'nutritional yeast' },
    { from: /\begg yolk\b/gi, to: 'Dijon' },
    { from: /\bhoney\b/gi, to: 'maple syrup' },
    { from: /\bWorcestershire\b/gi, to: 'soy sauce' },
    { from: /\bmelted butter\b/gi, to: 'olive oil' },
    { from: /\bbutter\b/gi, to: 'olive oil' },
    { from: /\bblue cheese crumbles\b/gi, to: 'cashew cream + white miso' },
    { from: /\bblue cheese\b/gi, to: 'cashew cream + miso' },
    { from: /\bbonito\b/gi, to: 'kombu' },
  ],
  'Vegetarian': [
    { from: /\banchov\w*/gi, to: 'capers' },
    { from: /\bfish sauce\b/gi, to: 'soy sauce' },
    { from: /\bbonito\b/gi, to: 'kombu' },
    { from: /\bWorcestershire\b/gi, to: 'soy sauce' },
  ],
  'Keto': [
    { from: /\bhoney\b/gi, to: 'monk fruit sweetener' },
    { from: /\bbrown sugar\b/gi, to: 'monk fruit sweetener' },
    { from: /\bpalm sugar\b/gi, to: 'monk fruit sweetener' },
    { from: /\bsugar\b/gi, to: 'monk fruit sweetener' },
    { from: /\bmaple syrup\b/gi, to: 'monk fruit sweetener' },
    { from: /\bmirin\b/gi, to: 'rice vinegar' },
  ],
  'Paleo': [
    { from: /\bGreek yogurt\b/gi, to: 'coconut yogurt' },
    { from: /\byogurt\b/gi, to: 'coconut yogurt' },
    { from: /\bmayo(nnaise)?\b/gi, to: 'avocado-oil mayo' },
    { from: /\bsour cream\b/gi, to: 'coconut cream' },
    { from: /\bcrema\b/gi, to: 'coconut cream' },
    { from: /\bbuttermilk\b/gi, to: 'coconut milk + lemon' },
    { from: /\bparmesan\b/gi, to: 'nutritional yeast' },
    { from: /\bpecorino\b/gi, to: 'nutritional yeast' },
    { from: /\bsoy sauce\b/gi, to: 'coconut aminos' },
    { from: /\btamari\b/gi, to: 'coconut aminos' },
    { from: /\b(shiro )?miso\b/gi, to: 'tahini' },
    { from: /\bmelted butter\b/gi, to: 'ghee' },
    { from: /\bbutter\b/gi, to: 'ghee' },
    { from: /\bblue cheese\b/gi, to: '' },
  ],
  'High-Protein': [],
};

export interface OptionalProtein {
  name: string;
  amount: string;
  diets: string[];
}

export const OPTIONAL_PROTEINS: OptionalProtein[] = [
  { name: 'grilled chicken breast', amount: '6 oz', diets: ['High-Protein', 'Keto', 'Paleo'] },
  { name: 'grilled salmon', amount: '6 oz', diets: ['High-Protein', 'Keto', 'Paleo'] },
  { name: 'grilled shrimp', amount: '6 oz', diets: ['High-Protein', 'Keto', 'Paleo'] },
  { name: 'hard-boiled eggs', amount: '2', diets: ['Vegetarian', 'High-Protein', 'Keto', 'Paleo'] },
  { name: 'roasted chickpeas', amount: '½ cup', diets: ['Vegan', 'Vegetarian', 'High-Protein'] },
  { name: 'pan-fried tofu', amount: '6 oz', diets: ['Vegan', 'Vegetarian', 'High-Protein'] },
  { name: 'tempeh, sliced', amount: '6 oz', diets: ['Vegan', 'Vegetarian'] },
  { name: 'edamame, shelled', amount: '½ cup', diets: ['Vegan', 'Vegetarian', 'High-Protein'] },
  { name: 'steak strips', amount: '6 oz', diets: ['High-Protein', 'Keto', 'Paleo'] },
  { name: 'hemp seeds', amount: '2 tbsp', diets: ['Vegan', 'Vegetarian', 'High-Protein', 'Keto', 'Paleo'] },
];

export const MIN_VIABLE_INGREDIENTS = 3;
