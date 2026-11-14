/*
Return only values from public records with the Houski property data API.

Houski estimates a value where no record states it, so nearly every home has
one. Many fields have a matching _source field that says where the value came
from: a link to the public record it was read from, Observed, Estimate or
User. exclude=estimates leaves the estimated values out of the answer, and a
value that is left out is not billed.

Usage: node public_record_values_only.ts

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx public_record_values_only.ts.
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
interface MeasuredHome {
  address: string;
  property_id: string;
  interior_sq_m?: number;
  interior_sq_m_source?: string;
}

// /properties with exclude: checked_fields lists the selected fields whose source was checked.
interface PropertiesAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  result_total: number;
  pagination: Pagination;
  checked_fields: string[];
}

const answer = await houski<PropertiesAnswer<MeasuredHome>>("properties", {
  country_abbreviation: "us",
  province_abbreviation: "tx",
  city: "austin",
  select: "interior_sq_m,interior_sq_m_source",
  // estimates leaves out the values Houski worked out. exclude=estimates,observed
  // keeps only the values read from a linked public record.
  exclude: "estimates",
  results_per_page: 5,
});

console.log(`Fields checked for their source: ${(answer.checked_fields ?? []).join(", ")}`);

for (const home of answer.data) {
  // A home whose floor area was an estimate is left out of the answer, and is not counted or billed.
  console.log(`${home.address}: ${home.interior_sq_m ?? "no recorded floor area"} square metres, source ${home.interior_sq_m_source ?? "none"}`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
