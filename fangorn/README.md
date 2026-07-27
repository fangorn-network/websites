# Fangorn Website

### The Faucet Worker

The website allows for a cloudflare worker to be deployed so that it can act as a faucet for new publishers.

``` sh
# paste id into wrangler.toml
cd websites/faucet && npx wrangler kv namespace create FAUCET_KV
npx wrangler secret put FAUCET_PRIVATE_KEY
npx wrangler deploy
```