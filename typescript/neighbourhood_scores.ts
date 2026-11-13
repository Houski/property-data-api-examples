/*
Get the neighbourhood scores of an address with the Houski property data API.

Prints how the area around a home rates for walkability, transit, schools,
safety and quiet. Each score runs from 0 to 10 and higher is always better.

Usage: node neighbourhood_scores.ts "100 main calgary"

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx neighbourhood_scores.ts.
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

const SCORES = ["score_total", "score_walkability", "score_transit", "score_education", "score_safety", "score_quiet"] as const;

// A row always has address and property_id. A field with no value for a home is left out of the row.
interface ScoredHome {
  address: string;
  property_id: string;
  score_total?: number;
  score_walkability?: number;
  score_transit?: number;
  score_education?: number;
  score_safety?: number;
  score_quiet?: number;
}

// /search: the best matches first, with one match score per result in match_meta.
interface SearchAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  match_meta: { property_id: string; match_value: number }[];
  result_total: number;
}

const address = process.argv.slice(2).join(" ") || "100 main calgary";

const answer = await houski<SearchAnswer<ScoredHome>>("search", { query: address, max_results: 1, select: SCORES.join(",") });

if (answer.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}

const home = answer.data[0];
console.log(`Address: ${home.address}`);
for (const score of SCORES) {
  console.log(`${score}: ${home[score] ?? "(not known)"} out of 10`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
