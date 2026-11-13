//! Get the tax assessment history of a home with the Houski property data API.
//!
//! Finds a home by its address, then reads its assessed value for each year on
//! record, beside its current assessed value and property taxes.
//!
//! Usage: cargo run -r --example assessment_history -- "100 main calgary"

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
    data: Vec<FoundHome>,
    match_meta: Vec<MatchMeta>,
    result_total: u64,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

// With no select, a row carries only address and property_id.
#[derive(Deserialize)]
struct FoundHome {
    address: String,
    property_id: String,
}

/// The match score of one result.
#[derive(Deserialize)]
struct MatchMeta {
    property_id: String,
    match_value: f64,
}

// /properties: one row per property.
#[derive(Deserialize)]
struct PropertiesAnswer {
    data: Vec<AssessedHome>,
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
struct AssessedHome {
    address: String,
    property_id: String,
    assessment_value: Option<f64>,
    property_taxes: Option<f64>,
    #[serde(default)]
    assessments: Vec<Assessment>,
}

// An assessment row attached by expand=assessments.
#[derive(Deserialize)]
struct Assessment {
    expand_assessment_year: f64,
    expand_assessment_value: f64,
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

    let found: SearchAnswer = houski("search", &[("query", address.as_str()), ("max_results", "1")]);
    let found_home = match found.data.first() {
        Some(found_home) => found_home,
        None => {
            eprintln!("No property matched that address.");
            std::process::exit(1);
        }
    };

    // property_id_eq reads one property. expand attaches its assessment rows, one per year.
    let answer: PropertiesAnswer = houski(
        "properties",
        &[("property_id_eq", found_home.property_id.as_str()), ("expand", "assessments"), ("select", "assessment_value,property_taxes")],
    );

    let home = &answer.data[0];
    println!(
        "{}: assessed at {}, property taxes {}",
        home.address,
        shown(&home.assessment_value, "(not known)"),
        shown(&home.property_taxes, "(not known)")
    );
    let mut assessments: Vec<&Assessment> = home.assessments.iter().collect();
    assessments.sort_by(|earlier, later| earlier.expand_assessment_year.total_cmp(&later.expand_assessment_year));
    for assessment in &assessments {
        println!("  {}: {}", assessment.expand_assessment_year, assessment.expand_assessment_value);
    }

    println!("Cost: {} cents", found.cost_cents + answer.cost_cents);
}
