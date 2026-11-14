//! Find recent home sales in a city with the Houski property data API.
//!
//! Lists homes with a Sold event in the last 90 days, each with the matching
//! sale rows attached: the date and the price.
//!
//! Usage: cargo run -r --example recent_home_sales -- gb eng manchester

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
    data: Vec<SoldHome>,
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
struct SoldHome {
    address: String,
    property_id: String,
    property_type: Option<String>,
    interior_sq_m: Option<f64>,
    #[serde(default)]
    listings: Vec<ListingEvent>,
}

// A listing row attached by expand=listings. The event is Listed, Sold and so on.
#[derive(Deserialize)]
struct ListingEvent {
    expand_listing_date: Option<String>,
    expand_listing_event: Option<String>,
    expand_estimate_list_price: Option<f64>,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

// The year, month and day of a count of days since 1970-01-01, by the days-to-civil algorithm for the proleptic Gregorian calendar (400 year eras of 146,097 days, with the year starting in March).
fn civil_date_from_days(days_since_unix_epoch: i64) -> (i64, i64, i64) {
    let shifted_days = days_since_unix_epoch + 719_468;
    let era = shifted_days.div_euclid(146_097);
    let day_of_era = shifted_days.rem_euclid(146_097);
    let year_of_era = (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_from_march = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_from_march + 2) / 5 + 1;
    let month = match month_from_march < 10 {
        true => month_from_march + 3,
        false => month_from_march - 9,
    };
    let year = match month <= 2 {
        true => year_of_era + era * 400 + 1,
        false => year_of_era + era * 400,
    };
    (year, month, day)
}

fn main() {
    let mut arguments = env::args().skip(1);
    let country = arguments.next().unwrap_or_else(|| "gb".to_string());
    let province = arguments.next().unwrap_or_else(|| "eng".to_string());
    let city = arguments.next().unwrap_or_else(|| "manchester".to_string());

    // Dates are written yyyy-mm-dd.
    let seconds_since_unix_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("the clock is set later than 1970")
        .as_secs();
    let (year, month, day) = civil_date_from_days((seconds_since_unix_epoch / 86_400) as i64 - 90);
    let since = format!("{year:04}-{month:02}-{day:02}");

    let answer: PropertiesAnswer = houski(
        "properties",
        &[
            ("country_abbreviation", country.as_str()),
            ("province_abbreviation", province.as_str()),
            ("city", city.as_str()),
            ("expand", "listings"),
            // These two filters choose which listing rows count.
            ("expand_listing_event_eq", "Sold"),
            ("expand_listing_date_gte", since.as_str()),
            // all keeps only the properties that have a matching row.
            ("filter_expand_match", "all"),
            ("select", "property_type,interior_sq_m"),
            // exclude=inferred leaves out the property types and floor areas Houski worked out, and a home with
            // neither one stated. Remove exclude to get the inferred values back.
            ("exclude", "inferred"),
            ("results_per_page", "10"),
        ],
    );

    for home in &answer.data {
        for sale in &home.listings {
            println!(
                "{}: {} ({}, {} square metres) sold for {}",
                shown(&sale.expand_listing_date, "not known"),
                home.address,
                shown(&home.property_type, "not known"),
                shown(&home.interior_sq_m, "not known"),
                shown(&sale.expand_estimate_list_price, "not known")
            );
        }
    }

    println!("{} homes sold since {since}. Cost of this page: {} cents", answer.result_total, answer.cost_cents);
}
