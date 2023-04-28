use std::convert::Infallible;
use std::net::SocketAddr;

use hyper::{Body, Request, Response, Server};
use hyper::service::{make_service_fn, service_fn};
use serde::Deserialize;
use serde_json::value::Number;
use mysql::prelude::*;

use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

fn mysql_to_json(x: &mysql::Value) -> serde_json::Value {
    match x {
        mysql::Value::NULL => serde_json::Value::Null,
        mysql::Value::Bytes(x) => serde_json::Value::String(String::from_utf8(x.to_vec()).unwrap()),
        mysql::Value::Int(x) => serde_json::Value::Number(Number::from_f64(*x as f64).unwrap()),
        mysql::Value::UInt(x) => serde_json::Value::Number(Number::from_f64(*x as f64).unwrap()),
        mysql::Value::Float(x) => serde_json::Value::Number(Number::from_f64(*x as f64).unwrap()),
        mysql::Value::Double(x) => serde_json::Value::Number(Number::from_f64(*x).unwrap()),
        _ => unimplemented!(),
        //mysql::Value::Date(y, mon, d, h, m, s, microsec)
        //mysql::Value::Time(neg, d, h, m, s, microsec)
    }
}

#[derive(Deserialize)]
struct SqlRequest {
    username: String,
    password: String,
    sql: String,
}

fn sql_request(req: SqlRequest) -> String {
    let opts = mysql::OptsBuilder::new()
        .ip_or_hostname(Some("192.168.1.101"))
        .db_name(Some("wheresthebeef"))
        .user(Some(req.username))
        .pass(Some(req.password));

    let pool = mysql::Pool::new(opts).unwrap();
    let mut conn = pool.get_conn().unwrap();
    let mut result = conn.query_iter(req.sql).unwrap();

    let mut all_result = Vec::new();
    while let Some(cursor) = result.iter() {
        let mut rows = Vec::new();
        for row in cursor {
            let row = row.unwrap();
            let mut cols = Vec::new();
            for i in 0..row.len() {
                cols.push(mysql_to_json(&row[i]));
            }
            rows.push(cols);
        }
        all_result.push(rows);
    }

    serde_json::to_string(&all_result).unwrap()
}

async fn handle(req: Request<Body>) -> Result<Response<Body>, Infallible> {
    let mut uri = req.uri().path().to_string();
    uri.remove(0); // remove the /
    println!("uri {}", uri);
    if uri.starts_with("database") {
        let body = hyper::body::to_bytes(req.into_body()).await.unwrap();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        println!("body {}", body_str);
        let sql: SqlRequest = serde_json::from_str(&body_str).unwrap();
        let resp = sql_request(sql);
        println!("resp {}", resp);
        Ok(Response::new(Body::from(resp)))
    } else {
        let file = File::open(uri).await.unwrap();
        let body = Body::wrap_stream(FramedRead::new(file, BytesCodec::new()));
        Ok(Response::new(body))
    }
}

#[tokio::main]
async fn main() {
    // Construct our SocketAddr to listen on...
    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));

    // And a MakeService to handle each connection...
    let make_service = make_service_fn(|_conn| async {
        Ok::<_, Infallible>(service_fn(handle))
    });

    // Then bind and serve...
    let server = Server::bind(&addr).serve(make_service);

    // And run forever...
    if let Err(e) = server.await {
        eprintln!("server error: {}", e);
    }
}