/*
Get property data by address with the Houski property data API.

Turns a typed address into one property and prints its facts: property type,
bedrooms, bathrooms, floor area, construction year and estimated sale price.

Usage: node get_property_data_by_address.ts "100 main calgary"

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx get_property_data_by_address.ts.
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

// /search: the best matches first, with one match score per result in match_meta.
interface SearchAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  match_meta: { property_id: string; match_value: number }[];
  result_total: number;
}

// A field with no value for a home is left out of the row, so every selected field is optional.
interface HomeFacts {
  address: string;
  property_id: string;
  property_type?: string;
  bedroom?: number;
  bathroom_full?: number;
  interior_sq_m?: number;
  construction_year?: number;
  estimate_sale_price?: number;
}

const address = process.argv.slice(2).join(" ") || "100 main calgary";

// /search matches a typed address, typos included, and returns the best matches first.
// select names the fields to return. Only the values that come back are billed.
const answer = await houski<SearchAnswer<HomeFacts>>("search", {
  query: address,
  max_results: 1,
  select: "property_type,bedroom,bathroom_full,interior_sq_m,construction_year,estimate_sale_price",
  // exclude=inferred leaves out the facts Houski worked out. estimate_sale_price has no source field,
  // so it is untouched. Remove exclude to get the inferred facts back.
  exclude: "inferred",
});

if (answer.data.length === 0) {
  console.error("No property matched that address, or Houski inferred every fact selected for it.");
  process.exit(1);
}

const home = answer.data[0];

// A field with no value for this home is left out of the row, so print what came back.
for (const [field, value] of Object.entries(home)) {
  console.log(`${field}: ${value}`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
