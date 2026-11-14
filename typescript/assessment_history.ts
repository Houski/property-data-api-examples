/*
Get the tax assessment history of a home with the Houski property data API.

Finds a home by its address, then reads its assessed value for each year on
record, beside its current assessed value and property taxes.

Usage: node assessment_history.ts "100 main calgary"

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx assessment_history.ts.
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

interface Pagination {
  current_page: number;
  page_total: number;
  has_next_page: boolean;
  has_previous_page: boolean;
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

// An assessment row attached by expand=assessments.
interface Assessment {
  expand_assessment_year: number;
  expand_assessment_value: number;
}

// A row always has address and property_id. A field with no value for a home is left out of the row.
interface AssessedHome {
  address: string;
  property_id: string;
  assessment_value?: number;
  assessment_value_source?: string;
  property_taxes?: number;
  assessments?: Assessment[];
}

// /properties: one row per property.
interface PropertiesAnswer<Row> extends AnswerEnvelope {
  data: Row[];
  result_total: number;
  pagination: Pagination;
}

const address = process.argv.slice(2).join(" ") || "100 main calgary";

const found = await houski<SearchAnswer<FoundHome>>("search", { query: address, max_results: 1 });
if (found.data.length === 0) {
  console.error("No property matched that address.");
  process.exit(1);
}

// property_id_eq reads one property. expand attaches its assessment rows, one per year.
const answer = await houski<PropertiesAnswer<AssessedHome>>("properties", {
  property_id_eq: found.data[0].property_id,
  expand: "assessments",
  // assessment_value_source says where the assessed value came from, often a link to the roll.
  select: "assessment_value,assessment_value_source,property_taxes",
  // exclude=inferred leaves out an assessed value or property taxes Houski worked out.
  // Remove exclude to get the inferred values back.
  exclude: "inferred",
});

if (answer.data.length === 0) {
  console.error("Houski inferred both the assessed value and the property taxes of that home. Remove exclude to see them.");
  process.exit(1);
}

const home = answer.data[0];
console.log(`${home.address}: assessed at ${home.assessment_value ?? "(not known)"} (source ${home.assessment_value_source ?? "none"}), property taxes ${home.property_taxes ?? "(not known)"}`);
for (const assessment of [...(home.assessments ?? [])].sort((a, b) => a.expand_assessment_year - b.expand_assessment_year)) {
  console.log(`  ${assessment.expand_assessment_year}: ${assessment.expand_assessment_value}`);
}

console.log(`Cost: ${found.cost_cents + answer.cost_cents} cents`);
