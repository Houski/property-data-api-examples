/*
Find homes by building permit history with the Houski property data API.

Lists homes in a city that had a roofing permit since a given date, with the
matching permits attached. Change the pattern to find any other kind of work,
such as solar, furnace or basement.

Usage: node find_homes_by_permit.ts roof 2024-01-01

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx find_homes_by_permit.ts.
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

// /properties: one row per property. A row always has address and property_id, plus the selected fields that have a value.
interface PropertiesAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  result_total: number;
  pagination: Pagination;
}

// A permit row attached by expand=permits.
interface Permit {
  expand_permit_id: string;
  expand_permit_application_date: string;
  expand_permit_type: string;
  expand_permit_content: string;
  expand_permit_value?: number;
}

// A field with no value for a home is left out of the row, so every selected field is optional.
interface HomeWithPermits {
  address: string;
  property_id: string;
  construction_year?: number;
  permits?: Permit[];
}

const [word = "roof", since = "2024-01-01"] = process.argv.slice(2);

const answer = await houski<PropertiesAnswer<HomeWithPermits>>("properties", {
  country_abbreviation: "ca",
  province_abbreviation: "ab",
  city: "calgary",
  // expand attaches each property's permit rows to it.
  expand: "permits",
  // These two filters choose which permit rows count. (?i) ignores case.
  expand_permit_application_date_gte: since,
  expand_permit_content_regex: `(?i)${word}`,
  // all keeps only the properties that have a matching permit.
  filter_expand_match: "all",
  select: "construction_year",
  results_per_page: 20,
});

for (const home of answer.data) {
  console.log(`${home.address} (built ${home.construction_year ?? "year not known"})`);
  for (const permit of home.permits ?? []) {
    console.log(`  ${permit.expand_permit_application_date} ${permit.expand_permit_type}: ${permit.expand_permit_content}`);
  }
}

console.log(`${answer.result_total} homes matched. Cost of this page: ${answer.cost_cents} cents`);
