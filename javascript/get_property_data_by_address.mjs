/*
Get property data by address with the Houski property data API.

Turns a typed address into one property and prints its facts: property type,
bedrooms, bathrooms, floor area, construction year and estimated sale price.

Usage: node get_property_data_by_address.mjs "100 main calgary"
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

const address = process.argv.slice(2).join(" ") || "100 main calgary";

// /search matches a typed address, typos included, and returns the best matches first.
// select names the fields to return. Only the values that come back are billed.
const answer = await houski("search", {
  query: address,
  max_results: 1,
  select: "property_type,bedroom,bathroom_full,interior_sq_m,construction_year,estimate_sale_price",
});

if (answer.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}

// A field with no value for this home is left out of the row, so print what came back.
for (const [field, value] of Object.entries(answer.data[0])) {
  console.log(`${field}: ${value}`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
