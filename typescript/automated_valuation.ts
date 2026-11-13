/*
Get an automated valuation of a home with the Houski property data API.

Finds a home by its address, quotes the valuation for free, and runs it only
when --yes is given, because a valuation costs $5.00. The valuation holds the
estimated sale price, list price and monthly rent, each with a confidence
score, plus warning flags and a link to a report.

Usage: node automated_valuation.ts "100 main calgary"
       node automated_valuation.ts "100 main calgary" --yes

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx automated_valuation.ts.
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

// With no select, a row carries only address and property_id.
interface FoundHome {
  address: string;
  property_id: string;
}

// /search: the best matches first, with one match score per result in match_meta.
interface SearchAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  match_meta: { property_id: string; match_value: number }[];
  result_total: number;
}

// One of the three valuations of a home.
interface SingleValuation {
  value: number;
  confidence_score: number;
}

// The valuation itself. It holds more keys than these, such as the facts of the home, a price history and the area's scores.
interface Valuation {
  property_id: string;
  valuation_date: string;
  estimate_sale_price: SingleValuation;
  estimate_list_price: SingleValuation;
  estimate_rent_monthly: SingleValuation;
  property_warning_flags: { warning: string; description: string }[];
}

// /avm: url is the link to the report of this valuation.
interface AvmAnswer extends AnswerEnvelope {
  data: Valuation;
  url: string;
}

const allArguments = process.argv.slice(2);
const approved = allArguments.includes("--yes");
const address = allArguments.filter((argument) => argument !== "--yes").join(" ") || "100 main calgary";

const found = await houski<SearchAnswer<FoundHome>>("search", { query: address, max_results: 1 });
if (found.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}
const home = found.data[0];

// price_quote=true returns what the valuation would cost, and charges nothing.
const quote = await houski<AvmAnswer>("avm", { property_id: home.property_id, price_quote: "true" });
console.log(`A valuation of ${home.address} costs ${quote.cost_cents} cents.`);

// Never run a valuation without the yes of the person who pays for it.
if (!approved) {
  console.error("Run again with --yes to buy the valuation.");
  process.exit(1);
}

const answer = await houski<AvmAnswer>("avm", { property_id: home.property_id });
const valuation = answer.data;

console.log(`Valued on ${valuation.valuation_date}`);
for (const field of ["estimate_sale_price", "estimate_list_price", "estimate_rent_monthly"] as const) {
  console.log(`${field}: ${valuation[field].value} (confidence ${valuation[field].confidence_score})`);
}
for (const flag of valuation.property_warning_flags) {
  console.log(`Warning, ${flag.warning}: ${flag.description}`);
}
console.log(`Report: ${answer.url}`);
console.log(`Cost: ${answer.cost_cents} cents`);
