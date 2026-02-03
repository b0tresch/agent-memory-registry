import fs from 'fs';
import os from 'os';
import "@nomicfoundation/hardhat-toolbox";

// Load wallet
const wallet = JSON.parse(fs.readFileSync(os.homedir() + '/.evm-wallet.json', 'utf8'));

export default {
  solidity: "0.8.19",
  networks: {
    monadTestnet: {
      type: "http",
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [wallet.privateKey]
    },
    monadMainnet: {
      type: "http", 
      url: "https://rpc.monad.xyz",
      chainId: 143,
      accounts: [wallet.privateKey]
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
