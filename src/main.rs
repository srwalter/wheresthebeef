use std::net::SocketAddr;

use futures_util::stream::StreamExt;
use futures_util::SinkExt;

use hyper::{Body, Request, Response, StatusCode};
use hyper::service::service_fn;
use hyper_tungstenite::{tungstenite, HyperWebsocket};
use tungstenite::Message;

use serde::Deserialize;
use serde_json::value::Number;
use mysql::prelude::*;
use mysql::PooledConn;

use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

type Error = Box<dyn std::error::Error + Send + Sync + 'static>;

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
    database: String,
    sql: String,
}

fn sql_connect(req: &SqlRequest) -> Result<PooledConn, mysql::Error> {
    let opts = mysql::OptsBuilder::new()
        .ip_or_hostname(Some("127.0.0.1"))
        .db_name(Some(&req.database))
        .user(Some(&req.username))
        .pass(Some(&req.password));

    let pool = mysql::Pool::new(opts)?;
    pool.get_conn()
}

fn sql_request(conn: &mut PooledConn, sql: &str) -> Result<String,mysql::Error> {
    let mut result = conn.query_iter(sql)?;

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

async fn serve_websocket(ws: HyperWebsocket) -> Result<(), Error> {
    let mut ws = ws.await?;

    let mut conn = None;

    while let Some(msg) = ws.next().await {
        match msg? {
            Message::Text(msg) => {
                let sql: SqlRequest = serde_json::from_str(&msg).unwrap();
                let resp = if let Some(ref mut conn) = conn {
                    sql_request(conn, &sql.sql)
                } else {
                    match sql_connect(&sql) {
                        Ok(mut new_conn) => {
                            let resp = sql_request(&mut new_conn, &sql.sql);
                            conn = Some(new_conn);
                            resp
                        }
                        Err(e) => {
                            Err(e)
                        }
                    }
                };

                let resp = match resp {
                    Ok(resp) => resp,
                    Err(err) => {
                        let map = vec![vec![vec!["error".to_string()], vec![format!("{:?}", err)]]];
                        serde_json::to_string(&map).unwrap()
                    }
                };
                ws.send(Message::text(resp)).await?;
            },
            Message::Ping(_msg) => (),
            Message::Close(_msg) => (),
            e => {
                eprintln!("Unexpected websocket message: {:?}", e);
            }
        }
    }

    Ok(())
}

async fn handle(mut req: Request<Body>) -> Result<Response<Body>, Error> {
    if hyper_tungstenite::is_upgrade_request(&req) {
        let (resp, ws) = hyper_tungstenite::upgrade(&mut req, None)?;
        tokio::spawn(async move {
            if let Err(e) = serve_websocket(ws).await {
                eprintln!("Error in websocket connection: {}", e);
            }
        });

        Ok(resp)
    } else {
        let mut uri = req.uri().path().to_string();
        uri.remove(0); // remove the /
        if uri.starts_with("database") {
            let body = hyper::body::to_bytes(req.into_body()).await.unwrap();
            let body_str = String::from_utf8(body.to_vec()).unwrap();
            let sql: SqlRequest = serde_json::from_str(&body_str).unwrap();
            let mut conn = sql_connect(&sql)?;
            let resp = match sql_request(&mut conn, &sql.sql) {
                Ok(resp) => resp,
                Err(err) => {
                    let map = vec![vec![vec!["error".to_string()], vec![format!("{:?}", err)]]];
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
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Construct our SocketAddr to listen on...
    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    let mut http = hyper::server::conn::Http::new();
    http.http1_only(true);
    http.http1_keep_alive(true);

    loop {
        let (stream, _) = listener.accept().await?;
        let conn = http
            .serve_connection(stream, service_fn(handle))
            .with_upgrades();
        tokio::spawn(async move {
            if let Err(err) = conn.await {
                println!("Error serving HTTP connection: {:?}", err);
            }
        });
    }
}
