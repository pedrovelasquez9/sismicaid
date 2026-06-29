<!-- apps/web/src/components/RescueMap.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type * as L from "leaflet";
  import type { TrappedPersonMarkerDTO } from "@sismicaid/shared";
  import { URGENCY_HEX, URGENCY_LABEL } from "../lib/urgency";

  export let markers: TrappedPersonMarkerDTO[] = [];

  let container: HTMLDivElement;
  let leaflet: typeof import("leaflet") | null = null;
  let map: L.Map | null = null;
  let layer: L.LayerGroup | null = null;

  const LEGEND = [
    { label: "Crítica", color: URGENCY_HEX.critical },
    { label: "Alta", color: URGENCY_HEX.high },
    { label: "Media", color: URGENCY_HEX.medium },
    { label: "Baja", color: URGENCY_HEX.low },
  ];

  function draw() {
    if (!map || !leaflet) return;
    if (layer) layer.remove();
    const lg = leaflet.layerGroup();
    for (const m of markers) {
      if (m.lat == null || m.lng == null) continue; // sin coords: solo en lista
      const color = URGENCY_HEX[m.urgency];
      const unverified = m.verificationStatus !== "verified";
      // Exacta: punto preciso. Aproximada: zona ~110 m (cubre el difuminado).
      const radius = m.locationPrecision === "exact" ? 90 : 150;
      const circle = leaflet.circle([m.lat, m.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: m.resolved ? 0.08 : 0.25,
        weight: 2,
        opacity: m.resolved ? 0.4 : 1,
        dashArray: unverified ? "5,5" : undefined,
      });
      const estado = m.resolved
        ? "Rescatado"
        : unverified
          ? "Sin verificar"
          : "Verificado";
      circle.bindTooltip(
        `Urgencia ${URGENCY_LABEL[m.urgency]} · ${estado}${m.municipality ? " · " + m.municipality : ""}`,
      );
      circle.addTo(lg);
    }
    lg.addTo(map);
    layer = lg;
  }

  onMount(async () => {
    await import("leaflet/dist/leaflet.css");
    leaflet = await import("leaflet");
    map = leaflet.map(container).setView([10.5, -66.9], 7);
    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      })
      .addTo(map);
    draw();
  });

  $: if (map && leaflet && markers) draw();

  onDestroy(() => {
    map?.remove();
    map = null;
  });
</script>

<div class="wrap">
  <div class="map" bind:this={container}></div>
  <ul class="legend" aria-label="Leyenda de urgencia">
    {#each LEGEND as l}
      <li><span class="dot" style={`background:${l.color}`}></span>{l.label}</li>
    {/each}
    <li><span class="dot dashed"></span>Sin verificar</li>
  </ul>
</div>

<style>
  .map {
    height: 360px;
    width: 100%;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    z-index: 0;
  }
  .legend {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-size: var(--font-sm);
    color: var(--color-text-soft);
  }
  .dot {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: var(--radius-full);
    margin-right: var(--space-1);
    vertical-align: middle;
  }
  .dot.dashed {
    background: transparent;
    border: 2px dashed var(--color-text-soft);
  }
</style>
