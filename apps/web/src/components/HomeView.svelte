<script lang="ts">
  import { onMount } from "svelte";
  import type { CurrentTsunamiDTO, SeismicEventDTO, StatusDTO } from "@sismicaid/shared";
  import { getCurrentTsunami, getSeismicEvents, getStatus } from "../lib/api";
  import { fetchWithCache } from "../lib/cache";
  import { link } from "../lib/links";
  import StatusBanner from "./StatusBanner.svelte";
  import EventCard from "./EventCard.svelte";
  import LastUpdated from "./LastUpdated.svelte";

  let state: "loading" | "ready" | "error" = "loading";
  let offline = false;

  let status: StatusDTO | null = null;
  let events: SeismicEventDTO[] = [];
  let tsunami: CurrentTsunamiDTO | null = null;
  let lastUpdatedIso: string | null = null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;

  $: latest = events[0] ?? null;
  $: events24h = events.filter((e) => Date.now() - new Date(e.eventTimeUtc).getTime() <= DAY_MS);
  $: maxMag24h = events24h.reduce<number | null>((max, e) => (e.magnitude != null && (max == null || e.magnitude > max) ? e.magnitude : max), null);

  // Estado general (banner). El tsunami SOLO sale de boletines, no del flag.
  $: banner = computeBanner(status, latest, tsunami, offline);

  function computeBanner(
    s: StatusDTO | null,
    ev: SeismicEventDTO | null,
    t: CurrentTsunamiDTO | null,
    isOffline: boolean,
  ): { variant: "success" | "info" | "warning" | "danger" | "neutral"; title: string; detail: string | null } {
    const active = t?.alert && ["warning", "advisory", "watch"].includes(t.alert.status);
    if (active && t?.alert) {
      const isWarning = t.alert.status === "warning";
      return {
        variant: isWarning ? "danger" : "warning",
        title: isWarning ? "Alerta de tsunami" : "Vigilancia de tsunami",
        detail: t.alert.affectedAreaText ?? t.alert.headline,
      };
    }
    if (t?.alert && t.alert.status === "canceled") {
      return { variant: "neutral", title: "Alerta de tsunami cancelada", detail: "Mantente atento a fuentes oficiales." };
    }
    if (isOffline) {
      return { variant: "warning", title: "Sin conexión", detail: "Mostrando últimos datos guardados." };
    }
    if (ev && Date.now() - new Date(ev.eventTimeUtc).getTime() <= HOUR_MS) {
      return { variant: "info", title: "Evento sísmico reciente", detail: ev.place || null };
    }
    return { variant: "success", title: "Sin alerta activa", detail: "Según la última fuente consultada." };
  }

  // Auto-refresco de eventos cada 5 min (y al recuperar conexión).
  const REFRESH_MS = 5 * 60 * 1000;

  async function load(silent = false) {
    if (!silent) state = "loading";
    try {
      const [s, e, t] = await Promise.all([
        fetchWithCache("status", getStatus),
        fetchWithCache("events", () => getSeismicEvents()),
        fetchWithCache("tsunami", getCurrentTsunami),
      ]);
      status = s.data;
      events = e.data;
      tsunami = t.data;
      offline = s.fromCache || e.fromCache || t.fromCache;
      lastUpdatedIso = status.seismic.lastUpdatedAt ?? (s.savedAt ? new Date(s.savedAt).toISOString() : null);
      state = "ready";
    } catch {
      // En refresco silencioso conservamos los datos actuales en pantalla.
      if (!silent) state = "error";
    }
  }

  onMount(() => {
    load();
    const id = setInterval(() => load(true), REFRESH_MS);
    const onOnline = () => load(true);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", onOnline);
    };
  });
</script>

{#if state === "loading"}
  <p class="muted">Cargando últimos datos...</p>
{:else if state === "error"}
  <p class="muted">No se pudo actualizar la información y no hay datos guardados. Verifica fuentes oficiales.</p>
{:else}
  <StatusBanner variant={banner.variant} title={banner.title} detail={banner.detail} />

  <a class="emergency-cta" href={link("/emergencia")}>
    <span class="ico" aria-hidden="true">✆</span>
    <span class="txt">
      <strong>Emergencia</strong>
      <span>Llamar a emergencias y avisar que estás a salvo</span>
    </span>
  </a>

  <section class="summary">
    <div class="head">
      <h2>Resumen sísmico</h2>
      <LastUpdated iso={lastUpdatedIso} fromCache={offline} />
    </div>
    <div class="stats">
      <div class="stat"><span class="n">{status?.seismic.recentCount ?? 0}</span><span class="l">eventos 24 h</span></div>
      <div class="stat"><span class="n">{maxMag24h != null ? `M ${maxMag24h.toFixed(1)}` : "—"}</span><span class="l">mayor magnitud 24 h</span></div>
    </div>
    {#if latest}
      <h3>Evento más reciente</h3>
      <EventCard event={latest} />
    {:else}
      <p class="muted">No hay eventos sísmicos recientes cargados para Venezuela. Verifica fuentes oficiales.</p>
    {/if}
  </section>

  <nav class="quick" aria-label="Accesos rápidos">
    <a href={link("/sismos")}>Mapa sísmico</a>
    <a href={link("/ayuda")}>Ayuda cercana</a>
    <a href={link("/rescate")}>Personas atrapadas</a>
    <a href={link("/desaparecidos")}>Desaparecidos</a>
    <a href={link("/reportar")}>Reportar</a>
    <a href={link("/recomendaciones")}>Recomendaciones</a>
  </nav>
{/if}

<style>
  .emergency-cta {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-5);
    padding: var(--space-4) var(--space-5);
    min-height: 64px;
    background: var(--color-danger);
    color: #fff;
    border-radius: var(--radius-lg);
    text-decoration: none;
    box-shadow: var(--shadow-raised);
  }
  .emergency-cta .ico {
    font-size: var(--font-2xl);
    line-height: 1;
  }
  .emergency-cta .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .emergency-cta strong {
    font-size: var(--font-lg);
  }
  .emergency-cta .txt span {
    font-size: var(--font-sm);
    opacity: 0.95;
  }
  .summary {
    margin-top: var(--space-5);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  h2 {
    font-size: var(--font-xl);
    margin: 0 0 var(--space-1);
  }
  h3 {
    font-size: var(--font-md);
    color: var(--color-text-muted);
    margin: var(--space-4) 0 var(--space-2);
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin: var(--space-3) 0;
  }
  .stat {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat .n {
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-text);
  }
  .stat .l {
    font-size: var(--font-sm);
    color: var(--color-text-soft);
  }
  .quick {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-top: var(--space-6);
  }
  .quick a {
    text-align: center;
    padding: var(--space-4);
    min-height: 44px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    text-decoration: none;
    font-size: var(--font-md);
  }
  .muted {
    color: var(--color-text-soft);
  }
</style>
