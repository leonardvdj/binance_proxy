import fetch from "node-fetch";

setInterval(async () => {
  try {
    let req = await fetch("http://127.0.0.1:8080/api/v3/klines?symbol=BTCUSDT&interval=1m")
    let res = await req.json();

    console.log(res[res.length - 1][4]);
  }catch(e) {}
}, 5);