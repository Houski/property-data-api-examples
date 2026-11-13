/*
Find homes by building permit history with the Houski property data API.

Lists homes in a city that had a roofing permit since a given date, with the
matching permits attached. Change the pattern to find any other kind of work,
such as solar, furnace or basement.

Usage: node find_homes_by_permit.mjs roof 2024-01-01
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

const [word = "roof", since = "2024-01-01"] = process.argv.slice(2);

const answer = await houski("properties", {
  country_abbreviation: "ca",
  province_abbreviation: "ab",
  city: "calgary",
  // expand attaches each property's permit rows to it.
  expand: "permits",
  // These two filters choose which permit rows count. (?i) ignores case.
  expand_permit_application_date_gte: since,
  expand_permit_content_regex: `(?i)${word}`,
  // all keeps only the properties that have a matching permit.
  filter_expand_match: "all",
  select: "construction_year",
  results_per_page: 20,
});

for (const home of answer.data) {
  console.log(`${home.address} (built ${home.construction_year ?? "year not known"})`);
  for (const permit of home.permits ?? []) {
    console.log(`  ${permit.expand_permit_application_date} ${permit.expand_permit_type}: ${permit.expand_permit_content}`);
  }
}

console.log(`${answer.result_total} homes matched. Cost of this page: ${answer.cost_cents} cents`);
