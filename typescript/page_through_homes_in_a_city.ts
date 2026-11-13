/*
Page through every home in a city with the Houski property data API.

Walks the result of one search page by page, following has_next_page, which
is how to pull a whole city or load a database. Each page is billed for the
values it returns, so this program stops after a set number of pages. Raise
MOST_PAGES to pull more.

Usage: node page_through_homes_in_a_city.ts ca ab calgary

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx page_through_homes_in_a_city.ts.
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
interface PricedHome {
  address: string;
  property_id: string;
  estimate_list_price?: number;
}

// /properties: one row per property.
interface PropertiesAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  result_total: number;
  pagination: Pagination;
}

const MOST_PAGES = 3;

const [country = "ca", province = "ab", city = "calgary"] = process.argv.slice(2);

let page = 1;
let homesRead = 0;
let centsSpent = 0;
let resultTotal = 0;

while (page <= MOST_PAGES) {
  const answer = await houski<PropertiesAnswer<PricedHome>>("properties", {
    country_abbreviation: country,
    province_abbreviation: province,
    city: city,
    select: "estimate_list_price",
    // results_per_page goes up to 1000. One response holds at most 10,000 values,
    // counted as rows times columns with address and property_id included.
    results_per_page: 50,
    page: page,
  });

  for (const home of answer.data) {
    console.log(`${home.property_id} ${home.address}: ${home.estimate_list_price ?? "not known"}`);
  }

  homesRead += answer.data.length;
  centsSpent += answer.cost_cents;
  resultTotal = answer.result_total;

  // has_next_page says whether another page follows this one.
  if (!answer.pagination.has_next_page) {
    break;
  }
  page += 1;
}

console.log(`Read ${homesRead} of ${resultTotal} homes. Cost: ${centsSpent} cents`);
