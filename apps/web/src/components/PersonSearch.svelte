<script lang="ts">
  import type {
    MissingPersonGroupDTO,
    MissingPersonResultDTO,
    MissingPersonStatus,
  } from "@sismicaid/shared";
  import { searchMissingPersons } from "../lib/api";
  import CommunityNotice from "./CommunityNotice.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import SourceBadge from "./SourceBadge.svelte";

  type State = "idle" | "short" | "loading" | "results" | "no-results" | "error";

  let query = "";
  let state: State = "idle";
  let groups: MissingPersonGroupDTO[] = [];
  let total = 0;
  let truncated = false;
  let lastQuery = "";

  const MIN_CHARS = 2;
  const DEBOUNCE_MS = 400; // nunca buscamos por tecla: respeta el caché del cron + rate-limit
  let debounceId: ReturnType<typeof setTimeout> | undefined;
  let requestSeq = 0;

  // Estado de la fuente -> etiqueta + color (siempre con texto, nunca solo color).
  const STATUS_META: Record<MissingPersonStatus, { label: string; variant: "neutral" | "success" | "warning" }> = {
    missing: { label: "Desaparecido", variant: "neutral" },
    found: { label: "Encontrado", variant: "success" },
    hospitalized: { label: "Hospitalizado", variant: "warning" },
  };

  function reset(): void {
    groups = [];
    total = 0;
    truncated = false;
  }

  function schedule(): void {
    if (debounceId) clearTimeout(debounceId);
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      state = trimmed.length === 0 ? "idle" : "short";
      reset();
      return;
    }
    debounceId = setTimeout(() => void runSearch(trimmed), DEBOUNCE_MS);
  }

  function onSubmit(e: Event): void {
    e.preventDefault();
    if (debounceId) clearTimeout(debounceId);
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      state = trimmed.length === 0 ? "idle" : "short";
      reset();
      return;
    }
    void runSearch(trimmed);
  }

  async function runSearch(q: string): Promise<void> {
    const seq = ++requestSeq;
    state = "loading";
    lastQuery = q;
    try {
      const res = await searchMissingPersons(q);
      if (seq !== requestSeq) return; // respuesta obsoleta: ignorar
      groups = res.groups;
      total = res.total;
      truncated = res.truncated;
      state = res.total === 0 ? "no-results" : "results";
    } catch {
      if (seq !== requestSeq) return;
      reset();
      state = "error";
    }
  }

  function statusMeta(s: MissingPersonStatus) {
    return STATUS_META[s];
  }

  function detailLines(r: MissingPersonResultDTO): Array<{ label: string; value: string }> {
    const out: Array<{ label: string; value: string }> = [];
    if (r.ageLabel) out.push({ label: "Edad", value: r.ageLabel });
    if (r.gender) out.push({ label: "Género", value: r.gender });
    if (r.lastSeenLocation) out.push({ label: "Visto por última vez", value: r.lastSeenLocation });
    if (r.hospitalName) out.push({ label: "Hospital", value: r.hospitalName });
    if (r.healthStatus) out.push({ label: "Estado de salud", value: r.healthStatus });
    if (r.foundBy) out.push({ label: "Reportado por", value: r.foundBy });
    return out;
  }
</script>

<form class="search" on:submit={onSubmit} role="search">
  <label for="person-q">Nombre de la persona</label>
  <div class="row">
    <input
      id="person-q"
      type="search"
      inputmode="text"
      autocomplete="off"
      placeholder="Ej. Ramón Torres"
      bind:value={query}
      on:input={schedule}
    />
    <button type="submit">Buscar</button>
  </div>
</form>

<p class="count" aria-live="polite">
  {#if state === "results"}
    {total} {total === 1 ? "resultado" : "resultados"} para «{lastQuery}»{truncated ? " (mostrando los primeros 100)" : ""}
  {/if}
</p>

{#if state === "idle"}
  <CommunityNotice
    text="Estos registros provienen de sitios comunitarios públicos. No están verificados ni son oficiales. Confírmalos en la fuente."
  />
  <p class="muted">
    Escribe el nombre de la persona que buscas. Mostramos coincidencias de registros comunitarios públicos, con enlace a la
    fuente original.
  </p>
{:else if state === "short"}
  <p class="muted">Escribe al menos 2 letras para buscar.</p>
{:else if state === "loading"}
  <p class="muted">Buscando...</p>
{:else if state === "error"}
  <p class="muted">No se pudo buscar. Intenta de nuevo.</p>
{:else if state === "no-results"}
  <p class="muted">Sin coincidencias. Verifica la ortografía o revisa las fuentes oficiales.</p>
{:else if state === "results"}
  <CommunityNotice
    text="Estos registros provienen de sitios comunitarios públicos. No están verificados ni son oficiales. Confírmalos en la fuente."
  />
  <div class="groups">
    {#each groups as g (g.normalizedName)}
      <section class="group">
        <header class="group-head">
          <h2>{g.displayName}</h2>
          {#if g.possibleSamePerson}
            <StatusBadge label="Posible misma persona" variant="info" />
          {/if}
        </header>
        <div class="cards">
          {#each g.results as r (r.id)}
            <article class="card">
              <div class="meta">
                <StatusBadge label={statusMeta(r.status).label} variant={statusMeta(r.status).variant} />
                <StatusBadge label="No verificado" variant="pending" />
              </div>
              <h3>{r.fullName}</h3>
              {#if detailLines(r).length > 0}
                <dl>
                  {#each detailLines(r) as line}
                    <div><dt>{line.label}</dt><dd>{line.value}</dd></div>
                  {/each}
                </dl>
              {/if}
              {#if r.description}<p class="desc">{r.description}</p>{/if}
              <div class="src">
                <SourceBadge source={r.source} />
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">Ver en {r.source}</a>
              </div>
              <p class="disclaimer">No verificado — registro comunitario.</p>
            </article>
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/if}

<style>
  .search {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .search label {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
  .row {
    display: flex;
    gap: var(--space-2);
  }
  input {
    flex: 1;
    min-height: 44px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: var(--radius-md);
    padding: 0 var(--space-3);
    font-size: var(--font-md);
  }
  input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 var(--space-4);
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-md);
    font-weight: 600;
    cursor: pointer;
  }
  .count {
    min-height: 1.25rem;
    margin: 0 0 var(--space-3);
    font-size: var(--font-sm);
    color: var(--color-text-soft);
  }
  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .group-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }
  .group-head h2 {
    font-size: var(--font-lg);
    margin: 0;
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .card h3 {
    margin: var(--space-2) 0;
    font-size: var(--font-md);
  }
  dl {
    display: grid;
    gap: var(--space-2);
    margin: var(--space-2) 0 0;
  }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }
  dt {
    color: var(--color-text-soft);
    flex-shrink: 0;
  }
  dd {
    margin: 0;
    text-align: right;
    color: var(--color-text);
  }
  .desc {
    margin: var(--space-3) 0 0;
    color: var(--color-text-muted);
    font-size: var(--font-sm);
  }
  .src {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-3);
  }
  .src a {
    color: var(--color-primary);
    text-decoration: none;
    font-size: var(--font-sm);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .disclaimer {
    margin: var(--space-2) 0 0;
    font-size: var(--font-xs);
    color: var(--color-text-soft);
  }
  .muted {
    color: var(--color-text-soft);
  }
  @media (min-width: 768px) {
    .cards {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
