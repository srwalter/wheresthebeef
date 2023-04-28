use std::convert::Infallible;
use std::net::SocketAddr;

use hyper::{Body, Request, Response, Server};
use hyper::service::{make_service_fn, service_fn};
use serde::Deserialize;
use mysql::prelude::*;

use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

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

    for row in result.iter().unwrap() {
        println!("{:?}", row);
    }

    "".into()
}

async fn handle(req: Request<Body>) -> Result<Response<Body>, Infallible> {
    let mut uri = req.uri().to_string();
    uri.remove(0); // remove the /
    println!("uri {}", uri);
    if uri.starts_with("database") {
        let body = hyper::body::to_bytes(req.into_body()).await.unwrap();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        println!("body {}", body_str);
        let sql: SqlRequest = serde_json::from_str(&body_str).unwrap();
        let resp = sql_request(sql);
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
