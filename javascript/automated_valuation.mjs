/*
Get an automated valuation of a home with the Houski property data API.

Finds a home by its address, quotes the valuation for free, and runs it only
when --yes is given, because a valuation costs $5.00. The valuation holds the
estimated sale price, list price and monthly rent, each with a confidence
score, plus warning flags and a link to a report.

Usage: node automated_valuation.mjs "100 main calgary"
       node automated_valuation.mjs "100 main calgary" --yes
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

const argumentsGiven = process.argv.slice(2).filter((argument) => argument !== "--yes");
const approved = process.argv.slice(2).includes("--yes");
const address = argumentsGiven.join(" ") || "100 main calgary";

const found = await houski("search", { query: address, max_results: 1 });
if (found.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}
const home = found.data[0];

// price_quote=true returns what the valuation would cost, and charges nothing.
const quote = await houski("avm", { property_id: home.property_id, price_quote: "true" });
console.log(`A valuation of ${home.address} costs ${quote.cost_cents} cents.`);

// Never run a valuation without the yes of the person who pays for it.
if (!approved) {
  console.error("Run again with --yes to buy the valuation.");
  process.exit(1);
}

const answer = await houski("avm", { property_id: home.property_id });
const valuation = answer.data;

console.log(`Valued on ${valuation.valuation_date}`);
for (const field of ["estimate_sale_price", "estimate_list_price", "estimate_rent_monthly"]) {
  console.log(`${field}: ${valuation[field].value} (confidence ${valuation[field].confidence_score})`);
}
for (const flag of valuation.property_warning_flags) {
  console.log(`Warning, ${flag.warning}: ${flag.description}`);
}
console.log(`Report: ${answer.url}`);
console.log(`Cost: ${answer.cost_cents} cents`);
