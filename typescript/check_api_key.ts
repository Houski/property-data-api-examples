/*
Check that a Houski API key works.

Calls /auth, which says whether the key exists and is enabled. It is free, so
it is the right first request to make with a new key.

Usage: node check_api_key.ts

Node 22.18 or later runs a TypeScript file directly. On an older Node, use npx tsx check_api_key.ts.
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

// /auth: the one answer with no cost, since it is never billed.
interface AuthAnswer {
  api_key_authorized: boolean;
  error: string;
  time_ms: number;
}

const answer = await houski<AuthAnswer>("auth");

if (!answer.api_key_authorized) {
  console.error(`The key was refused: ${answer.error}`);
  process.exit(1);
}

console.log("The key works.");
