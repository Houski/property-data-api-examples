//! Find homes for rent with their rental listing history with the Houski property data API.
//!
//! Lists homes that are for rent in a city, each with its rental listing events
//! attached: the date, the event and the monthly rent asked.
//!
//! Usage: cargo run -r --example homes_for_rent_with_rental_listings -- ca bc vancouver

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

// /properties: one row per property.
#[derive(Deserialize)]
struct PropertiesAnswer {
    data: Vec<HomeForRent>,
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
struct HomeForRent {
    address: String,
    property_id: String,
    property_type: Option<String>,
    bedroom: Option<f64>,
    estimate_rent_monthly: Option<f64>,
    #[serde(default)]
    listings_rent: Vec<RentalListing>,
}

// A rental listing row attached by expand=listings_rent.
#[derive(Deserialize)]
struct RentalListing {
    expand_listing_rent_date: Option<String>,
    expand_listing_rent_event: Option<String>,
    expand_estimate_rent_monthly: Option<f64>,
    expand_for_rent_what_is: Option<String>,
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
    let country = arguments.next().unwrap_or_else(|| "ca".to_string());
    let province = arguments.next().unwrap_or_else(|| "bc".to_string());
    let city = arguments.next().unwrap_or_else(|| "vancouver".to_string());

    let answer: PropertiesAnswer = houski(
        "properties",
        &[
            ("country_abbreviation", country.as_str()),
            ("province_abbreviation", province.as_str()),
            ("city", city.as_str()),
            ("for_rent_eq", "true"),
            // expand attaches each property's rental listing rows to it. Each row is billed.
            ("expand", "listings_rent"),
            ("select", "property_type,bedroom,estimate_rent_monthly"),
            ("results_per_page", "5"),
        ],
    );

    for home in &answer.data {
        println!(
            "{}: {}, {} bedrooms, estimated rent {}",
            home.address,
            shown(&home.property_type, "not known"),
            shown(&home.bedroom, "not known"),
            shown(&home.estimate_rent_monthly, "not known")
        );
        for listing in &home.listings_rent {
            println!(
                "  {} {}: {} a month",
                shown(&listing.expand_listing_rent_date, "not known"),
                shown(&listing.expand_listing_rent_event, "not known"),
                shown(&listing.expand_estimate_rent_monthly, "not known")
            );
        }
    }

    println!("{} homes for rent. Cost of this page: {} cents", answer.result_total, answer.cost_cents);
}
