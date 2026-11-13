//! Find properties near a latitude and longitude with the Houski property data API.
//!
//! Lists the houses within a radius of a point, nearest first. Use it for
//! "homes near me", for comparable properties around an address, or to turn a
//! map click into the properties around it.
//!
//! Usage: cargo run -r --example find_properties_near_point -- 51.0447 -114.0719 0.5

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

// /geocoding: one row per property, nearest first, paged like /properties.
#[derive(Deserialize)]
struct GeocodingAnswer {
    data: Vec<NearbyHome>,
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
struct NearbyHome {
    address: String,
    property_id: String,
    bedroom: Option<f64>,
    bathroom_full: Option<f64>,
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
    let mut arguments = env::args().skip(1);
    let latitude = arguments.next().unwrap_or_else(|| "51.0447".to_string());
    let longitude = arguments.next().unwrap_or_else(|| "-114.0719".to_string());
    let radius_km = arguments.next().unwrap_or_else(|| "0.5".to_string());

    let answer: GeocodingAnswer = houski(
        "geocoding",
        &[
            ("latitude", latitude.as_str()),
            ("longitude", longitude.as_str()),
            // The radius is in kilometres. shape is circle, the default, or square.
            ("radius", radius_km.as_str()),
            ("shape", "circle"),
            // /geocoding takes no place parameters. Filters narrow it the same way as on /properties.
            ("property_type_eq", "House"),
            ("select", "bedroom,bathroom_full,estimate_list_price"),
            ("results_per_page", "10"),
        ],
    );

    for home in &answer.data {
        println!(
            "{}: {} bedrooms, {} full bathrooms, {}",
            home.address,
            shown(&home.bedroom, "not known"),
            shown(&home.bathroom_full, "not known"),
            shown(&home.estimate_list_price, "not known")
        );
    }

    println!("{} houses within {radius_km} km. Cost of this page: {} cents", answer.result_total, answer.cost_cents);
}
