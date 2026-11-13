//! Return only values from public records with the Houski property data API.
//!
//! Houski estimates a value where no record states it, so nearly every home has
//! one. Many fields have a matching _source field that says where the value came
//! from: a link to the public record it was read from, Observed, Estimate or
//! User. exclude=estimates leaves the estimated values out of the answer, and a
//! value that is left out is not billed.
//!
//! Usage: cargo run -r --example public_record_values_only

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

// /properties with exclude: checked_fields lists the selected fields whose source was checked.
#[derive(Deserialize)]
struct PropertiesAnswer {
    data: Vec<MeasuredHome>,
    result_total: u64,
    pagination: Pagination,
    #[serde(default)]
    checked_fields: Vec<String>,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

/// Where this page sits among the pages of the result.
#[derive(Deserialize)]
struct Pagination {
    current_page: u64,
    page_total: u64,
    has_next_page: bool,
    has_previous_page: bool,
}

// A row always has address and property_id. A field with no value for a home is left out of the row, so every selected field is an Option.
#[derive(Deserialize)]
struct MeasuredHome {
    address: String,
    property_id: String,
    interior_sq_m: Option<f64>,
    interior_sq_m_source: Option<String>,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

fn main() {
    let answer: PropertiesAnswer = houski(
        "properties",
        &[
            ("country_abbreviation", "nl"),
            ("province_abbreviation", "nho"),
            ("city", "amsterdam"),
            ("select", "interior_sq_m,interior_sq_m_source"),
            // estimates leaves out the values Houski worked out. exclude=estimates,observed
            // keeps only the values read from a linked public record.
            ("exclude", "estimates"),
            ("results_per_page", "5"),
        ],
    );

    println!("Fields checked for their source: {}", answer.checked_fields.join(", "));

    for home in &answer.data {
        // A home whose floor area was an estimate still comes back, with the value left out.
        println!(
            "{}: {} square metres, source {}",
            home.address,
            shown(&home.interior_sq_m, "no recorded floor area"),
            shown(&home.interior_sq_m_source, "none")
        );
    }

    println!("Cost: {} cents", answer.cost_cents);
}
