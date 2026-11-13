/*
Median home price and home count by community with the Houski property data API.

Reads the communities of a city from /location, then asks /aggregate for the
median estimated list price and the number of houses in each one, all in a
single batched request.

Usage: node market_statistics_by_community.ts ca ab calgary

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx market_statistics_by_community.ts.
*/

const API_URL = process.env.HOUSKI_API_URL ?? "https://api.houski.ca";
const API_KEY = process.env.HOUSKI_API_KEY ?? "";
if (API_KEY === "") {
  console.error("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
  process.exit(1);
}

type RequestParameters = Record<string, string | number | boolean>;

// Send one GET request to the Houski API and return the parsed JSON answer.
async function houski<Answer>(endpoint: string, parameters: RequestParameters = {}): Promise<Answer> {
  const query = new URLSearchParams({ api_key: API_KEY, ...parameters } as Record<string, string>);
  const response = await fetch(`${API_URL}/${endpoint}?${query}`);
  if (!response.ok) {
    console.error(`Houski answered ${response.status}: ${await response.text()}`);
    process.exit(1);
  }
  return response.json() as Promise<Answer>;
}

// Every billed answer carries these keys. A failure has the same shape with an empty data and a filled error.
interface AnswerEnvelope {
  error: string;
  time_ms: number;
  cost_cents: number;
  cache_hit: boolean;
  price_quote: boolean;
}

// /aggregate: one entry per statistic, in the order asked. Every value is a string.
interface AggregateAnswer extends AnswerEnvelope {
  data: { field: string; aggregation: string; value: string }[];
}

// /location with flat=true: one entry per place. Keys of levels below the resolution are absent.
interface FlatLocation {
  country?: string;
  country_abbreviation?: string;
  province?: string;
  province_abbreviation?: string;
  city?: string;
  city_slug?: string;
  community?: string;
  community_slug?: string;
}
interface LocationAnswer extends AnswerEnvelope {
  data: { flat: FlatLocation[] };
  result_total: number;
}

const [country = "ca", province = "ab", city = "calgary"] = process.argv.slice(2);
const place = { country_abbreviation: country, province_abbreviation: province, city: city };

// Step 1: the communities of the city. Places always come from /location, never
// from a list written into the code.
const locations = await houski<LocationAnswer>("location", { resolution: "community", flat: "true", ...place });
const communities = locations.data.flat
  .flatMap((location) => (location.community ? [location.community] : []))
  .slice(0, 5);

// Step 2: two statistics per community in one request. In a batch, every
// parameter carries the agg0_, agg1_ prefix of the statistic it belongs to,
// numbered from 0 with no gaps.
const parameters: RequestParameters = {};
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

const statistics = await houski<AggregateAnswer>("aggregate", parameters);

// The answers come back in the order they were asked, and every value is a string.
for (const [index, community] of communities.entries()) {
  const median = statistics.data[index * 2];
  const count = statistics.data[index * 2 + 1];
  console.log(`${community}: median estimated list price ${median.value}, ${count.value} houses`);
}

console.log(`Cost: ${locations.cost_cents + statistics.cost_cents} cents`);
