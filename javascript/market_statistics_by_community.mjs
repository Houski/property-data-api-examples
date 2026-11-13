/*
Median home price and home count by community with the Houski property data API.

Reads the communities of a city from /location, then asks /aggregate for the
median estimated list price and the number of houses in each one, all in a
single batched request.

Usage: node market_statistics_by_community.mjs ca ab calgary
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

const [country = "ca", province = "ab", city = "calgary"] = process.argv.slice(2);
const place = { country_abbreviation: country, province_abbreviation: province, city: city };

// Step 1: the communities of the city. Places always come from /location, never
// from a list written into the code.
const locations = await houski("location", { resolution: "community", flat: "true", ...place });
const communities = locations.data.flat
  .filter((location) => location.community)
  .map((location) => location.community)
  .slice(0, 5);

// Step 2: two statistics per community in one request. In a batch, every
// parameter carries the agg0_, agg1_ prefix of the statistic it belongs to,
// numbered from 0 with no gaps.
const parameters = {};
for (const [index, community] of communities.entries()) {
  for (const [number, [field, aggregation]] of [["estimate_list_price", "median"], ["property_id", "count"]].entries()) {
    const prefix = `agg${index * 2 + number}_`;
    for (const [name, value] of Object.entries(place)) {
      parameters[prefix + name] = value;
    }
    parameters[prefix + "community_eq"] = community;
    parameters[prefix + "property_type_eq"] = "House";
    parameters[prefix + "field"] = field;
    parameters[prefix + "aggregation"] = aggregation;
  }
}

const statistics = await houski("aggregate", parameters);

// The answers come back in the order they were asked, and every value is a string.
for (const [index, community] of communities.entries()) {
  const median = statistics.data[index * 2];
  const count = statistics.data[index * 2 + 1];
  console.log(`${community}: median estimated list price ${median.value}, ${count.value} houses`);
}

console.log(`Cost: ${locations.cost_cents + statistics.cost_cents} cents`);
