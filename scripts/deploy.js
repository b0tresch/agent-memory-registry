import { ethers } from "ethers";
import fs from "fs";
import os from "os";

async function main() {
  // Load wallet
  const wallet = JSON.parse(fs.readFileSync(os.homedir() + '/.evm-wallet.json', 'utf8'));
  
  // Connect to Monad testnet
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
  const signer = new ethers.Wallet(wallet.privateKey, provider);
  
  console.log("Deploying from:", signer.address);
  
  // Check balance
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "MON");
  
  if (balance === 0n) {
    console.error("No MON balance! Get tokens from faucet first.");
    process.exit(1);
  }
  
  // Load compiled contract
  const artifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/SentimentOracle.sol/SentimentOracle.json", "utf8")
  );
  
  // Deploy
  console.log("Deploying SentimentOracle...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log("SentimentOracle deployed to:", address);
  
  // Save deployment info
  const deployment = {
    network: "monadTestnet",
    address: address,
    deployer: signer.address,
    timestamp: new Date().toISOString(),
    txHash: contract.deploymentTransaction()?.hash
  };
  
  fs.writeFileSync("./deployment.json", JSON.stringify(deployment, null, 2));
  console.log("Deployment info saved to deployment.json");
}

main().catch(console.error);
