/*
Check a home's value for a mortgage file with the Houski property data API.

Prints the estimated sale price beside the assessed value and the property
taxes, then two years of monthly value history for the same home.

Usage: node lender_value_check.ts "100 main calgary"

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx lender_value_check.ts.
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

// A field with no value for a home is left out of the row, so every selected field is optional.
interface HomeValues {
  address: string;
  property_id: string;
  estimate_sale_price?: number;
  assessment_value?: number;
  property_taxes?: number;
}

const address = process.argv.slice(2).join(" ") || "100 main calgary";

// Step 1: find the home and read its values. Money is in the currency of the
// property's country and is never converted.
const found = await houski<SearchAnswer<HomeValues>>("search", { query: address, max_results: 1, select: "estimate_sale_price,assessment_value,property_taxes" });

if (found.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}

const home = found.data[0];
console.log(`Address: ${home.address}`);
for (const field of ["estimate_sale_price", "assessment_value", "property_taxes"] as const) {
  console.log(`${field}: ${home[field] ?? "(not known)"}`);
}

// Step 2: the modelled sale value of that home for each of the last 24 months.
// /predict covers 2021-01-01 to today. It does not forecast.
const history = await houski<PredictAnswer>("predict", { property_id: home.property_id, fields: "estimate_sale_price", period: "month", last: 24 });

const predictions = [...history.data[0].predictions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
for (const prediction of predictions) {
  console.log(`${prediction.date}: ${prediction.estimate_sale_price ?? "not known"}`);
}

const first = predictions[0].estimate_sale_price;
const latest = predictions[predictions.length - 1].estimate_sale_price;
if (first && latest) {
  console.log(`Change over the period: ${(((latest - first) / first) * 100).toFixed(1)}%`);
}

console.log(`Cost: ${found.cost_cents + history.cost_cents} cents`);
