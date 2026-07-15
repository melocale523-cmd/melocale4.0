// Normalização de cidade/UF — fonte da verdade da higiene de profiles.city.
// Existe uma cópia espelhada no backend (backend/src/lib/normalizeCity.ts);
// se mudar a lógica aqui, mudar lá também.

export const TARGET_CITIES = [
  'Salvador',
  'Lauro de Freitas',
  'Jacobina',
  'Feira de Santana',
  'Irecê',
  'Senhor do Bonfim',
  'Vitória da Conquista',
  'Barreiras',
  'Porto Seguro',
] as const;

const VALID_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

// Palavras que ficam minúsculas no Title Case (exceto se forem a primeira)
const LOWERCASE_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e']);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && LOWERCASE_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Normaliza cidade + UF:
 * - trim + colapso de espaços múltiplos
 * - fuzzy-match (acentos/caixa + Levenshtein <= 1-2) contra as 6 cidades-alvo
 *   → nome canônico exato e UF 'BA' garantida
 * - fora das alvo: Title Case na cidade; UF em maiúsculas validada contra as
 *   27 — se inválida, mantém como veio (sem inventar) e loga
 */
export function normalizeCity(city: string | null | undefined, state?: string | null): { city: string; state: string } {
  const c = collapseSpaces(city ?? '');
  let uf = collapseSpaces(state ?? '').toUpperCase();
  if (uf && !VALID_UFS.has(uf)) {
    console.warn(`[normalizeCity] UF inválida mantida como veio: "${uf}"`);
  }
  if (!c) return { city: '', state: uf };

  const key = stripAccents(c).toLowerCase();
  for (const target of TARGET_CITIES) {
    const targetKey = stripAccents(target).toLowerCase();
    const tolerance = targetKey.length > 8 ? 2 : 1;
    if (key === targetKey || levenshtein(key, targetKey) <= tolerance) {
      return { city: target, state: 'BA' };
    }
  }
  return { city: titleCase(c), state: uf };
}

/** Monta o rótulo "Cidade - UF" (formato de profiles.city) já normalizado. */
export function cityLabel(city: string | null | undefined, state?: string | null): string | null {
  const n = normalizeCity(city, state);
  return [n.city, n.state].filter(Boolean).join(' - ') || null;
}

/** Normaliza um rótulo já no formato "Cidade - UF" (ou só "Cidade"). */
export function normalizeCityLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const [cityPart, statePart] = collapseSpaces(label).split(' - ');
  return cityLabel(cityPart, statePart);
}
