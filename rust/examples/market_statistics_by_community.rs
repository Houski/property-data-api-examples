//! Median home price and home count by community with the Houski property data API.
//!
//! Reads the communities of a city from /location, then asks /aggregate for the
//! median estimated list price and the number of houses in each one, all in a
//! single batched request.
//!
//! Usage: cargo run -r --example market_statistics_by_community -- ca ab calgary

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

/// One place. A level finer than the resolution asked for is left out.
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

/// The answer of /aggregate.
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

fn main() {
    let mut arguments = env::args().skip(1);
    let country = arguments.next().unwrap_or_else(|| "ca".to_string());
    let province = arguments.next().unwrap_or_else(|| "ab".to_string());
    let city = arguments.next().unwrap_or_else(|| "calgary".to_string());
    let place: [(&str, &str); 3] = [("country_abbreviation", country.as_str()), ("province_abbreviation", province.as_str()), ("city", city.as_str())];

    // Step 1: the communities of the city. Places always come from /location, never
    // from a list written into the code.
    let mut location_parameters: Vec<(&str, &str)> = vec![("resolution", "community"), ("flat", "true")];
    location_parameters.extend_from_slice(&place);
    let locations: LocationAnswer = houski("location", &location_parameters);
    let communities: Vec<String> = locations
        .data
        .flat
        .iter()
        .filter_map(|location| location.community.clone())
        .filter(|community| !community.is_empty())
        .take(5)
        .collect();

    // Step 2: two statistics per community in one request. In a batch, every
    // parameter carries the agg0_, agg1_ prefix of the statistic it belongs to,
    // numbered from 0 with no gaps.
    let mut parameters: Vec<(String, String)> = Vec::new();
    for (index, community) in communities.iter().enumerate() {
        for (number, (field, aggregation)) in [("estimate_list_price", "median"), ("property_id", "count")].iter().enumerate() {
            let prefix = format!("agg{}_", index * 2 + number);
            for (name, value) in place.iter() {
                parameters.push((format!("{prefix}{name}"), value.to_string()));
            }
            parameters.push((format!("{prefix}community_eq"), community.clone()));
            parameters.push((format!("{prefix}property_type_eq"), "House".to_string()));
            parameters.push((format!("{prefix}field"), field.to_string()));
            parameters.push((format!("{prefix}aggregation"), aggregation.to_string()));
        }
    }
    let borrowed_parameters: Vec<(&str, &str)> = parameters.iter().map(|(name, value)| (name.as_str(), value.as_str())).collect();

    let statistics: AggregateAnswer = houski("aggregate", &borrowed_parameters);

    // The answers come back in the order they were asked, and every value is a string.
    for (index, community) in communities.iter().enumerate() {
        let median = &statistics.data[index * 2];
        let count = &statistics.data[index * 2 + 1];
        println!("{community}: median estimated list price {}, {} houses", median.value, count.value);
    }

    println!("Cost: {} cents", locations.cost_cents + statistics.cost_cents);
}
