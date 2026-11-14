/*
Estimate how a renovation changes a home's value with the Houski property data API.

Finds a home by its address, then asks /predict for its estimated sale price
twice: as it is, and with one more bedroom. Other facts can be overridden the
same way, such as bathroom_full, interior_sq_m and construction_year.

Usage: node value_change_from_renovation.ts "100 main calgary"

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx value_change_from_renovation.ts.
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

// A row always has address and property_id. A field with no value for a home is left out of the row.
interface HomeAsItIs {
  address: string;
  property_id: string;
  bedroom?: number;
}

// /search: the best matches first, with one match score per result in match_meta.
interface SearchAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  match_meta: { property_id: string; match_value: number }[];
  result_total: number;
}

// /predict: one entry per property, each with one prediction per date.
interface Prediction {
  date: string;
  estimate_sale_price?: number;
  estimate_list_price?: number;
  estimate_rent_monthly?: number;
}
interface PredictAnswer extends AnswerEnvelope {
  data: { property_id: string; predictions: Prediction[] }[];
  result_total: number;
}

// The estimated sale price of the most recent date in the answer.
function latestSalePrice(answer: PredictAnswer): number | undefined {
  const predictions = [...answer.data[0].predictions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return predictions[predictions.length - 1].estimate_sale_price;
}

const address = process.argv.slice(2).join(" ") || "100 main calgary";

// exclude=inferred is left off here: /predict values the home by its bedroom count whether stated or
// worked out, so the example needs a count for every home.
const found = await houski<SearchAnswer<HomeAsItIs>>("search", { query: address, max_results: 1, select: "bedroom" });
if (found.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}
const home = found.data[0];
const bedrooms = home.bedroom;
if (bedrooms === undefined) {
  console.error("The number of bedrooms of that home is not known.");
  process.exit(1);
}

const asItIs = await houski<PredictAnswer>("predict", { property_id: home.property_id, fields: "estimate_sale_price", period: "month", last: 1 });

// An override is passed by its bare field name. Here the same home is valued with one more bedroom.
const renovated = await houski<PredictAnswer>("predict", { property_id: home.property_id, fields: "estimate_sale_price", period: "month", last: 1, bedroom: bedrooms + 1 });

const before = latestSalePrice(asItIs);
const after = latestSalePrice(renovated);
console.log(`${home.address} with ${bedrooms} bedrooms: ${before ?? "not known"}`);
console.log(`The same home with ${bedrooms + 1} bedrooms: ${after ?? "not known"}`);
if (before && after) {
  console.log(`Difference: ${after - before}`);
}

console.log(`Cost: ${found.cost_cents + asItIs.cost_cents + renovated.cost_cents} cents`);
