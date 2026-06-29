<script lang="ts">
  import { onMount } from "svelte";
  import type { CreateReportInput, ReportSourceType, ReportType, Urgency } from "@sismicaid/shared";
  import { ApiError } from "../lib/api";
  import { initOutboxAutoFlush, pendingCount, submitReport, flushOutbox } from "../lib/outbox";
  import { VENEZUELA_STATES } from "../lib/venezuela";
  import { REPORT_CATEGORIES } from "../lib/reportGroups";
  import { REPORT_TYPE_LABEL } from "../lib/labels";
  import { getCurrentLocation } from "../lib/geolocation";

  const URGENCIES: Array<{ value: Urgency; label: string }> = [
    { value: "low", label: "Baja" },
    { value: "medium", label: "Media" },
    { value: "high", label: "Alta" },
    { value: "critical", label: "Crítica" },
  ];
  const SOURCES: Array<{ value: ReportSourceType; label: string }> = [
    { value: "first_hand", label: "Lo vi personalmente" },
    { value: "reported_by_other", label: "Me lo reportaron" },
    { value: "media", label: "Medio de comunicación" },
    { value: "authority", label: "Autoridad" },
    { value: "volunteer", label: "Voluntario" },
  ];

  let step = 1;
  const TOTAL = 4;

  // Estado del formulario.
  let reportType: ReportType | "" = "";
  let state = "";
  let municipality = "";
  let parish = "";
  let title = "";
  let description = "";
  let urgency: Urgency | "" = "";
  let reportSourceType: ReportSourceType | "" = "";
  let evidenceUrl = "";
  let privateContact = "";

  // Ubicación (opt-in). Sin coords, un reporte de persona atrapada no puede
  // pintarse en el mapa de rescate.
  let lat: number | null = null;
  let lng: number | null = null;
  let geoState: "idle" | "loading" | "ok" | "denied" = "idle";
  // Precisión a discreción del usuario. Por defecto aproximada (el servidor
  // difumina a ~110 m); si la activa, se publica la ubicación exacta.
  let exactLocation = false;

  async function useMyLocation() {
    geoState = "loading";
    const c = await getCurrentLocation();
    if (c) {
      lat = c.lat;
      lng = c.lng;
      geoState = "ok";
    } else {
      lat = lng = null;
      geoState = "denied";
    }
  }

  // Marca si el usuario ya intentó avanzar desde cada paso (para mostrar errores).
  let attempted: Record<number, boolean> = {};

  let submitting = false;
  let result: "sent" | "queued" | null = null;
  let errorMsg: string | null = null;
  let queued = 0;

  onMount(() => {
    initOutboxAutoFlush();
    queued = pendingCount();
  });

  $: titleOk = title.trim().length >= 3;
  $: step1Ok = reportType !== "";
  $: step2Ok = state !== "";
  $: step3Ok = titleOk && urgency !== "" && reportSourceType !== "";
  $: stepOk = step === 1 ? step1Ok : step === 2 ? step2Ok : step === 3 ? step3Ok : true;

  function next() {
    attempted = { ...attempted, [step]: true };
    if (!stepOk) return; // muestra los errores en pantalla
    if (step < TOTAL) step += 1;
  }
  function back() {
    if (step > 1) step -= 1;
  }

  function buildInput(): CreateReportInput {
    return {
      reportType: reportType as ReportType,
      title: title.trim(),
      description: description.trim() || undefined,
      state,
      municipality: municipality.trim() || undefined,
      parish: parish.trim() || undefined,
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
      // El usuario elige: exacta (se publica tal cual) o aproximada (el servidor
      // difumina a ~110 m antes de guardar). Sin coords, da igual: aproximada.
      locationPrecision: lat != null && exactLocation ? "exact" : "approximate",
      urgency: urgency as Urgency,
      evidenceUrl: evidenceUrl.trim() || undefined,
      reportSourceType: reportSourceType as ReportSourceType,
      privateContact: privateContact.trim() || undefined,
    };
  }

  async function submit() {
    submitting = true;
    errorMsg = null;
    try {
      result = await submitReport(buildInput());
      queued = pendingCount();
    } catch (e) {
      errorMsg =
        e instanceof ApiError && e.status === 429
          ? "Demasiados envíos. Espera un minuto e inténtalo de nuevo."
          : "El reporte tiene datos inválidos. Revisa los campos marcados.";
    } finally {
      submitting = false;
    }
  }

  async function retryQueued() {
    await flushOutbox();
    queued = pendingCount();
  }

  function resetForm() {
    step = 1;
    reportType = "";
    state = municipality = parish = title = description = evidenceUrl = privateContact = "";
    urgency = "";
    reportSourceType = "";
    lat = lng = null;
    geoState = "idle";
    exactLocation = false;
    attempted = {};
    result = null;
    errorMsg = null;
  }
</script>

