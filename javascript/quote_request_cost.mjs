/*
Quote the cost of a request before running it with the Houski property data API.

Houski bills for the values a request returns, never for how much was
searched. Adding price_quote=true to any request returns what it would cost,
with no data and no charge. This program quotes a property search, then runs
it only if the cost is under a limit.

Usage: node quote_request_cost.mjs
*/

const API_URL = process.env.HOUSKI_API_URL ?? "https://api.houski.ca";
const API_KEY = process.env.HOUSKI_API_KEY;
if (!API_KEY) {
  console.error("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
  process.exit(1);
}

const MOST_CENTS_TO_SPEND = 25;

// Send one GET request to the Houski API and return the parsed JSON answer.
async function houski(endpoint, parameters = {}) {
  const query = new URLSearchParams({ api_key: API_KEY, ...parameters });
  const response = await fetch(`${API_URL}/${endpoint}?${query}`);
  if (!response.ok) {
    console.error(`Houski answered ${response.status}: ${await response.text()}`);
    process.exit(1);
  }
  return response.json();
}

const search = {
  country_abbreviation: "ca",
  province_abbreviation: "ab",
  city: "calgary",
  property_type_eq: "House",
  bedroom_gte: 3,
  estimate_list_price_lte: 600000,
  estimate_list_price_sort: "asc",
  // Selecting only the fields the code uses is the biggest saving.
  select: "bedroom,bathroom_full,interior_sq_m,estimate_list_price",
  results_per_page: 25,
};

const quote = await houski("properties", { price_quote: "true", ...search });
console.log(`${quote.result_total} homes match. This page would cost ${quote.cost_cents} cents.`);

if (quote.cost_cents > MOST_CENTS_TO_SPEND) {
  console.error(`That is over the limit of ${MOST_CENTS_TO_SPEND} cents, so the request was not run.`);
  process.exit(1);
}

const answer = await houski("properties", search);
for (const home of answer.data) {
  console.log(`${home.address}: ${home.bedroom ?? "not known"} bedrooms, ${home.interior_sq_m ?? "not known"} square metres, ${home.estimate_list_price ?? "not known"}`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
