//! Find homes by building permit history with the Houski property data API.
//!
//! Lists homes in a city that had a roofing permit since a given date, with the
//! matching permits attached. Change the pattern to find any other kind of work,
//! such as solar, furnace or basement.
//!
//! Usage: cargo run -r --example find_homes_by_permit -- roof 2024-01-01

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

/// The answer of /properties.
#[derive(Deserialize)]
struct PropertiesAnswer {
    data: Vec<HomeWithPermits>,
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
struct HomeWithPermits {
    address: String,
    property_id: String,
    construction_year: Option<f64>,
    #[serde(default)]
    permits: Vec<Permit>,
}

/// One permit row, attached to its property by expand=permits.
#[derive(Deserialize)]
struct Permit {
    expand_permit_id: String,
    expand_permit_application_date: String,
    expand_permit_type: String,
    expand_permit_content: String,
    expand_permit_value: Option<f64>,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

fn main() {
    let mut arguments = env::args().skip(1);
    let word = arguments.next().unwrap_or_else(|| "roof".to_string());
    let since = arguments.next().unwrap_or_else(|| "2024-01-01".to_string());
    let pattern = format!("(?i){word}");

    let answer: PropertiesAnswer = houski(
        "properties",
        &[
            ("country_abbreviation", "ca"),
            ("province_abbreviation", "ab"),
            ("city", "calgary"),
            // expand attaches each property's permit rows to it.
            ("expand", "permits"),
            // These two filters choose which permit rows count. (?i) ignores case.
            ("expand_permit_application_date_gte", since.as_str()),
            ("expand_permit_content_regex", pattern.as_str()),
            // all keeps only the properties that have a matching permit.
            ("filter_expand_match", "all"),
            ("select", "construction_year"),
            ("results_per_page", "20"),
        ],
    );

    for home in &answer.data {
        println!("{} (built {})", home.address, shown(&home.construction_year, "year not known"));
        for permit in &home.permits {
            println!("  {} {}: {}", permit.expand_permit_application_date, permit.expand_permit_type, permit.expand_permit_content);
        }
    }

    println!("{} homes matched. Cost of this page: {} cents", answer.result_total, answer.cost_cents);
}
