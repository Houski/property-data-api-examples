//! Count homes and find the median price inside a polygon with the Houski property data API.
//!
//! Draw any area as a list of points, such as a sales territory, a flood zone or
//! a school catchment, and /aggregate answers for the homes inside it.
//!
//! Usage: cargo run -r --example statistics_inside_a_polygon

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

// /aggregate: one entry per statistic, in the order asked. Every value is a string.
#[derive(Deserialize)]
struct AggregateAnswer {
    data: Vec<Statistic>,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

/// One statistic. Every value is a string.
#[derive(Deserialize)]
struct Statistic {
    field: String,
    aggregation: String,
    value: String,
}

// The corners of the area as (latitude, longitude), here a few blocks of central Calgary. At most 100 points.
const CORNERS: [(f64, f64); 4] = [(51.050, -114.090), (51.050, -114.050), (51.030, -114.050), (51.030, -114.090)];

fn main() {
    // A polygon is written lat_lng,lat_lng,lat_lng with an underscore inside each point and commas between points.
    let points: Vec<String> = CORNERS.iter().map(|(latitude, longitude)| format!("{latitude}_{longitude}")).collect();
    let polygon = points.join(",");

    // Two statistics in one request. In a batch, every parameter carries the agg0_, agg1_
    // prefix of its statistic. Only polygon and price_quote stay bare.
    let answer: AggregateAnswer = houski(
        "aggregate",
        &[
            ("polygon", polygon.as_str()),
            ("agg0_field", "property_id"),
            ("agg0_aggregation", "count"),
            ("agg1_field", "estimate_list_price"),
            ("agg1_aggregation", "median"),
        ],
    );

    let count = &answer.data[0];
    let median = &answer.data[1];
    println!("Homes inside the polygon: {}", count.value);
    println!("Median estimated list price: {}", median.value);
    println!("Cost: {} cents", answer.cost_cents);
}
