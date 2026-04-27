// Persona Archetypes for character identity
export const PERSONA_ARCHETYPES = [
  'Hero',
  'Villain',
  'Antihero',
  'Mentor',
  'Sidekick',
  'Trickster',
  'Lover',
  'Everyman',
  'Rebel',
  'Creator',
  'Caregiver',
  'Explorer',
  'Sage',
  'Innocent',
  'Ruler',
  'Other'
] as const

export type PersonaArchetype = typeof PERSONA_ARCHETYPES[number]

// Storyline categories available for selection
export const STORYLINE_CATEGORIES = [
  'Romance',
  'Action',
  'Horror',
  'Fantasy',
  'Sci-Fi',
  'Slice of Life',
  'Mystery',
  'Comedy',
  'Drama',
  'Adventure',
  'Thriller',
  'Historical',
  'Supernatural',
  'Other'
] as const

export type StorylineCategory = typeof STORYLINE_CATEGORIES[number]
