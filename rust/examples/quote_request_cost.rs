//! Quote the cost of a request before running it with the Houski property data API.
//!
//! Houski bills for the values a request returns, never for how much was
//! searched. Adding price_quote=true to any request returns what it would cost,
//! with no data and no charge. This program quotes a property search, then runs
//! it only if the cost is under a limit.
//!
//! Usage: cargo run -r --example quote_request_cost

use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::env;

const MOST_CENTS_TO_SPEND: f64 = 25.0;

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

/// The answer of /properties.
#[derive(Deserialize)]
struct PropertiesAnswer {
    data: Vec<SearchedHome>,
    result_total: u64,
    pagination: Pagination,
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
struct SearchedHome {
    address: String,
    property_id: String,
    bedroom: Option<f64>,
    bathroom_full: Option<f64>,
    interior_sq_m: Option<f64>,
    estimate_list_price: Option<f64>,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

fn main() {
    let search: [(&str, &str); 9] = [
        ("country_abbreviation", "ca"),
        ("province_abbreviation", "ab"),
        ("city", "calgary"),
        ("property_type_eq", "House"),
        ("bedroom_gte", "3"),
        ("estimate_list_price_lte", "600000"),
        ("estimate_list_price_sort", "asc"),
        // Selecting only the fields the code uses is the biggest saving.
        ("select", "bedroom,bathroom_full,interior_sq_m,estimate_list_price"),
        ("results_per_page", "25"),
    ];

    let mut quote_parameters: Vec<(&str, &str)> = vec![("price_quote", "true")];
    quote_parameters.extend_from_slice(&search);
    let quote: PropertiesAnswer = houski("properties", &quote_parameters);
    println!("{} homes match. This page would cost {} cents.", quote.result_total, quote.cost_cents);

    if quote.cost_cents > MOST_CENTS_TO_SPEND {
        eprintln!("That is over the limit of {MOST_CENTS_TO_SPEND} cents, so the request was not run.");
        std::process::exit(1);
    }

    let answer: PropertiesAnswer = houski("properties", &search);
    for home in &answer.data {
        println!(
            "{}: {} bedrooms, {} square metres, {}",
            home.address,
            shown(&home.bedroom, "not known"),
            shown(&home.interior_sq_m, "not known"),
            shown(&home.estimate_list_price, "not known")
        );
    }

    println!("Cost: {} cents", answer.cost_cents);
}
