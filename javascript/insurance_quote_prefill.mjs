/*
Pre-fill an insurance quote form from an address with the Houski property data API.

One request returns the facts an insurer asks a home owner for: property type,
construction year, floor area, roof material, and the flood and fire scores of
the area. Each score runs from 0 to 10 and higher is better, so a high
score_flood means the area floods less often.

Usage: node insurance_quote_prefill.mjs "100 main calgary"
*/

const API_URL = process.env.HOUSKI_API_URL ?? "https://api.houski.ca";
const API_KEY = process.env.HOUSKI_API_KEY;
if (!API_KEY) {
  console.error("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
  process.exit(1);
}

const QUOTE_FORM_FIELDS = ["property_type", "construction_year", "interior_sq_m", "roof_material", "score_flood", "score_fire"];

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

// exclude=inferred leaves out the facts Houski worked out, so a box is pre-filled only with a fact stated
// for this home. The scores have no source field and are untouched. Remove exclude to pre-fill inferred facts too.
const answer = await houski("search", { query: address, max_results: 1, select: QUOTE_FORM_FIELDS.join(","), exclude: "inferred" });

if (answer.data.length === 0) {
  console.error("No property matched that address, or Houski inferred every fact selected for it.");
  process.exit(1);
}

const home = answer.data[0];
console.log(`Address: ${home.address}`);

// A field with no value for this home is left out of the row. Leave that form box
// empty for the applicant to fill in.
for (const field of QUOTE_FORM_FIELDS) {
  console.log(`${field}: ${home[field] ?? "(not known, ask the applicant)"}`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
