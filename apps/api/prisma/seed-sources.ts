import { PrismaClient } from "../src/generated/prisma";

// Seed idempotente de fuentes oficiales (solo METADATOS de fuente, nunca datos
// sísmicos/tsunami: esos entran por fetch real). docs/SPEC.md §7.3 seed:official-sources.
const prisma = new PrismaClient();

const SOURCES = [
  {
    name: "USGS Earthquake Catalog",
    type: "seismic",
    country: "US",
    baseUrl: "https://earthquake.usgs.gov/fdsnws/event/1/",
    trustLevel: "official",
  },
  {
    name: "NOAA PTWC",
    type: "tsunami",
    country: "US",
    baseUrl: "https://www.tsunami.gov/",
    trustLevel: "official",
  },
  {
    name: "NOAA NTWC",
    type: "tsunami",
    country: "US",
    baseUrl: "https://www.tsunami.gov/",
    trustLevel: "official",
  },
  {
    name: "FUNVISIS",
    type: "seismic",
    country: "VE",
    baseUrl: "http://www.funvisis.gob.ve/",
    trustLevel: "official",
  },
  {
    name: "Protección Civil Venezuela",
    type: "civil_protection",
    country: "VE",
    baseUrl: null,
    trustLevel: "official",
  },
  // Registros comunitarios de personas desaparecidas (meta-buscador). NUNCA
  // "official": son fuentes comunitarias sin verificar (community_pending).
  {
    name: "Venezuela Te Busca",
    type: "missing_persons",
    country: "VE",
    baseUrl: "https://venezuelatebusca.com/",
    trustLevel: "community_pending",
  },
  {
    name: "Encuéntralos",
    type: "missing_persons",
    country: "VE",
    baseUrl: "https://encuentralos.tecnosoft.dev/",
    trustLevel: "community_pending",
  },
] as const;

async function main(): Promise<void> {
  for (const s of SOURCES) {
    await prisma.officialSource.upsert({
      where: { name: s.name },
      update: { type: s.type, country: s.country, baseUrl: s.baseUrl, trustLevel: s.trustLevel },
      create: { name: s.name, type: s.type, country: s.country, baseUrl: s.baseUrl, trustLevel: s.trustLevel },
    });
  }
  const count = await prisma.officialSource.count();
  console.log(`official_sources: ${count} filas`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
