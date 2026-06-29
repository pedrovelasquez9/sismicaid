// Pide la ubicación actual del navegador (opt-in, iniciado por el usuario).
// Resuelve con coordenadas o null si la niegan, no está disponible o expira.
// No guarda nada: quien llama decide qué hacer con las coordenadas.
export function getCurrentLocation(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
