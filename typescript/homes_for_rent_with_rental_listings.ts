/*
Find homes for rent with their rental listing history with the Houski property data API.

Lists homes that are for rent in a city, each with its rental listing events
attached: the date, the event and the monthly rent asked.

Usage: node homes_for_rent_with_rental_listings.ts ca bc vancouver

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx homes_for_rent_with_rental_listings.ts.
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

// A rental listing row attached by expand=listings_rent.
interface RentalListing {
  expand_listing_rent_date?: string;
  expand_listing_rent_event?: string;
  expand_estimate_rent_monthly?: number;
  expand_for_rent_what_is?: string;
}

// A row always has address and property_id. A field with no value for a home is left out of the row.
interface HomeForRent {
  address: string;
  property_id: string;
  property_type?: string;
  bedroom?: number;
  estimate_rent_monthly?: number;
  listings_rent?: RentalListing[];
}

// /properties: one row per property.
interface PropertiesAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  result_total: number;
  pagination: Pagination;
}

const [country = "ca", province = "bc", city = "vancouver"] = process.argv.slice(2);

const answer = await houski<PropertiesAnswer<HomeForRent>>("properties", {
  country_abbreviation: country,
  province_abbreviation: province,
  city: city,
  for_rent_eq: "true",
  // expand attaches each property's rental listing rows to it. Each row is billed.
  expand: "listings_rent",
  select: "property_type,bedroom,estimate_rent_monthly",
  results_per_page: 5,
});

for (const home of answer.data) {
  console.log(`${home.address}: ${home.property_type ?? "not known"}, ${home.bedroom ?? "not known"} bedrooms, estimated rent ${home.estimate_rent_monthly ?? "not known"}`);
  for (const listing of home.listings_rent ?? []) {
    console.log(`  ${listing.expand_listing_rent_date ?? "not known"} ${listing.expand_listing_rent_event ?? "not known"}: ${listing.expand_estimate_rent_monthly ?? "not known"} a month`);
  }
}

console.log(`${answer.result_total} homes for rent. Cost of this page: ${answer.cost_cents} cents`);
