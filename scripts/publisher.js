#!/usr/bin/env node
/**
 * SentimentOracle Publisher
 * Fetches sentiment data from Santiment and publishes to Monad
 * 
 * Usage: node publisher.js [--asset bitcoin] [--network testnet]
 */

import { ethers } from "ethers";
import fs from "fs";
import os from "os";
import https from "https";

// Config
const SANTIMENT_API_KEY = fs.readFileSync(os.homedir() + '/.config/santiment/api_key', 'utf8').trim();
const WALLET = JSON.parse(fs.readFileSync(os.homedir() + '/.evm-wallet.json', 'utf8'));

const NETWORKS = {
  testnet: {
    url: "https://testnet-rpc.monad.xyz",
    chainId: 10143
  },
  mainnet: {
    url: "https://rpc.monad.xyz", 
    chainId: 143
  }
};

// Parse args
const args = process.argv.slice(2);
const asset = args.includes('--asset') ? args[args.indexOf('--asset') + 1] : 'bitcoin';
const network = args.includes('--network') ? args[args.indexOf('--network') + 1] : 'testnet';

// Load contract
let deployment;
try {
  deployment = JSON.parse(fs.readFileSync('./deployment.json', 'utf8'));
} catch (e) {
  console.error("No deployment.json found. Deploy the contract first.");
  process.exit(1);
}

const artifact = JSON.parse(
  fs.readFileSync("./artifacts/contracts/SentimentOracle.sol/SentimentOracle.json", "utf8")
);

// Santiment GraphQL query
function fetchSantimentData(slug) {
  return new Promise((resolve, reject) => {
    const query = `{
      sentiment: getMetric(metric: "sentiment_balance_total") {
        timeseriesData(slug: "${slug}", from: "utc_now-1d", to: "utc_now", interval: "1d") {
          datetime
          value
        }
      }
      price: getMetric(metric: "price_usd") {
        timeseriesData(slug: "${slug}", from: "utc_now-1d", to: "utc_now", interval: "1d") {
          datetime
          value
        }
      }
    }`;

    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: 'api.santiment.net',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Apikey ${SANTIMENT_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.errors) {
            reject(new Error(result.errors[0].message));
          } else {
            const sentiment = result.data.sentiment.timeseriesData;
            const price = result.data.price.timeseriesData;
            
            // Get latest values
            const latestSentiment = sentiment[sentiment.length - 1]?.value || 0;
            const latestPrice = price[price.length - 1]?.value || 0;
            
            resolve({
              sentiment: Math.round(latestSentiment * 100), // Scale for int storage
              price: ethers.parseEther(latestPrice.toFixed(18).slice(0, 20)), // 18 decimals
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log(`\n📊 SentimentOracle Publisher`);
  console.log(`Asset: ${asset}`);
  console.log(`Network: ${network}`);
  console.log(`Contract: ${deployment.address}\n`);

  // Connect to network
  const provider = new ethers.JsonRpcProvider(NETWORKS[network].url);
  const signer = new ethers.Wallet(WALLET.privateKey, provider);
  
  // Check balance
  const balance = await provider.getBalance(signer.address);
  console.log(`Wallet balance: ${ethers.formatEther(balance)} MON`);
  
  if (balance === 0n) {
    console.error("❌ No MON balance! Get tokens from faucet first.");
    process.exit(1);
  }

  // Connect to contract
  const oracle = new ethers.Contract(deployment.address, artifact.abi, signer);

  // Fetch data from Santiment
  console.log(`\nFetching ${asset} data from Santiment...`);
  const data = await fetchSantimentData(asset);
  
  console.log(`Sentiment: ${data.sentiment / 100}`);
  console.log(`Price: $${ethers.formatEther(data.price)}`);

  // Publish to chain
  console.log(`\nPublishing to Monad ${network}...`);
  const tx = await oracle.publishSentiment(
    asset,
    data.sentiment,
    data.price,
    "santiment.net"
  );
  
  console.log(`TX Hash: ${tx.hash}`);
  console.log(`Waiting for confirmation...`);
  
  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
  
  // Verify
  const stored = await oracle.getLatest(asset);
  console.log(`\nVerification:`);
  console.log(`  Timestamp: ${new Date(Number(stored[0]) * 1000).toISOString()}`);
  console.log(`  Sentiment: ${Number(stored[1]) / 100}`);
  console.log(`  Price: $${ethers.formatEther(stored[2])}`);
  console.log(`  Source: ${stored[3]}`);
}

main().catch(console.error);
