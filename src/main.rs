use std::convert::Infallible;
use std::net::SocketAddr;
use std::collections::HashMap;

use hyper::{Body, Request, Response, Server, StatusCode};
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

fn sql_request(req: SqlRequest) -> Result<String,mysql::Error> {
    let opts = mysql::OptsBuilder::new()
        .ip_or_hostname(Some("192.168.1.101"))
        .db_name(Some("wheresthebeef"))
        .user(Some(req.username))
        .pass(Some(req.password));

    let pool = mysql::Pool::new(opts)?;
    let mut conn = pool.get_conn()?;
    let mut result = conn.query_iter(req.sql)?;

    let mut all_result = Vec::new();
    while let Some(cursor) = result.iter() {
        let mut rows = Vec::new();

        let mut first = true;
        for row in cursor {
            let row = row?;

            // Put the column names first
            if first {
                let mut cols = Vec::new();
                for column in row.columns_ref() {
                    cols.push(serde_json::Value::String(column.name_str().to_string()));
                }
                rows.push(cols);
                first = false;
            }

            let mut cols = Vec::new();
            for i in 0..row.len() {
                cols.push(mysql_to_json(&row[i]));
            }
            rows.push(cols);
        }
        all_result.push(rows);
    }

    Ok(serde_json::to_string(&all_result).unwrap())
}

async fn handle(req: Request<Body>) -> Result<Response<Body>, Infallible> {
    let mut uri = req.uri().path().to_string();
    uri.remove(0); // remove the /
    if uri.starts_with("database") {
        let body = hyper::body::to_bytes(req.into_body()).await.unwrap();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        let sql: SqlRequest = serde_json::from_str(&body_str).unwrap();
        let resp = match sql_request(sql) {
            Ok(resp) => resp,
            Err(err) => {
                let mut map = HashMap::new();
                map.insert("error", format!("{:?}", err));
                serde_json::to_string(&map).unwrap()
            }
        };
        Ok(Response::new(Body::from(resp)))
    } else {
        if let Ok(file) = File::open(uri).await {
            let body = Body::wrap_stream(FramedRead::new(file, BytesCodec::new()));
            Ok(Response::new(body))
        } else {
            Ok(Response::builder()
               .status(StatusCode::NOT_FOUND)
               .body(Body::from("Not Found"))
               .unwrap())
        }
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
