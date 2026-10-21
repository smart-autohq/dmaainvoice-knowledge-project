export const CATEGORY_DEFINITIONS = [
  { slug: 'technology', label: 'Technology', aliases: ['technology', 'tech'] },
  { slug: 'finance', label: 'Islamic Finance', aliases: ['finance', 'islamic-finance', 'islamic finance'] },
  { slug: 'business', label: 'Business', aliases: ['business', 'ethical-business', 'ethical business'] },
  { slug: 'personal-development', label: 'Personal Development', aliases: ['personal-development', 'personal development', 'personal-mastery'] },
  { slug: 'public-speaking', label: 'Public Speaking', aliases: ['public-speaking', 'public speaking'] },
  { slug: 'career', label: 'Career & Growth', aliases: ['career', 'career-growth', 'career & growth', 'career and growth'] },
];

export function getCategoryLabel(cat) {
  if (!cat) return 'Knowledge Track';
  const c = String(cat).trim().toLowerCase();
  for (const def of CATEGORY_DEFINITIONS) {
    if (def.slug === c || def.label.toLowerCase() === c || def.aliases.includes(c)) {
      return def.label;
    }
  }
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function getCategoryAliases(cat) {
  if (!cat) return [];
  const c = String(cat).trim().toLowerCase();
  for (const def of CATEGORY_DEFINITIONS) {
    if (def.slug === c || def.label.toLowerCase() === c || def.aliases.includes(c)) {
      return Array.from(new Set([def.slug, def.label, ...def.aliases]));
    }
  }
  return [cat];
}
