/*
Screen homes for sale as investments with the Houski property data API.

Lists the houses for sale in a city with the highest cap rate first, and marks
the ones whose list price sits below the estimated list price.

Usage: node investment_property_screen.ts ca ab calgary

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx investment_property_screen.ts.
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

// A field with no value for a home is left out of the row, so every selected field is optional.
interface ForSaleHome {
  address: string;
  property_id: string;
  list_price?: number;
  estimate_list_price?: number;
  estimate_rent_monthly?: number;
  cap_rate?: number;
}

const [country = "ca", province = "ab", city = "calgary"] = process.argv.slice(2);

const answer = await houski<PropertiesAnswer<ForSaleHome>>("properties", {
  country_abbreviation: country,
  province_abbreviation: province,
  city: city,
  // Filters are a field name, an operator suffix and a value.
  for_sale_eq: "true",
  property_type_eq: "House",
  // One sort per request. Homes with no cap rate sort last.
  cap_rate_sort: "desc",
  select: "list_price,estimate_list_price,estimate_rent_monthly,cap_rate",
  results_per_page: 25,
});

for (const home of answer.data) {
  const listPrice = home.list_price ?? null;
  const estimate = home.estimate_list_price ?? null;
  const belowEstimate = listPrice && estimate && listPrice < estimate ? "  below estimate" : "";
  console.log(`${home.address}: cap rate ${home.cap_rate ?? "not known"}, list price ${listPrice ?? "not known"}, estimate ${estimate ?? "not known"}, rent ${home.estimate_rent_monthly ?? "not known"}${belowEstimate}`);
}

console.log(`${answer.result_total} houses for sale. Cost of this page: ${answer.cost_cents} cents`);
