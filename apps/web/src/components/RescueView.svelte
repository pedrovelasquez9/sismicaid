<!-- apps/web/src/components/RescueView.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { TrappedPersonMarkerDTO } from "@sismicaid/shared";
  import { getTrappedPersons } from "../lib/api";
  import { fetchWithCache } from "../lib/cache";
  import { URGENCY_HEX, URGENCY_LABEL } from "../lib/urgency";
  import RescueMap from "./RescueMap.svelte";

  let state: "loading" | "ready" = "loading";
  let fromCache = false;
  let all: TrappedPersonMarkerDTO[] = [];

  // Filtros de presentación.
  let onlyVerified = false;
  let showResolved = false;

  $: visible = all.filter(
    (m) =>
      (showResolved || !m.resolved) &&
      (!onlyVerified || m.verificationStatus === "verified"),
  );

  function estado(m: TrappedPersonMarkerDTO): string {
    if (m.resolved) return "Rescatado";
    const base = m.verificationStatus === "verified" ? "Verificado" : "Sin verificar";
    return m.lat == null ? `${base} · Sin ubicación en mapa` : base;
  }

  onMount(async () => {
    const res = await fetchWithCache("trapped-persons", getTrappedPersons).catch(() => null);
    if (res) {
      all = res.data;
      fromCache = res.fromCache;
    }
    state = "ready";
  });
</script>

<p class="notice">
  Reportes ciudadanos, muchos sin verificar. La ubicación es la indicada en el reporte, para que rescate pueda acudir. No incluye nombres.
</p>

{#if fromCache}
  <p class="offline">Sin conexión. Mostrando últimos datos guardados, posiblemente desactualizados.</p>
{/if}

<div class="filters">
  <label><input type="checkbox" bind:checked={onlyVerified} /> Solo verificados</label>
  <label><input type="checkbox" bind:checked={showResolved} /> Mostrar rescatados</label>
</div>

{#if state === "loading"}
  <p class="muted">Cargando últimos datos...</p>
{:else}
  <RescueMap markers={visible} />

  {#if visible.length === 0}
    <p class="muted">No hay reportes de personas atrapadas según la última actualización.</p>
  {:else}
    <ul class="list">
      {#each visible as m (m.id)}
        <li>
          <span class="badge" style={`background:${URGENCY_HEX[m.urgency]}`}>
            {URGENCY_LABEL[m.urgency]}
          </span>
          <div>
            <strong>{m.municipality ?? "Ubicación aproximada"}</strong>
            <span class="est">{estado(m)}</span>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .notice {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    color: var(--color-text-muted);
    font-size: var(--font-sm);
    margin: 0 0 var(--space-4);
  }
  .offline {
    color: var(--color-warning);
    font-size: var(--font-sm);
    margin: 0 0 var(--space-3);
  }
  .filters {
    display: flex;
    gap: var(--space-4);
    margin: 0 0 var(--space-4);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
  .muted {
    color: var(--color-text-soft);
    margin-top: var(--space-4);
  }
  .list {
    list-style: none;
    padding: 0;
    margin: var(--space-4) 0 0;
    display: grid;
    gap: var(--space-2);
  }
  .list li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }
  .badge {
    color: #fff;
    border-radius: var(--radius-full);
    padding: 0.125rem 0.625rem;
    font-size: var(--font-xs);
    white-space: nowrap;
  }
  .est {
    color: var(--color-text-soft);
    font-size: var(--font-sm);
    margin-left: var(--space-2);
  }
</style>
