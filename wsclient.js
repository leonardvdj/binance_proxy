import Binance from "node-binance-api";
import fetch from "node-fetch";

export default new class Client {
  binance;
  subscribedCandles;
  klines;
  subscribedDepth;
  depth;

  constructor() {
    this.binance = new Binance().options();
    this.subscribedCandles = [];
    this.klines = {};
    this.subscribedDepth = [];
    this.depth = {};
  }

  subscribeCandles(symbol, interval) {
    if (this.subscribedCandles.find(e => e === symbol + interval)) return;
    this.subscribedCandles.push(symbol + interval);
    console.log(`Subscribed candles: ${this.subscribedCandles.length}`);

    let cache = this.klines[symbol + interval];

    this.binance.websockets.candlesticks([symbol], interval, (candle) => {
      let matching_candle_index = cache.candles.findIndex(elem => elem[0] === candle.k.t);

      let new_candle = [
        candle.k.t,   // open ts
        candle.k.o,   // open
        candle.k.h,   // high
        candle.k.l,   // low
        candle.k.c,   // close
        candle.k.v,   // base asset volume
        candle.k.T,   // close ts
        candle.k.q,   // quote asset volume
        candle.k.n,   // numer of trades
        candle.k.V,   // taker buy base asset volume
        candle.k.Q,   // taker buy quote asset volume
        candle.k.B    // ignore
      ];

      if (matching_candle_index !== -1) {
        cache.candles[matching_candle_index] = new_candle;
      }else{
        if (!cache.is_refresh)
          cache.candles.push(new_candle);
      }
    });
  }

  async getCandles(symbol, interval, use_fake_candle) {
    let data = this.klines[symbol + interval];
    if (!data) {
      console.log(`No candle cache for ${symbol}${interval}, creating...`);
      this.klines[symbol + interval] = {
        is_init: true,
        is_refresh: false,
        candles: []
      };
      let req = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`);
      let res = await req.json();
      this.klines[symbol + interval].candles = res;
      this.klines[symbol + interval].is_init = false;
      data = this.klines[symbol + interval];
      this.subscribeCandles(symbol, interval);
    }
    let was_waiting = data.is_init;
    let prev = Date.now();
    while (data.is_init) {
      await new Promise(r => setTimeout(r, 20));
      data = this.klines[symbol + interval];
    }
    if (was_waiting) {
      console.log(`Waited for ${symbol}${interval} init for ${((Date.now() - prev) / 1000).toFixed(2)}s`);
    }
    if (!data.is_refresh && data.candles[data.candles.length - 1][6] <= Date.now()) {
      data.is_refresh = true;
      if (use_fake_candle) {
        console.log(`Faking open candle for ${symbol}${interval}`);
        let lastcandle = data.candles[data.candles.length - 1];
        let lastcandle2 = data.candles[data.candles.length - 2];
        let time_diff = lastcandle[0] - lastcandle2[0];
        data.candles.push([
          lastcandle[0] + time_diff,  // open ts
          lastcandle[4],              // open
          lastcandle[4],              // high
          lastcandle[4],              // low
          lastcandle[4],              // close
          "0.0",                      // base asset volume
          lastcandle[6] + time_diff,  // close ts
          "0.0",                      // quote asset volume
          0,                          // numer of trades
          "0.0",                      // taker buy base asset volume
          "0.0",                      // taker buy quote asset volume
          "0"                         // ignore
        ]);
      }else{
        console.log(`Refreshing candle data from api for ${symbol}${interval}`);
        let req = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`);
        let res = await req.json();
        this.klines[symbol + interval].candles = res;
        data = this.klines[symbol + interval];
      }
      data.is_refresh = false;
    }
    was_waiting = data.is_refresh;
    prev = Date.now();
    while (data.is_refresh) {
      await new Promise(r => setTimeout(r, 20));
      data = this.klines[symbol + interval];
    }
    if (was_waiting) {
      console.log(`Waited for ${symbol}${interval} refresh for ${((Date.now() - prev) / 1000).toFixed(2)}s`);
    }
    return data.candles;
  }

  subscribeDepth(symbol) {
    if (this.subscribedDepth.find(e => e === symbol)) return;
    this.subscribedDepth.push(symbol);
    console.log(`Subscribed depth: ${this.subscribedDepth.length}`);

    this.binance.websockets.depthCache([symbol], (symbol, depth) => {
      let bids = this.binance.sortBids(depth.bids);
      let asks = this.binance.sortAsks(depth.asks);

      let format_bids = Object.keys(bids).map(price => {
        return [
          price,
          bids[price].toString()
        ]
      });

      let format_asks = Object.keys(asks).map(price => {
        return [
          price,
          asks[price].toString()
        ]
      });

      this.depth[symbol] = {
        lastUpdateId: depth.lastUpdateId,
        bids: format_bids.slice(0, 20),
        asks: format_asks.slice(0, 20)
      };
    });
  }

  async getDepth(symbol, limit) {
    let data = this.depth[symbol];
    if (!data) {
      console.log(`No depth cache for ${symbol}, creating...`);
      let req = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`);
      let res = await req.json();
      this.depth[symbol] = res;
      data = this.depth[symbol];
      this.subscribeDepth(symbol);
    }
    limit = parseInt(limit);
    return {
      lastUpdateId: data.lastUpdateId,
      bids: data.bids.slice(0, limit),
      asks: data.asks.slice(0, limit)
    };
  }
}