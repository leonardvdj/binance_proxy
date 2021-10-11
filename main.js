import express from "express";
import cors from "cors";
import compression from "compression";
import { createProxyMiddleware } from "http-proxy-middleware";
import wsc from "./wsclient.js";

let use_fake_candle = process.argv.includes("--fakecandle");
if (use_fake_candle) {
  console.log("Using fake candles. DISCLAIMER: This is an experimental feature, and is not guaranteed to work.");
}

const app = express();
app.use(cors());
// app.use(compression()); // Disabled for testing

app.get("/api/v3/klines", async (req, res) => {
  wsc.getCandles(req.query.symbol, req.query.interval, use_fake_candle).then(result => res.send(result));
});

app.get("/api/v3/depth", async (req, res) => {
  wsc.getDepth(req.query.symbol, req.query.limit).then(result => res.send(result));
});

app.use((req, res, next) => {
  console.log(`Passthrough: ${req.url}`);
  next();
});

app.use(createProxyMiddleware({
  target: "https://api.binance.com", changeOrigin: true
}));

app.listen(8080);