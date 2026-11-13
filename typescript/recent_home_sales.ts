/*
Find recent home sales in a city with the Houski property data API.

Lists homes with a Sold event in the last 90 days, each with the matching
sale rows attached: the date and the price.

Usage: node recent_home_sales.ts gb eng manchester

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx recent_home_sales.ts.
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

// A listing row attached by expand=listings. The event is Listed, Sold and so on.
interface ListingEvent {
  expand_listing_date?: string;
  expand_listing_event?: string;
  expand_estimate_list_price?: number;
}

// A row always has address and property_id. A field with no value for a home is left out of the row.
interface SoldHome {
  address: string;
  property_id: string;
  property_type?: string;
  interior_sq_m?: number;
  listings?: ListingEvent[];
}

// /properties: one row per property.
interface PropertiesAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  result_total: number;
  pagination: Pagination;
}

const [country = "gb", province = "eng", city = "manchester"] = process.argv.slice(2);

// Dates are written yyyy-mm-dd.
const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const answer = await houski<PropertiesAnswer<SoldHome>>("properties", {
  country_abbreviation: country,
  province_abbreviation: province,
  city: city,
  expand: "listings",
  // These two filters choose which listing rows count.
  expand_listing_event_eq: "Sold",
  expand_listing_date_gte: since,
  // all keeps only the properties that have a matching row.
  filter_expand_match: "all",
  select: "property_type,interior_sq_m",
  results_per_page: 10,
});

for (const home of answer.data) {
  for (const sale of home.listings ?? []) {
    console.log(`${sale.expand_listing_date ?? "not known"}: ${home.address} (${home.property_type ?? "not known"}, ${home.interior_sq_m ?? "not known"} square metres) sold for ${sale.expand_estimate_list_price ?? "not known"}`);
  }
}

console.log(`${answer.result_total} homes sold since ${since}. Cost of this page: ${answer.cost_cents} cents`);
