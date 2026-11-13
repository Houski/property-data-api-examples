/*
Address autocomplete with the Houski property data API.

Prints address suggestions for a partly typed address, best match first. Call
this from your own server as the visitor types, so the API key never reaches
the browser.

Usage: node address_autocomplete.ts "100 main cal"

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx address_autocomplete.ts.
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

// With no select, a row carries only address and property_id.
interface AddressSuggestion {
  address: string;
  property_id: string;
}

// Return up to five suggestions as (address, property_id, match score).
async function suggestAddresses(typedText: string, countryAbbreviation: string | null = null) {
  const parameters: RequestParameters = { query: typedText, max_results: 5 };
  if (countryAbbreviation) {
    parameters.country_abbreviation = countryAbbreviation;
  }

  // With no select, a result carries only address and property_id, the least expensive answer.
  const answer = await houski<SearchAnswer<AddressSuggestion>>("search", parameters);

  // match_meta holds one match score per result, keyed by property_id.
  const scores = new Map(answer.match_meta.map((meta) => [meta.property_id, meta.match_value]));
  return answer.data.map((home) => [home.address, home.property_id, scores.get(home.property_id) ?? "not known"]);
}

const typedText = process.argv.slice(2).join(" ") || "100 main cal";

for (const [address, propertyId, score] of await suggestAddresses(typedText)) {
  console.log(`${address}  (property_id ${propertyId}, match ${score})`);
}
