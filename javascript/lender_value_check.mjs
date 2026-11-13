/*
Check a home's value for a mortgage file with the Houski property data API.

Prints the estimated sale price beside the assessed value and the property
taxes, then two years of monthly value history for the same home.

Usage: node lender_value_check.mjs "100 main calgary"
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

// Step 1: find the home and read its values. Money is in the currency of the
// property's country and is never converted.
const found = await houski("search", { query: address, max_results: 1, select: "estimate_sale_price,assessment_value,property_taxes" });

if (found.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}

const home = found.data[0];
console.log(`Address: ${home.address}`);
for (const field of ["estimate_sale_price", "assessment_value", "property_taxes"]) {
  console.log(`${field}: ${home[field] ?? "(not known)"}`);
}

// Step 2: the modelled sale value of that home for each of the last 24 months.
// /predict covers 2021-01-01 to today. It does not forecast.
const history = await houski("predict", { property_id: home.property_id, fields: "estimate_sale_price", period: "month", last: 24 });

const predictions = [...history.data[0].predictions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
for (const prediction of predictions) {
  console.log(`${prediction.date}: ${prediction.estimate_sale_price ?? "not known"}`);
}

const first = predictions[0].estimate_sale_price;
const latest = predictions[predictions.length - 1].estimate_sale_price;
if (first && latest) {
  console.log(`Change over the period: ${(((latest - first) / first) * 100).toFixed(1)}%`);
}

console.log(`Cost: ${found.cost_cents + history.cost_cents} cents`);
