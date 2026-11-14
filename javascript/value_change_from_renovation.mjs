/*
Estimate how a renovation changes a home's value with the Houski property data API.

Finds a home by its address, then asks /predict for its estimated sale price
twice: as it is, and with one more bedroom. Other facts can be overridden the
same way, such as bathroom_full, interior_sq_m and construction_year.

Usage: node value_change_from_renovation.mjs "100 main calgary"
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

// The estimated sale price of the most recent date in the answer.
function latestSalePrice(answer) {
  const predictions = [...answer.data[0].predictions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return predictions[predictions.length - 1].estimate_sale_price;
}

const address = process.argv.slice(2).join(" ") || "100 main calgary";

// exclude=inferred is left off here: /predict values the home by its bedroom count whether stated or
// worked out, so the example needs a count for every home.
const found = await houski("search", { query: address, max_results: 1, select: "bedroom" });
if (found.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}
const home = found.data[0];
const bedrooms = home.bedroom;
if (bedrooms === undefined || bedrooms === null) {
  console.error("The number of bedrooms of that home is not known.");
  process.exit(1);
}

const asItIs = await houski("predict", { property_id: home.property_id, fields: "estimate_sale_price", period: "month", last: 1 });

// An override is passed by its bare field name. Here the same home is valued with one more bedroom.
const renovated = await houski("predict", { property_id: home.property_id, fields: "estimate_sale_price", period: "month", last: 1, bedroom: bedrooms + 1 });

const before = latestSalePrice(asItIs);
const after = latestSalePrice(renovated);
console.log(`${home.address} with ${bedrooms} bedrooms: ${before ?? "not known"}`);
console.log(`The same home with ${bedrooms + 1} bedrooms: ${after ?? "not known"}`);
if (before && after) {
  console.log(`Difference: ${after - before}`);
}

console.log(`Cost: ${found.cost_cents + asItIs.cost_cents + renovated.cost_cents} cents`);
