import { ethers } from "ethers";
import fs from "fs";
import os from "os";

const wallet = JSON.parse(fs.readFileSync(os.homedir() + '/.evm-wallet.json', 'utf8'));

// Check both testnet and mainnet
const networks = [
  { name: "Monad Testnet", url: "https://testnet-rpc.monad.xyz", chainId: 10143 },
  { name: "Monad Mainnet", url: "https://rpc.monad.xyz", chainId: 143 }
];

for (const net of networks) {
  try {
    const provider = new ethers.JsonRpcProvider(net.url);
    const balance = await provider.getBalance(wallet.address);
    console.log(`${net.name}: ${ethers.formatEther(balance)} MON`);
  } catch (e) {
    console.log(`${net.name}: Error - ${e.message}`);
  }
}
