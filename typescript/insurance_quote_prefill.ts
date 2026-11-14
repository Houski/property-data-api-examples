/*
Pre-fill an insurance quote form from an address with the Houski property data API.

One request returns the facts an insurer asks a home owner for: property type,
construction year, floor area, roof material, and the flood and fire scores of
the area. Each score runs from 0 to 10 and higher is better, so a high
score_flood means the area floods less often.

Usage: node insurance_quote_prefill.ts "100 main calgary"

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx insurance_quote_prefill.ts.
*/

const API_URL = process.env.HOUSKI_API_URL ?? "https://api.houski.ca";
const API_KEY = process.env.HOUSKI_API_KEY ?? "";
if (API_KEY === "") {
  console.error("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
  process.exit(1);
}

const QUOTE_FORM_FIELDS: (keyof QuoteFormHome)[] = ["property_type", "construction_year", "interior_sq_m", "roof_material", "score_flood", "score_fire"];

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
interface QuoteFormHome {
  address: string;
  property_id: string;
  property_type?: string;
  construction_year?: number;
  interior_sq_m?: number;
  roof_material?: string;
  score_flood?: number;
  score_fire?: number;
}

const address = process.argv.slice(2).join(" ") || "100 main calgary";

// exclude=inferred leaves out the facts Houski worked out, so a box is pre-filled only with a fact stated
// for this home. The scores have no source field and are untouched. Remove exclude to pre-fill inferred facts too.
const answer = await houski<SearchAnswer<QuoteFormHome>>("search", { query: address, max_results: 1, select: QUOTE_FORM_FIELDS.join(","), exclude: "inferred" });

if (answer.data.length === 0) {
  console.error("No property matched that address, or Houski inferred every fact selected for it.");
  process.exit(1);
}

const home = answer.data[0];
console.log(`Address: ${home.address}`);

// A field with no value for this home is left out of the row. Leave that form box
// empty for the applicant to fill in.
for (const field of QUOTE_FORM_FIELDS) {
  console.log(`${field}: ${home[field] ?? "(not known, ask the applicant)"}`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
