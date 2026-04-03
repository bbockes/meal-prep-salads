export const ACCENT: Record<string, string> = {
  American:        '#c73d3a',
  Italian:         '#2d8650',
  Greek:           '#2d86ae',
  French:          '#6b5b95',
  'Middle Eastern': '#b57d1f',
  Spanish:         '#e25d40',
  Mexican:         '#c86b45',
  Indian:          '#c23b3b',
  Thai:            '#1b8670',
  Japanese:        '#5d4e44',
  Korean:          '#d4543a',
  Vietnamese:      '#4a9b6e',
};

export const FLAVOR_KEYS = ['Tangy', 'Creamy', 'Spicy', 'Fresh', 'Savory', 'Umami'] as const;
export const SEASON_KEYS = ['Spring', 'Summer', 'Fall', 'Winter', 'Year-round'] as const;

export const FLAVOR_ACCENTS: Record<string, string> = {
  'Tangy': '#2bb0a3',
  'Creamy': '#8b78b8',
  'Spicy': '#c23b3b',
  'Fresh': '#4a9b6e',
  'Savory': '#b57d1f',
  'Umami': '#5d4e44',
};

export const SEASON_ACCENTS: Record<string, string> = {
  'Spring': '#5d8f6e',
  'Summer': '#b8892a',
  'Fall': '#c86b45',
  'Winter': '#6b7f94',
  'Year-round': '#2d86ae',
};

export { DIET_KEYS, DIET_ACCENTS, DIET_SLUGS, DIET_FROM_SLUG } from './diet-config';
