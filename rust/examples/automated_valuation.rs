//! Get an automated valuation of a home with the Houski property data API.
//!
//! Finds a home by its address, quotes the valuation for free, and runs it only
//! when --yes is given, because a valuation costs $5.00. The valuation holds the
//! estimated sale price, list price and monthly rent, each with a confidence
//! score, plus warning flags and a link to a report.
//!
//! Usage: cargo run -r --example automated_valuation -- "100 main calgary"
//!        cargo run -r --example automated_valuation -- "100 main calgary" --yes

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

// /avm: url is the link to the report of this valuation.
#[derive(Deserialize)]
struct AvmAnswer {
    data: Valuation,
    url: String,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

// The valuation itself. It holds more keys than these, such as the facts of the home, a price history and the area's scores.
#[derive(Deserialize)]
struct Valuation {
    property_id: String,
    valuation_date: String,
    estimate_sale_price: SingleValuation,
    estimate_list_price: SingleValuation,
    estimate_rent_monthly: SingleValuation,
    property_warning_flags: Vec<WarningFlag>,
}

// One of the three valuations of a home.
#[derive(Deserialize)]
struct SingleValuation {
    value: f64,
    confidence_score: f64,
}

/// One warning about the home or its valuation.
#[derive(Deserialize)]
struct WarningFlag {
    warning: String,
    description: String,
}

fn main() {
    let every_argument: Vec<String> = env::args().skip(1).collect();
    let approved = every_argument.iter().any(|argument| argument == "--yes");
    let arguments: Vec<String> = every_argument.into_iter().filter(|argument| argument != "--yes").collect();
    let address = match arguments.is_empty() {
        true => "100 main calgary".to_string(),
        false => arguments.join(" "),
    };

    let found: SearchAnswer = houski("search", &[("query", address.as_str()), ("max_results", "1")]);
    let home = match found.data.first() {
        Some(home) => home,
        None => {
            eprintln!("No property matched that address.");
            std::process::exit(1);
        }
    };

    // price_quote=true returns what the valuation would cost, and charges nothing.
    let quote: AvmAnswer = houski("avm", &[("property_id", home.property_id.as_str()), ("price_quote", "true")]);
    println!("A valuation of {} costs {} cents.", home.address, quote.cost_cents);

    // Never run a valuation without the yes of the person who pays for it.
    if !approved {
        eprintln!("Run again with --yes to buy the valuation.");
        std::process::exit(1);
    }

    let answer: AvmAnswer = houski("avm", &[("property_id", home.property_id.as_str())]);
    let valuation = &answer.data;

    println!("Valued on {}", valuation.valuation_date);
    println!("estimate_sale_price: {} (confidence {})", valuation.estimate_sale_price.value, valuation.estimate_sale_price.confidence_score);
    println!("estimate_list_price: {} (confidence {})", valuation.estimate_list_price.value, valuation.estimate_list_price.confidence_score);
    println!("estimate_rent_monthly: {} (confidence {})", valuation.estimate_rent_monthly.value, valuation.estimate_rent_monthly.confidence_score);
    for flag in &valuation.property_warning_flags {
        println!("Warning, {}: {}", flag.warning, flag.description);
    }
    println!("Report: {}", answer.url);
    println!("Cost: {} cents", answer.cost_cents);
}
