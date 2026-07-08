import type {
  CurrentTsunamiDTO,
  CitizenReportDTO,
  NeedDTO,
  RecommendationDTO,
  ResourceDTO,
  SeismicEventDTO,
  StatusDTO,
  TrappedPersonMarkerDTO,
} from "@sismicaid/shared";

// URL del backend. Configurable con PUBLIC_API_URL (expuesta al cliente por Vite).
// `import.meta.env` solo existe bajo Vite; el `?? {}` evita romper fuera de él.
const API_URL = ((import.meta.env as Record<string, string> | undefined)?.PUBLIC_API_URL) ?? "http://localhost:3000";

// status 0 = fallo de red (sin respuesta); >0 = respuesta HTTP de error.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new ApiError(res.status, `API ${res.status} en ${path}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Sin conexión");
  }
  if (!res.ok) throw new ApiError(res.status, `API ${res.status} en ${path}`);
  return res.json() as Promise<T>;
}

export function getRecommendations(context?: string): Promise<RecommendationDTO[]> {
  const qs = context ? `?context=${encodeURIComponent(context)}` : "";
  return apiGet<RecommendationDTO[]>(`/api/recommendations${qs}`);
}

export function getStatus(): Promise<StatusDTO> {
  return apiGet<StatusDTO>("/api/status");
}

export function getSeismicEvents(query = ""): Promise<SeismicEventDTO[]> {
  return apiGet<SeismicEventDTO[]>(`/api/seismic-events${query}`);
}

export function getCurrentTsunami(): Promise<CurrentTsunamiDTO> {
  return apiGet<CurrentTsunamiDTO>("/api/tsunami-alerts/current");
}

export function getResources(query = ""): Promise<ResourceDTO[]> {
  return apiGet<ResourceDTO[]>(`/api/resources${query}`);
}

export function getNeeds(query = ""): Promise<NeedDTO[]> {
  return apiGet<NeedDTO[]>(`/api/needs${query}`);
}

export function getReports(query = ""): Promise<CitizenReportDTO[]> {
  return apiGet<CitizenReportDTO[]>(`/api/reports${query}`);
}

export function getTrappedPersons(): Promise<TrappedPersonMarkerDTO[]> {
  return apiGet<TrappedPersonMarkerDTO[]>("/api/trapped-persons");
}
