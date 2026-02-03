#!/usr/bin/env node
/**
 * Deploy AgentMemoryRegistry contract
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORKS = {
  testnet: {
    rpc: "https://testnet-rpc.monad.xyz",
    chainId: 10143,
  },
  mainnet: {
    rpc: "https://rpc.monad.xyz",
    chainId: 143,
  }
};

async function main() {
  const network = process.argv[2] || "testnet";
  console.log("🚀 Deploying AgentMemoryRegistry...\n");

  // Load wallet
  const walletPath = path.join(process.env.HOME, ".evm-wallet.json");
  const wallet = JSON.parse(fs.readFileSync(walletPath));
  
  // Connect to network
  const networkConfig = NETWORKS[network];
  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const signer = new ethers.Wallet(wallet.privateKey, provider);

  console.log("Network:", network, `(chain ${networkConfig.chainId})`);
  console.log("Deployer:", signer.address);
  
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "MON\n");

  // Load compiled contract
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "AgentMemoryRegistry.sol", "AgentMemoryRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath));

  // Deploy
  console.log("📦 Deploying contract...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  
  console.log("   TX:", contract.deploymentTransaction().hash);
  console.log("   Waiting for confirmation...");
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log("✅ Deployed to:", address);

  // Save deployment info
  const deployment = {
    contract: "AgentMemoryRegistry",
    address: address,
    deployer: signer.address,
    network: network,
    chainId: networkConfig.chainId,
    deployedAt: new Date().toISOString(),
    txHash: contract.deploymentTransaction().hash
  };

  const deploymentPath = path.join(__dirname, "..", "deployment-registry.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n📝 Deployment saved to deployment-registry.json");

  // Register as agent
  console.log("\n📝 Registering as b0tresch...");
  const tx = await contract.registerAgent("b0tresch");
  console.log("   TX:", tx.hash);
  await tx.wait();
  console.log("✅ Registered!");

  // Verify registration
  const agentInfo = await contract.agents("b0tresch");
  console.log("\nAgent Info:");
  console.log("  Owner:", agentInfo.owner);
  console.log("  Active:", agentInfo.active);

  console.log("\n🎉 Deployment complete!");
  console.log("\nNext: Run 'node scripts/checkpoint.js' to publish your first memory checkpoint");
}

main().catch(console.error);
