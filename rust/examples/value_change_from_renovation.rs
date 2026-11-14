//! Estimate how a renovation changes a home's value with the Houski property data API.
//!
//! Finds a home by its address, then asks /predict for its estimated sale price
//! twice: as it is, and with one more bedroom. Other facts can be overridden the
//! same way, such as bathroom_full, interior_sq_m and construction_year.
//!
//! Usage: cargo run -r --example value_change_from_renovation -- "100 main calgary"

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

// /search: the best matches first, with one match score per result in match_meta.
#[derive(Deserialize)]
struct SearchAnswer {
    data: Vec<HomeAsItIs>,
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
struct HomeAsItIs {
    address: String,
    property_id: String,
    bedroom: Option<f64>,
}

/// The match score of one result.
#[derive(Deserialize)]
struct MatchMeta {
    property_id: String,
    match_value: f64,
}

// /predict: one entry per property, each with one prediction per date.
#[derive(Deserialize)]
struct PredictAnswer {
    data: Vec<PropertyPredictions>,
    result_total: u64,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

/// The modelled values of one property, one prediction per date.
#[derive(Deserialize)]
struct PropertyPredictions {
    property_id: String,
    predictions: Vec<Prediction>,
}

/// The modelled values of a property on one date. Only the fields asked for come back.
#[derive(Deserialize)]
struct Prediction {
    date: String,
    estimate_sale_price: Option<f64>,
    estimate_list_price: Option<f64>,
    estimate_rent_monthly: Option<f64>,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

/// The estimated sale price of the most recent date in the answer.
fn latest_sale_price(answer: &PredictAnswer) -> Option<f64> {
    let mut predictions: Vec<&Prediction> = answer.data[0].predictions.iter().collect();
    predictions.sort_by(|earlier, later| earlier.date.cmp(&later.date));
    predictions.last().and_then(|prediction| prediction.estimate_sale_price)
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let address = match arguments.is_empty() {
        true => "100 main calgary".to_string(),
        false => arguments.join(" "),
    };

    // exclude=inferred is left off here: /predict values the home by its bedroom count whether stated or
    // worked out, so the example needs a count for every home.
    let found: SearchAnswer = houski("search", &[("query", address.as_str()), ("max_results", "1"), ("select", "bedroom")]);
    let home = match found.data.first() {
        Some(home) => home,
        None => {
            eprintln!("No property matched that address.");
            std::process::exit(1);
        }
    };
    let bedrooms = match home.bedroom {
        Some(bedrooms) => bedrooms,
        None => {
            eprintln!("The number of bedrooms of that home is not known.");
            std::process::exit(1);
        }
    };

    let as_it_is: PredictAnswer = houski(
        "predict",
        &[("property_id", home.property_id.as_str()), ("fields", "estimate_sale_price"), ("period", "month"), ("last", "1")],
    );

    // An override is passed by its bare field name. Here the same home is valued with one more bedroom.
    let one_more_bedroom = format!("{}", bedrooms + 1.0);
    let renovated: PredictAnswer = houski(
        "predict",
        &[
            ("property_id", home.property_id.as_str()),
            ("fields", "estimate_sale_price"),
            ("period", "month"),
            ("last", "1"),
            ("bedroom", one_more_bedroom.as_str()),
        ],
    );

    let before = latest_sale_price(&as_it_is);
    let after = latest_sale_price(&renovated);
    println!("{} with {bedrooms} bedrooms: {}", home.address, shown(&before, "not known"));
    println!("The same home with {one_more_bedroom} bedrooms: {}", shown(&after, "not known"));
    match (before, after) {
        (Some(before), Some(after)) if before != 0.0 && after != 0.0 => {
            println!("Difference: {}", after - before);
        }
        _ => {}
    }

    println!("Cost: {} cents", found.cost_cents + as_it_is.cost_cents + renovated.cost_cents);
}
