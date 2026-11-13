/*
Screen homes for sale as investments with the Houski property data API.

Lists the houses for sale in a city with the highest cap rate first, and marks
the ones whose list price sits below the estimated list price.

Usage: node investment_property_screen.mjs ca ab calgary
*/

const API_URL = process.env.HOUSKI_API_URL ?? "https://api.houski.ca";
const API_KEY = process.env.HOUSKI_API_KEY;
if (!API_KEY) {
  console.error("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
  process.exit(1);
}

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

const [country = "ca", province = "ab", city = "calgary"] = process.argv.slice(2);

const answer = await houski("properties", {
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
