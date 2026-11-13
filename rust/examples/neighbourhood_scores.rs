//! Get the neighbourhood scores of an address with the Houski property data API.
//!
//! Prints how the area around a home rates for walkability, transit, schools,
//! safety and quiet. Each score runs from 0 to 10 and higher is always better.
//!
//! Usage: cargo run -r --example neighbourhood_scores -- "100 main calgary"

use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::env;

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

const SCORES: [&str; 6] = ["score_total", "score_walkability", "score_transit", "score_education", "score_safety", "score_quiet"];

// /search: the best matches first, with one match score per result in match_meta.
#[derive(Deserialize)]
struct SearchAnswer {
    data: Vec<ScoredHome>,
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
struct ScoredHome {
    address: String,
    property_id: String,
    score_total: Option<f64>,
    score_walkability: Option<f64>,
    score_transit: Option<f64>,
    score_education: Option<f64>,
    score_safety: Option<f64>,
    score_quiet: Option<f64>,
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
    let select = SCORES.join(",");

    let answer: SearchAnswer = houski("search", &[("query", address.as_str()), ("max_results", "1"), ("select", select.as_str())]);

    let home = match answer.data.first() {
        Some(home) => home,
        None => {
            eprintln!("No property matched that address.");
            std::process::exit(1);
        }
    };
    println!("Address: {}", home.address);
    // The values in the order of SCORES.
    let values: [Option<f64>; 6] = [home.score_total, home.score_walkability, home.score_transit, home.score_education, home.score_safety, home.score_quiet];
    for (score, value) in SCORES.iter().zip(values.iter()) {
        println!("{score}: {} out of 10", shown(value, "(not known)"));
    }

    println!("Cost: {} cents", answer.cost_cents);
}
