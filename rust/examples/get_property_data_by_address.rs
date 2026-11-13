//! Get property data by address with the Houski property data API.
//!
//! Turns a typed address into one property and prints its facts: property type,
//! bedrooms, bathrooms, floor area, construction year and estimated sale price.
//!
//! Usage: cargo run -r --example get_property_data_by_address -- "100 main calgary"

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
    data: Vec<HomeFacts>,
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
struct HomeFacts {
    address: String,
    property_id: String,
    property_type: Option<String>,
    bedroom: Option<f64>,
    bathroom_full: Option<f64>,
    interior_sq_m: Option<f64>,
    construction_year: Option<f64>,
    estimate_sale_price: Option<f64>,
}

/// The match score of one result.
#[derive(Deserialize)]
struct MatchMeta {
    property_id: String,
    match_value: f64,
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let address = match arguments.is_empty() {
        true => "100 main calgary".to_string(),
        false => arguments.join(" "),
    };

    // /search matches a typed address, typos included, and returns the best matches first.
    // select names the fields to return. Only the values that come back are billed.
    let answer: SearchAnswer = houski(
        "search",
        &[
            ("query", address.as_str()),
            ("max_results", "1"),
            ("select", "property_type,bedroom,bathroom_full,interior_sq_m,construction_year,estimate_sale_price"),
        ],
    );

    let home = match answer.data.first() {
        Some(home) => home,
        None => {
            eprintln!("No property matched that address.");
            std::process::exit(1);
        }
    };

    // A field with no value for this home is left out of the row, so print what came back.
    println!("address: {}", home.address);
    println!("property_id: {}", home.property_id);
    let selected_fields: [(&str, Option<String>); 6] = [
        ("property_type", home.property_type.clone()),
        ("bedroom", home.bedroom.map(|value| value.to_string())),
        ("bathroom_full", home.bathroom_full.map(|value| value.to_string())),
        ("interior_sq_m", home.interior_sq_m.map(|value| value.to_string())),
        ("construction_year", home.construction_year.map(|value| value.to_string())),
        ("estimate_sale_price", home.estimate_sale_price.map(|value| value.to_string())),
    ];
    for (field, value) in &selected_fields {
        match value {
            Some(value) => println!("{field}: {value}"),
            None => {}
        }
    }

    println!("Cost: {} cents", answer.cost_cents);
}
