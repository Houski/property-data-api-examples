//! Address autocomplete with the Houski property data API.
//!
//! Prints address suggestions for a partly typed address, best match first. Call
//! this from your own server as the visitor types, so the API key never reaches
//! the browser.
//!
//! Usage: cargo run -r --example address_autocomplete -- "100 main cal"

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

/// The answer of /search.
#[derive(Deserialize)]
struct SearchAnswer {
    data: Vec<AddressSuggestion>,
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
struct AddressSuggestion {
    address: String,
    property_id: String,
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

/// Return up to five suggestions as (address, property_id, match score).
fn suggest_addresses(typed_text: &str, country_abbreviation: Option<&str>) -> Vec<(String, String, Option<f64>)> {
    let mut parameters: Vec<(&str, &str)> = vec![("query", typed_text), ("max_results", "5")];
    match country_abbreviation {
        Some(country_abbreviation) => parameters.push(("country_abbreviation", country_abbreviation)),
        None => {}
    }

    // With no select, a result carries only address and property_id, the least expensive answer.
    let answer: SearchAnswer = houski("search", &parameters);

    // match_meta holds one match score per result, keyed by property_id.
    let mut suggestions: Vec<(String, String, Option<f64>)> = Vec::new();
    for home in &answer.data {
        let score = answer.match_meta.iter().rev().find(|meta| meta.property_id == home.property_id).map(|meta| meta.match_value);
        suggestions.push((home.address.clone(), home.property_id.clone(), score));
    }
    suggestions
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let typed_text = match arguments.is_empty() {
        true => "100 main cal".to_string(),
        false => arguments.join(" "),
    };

    for (address, property_id, score) in suggest_addresses(&typed_text, None) {
        println!("{address}  (property_id {property_id}, match {})", shown(&score, "not known"));
    }
}
