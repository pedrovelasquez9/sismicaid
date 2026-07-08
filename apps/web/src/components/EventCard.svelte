<script lang="ts">
  import type { SeismicEventDTO } from "@sismicaid/shared";
  import { magnitudeSeverity, SEVERITY_COLOR } from "../lib/severity";
  import StatusBadge from "./StatusBadge.svelte";
  import SourceBadge from "./SourceBadge.svelte";

  export let event: SeismicEventDTO;

  $: color = SEVERITY_COLOR[magnitudeSeverity(event.magnitude)];
  $: mag = event.magnitude != null ? event.magnitude.toFixed(1) : "—";
  // Hora local VET viene como "YYYY-MM-DDTHH:mm:ss" (sin Z). Mostramos fecha y hora.
  $: localTime = event.eventTimeLocal ? event.eventTimeLocal.slice(11, 16) : null;
  // "YYYY-MM-DD" -> "DD/MM/YYYY" para el historial.
  $: localDate = event.eventTimeLocal
    ? event.eventTimeLocal.slice(0, 10).split("-").reverse().join("/")
    : null;
</script>

<article class="card">
  <div class="mag" style={`--c:${color}`}>
    <span class="m">M</span>{mag}
  </div>
  <div class="body">
    <p class="place">{event.place || "Ubicación no especificada"}</p>
    <p class="meta">
      {#if localDate}{localDate}, {/if}{#if localTime}{localTime} VET · {/if}Prof. {event.depthKm != null ? `${event.depthKm} km` : "—"}
      {#if event.mmi != null}· Intensidad estimada {event.mmi}{/if}
    </p>
    <div class="badges">
      <StatusBadge
        label={event.status === "reviewed" ? "Revisado" : "Automático"}
        variant={event.status === "reviewed" ? "verified" : "neutral"}
      />
      {#if event.tsunamiFlag}
        <!-- Bandera del evento, NO una alerta de tsunami activa. -->
        <StatusBadge label="Bandera de tsunami (no es alerta)" variant="warning" />
      {/if}
      <SourceBadge source={event.source} />
    </div>
  </div>
</article>

<style>
  .card {
    display: flex;
    gap: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }
  .mag {
    display: flex;
    align-items: baseline;
    font-size: var(--font-2xl);
    font-weight: 700;
    color: var(--c);
    min-width: 3.5rem;
  }
  .mag .m {
    font-size: var(--font-md);
    margin-right: 2px;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .place {
    margin: 0 0 var(--space-1);
    font-size: var(--font-lg);
    color: var(--color-text);
  }
  .meta {
    margin: 0 0 var(--space-3);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
</style>
