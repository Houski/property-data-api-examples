//! Screen homes for sale as investments with the Houski property data API.
//!
//! Lists the houses for sale in a city with the highest cap rate first, and marks
//! the ones whose list price sits below the estimated list price.
//!
//! Usage: cargo run -r --example investment_property_screen -- ca ab calgary

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
    data: Vec<ForSaleHome>,
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
struct ForSaleHome {
    address: String,
    property_id: String,
    list_price: Option<f64>,
    estimate_list_price: Option<f64>,
    estimate_rent_monthly: Option<f64>,
    cap_rate: Option<f64>,
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
    let province = arguments.next().unwrap_or_else(|| "ab".to_string());
    let city = arguments.next().unwrap_or_else(|| "calgary".to_string());

    let answer: PropertiesAnswer = houski(
        "properties",
        &[
            ("country_abbreviation", country.as_str()),
            ("province_abbreviation", province.as_str()),
            ("city", city.as_str()),
            // Filters are a field name, an operator suffix and a value.
            ("for_sale_eq", "true"),
            ("property_type_eq", "House"),
            // One sort per request. Homes with no cap rate sort last.
            ("cap_rate_sort", "desc"),
            ("select", "list_price,estimate_list_price,estimate_rent_monthly,cap_rate"),
            ("results_per_page", "25"),
        ],
    );

    for home in &answer.data {
        let below_estimate = match (home.list_price, home.estimate_list_price) {
            (Some(list_price), Some(estimate)) if list_price != 0.0 && estimate != 0.0 && list_price < estimate => "  below estimate",
            _ => "",
        };
        println!(
            "{}: cap rate {}, list price {}, estimate {}, rent {}{}",
            home.address,
            shown(&home.cap_rate, "not known"),
            shown(&home.list_price, "not known"),
            shown(&home.estimate_list_price, "not known"),
            shown(&home.estimate_rent_monthly, "not known"),
            below_estimate
        );
    }

    println!("{} houses for sale. Cost of this page: {} cents", answer.result_total, answer.cost_cents);
}
