/*
Get the neighbourhood scores of an address with the Houski property data API.

Prints how the area around a home rates for walkability, transit, schools,
safety and quiet. Each score runs from 0 to 10 and higher is always better.

Usage: node neighbourhood_scores.mjs "100 main calgary"
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

const SCORES = ["score_total", "score_walkability", "score_transit", "score_education", "score_safety", "score_quiet"];

const address = process.argv.slice(2).join(" ") || "100 main calgary";

const answer = await houski("search", { query: address, max_results: 1, select: SCORES.join(",") });

if (answer.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}

const home = answer.data[0];
console.log(`Address: ${home.address}`);
for (const score of SCORES) {
  console.log(`${score}: ${home[score] ?? "(not known)"} out of 10`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
