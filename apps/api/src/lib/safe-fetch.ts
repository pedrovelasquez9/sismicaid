// Fetch endurecido para los jobs de ingesta de personas (defensa SSRF + timeout).
// Compartido por fetch-venezuelatebusca y fetch-encuentralos para que AMBOS
// hereden las mismas protecciones.

// User-Agent descriptivo NO-IA con URL de contacto REAL y alcanzable (el robots
// de las fuentes solo bloquea bots de IA; identificarnos honestamente).
export const PEOPLE_SEARCH_UA =
  "SismicAid/1.0 (+https://github.com/pedrovelasquez9/sismicaid; humanitarian people-search aggregator)";

const FETCH_TIMEOUT_MS = 15_000;

export function assertAllowedHost(url: string, allowedHost: string): void {
  const host = new URL(url).hostname;
  if (host !== allowedHost) throw new Error(`Host no permitido (allowlist SSRF): ${host}`);
}

// GET endurecido:
// - host allowlist (no hay URL de usuario -> sin SSRF directo);
// - redirect:"manual" + rechazo de cualquier 3xx -> un redirect upstream NO puede
//   llevarnos a un host interno/arbitrario (SSRF vía Location);
// - AbortSignal.timeout -> un upstream colgado no estanca el cron;
// - UA descriptivo no-IA.
export async function safeGet(url: string, allowedHost: string, accept: string): Promise<Response> {
  assertAllowedHost(url, allowedHost);
  const res = await fetch(url, {
    headers: { "user-agent": PEOPLE_SEARCH_UA, accept },
    redirect: "manual",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status >= 300 && res.status < 400) {
    throw new Error(`redirect no permitido (HTTP ${res.status}) — posible SSRF, abortado`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).pathname}`);
  return res;
}
