/*
Find properties near a latitude and longitude with the Houski property data API.

Lists the houses within a radius of a point, nearest first. Use it for
"homes near me", for comparable properties around an address, or to turn a
map click into the properties around it.

Usage: node find_properties_near_point.ts 51.0447 -114.0719 0.5

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx find_properties_near_point.ts.
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

interface Pagination {
  current_page: number;
  page_total: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

// A row always has address and property_id. A field with no value for a home is left out of the row.
interface NearbyHome {
  address: string;
  property_id: string;
  bedroom?: number;
  bathroom_full?: number;
  estimate_list_price?: number;
}

// /geocoding: one row per property, nearest first, paged like /properties.
interface GeocodingAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  result_total: number;
  pagination: Pagination;
}

const [latitude = "51.0447", longitude = "-114.0719", radiusKm = "0.5"] = process.argv.slice(2);

const answer = await houski<GeocodingAnswer<NearbyHome>>("geocoding", {
  latitude: latitude,
  longitude: longitude,
  // The radius is in kilometres. shape is circle, the default, or square.
  radius: radiusKm,
  shape: "circle",
  // /geocoding takes no place parameters. Filters narrow it the same way as on /properties.
  property_type_eq: "House",
  select: "bedroom,bathroom_full,estimate_list_price",
  // exclude=inferred leaves out the bedroom and bathroom counts Houski worked out, and a house with
  // neither count stated. Remove exclude to get the inferred values back.
  exclude: "inferred",
  results_per_page: 10,
});

for (const home of answer.data) {
  console.log(`${home.address}: ${home.bedroom ?? "not known"} bedrooms, ${home.bathroom_full ?? "not known"} full bathrooms, ${home.estimate_list_price ?? "not known"}`);
}

console.log(`${answer.result_total} houses within ${radiusKm} km. Cost of this page: ${answer.cost_cents} cents`);
