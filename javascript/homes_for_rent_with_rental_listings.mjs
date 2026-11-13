/*
Find homes for rent with their rental listing history with the Houski property data API.

Lists homes that are for rent in a city, each with its rental listing events
attached: the date, the event and the monthly rent asked.

Usage: node homes_for_rent_with_rental_listings.mjs ca bc vancouver
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

const [country = "ca", province = "bc", city = "vancouver"] = process.argv.slice(2);

const answer = await houski("properties", {
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
