import iconIndex from "../generation/iconIndex.json";

interface IconEntry {
  name: string;
  tags: string;
}

let icons: IconEntry[] | null = null;

function loadIcons(): IconEntry[] {
  if (!icons) {
    icons = Array.isArray(iconIndex.icons) ? (iconIndex.icons as IconEntry[]) : [];
  }
  return icons;
}

export async function searchIcons(
  query: string,
  limit: number = 20,
  weight: string = "regular"
): Promise<string[]> {
  // Only the regular Phosphor set is bundled with the serverless build.
  const normWeight = "regular";
  void weight;

  try {
    const catalog = loadIcons();
    const q = query.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);
    if (!catalog.length || !terms.length) {
      return [`/static/icons/${normWeight}/star.svg`];
    }

    const matches: { name: string; score: number }[] = [];

    for (const icon of catalog) {
      const name = icon.name.toLowerCase();
      const tags = (icon.tags || "").toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (name === term) score += 10;
        else if (name.startsWith(term)) score += 5;
        else if (name.includes(term)) score += 3;

        if (tags.includes(term)) score += 2;
      }

      if (score > 0) matches.push({ name, score });
    }

    matches.sort((a, b) => b.score - a.score);
    const results: string[] = [];

    for (const match of matches) {
      const url = `/static/icons/${normWeight}/${match.name}.svg`;
      if (!results.includes(url)) results.push(url);
      if (results.length >= limit) break;
    }

    if (results.length === 0) {
      results.push(`/static/icons/${normWeight}/star.svg`);
    }

    return results;
  } catch (err) {
    console.warn("[Pixa V3 Icon Search] Error:", err);
    return [`/static/icons/${normWeight}/star.svg`];
  }
}
