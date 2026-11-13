/*
List the countries, provinces or states, and cities the Houski property data API covers.

Places are never written into code. /location returns the ones that hold
data, so menus and validation stay right as coverage grows. This program
prints every country, then the provinces or states of one country, then the
first cities of one province or state.

Usage: node list_countries_provinces_and_cities.ts ca ab

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx list_countries_provinces_and_cities.ts.
*/

const API_URL = process.env.HOUSKI_API_URL ?? "https://api.houski.ca";
const API_KEY = process.env.HOUSKI_API_KEY ?? "";
if (API_KEY === "") {
  console.error("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
  process.exit(1);
}

type RequestParameters = Record<string, string | number | boolean>;

// Send one GET request to the Houski API and return the parsed JSON answer.
async function houski<Answer>(endpoint: string, parameters: RequestParameters = {}): Promise<Answer> {
  const query = new URLSearchParams({ api_key: API_KEY, ...parameters } as Record<string, string>);
  const response = await fetch(`${API_URL}/${endpoint}?${query}`);
  if (!response.ok) {
    console.error(`Houski answered ${response.status}: ${await response.text()}`);
    process.exit(1);
  }
  return response.json() as Promise<Answer>;
}

// Every billed answer carries these keys. A failure has the same shape with an empty data and a filled error.
interface AnswerEnvelope {
  error: string;
  time_ms: number;
  cost_cents: number;
  cache_hit: boolean;
  price_quote: boolean;
}

// /location with flat=true: one entry per place. Keys of levels below the resolution are absent.
interface FlatLocation {
  country?: string;
  country_abbreviation?: string;
  province?: string;
  province_abbreviation?: string;
  city?: string;
  city_slug?: string;
  community?: string;
  community_slug?: string;
}
interface LocationAnswer extends AnswerEnvelope {
  data: { flat: FlatLocation[] };
  result_total: number;
}

const [country = "ca", province = "ab"] = process.argv.slice(2);

// resolution says which level to list. flat=true returns a plain list instead of a nested tree.
const countries = await houski<LocationAnswer>("location", { resolution: "country", flat: "true" });
console.log("Countries:");
for (const place of countries.data.flat) {
  console.log(`  ${place.country ?? "not known"} (${place.country_abbreviation ?? "not known"})`);
}

// Each level needs every level above it, so provinces need their country.
const provinces = await houski<LocationAnswer>("location", { resolution: "province", flat: "true", country_abbreviation: country });
console.log(`Provinces or states of ${country}:`);
for (const place of provinces.data.flat) {
  console.log(`  ${place.province ?? "not known"} (${place.province_abbreviation ?? "not known"})`);
}

// /location has no paging, so always scope it. The slug of a city works as the city value of other requests.
const cities = await houski<LocationAnswer>("location", { resolution: "city", flat: "true", country_abbreviation: country, province_abbreviation: province });
console.log(`${cities.result_total} cities in ${province}. The first ten:`);
for (const place of cities.data.flat.slice(0, 10)) {
  console.log(`  ${place.city ?? "not known"} (city=${place.city_slug ?? "not known"})`);
}

console.log(`Cost: ${countries.cost_cents + provinces.cost_cents + cities.cost_cents} cents`);
