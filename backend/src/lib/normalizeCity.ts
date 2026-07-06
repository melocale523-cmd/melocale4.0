// Cópia espelhada de frontend/src/utils/normalizeCity.ts — se mudar a
// lógica lá, mudar aqui também. Usada pelo backend ao gravar leads.city.

export const TARGET_CITIES = [
  "Salvador",
  "Lauro de Freitas",
  "Jacobina",
  "Feira de Santana",
  "Irecê",
  "Senhor do Bonfim",
] as const;

const VALID_UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]);

const LOWERCASE_WORDS = new Set(["de", "do", "da", "dos", "das", "e"]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && LOWERCASE_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
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

export function normalizeCity(city: string | null | undefined, state?: string | null): { city: string; state: string } {
  const c = collapseSpaces(city ?? "");
  const uf = collapseSpaces(state ?? "").toUpperCase();
  if (uf && !VALID_UFS.has(uf)) {
    console.warn(`[normalizeCity] UF inválida mantida como veio: "${uf}"`);
  }
  if (!c) return { city: "", state: uf };

  const key = stripAccents(c).toLowerCase();
  for (const target of TARGET_CITIES) {
    const targetKey = stripAccents(target).toLowerCase();
    const tolerance = targetKey.length > 8 ? 2 : 1;
    if (key === targetKey || levenshtein(key, targetKey) <= tolerance) {
      return { city: target, state: "BA" };
    }
  }
  return { city: titleCase(c), state: uf };
}
