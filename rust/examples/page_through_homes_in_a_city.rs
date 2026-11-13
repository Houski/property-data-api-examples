//! Page through every home in a city with the Houski property data API.
//!
//! Walks the result of one search page by page, following has_next_page, which
//! is how to pull a whole city or load a database. Each page is billed for the
//! values it returns, so this program stops after a set number of pages. Raise
//! MOST_PAGES to pull more.
//!
//! Usage: cargo run -r --example page_through_homes_in_a_city -- ca ab calgary

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
    data: Vec<PricedHome>,
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
struct PricedHome {
    address: String,
    property_id: String,
    estimate_list_price: Option<f64>,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

const MOST_PAGES: u64 = 3;

fn main() {
    let mut arguments = env::args().skip(1);
    let country = arguments.next().unwrap_or_else(|| "ca".to_string());
    let province = arguments.next().unwrap_or_else(|| "ab".to_string());
    let city = arguments.next().unwrap_or_else(|| "calgary".to_string());

    let mut page: u64 = 1;
    let mut homes_read: u64 = 0;
    let mut cents_spent: f64 = 0.0;
    let mut result_total: u64 = 0;

    while page <= MOST_PAGES {
        let page_number = page.to_string();
        let answer: PropertiesAnswer = houski(
            "properties",
            &[
                ("country_abbreviation", country.as_str()),
                ("province_abbreviation", province.as_str()),
                ("city", city.as_str()),
                ("select", "estimate_list_price"),
                // results_per_page goes up to 1000. One response holds at most 10,000 values,
                // counted as rows times columns with address and property_id included.
                ("results_per_page", "50"),
                ("page", page_number.as_str()),
            ],
        );

        for home in &answer.data {
            println!("{} {}: {}", home.property_id, home.address, shown(&home.estimate_list_price, "not known"));
        }

        homes_read += answer.data.len() as u64;
        cents_spent += answer.cost_cents;
        result_total = answer.result_total;

        // has_next_page says whether another page follows this one.
        match answer.pagination.has_next_page {
            true => page += 1,
            false => break,
        }
    }

    println!("Read {homes_read} of {result_total} homes. Cost: {cents_spent} cents");
}
