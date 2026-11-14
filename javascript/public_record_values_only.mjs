/*
Return only values from public records with the Houski property data API.

Houski infers a value where no record states it, so nearly every home has
one. Many fields have a matching _source field that says where the value came
from: a link to the public record it was read from, Observed, Inferred or
User. exclude=inferred leaves the inferred values out of the answer, and a
value that is left out is not billed.

Usage: node public_record_values_only.mjs
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

const answer = await houski("properties", {
  country_abbreviation: "us",
  province_abbreviation: "tx",
  city: "austin",
  select: "interior_sq_m,interior_sq_m_source",
  // inferred leaves out the values Houski worked out. exclude=inferred,observed
  // keeps only the values read from a linked public record.
  exclude: "inferred",
  results_per_page: 5,
});

console.log(`Fields checked for their source: ${(answer.checked_fields ?? []).join(", ")}`);

for (const home of answer.data) {
  // A home whose floor area was inferred is left out of the answer, and is not counted or billed.
  console.log(`${home.address}: ${home.interior_sq_m ?? "no recorded floor area"} square metres, source ${home.interior_sq_m_source ?? "none"}`);
}

console.log(`Cost: ${answer.cost_cents} cents`);
