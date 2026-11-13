/*
Count homes and find the median price inside a polygon with the Houski property data API.

Draw any area as a list of points, such as a sales territory, a flood zone or
a school catchment, and /aggregate answers for the homes inside it.

Usage: node statistics_inside_a_polygon.mjs
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

// The corners of the area as (latitude, longitude), here a few blocks of central Calgary. At most 100 points.
const CORNERS = [[51.050, -114.090], [51.050, -114.050], [51.030, -114.050], [51.030, -114.090]];

// A polygon is written lat_lng,lat_lng,lat_lng with an underscore inside each point and commas between points.
const polygon = CORNERS.map(([latitude, longitude]) => `${latitude}_${longitude}`).join(",");

// Two statistics in one request. In a batch, every parameter carries the agg0_, agg1_
// prefix of its statistic. Only polygon and price_quote stay bare.
const answer = await houski("aggregate", {
  polygon: polygon,
  agg0_field: "property_id",
  agg0_aggregation: "count",
  agg1_field: "estimate_list_price",
  agg1_aggregation: "median",
});

const [count, median] = answer.data;
console.log(`Homes inside the polygon: ${count.value}`);
console.log(`Median estimated list price: ${median.value}`);
console.log(`Cost: ${answer.cost_cents} cents`);
