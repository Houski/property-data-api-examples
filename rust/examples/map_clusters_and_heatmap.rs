//! Property map clusters and a price heatmap with the Houski property data API.
//!
//! For one bounding box, prints the clusters a zoomed out map would draw, then
//! the cells of a heatmap shaded by median estimated list price.
//!
//! Usage: cargo run -r --example map_clusters_and_heatmap

use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::env;

// The north east and south west corners of the map view, here central Calgary.
const BOUNDING_BOX: [(&str, &str); 4] = [("bbox_ne_lat", "51.1"), ("bbox_ne_lng", "-113.9"), ("bbox_sw_lat", "50.9"), ("bbox_sw_lng", "-114.2")];

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

/// The answer of /map.
#[derive(Deserialize)]
struct MapAnswer {
    data: MapData,
    error: String,
    time_ms: u64,
    cost_cents: f64,
    cache_hit: bool,
    price_quote: bool,
}

/// What a map view draws: clusters and heatmap cells.
#[derive(Deserialize)]
struct MapData {
    clusters: Vec<Cluster>,
    heatmap: Vec<HeatmapCell>,
}

/// One cluster: its centre and the number of properties in it.
#[derive(Deserialize)]
struct Cluster {
    latitude: f64,
    longitude: f64,
    number_of_properties: u64,
}

/// One heatmap cell: its centre, its shading and the statistic behind the shading.
#[derive(Deserialize)]
struct HeatmapCell {
    latitude: f64,
    longitude: f64,
    intensity: f64,
    number_of_properties: u64,
    aggregation_value: Option<f64>,
}

/// The value as text, or the fallback where the home has none.
fn shown<Shown: std::fmt::Display>(value: &Option<Shown>, fallback: &str) -> String {
    match value {
        Some(value) => value.to_string(),
        None => fallback.to_string(),
    }
}

fn main() {
    // Clusters: at most ten, each with a centre and the number of properties in it.
    let mut cluster_parameters: Vec<(&str, &str)> = vec![("cluster", "true"), ("property_type_eq", "House")];
    cluster_parameters.extend_from_slice(&BOUNDING_BOX);
    let clustered: MapAnswer = houski("map", &cluster_parameters);
    for cluster in &clustered.data.clusters {
        println!("Cluster at {}, {}: {} houses", cluster.latitude, cluster.longitude, cluster.number_of_properties);
    }

    // Heatmap: one cell per patch of the box. aggregation_value is the median price
    // of the cell, and intensity is that value scaled from 0 to 1 for shading.
    let mut heatmap_parameters: Vec<(&str, &str)> = vec![
        ("heatmap", "true"),
        ("heatmap_aggregation_field", "estimate_list_price"),
        ("heatmap_aggregation_type", "median"),
        ("heatmap_cell_limit", "100"),
    ];
    heatmap_parameters.extend_from_slice(&BOUNDING_BOX);
    let heatmap: MapAnswer = houski("map", &heatmap_parameters);
    for cell in heatmap.data.heatmap.iter().take(10) {
        println!(
            "Cell at {}, {}: median {}, intensity {}",
            cell.latitude,
            cell.longitude,
            shown(&cell.aggregation_value, "not known"),
            cell.intensity
        );
    }

    println!("Cost: {} cents", clustered.cost_cents + heatmap.cost_cents);
}