{#if result}
  <div class="done">
    {#if result === "sent"}
      <h2>Reporte enviado</h2>
      <p>Se publicará como <strong>reporte ciudadano sin verificar</strong>. Gracias por reportar con responsabilidad.</p>
    {:else}
      <h2>Guardado sin conexión</h2>
      <p>Tu reporte se guardó en este dispositivo y se enviará automáticamente cuando vuelva la conexión.</p>
    {/if}
    <button type="button" class="primary" on:click={resetForm}>Reportar otra cosa</button>
  </div>
{:else}
  <div class="progress" aria-label={`Paso ${step} de ${TOTAL}`}>
    {#each Array(TOTAL) as _, i}
      <span class="dot" class:on={i + 1 <= step}></span>
    {/each}
  </div>

  {#if queued > 0}
    <p class="queued">
      Tienes {queued} reporte(s) pendientes de envío.
      <button type="button" class="link" on:click={retryQueued}>Reintentar ahora</button>
    </p>
  {/if}

  {#if step === 1}
    <fieldset>
      <legend>¿Qué quieres reportar?</legend>
      {#each REPORT_CATEGORIES as cat}
        <div class="category">
          <p class="cat-head">{cat.label} <span class="cat-hint">· {cat.hint}</span></p>
          <div class="grid">
            {#each cat.types as t}
              <button type="button" class="opt" class:sel={reportType === t} on:click={() => (reportType = t)}>
                {REPORT_TYPE_LABEL[t]}
              </button>
            {/each}
          </div>
        </div>
      {/each}
      {#if attempted[1] && !step1Ok}<p class="error">Selecciona un tipo de reporte para continuar.</p>{/if}
    </fieldset>
  {:else if step === 2}
    <fieldset>
      <legend>¿Dónde?</legend>
      <label>
        <span class="lbl">Estado <span class="req">obligatorio</span></span>
        <select bind:value={state} class:invalid={attempted[2] && !state}>
          <option value="" disabled>Selecciona un estado</option>
          {#each VENEZUELA_STATES as s}<option value={s}>{s}</option>{/each}
        </select>
      </label>
      {#if attempted[2] && !state}<p class="error">Selecciona un estado.</p>{/if}
      <label><span class="lbl">Municipio <span class="opt-tag">opcional</span></span><input type="text" bind:value={municipality} maxlength="80" /></label>
      <label><span class="lbl">Parroquia <span class="opt-tag">opcional</span></span><input type="text" bind:value={parish} maxlength="80" /></label>

      <div class="field">
        <span class="lbl">Ubicación en el mapa <span class="opt-tag">opcional</span></span>
        <button type="button" class="geo" on:click={useMyLocation} disabled={geoState === "loading"}>
          {geoState === "loading" ? "Obteniendo ubicación..." : geoState === "ok" ? "Ubicación añadida ✓" : "Usar mi ubicación actual"}
        </button>
        {#if geoState === "ok"}
          <label class="exact-toggle">
            <input type="checkbox" bind:checked={exactLocation} />
            <span>Mostrar mi ubicación exacta en el mapa</span>
          </label>
          {#if exactLocation}
            <p class="note">
              <strong>Exacta:</strong> se publica el punto preciso. Úsala en emergencias
              de vida (persona atrapada) para que rescate llegue al sitio. Tu ubicación
              exacta será visible públicamente, incluso antes de verificarse.
            </p>
          {:else}
            <p class="note">
              <strong>Aproximada (recomendada):</strong> el servidor difumina tu
              ubicación a ~110 m antes de publicarla. Protege tu privacidad; el mapa
              muestra la zona, no tu punto exacto.
            </p>
          {/if}
        {:else if geoState === "denied"}
          <p class="note">No se pudo obtener la ubicación. El reporte se enviará igual, pero no aparecerá en el mapa.</p>
        {/if}
      </div>

      <p class="note">No incluyas direcciones privadas exactas en el texto del reporte.</p>
    </fieldset>
  {:else if step === 3}
    <fieldset>
      <legend>Detalles</legend>
      <label>
        <span class="lbl">Resumen corto <span class="req">obligatorio</span></span>
        <input type="text" bind:value={title} maxlength="140" placeholder="Ej: Grietas en fachada" class:invalid={attempted[3] && !titleOk} />
      </label>
      {#if attempted[3] && !titleOk}<p class="error">Escribe un resumen de al menos 3 caracteres.</p>{/if}

      <label><span class="lbl">Detalle <span class="opt-tag">opcional</span></span><textarea bind:value={description} maxlength="2000" rows="3"></textarea></label>

      <div class="field">
        <span class="lbl">Urgencia <span class="req">obligatorio</span></span>
        <div class="row">
          {#each URGENCIES as u}
            <button type="button" class="opt sm" class:sel={urgency === u.value} on:click={() => (urgency = u.value)}>{u.label}</button>
          {/each}
        </div>
      </div>
      {#if attempted[3] && urgency === ""}<p class="error">Selecciona la urgencia.</p>{/if}

      <label>
        <span class="lbl">Fuente <span class="req">obligatorio</span></span>
        <select bind:value={reportSourceType} class:invalid={attempted[3] && reportSourceType === ""}>
          <option value="" disabled>¿Cómo lo sabes?</option>
          {#each SOURCES as s}<option value={s.value}>{s.label}</option>{/each}
        </select>
      </label>
      {#if attempted[3] && reportSourceType === ""}<p class="error">Indica cómo conoces esta información.</p>{/if}

      <label><span class="lbl">Evidencia (enlace) <span class="opt-tag">opcional</span></span><input type="url" bind:value={evidenceUrl} placeholder="https://..." /></label>
      <label><span class="lbl">Contacto privado <span class="opt-tag">opcional</span></span><input type="text" bind:value={privateContact} maxlength="200" /></label>
      <p class="note">El contacto privado <strong>no se publica</strong>; solo sirve para seguimiento si hace falta.</p>
    </fieldset>
  {:else}
    <fieldset>
      <legend>Revisa y envía</legend>
      <dl class="review">
        <div><dt>Tipo</dt><dd>{reportType ? REPORT_TYPE_LABEL[reportType] : "—"}</dd></div>
        <div><dt>Estado</dt><dd>{state || "—"}</dd></div>
        <div><dt>Resumen</dt><dd>{title || "—"}</dd></div>
        <div><dt>Urgencia</dt><dd>{URGENCIES.find((u) => u.value === urgency)?.label ?? "—"}</dd></div>
      </dl>
      <p class="note">Se publicará de inmediato como ciudadano/no verificado. No publiques datos personales de terceros.</p>
      <p class="disclaimer">
        Los datos que registras son tu responsabilidad y se publican tal cual,
        incluida la ubicación. Reporta <strong>solo emergencias reales</strong>:
        un reporte falso desvía a los rescatistas de quien sí lo necesita.
      </p>
      {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
    </fieldset>
  {/if}

  <div class="nav">
    {#if step > 1}<button type="button" class="secondary" on:click={back} disabled={submitting}>Atrás</button>{/if}
    {#if step < TOTAL}
      <button type="button" class="primary" on:click={next}>Siguiente</button>
    {:else}
      <button type="button" class="primary" on:click={submit} disabled={submitting}>
        {submitting ? "Enviando..." : "Enviar reporte"}
      </button>
    {/if}
  </div>
{/if}

<style>
  .progress {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .dot {
    flex: 1;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--color-border);
  }
  .dot.on {
    background: var(--color-primary);
  }
  fieldset {
    border: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  legend {
    font-size: var(--font-xl);
    color: var(--color-text);
    margin-bottom: var(--space-2);
    padding: 0;
  }
  .category {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .cat-head {
    margin: 0;
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text);
  }
  .cat-hint {
    font-weight: 400;
    color: var(--color-text-soft);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .opt {
    min-height: 48px;
    padding: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    cursor: pointer;
  }
  .opt.sm {
    min-height: 44px;
    flex: 1;
  }
  .opt.sel {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .row {
    display: flex;
    gap: var(--space-2);
  }
  label,
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
  .lbl {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .req {
    font-size: var(--font-xs);
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-full);
    padding: 0 var(--space-2);
    text-transform: lowercase;
  }
  .opt-tag {
    font-size: var(--font-xs);
    color: var(--color-text-soft);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 0 var(--space-2);
  }
  input,
  select,
  textarea {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: var(--radius-md);
    padding: 0.75rem 0.875rem;
    font: inherit;
    min-height: 44px;
  }
  .invalid {
    border-color: var(--color-danger);
  }
  .geo {
    min-height: 44px;
    padding: var(--space-3);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: var(--radius-md);
    font: inherit;
    cursor: pointer;
  }
  .geo:disabled {
    opacity: 0.6;
  }
  .exact-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .exact-toggle input {
    width: 1.1rem;
    height: 1.1rem;
  }
  .note {
    font-size: var(--font-xs);
    color: var(--color-text-soft);
    margin: 0;
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-sm);
    margin: 0;
  }
  .disclaimer {
    background: var(--color-surface);
    border-left: 4px solid var(--color-warning);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    margin: 0;
  }
  .review {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  .review div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border-soft);
  }
  .review dt {
    color: var(--color-text-soft);
  }
  .review dd {
    margin: 0;
    color: var(--color-text);
    text-align: right;
  }
  .nav {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }
  .primary,
  .secondary {
    flex: 1;
    min-height: 48px;
    border-radius: var(--radius-md);
    font-size: var(--font-md);
    cursor: pointer;
  }
  .primary {
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    border: none;
  }
  .primary:disabled {
    opacity: 0.5;
  }
  .secondary {
    background: var(--color-surface-raised);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  .done {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
  }
  .queued {
    background: var(--color-surface);
    border-left: 4px solid var(--color-warning);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--font-sm);
    color: var(--color-text-muted);
  }
  .link {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    font: inherit;
  }
</style>
