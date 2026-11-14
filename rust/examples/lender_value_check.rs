//! Check a home's value for a mortgage file with the Houski property data API.
//!
//! Prints the estimated sale price beside the assessed value and the property
//! taxes, then two years of monthly value history for the same home.
//!
//! Usage: cargo run -r --example lender_value_check -- "100 main calgary"

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
    data: Vec<ValuedHome>,
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
struct ValuedHome {
    address: String,
    property_id: String,
    estimate_sale_price: Option<f64>,
    assessment_value: Option<f64>,
    assessment_value_source: Option<String>,
    property_taxes: Option<f64>,
}

/// The match score of one result.
#[derive(Deserialize)]
struct MatchMeta {
    property_id: String,
    match_value: f64,
}

/// The answer of /predict.
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

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let address = match arguments.is_empty() {
        true => "100 main calgary".to_string(),
        false => arguments.join(" "),
    };

    // Step 1: find the home and read its values. Money is in the currency of the
    // property's country and is never converted. assessment_value_source says where
    // the assessed value came from, often a link to the roll.
    // exclude=inferred leaves out an assessed value or property taxes Houski worked out. estimate_sale_price
    // has no source field, so it is untouched. Remove exclude to get the inferred values back.
    let found: SearchAnswer = houski(
        "search",
        &[
            ("query", address.as_str()),
            ("max_results", "1"),
            ("select", "estimate_sale_price,assessment_value,assessment_value_source,property_taxes"),
            ("exclude", "inferred"),
        ],
    );

    let home = match found.data.first() {
        Some(home) => home,
        None => {
            eprintln!("No property matched that address, or Houski inferred both its assessed value and its property taxes.");
            std::process::exit(1);
        }
    };
    println!("Address: {}", home.address);
    println!("estimate_sale_price: {}", shown(&home.estimate_sale_price, "(not known)"));
    println!("assessment_value: {}", shown(&home.assessment_value, "(not known)"));
    println!("assessment_value_source: {}", shown(&home.assessment_value_source, "(not known)"));
    println!("property_taxes: {}", shown(&home.property_taxes, "(not known)"));

    // Step 2: the modelled sale value of that home for each of the last 24 months.
    // /predict covers 2021-01-01 to today. It does not forecast.
    let history: PredictAnswer = houski(
        "predict",
        &[("property_id", home.property_id.as_str()), ("fields", "estimate_sale_price"), ("period", "month"), ("last", "24")],
    );

    let mut predictions: Vec<&Prediction> = history.data[0].predictions.iter().collect();
    predictions.sort_by(|earlier, later| earlier.date.cmp(&later.date));
    for prediction in &predictions {
        println!("{}: {}", prediction.date, shown(&prediction.estimate_sale_price, "not known"));
    }

    let first = predictions.first().and_then(|prediction| prediction.estimate_sale_price);
    let latest = predictions.last().and_then(|prediction| prediction.estimate_sale_price);
    match (first, latest) {
        (Some(first), Some(latest)) if first != 0.0 && latest != 0.0 => {
            println!("Change over the period: {:.1}%", (latest - first) / first * 100.0);
        }
        _ => {}
    }

    println!("Cost: {} cents", found.cost_cents + history.cost_cents);
}
