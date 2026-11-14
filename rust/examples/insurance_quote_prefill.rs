//! Pre-fill an insurance quote form from an address with the Houski property data API.
//!
//! One request returns the facts an insurer asks a home owner for: property type,
//! construction year, floor area, roof material, and the flood and fire scores of
//! the area. Each score runs from 0 to 10 and higher is better, so a high
//! score_flood means the area floods less often.
//!
//! Usage: cargo run -r --example insurance_quote_prefill -- "100 main calgary"

use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::env;

const QUOTE_FORM_FIELDS: [&str; 6] = ["property_type", "construction_year", "interior_sq_m", "roof_material", "score_flood", "score_fire"];

/// Send one GET request to the Houski API and return the parsed JSON answer.
fn houski<Answer: DeserializeOwned>(endpoint: &str, parameters: &[(&str, &str)]) -> Answer {
    let api_url = env::var("HOUSKI_API_URL").unwrap_or_else(|_| "https://api.houski.ca".to_string());
    let api_key = match env::var("HOUSKI_API_KEY") {
        Ok(api_key) => api_key,
        Err(_) => {
            eprintln!("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api");
            std::process::exit(1);
        }
    };
    let mut request = ureq::get(&format!("{api_url}/{endpoint}")).query("api_key", &api_key);
    for (name, value) in parameters {
        request = request.query(name, value);
    }
    match request.call() {
        Ok(response) => response.into_json().expect("the answer has the documented shape"),
        Err(ureq::Error::Status(code, response)) => {
            eprintln!("Houski answered {code}: {}", response.into_string().unwrap_or_default());
            std::process::exit(1);
        }
        Err(error) => {
            eprintln!("The request did not reach Houski: {error}");
            std::process::exit(1);
        }
    }
}

/// The answer of /search.
#[derive(Deserialize)]
struct SearchAnswer {
    data: Vec<QuoteFormHome>,
    match_meta: Vec<MatchMeta>,
    result_total: u64,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

// A row always has address and property_id. A field with no value for a home is left out of the row, so every selected field is an Option.
#[derive(Deserialize)]
struct QuoteFormHome {
    address: String,
    property_id: String,
    property_type: Option<String>,
    construction_year: Option<f64>,
    interior_sq_m: Option<f64>,
    roof_material: Option<String>,
    score_flood: Option<f64>,
    score_fire: Option<f64>,
}

/// The match score of one result.
#[derive(Deserialize)]
struct MatchMeta {
    property_id: String,
    match_value: f64,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let address = match arguments.is_empty() {
        true => "100 main calgary".to_string(),
        false => arguments.join(" "),
    };
    let select = QUOTE_FORM_FIELDS.join(",");

    // exclude=inferred leaves out the facts Houski worked out, so a box is pre-filled only with a fact stated
    // for this home. The scores have no source field and are untouched. Remove exclude to pre-fill inferred facts too.
    let answer: SearchAnswer = houski(
        "search",
        &[("query", address.as_str()), ("max_results", "1"), ("select", select.as_str()), ("exclude", "inferred")],
    );

    let home = match answer.data.first() {
        Some(home) => home,
        None => {
            eprintln!("No property matched that address, or Houski inferred every fact selected for it.");
            std::process::exit(1);
        }
    };
    println!("Address: {}", home.address);

    // A field with no value for this home is left out of the row. Leave that form box
    // empty for the applicant to fill in.
    let fallback = "(not known, ask the applicant)";
    let quote_form_values: [String; 6] = [
        shown(&home.property_type, fallback),
        shown(&home.construction_year, fallback),
        shown(&home.interior_sq_m, fallback),
        shown(&home.roof_material, fallback),
        shown(&home.score_flood, fallback),
        shown(&home.score_fire, fallback),
    ];
    for (field, value) in QUOTE_FORM_FIELDS.iter().zip(quote_form_values.iter()) {
        println!("{field}: {value}");
    }

    println!("Cost: {} cents", answer.cost_cents);
}
