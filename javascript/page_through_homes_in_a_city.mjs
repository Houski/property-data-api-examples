/*
Page through every home in a city with the Houski property data API.

Walks the result of one search page by page, following has_next_page, which
is how to pull a whole city or load a database. Each page is billed for the
values it returns, so this program stops after a set number of pages. Raise
MOST_PAGES to pull more.

Usage: node page_through_homes_in_a_city.mjs ca ab calgary
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

const MOST_PAGES = 3;

const [country = "ca", province = "ab", city = "calgary"] = process.argv.slice(2);

let page = 1;
let homesRead = 0;
let centsSpent = 0;
let answer;

while (page <= MOST_PAGES) {
  answer = await houski("properties", {
    country_abbreviation: country,
    province_abbreviation: province,
    city: city,
    select: "estimate_list_price",
    // results_per_page goes up to 1000. One response holds at most 10,000 values,
    // counted as rows times columns with address and property_id included.
    results_per_page: 50,
    page: page,
  });

  for (const home of answer.data) {
    console.log(`${home.property_id} ${home.address}: ${home.estimate_list_price ?? "not known"}`);
  }

  homesRead += answer.data.length;
  centsSpent += answer.cost_cents;

  // has_next_page says whether another page follows this one.
  if (!answer.pagination.has_next_page) {
    break;
  }
  page += 1;
}

console.log(`Read ${homesRead} of ${answer.result_total} homes. Cost: ${centsSpent} cents`);
