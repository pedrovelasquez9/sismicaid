<script lang="ts">
  import { onMount } from "svelte";
  import type { CitizenReportDTO } from "@sismicaid/shared";
  import { getReports } from "../lib/api";
  import { fetchWithCache } from "../lib/cache";
  import { link } from "../lib/links";
  import { VENEZUELA_STATES } from "../lib/venezuela";
  import { helpReportsQuery } from "../lib/reportGroups";
  import ReportCard from "./ReportCard.svelte";
  import CommunityNotice from "./CommunityNotice.svelte";

  let state: "loading" | "ready" | "error" = "loading";
  let offline = false;
  let reports: CitizenReportDTO[] = [];
  let stateFilter = "";

  $: filtered = stateFilter ? reports.filter((r) => r.state === stateFilter) : reports;

  onMount(async () => {
    try {
      const res = await fetchWithCache("ayuda-reports", () => getReports(helpReportsQuery));
      reports = res.data;
      offline = res.fromCache;
      state = "ready";
    } catch {
      state = "error";
    }
  });
</script>

<a class="people-cta" href={link("/buscar-personas")}>
  <span class="ico" aria-hidden="true">⌕</span>
  <span class="txt">
    <strong>¿Buscas a un familiar?</strong>
    <span>Busca por nombre en registros de personas desaparecidas</span>
  </span>
</a>

{#if offline}
  <p class="offline">Sin conexión. Mostrando últimos datos guardados.</p>
{/if}

{#if state === "loading"}
  <p class="muted">Cargando ayuda compartida...</p>
{:else if state === "error"}
  <p class="muted">No se pudo cargar la ayuda. Verifica tu conexión.</p>
{:else}
  <CommunityNotice text="La ayuda listada la comparten otros usuarios. No está verificada ni es oficial; confírmala antes de acudir." />
  <label class="filter">
    Estado
    <select bind:value={stateFilter}>
      <option value="">Todos</option>
      {#each VENEZUELA_STATES as s}<option value={s}>{s}</option>{/each}
    </select>
  </label>

  {#if filtered.length === 0}
    <p class="muted">No hay ayuda compartida para esta zona por ahora. Usa "Reportar" para compartir refugios, acopios o servicios activos.</p>
  {:else}
    <div class="grid">
      {#each filtered as r (r.id)}<ReportCard report={r} />{/each}
    </div>
  {/if}
{/if}

<style>
  .filter {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    max-width: 260px;
  }
  select {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: var(--radius-md);
    padding: 0.75rem;
    min-height: 44px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  .offline {
    background: var(--color-surface);
    border-left: 4px solid var(--color-warning);
    color: var(--color-warning);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-sm);
    margin-bottom: var(--space-3);
  }
  .people-cta {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    min-height: 56px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-lg);
    color: var(--color-text);
    text-decoration: none;
    box-shadow: var(--shadow-soft);
  }
  .people-cta .ico {
    font-size: var(--font-xl);
    line-height: 1;
    color: var(--color-primary);
  }
  .people-cta .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .people-cta strong {
    color: var(--color-primary);
  }
  .people-cta .txt span {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
  .muted {
    color: var(--color-text-soft);
  }
  @media (min-width: 768px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
