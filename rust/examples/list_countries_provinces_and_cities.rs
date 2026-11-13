//! List the countries, provinces or states, and cities the Houski property data API covers.
//!
//! Places are never written into code. /location returns the ones that hold
//! data, so menus and validation stay right as coverage grows. This program
//! prints every country, then the provinces or states of one country, then the
//! first cities of one province or state.
//!
//! Usage: cargo run -r --example list_countries_provinces_and_cities -- ca ab

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

/// The answer of /location with flat=true.
#[derive(Deserialize)]
struct LocationAnswer {
    data: LocationData,
    result_total: u64,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

/// The places of the answer as one flat list.
#[derive(Deserialize)]
struct LocationData {
    flat: Vec<FlatLocation>,
}

// /location with flat=true: one entry per place. Keys of levels below the resolution are absent.
#[derive(Deserialize)]
struct FlatLocation {
    country: Option<String>,
    country_abbreviation: Option<String>,
    province: Option<String>,
    province_abbreviation: Option<String>,
    city: Option<String>,
    city_slug: Option<String>,
    community: Option<String>,
    community_slug: Option<String>,
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

    // resolution says which level to list. flat=true returns a plain list instead of a nested tree.
    let countries: LocationAnswer = houski("location", &[("resolution", "country"), ("flat", "true")]);
    println!("Countries:");
    for place in &countries.data.flat {
        println!("  {} ({})", shown(&place.country, "not known"), shown(&place.country_abbreviation, "not known"));
    }

    // Each level needs every level above it, so provinces need their country.
    let provinces: LocationAnswer = houski("location", &[("resolution", "province"), ("flat", "true"), ("country_abbreviation", country.as_str())]);
    println!("Provinces or states of {country}:");
    for place in &provinces.data.flat {
        println!("  {} ({})", shown(&place.province, "not known"), shown(&place.province_abbreviation, "not known"));
    }

    // /location has no paging, so always scope it. The slug of a city works as the city value of other requests.
    let cities: LocationAnswer = houski(
        "location",
        &[("resolution", "city"), ("flat", "true"), ("country_abbreviation", country.as_str()), ("province_abbreviation", province.as_str())],
    );
    println!("{} cities in {province}. The first ten:", cities.result_total);
    for place in cities.data.flat.iter().take(10) {
        println!("  {} (city={})", shown(&place.city, "not known"), shown(&place.city_slug, "not known"));
    }

    println!("Cost: {} cents", countries.cost_cents + provinces.cost_cents + cities.cost_cents);
}
