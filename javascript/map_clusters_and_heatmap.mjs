/*
Property map clusters and a price heatmap with the Houski property data API.

For one bounding box, prints the clusters a zoomed out map would draw, then
the cells of a heatmap shaded by median estimated list price.

Usage: node map_clusters_and_heatmap.mjs
*/

const API_URL = process.env.HOUSKI_API_URL ?? "https://api.houski.ca";
const API_KEY = process.env.HOUSKI_API_KEY;
if (!API_KEY) {
  console.error("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
  process.exit(1);
}

// The north east and south west corners of the map view, here central Calgary.
const BOUNDING_BOX = { bbox_ne_lat: 51.10, bbox_ne_lng: -113.90, bbox_sw_lat: 50.90, bbox_sw_lng: -114.20 };

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

// Clusters: at most ten, each with a centre and the number of properties in it.
const clustered = await houski("map", { cluster: "true", property_type_eq: "House", ...BOUNDING_BOX });
for (const cluster of clustered.data.clusters) {
  console.log(`Cluster at ${cluster.latitude}, ${cluster.longitude}: ${cluster.number_of_properties} houses`);
}

// Heatmap: one cell per patch of the box. aggregation_value is the median price
// of the cell, and intensity is that value scaled from 0 to 1 for shading.
const heatmap = await houski("map", {
  heatmap: "true",
  heatmap_aggregation_field: "estimate_list_price",
  heatmap_aggregation_type: "median",
  heatmap_cell_limit: 100,
  ...BOUNDING_BOX,
});
for (const cell of heatmap.data.heatmap.slice(0, 10)) {
  console.log(`Cell at ${cell.latitude}, ${cell.longitude}: median ${cell.aggregation_value ?? "not known"}, intensity ${cell.intensity}`);
}

console.log(`Cost: ${clustered.cost_cents + heatmap.cost_cents} cents`);
