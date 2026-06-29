<script lang="ts">
  import { EMERGENCY_NUMBERS } from "../lib/emergency";
  import { VENEZUELA_STATES } from "../lib/venezuela";
  import { getCurrentLocation } from "../lib/geolocation";

  // "Estoy a salvo": arma un mensaje en el dispositivo y lo comparte por
  // WhatsApp / copiado. NO se guarda nada en ningún servidor (privacidad:
  // no creamos un registro de personas, ver SPEC §3.3).
  let name = "";
  let state = "";
  let municipality = "";
  let copied = false;
  // Ubicación actual (opt-in): el usuario comparte SU propia ubicación con su
  // familia. No se guarda en ningún servidor.
  let coords: { lat: number; lng: number } | null = null;
  let geoState: "idle" | "loading" | "ok" | "denied" = "idle";

  $: place = [state, municipality.trim()].filter(Boolean).join(", ");
  $: message = buildMessage(name.trim(), place, coords);

  function buildMessage(n: string, p: string, c: { lat: number; lng: number } | null): string {
    const time = new Date().toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
    const who = n ? `${n}: estoy` : "Estoy";
    const where = p ? ` Ubicación aproximada: ${p}.` : "";
    const link = c ? ` Mi ubicación: https://maps.google.com/?q=${c.lat},${c.lng}.` : "";
    return `✅ ${who} a salvo.${where}${link} ${time}. — enviado con Sismicaid`;
  }

  async function useMyLocation() {
    geoState = "loading";
    coords = await getCurrentLocation();
    geoState = coords ? "ok" : "denied";
  }

  $: waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
    }
  }
</script>

<section class="block">
  <h2>Llamadas de emergencia</h2>
  <p class="hint">Funciona sin conexión. Toca para llamar.</p>
  <ul class="calls">
    {#each EMERGENCY_NUMBERS as n}
      <li>
        <a class="call" href={`tel:${n.phone}`}>
          <span class="num">{n.phone}</span>
          <span class="meta">
            <span class="label">{n.label}</span>
            {#if n.note}<span class="note">{n.note}</span>{/if}
          </span>
        </a>
      </li>
    {/each}
  </ul>
</section>

<section class="block">
  <h2>Avisar que estoy a salvo</h2>
  <p class="hint">
    Arma un mensaje en tu teléfono para enviar a tu familia. No se guarda nada: la
    app no registra personas.
  </p>

  <label class="field">
    <span>Tu nombre (opcional)</span>
    <input type="text" bind:value={name} placeholder="Ej: María" maxlength="60" />
  </label>

  <div class="row">
    <label class="field">
      <span>Estado (opcional)</span>
      <select bind:value={state}>
        <option value="">—</option>
        {#each VENEZUELA_STATES as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>Municipio / sector (opcional)</span>
      <input type="text" bind:value={municipality} placeholder="Ej: Maiquetía" maxlength="60" />
    </label>
  </div>

  <button type="button" class="button-secondary geo" on:click={useMyLocation} disabled={geoState === "loading"}>
    {geoState === "loading" ? "Obteniendo ubicación..." : geoState === "ok" ? "Ubicación añadida ✓" : "Usar mi ubicación actual"}
  </button>
  {#if geoState === "denied"}
    <p class="hint">No se pudo obtener la ubicación. Puedes indicar el estado y municipio arriba.</p>
  {/if}

  <p class="preview" aria-live="polite">{message}</p>

  <div class="actions">
    <a class="button-primary" href={waLink} target="_blank" rel="noopener">Enviar por WhatsApp</a>
    <button class="button-secondary" type="button" on:click={copy}>
      {copied ? "¡Copiado!" : "Copiar mensaje"}
    </button>
  </div>
</section>

<style>
  .block {
    margin-bottom: var(--space-8);
  }
  h2 {
    font-size: var(--font-xl);
    margin: 0 0 var(--space-1);
  }
  .hint {
    color: var(--color-text-muted);
    font-size: var(--font-sm);
    margin: 0 0 var(--space-4);
  }
  .calls {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-3);
  }
  .call {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    min-height: 64px;
    background: var(--color-danger);
    color: #fff;
    border-radius: var(--radius-lg);
    text-decoration: none;
  }
  .call .num {
    font-size: var(--font-2xl);
    font-weight: 800;
    line-height: 1;
  }
  .call .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .call .label {
    font-size: var(--font-md);
    font-weight: 600;
  }
  .call .note {
    font-size: var(--font-sm);
    opacity: 0.9;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }
  .field span {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
  input,
  select {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: var(--radius-md);
    padding: 0.875rem 1rem;
    font-size: var(--font-md);
  }
  .row {
    display: grid;
    gap: var(--space-3);
  }
  .preview {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    color: var(--color-text);
    font-size: var(--font-sm);
    margin: var(--space-2) 0 var(--space-4);
  }
  .actions {
    display: grid;
    gap: var(--space-3);
  }
  .button-primary,
  .button-secondary {
    text-align: center;
    padding: var(--space-4);
    min-height: 44px;
    border-radius: var(--radius-md);
    font-size: var(--font-md);
    text-decoration: none;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .button-primary {
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-weight: 600;
  }
  .button-secondary {
    background: var(--color-surface-raised);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .geo {
    width: 100%;
    margin-bottom: var(--space-3);
  }
  .geo:disabled {
    opacity: 0.6;
  }
  @media (min-width: 768px) {
    .row {
      grid-template-columns: 1fr 1fr;
    }
    .actions {
      grid-template-columns: auto auto;
      justify-content: start;
    }
  }
</style>
