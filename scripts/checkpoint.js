#!/usr/bin/env node
/**
 * Memory Checkpoint Publisher
 * 
 * Reads b0tresch's actual memory files, builds a merkle tree,
 * and publishes the root on-chain.
 * 
 * Usage:
 *   node scripts/checkpoint.js [--dry-run] [--network=testnet|mainnet]
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ Configuration ============

const MEMORY_PATHS = [
  "/root/.openclaw/workspace/MEMORY.md",
  "/root/.openclaw/workspace/AGENTS.md",
  "/root/.openclaw/workspace/SOUL.md",
  "/root/.openclaw/workspace/USER.md",
  "/root/.openclaw/workspace/IDENTITY.md",
  "/root/.openclaw/workspace/GOALS.md",
  "/root/.openclaw/workspace/TOOLS.md",
  "/root/.openclaw/workspace/HEARTBEAT.md",
];

const MEMORY_DIR = "/root/.openclaw/workspace/memory";

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

// ============ Merkle Tree ============

class MerkleTree {
  constructor(leaves, alreadyHashed = false) {
    // If leaves are already hashed (32-byte buffers), use directly
    // Otherwise hash them
    this.leaves = alreadyHashed ? leaves : leaves.map(l => this.hash(l));
    this.layers = [this.leaves];
    this.buildTree();
  }

  hash(data) {
    // Use keccak256 to match Solidity's keccak256
    if (Buffer.isBuffer(data)) {
      return Buffer.from(ethers.keccak256(data).slice(2), "hex");
    }
    return Buffer.from(ethers.keccak256(Buffer.from(data)).slice(2), "hex");
  }

  hashPair(a, b) {
    // Sort to ensure consistent ordering
    const sorted = Buffer.compare(a, b) <= 0 ? [a, b] : [b, a];
    return this.hash(Buffer.concat(sorted));
  }

  buildTree() {
    let currentLayer = this.leaves;
    
    while (currentLayer.length > 1) {
      const nextLayer = [];
      
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          nextLayer.push(this.hashPair(currentLayer[i], currentLayer[i + 1]));
        } else {
          // Odd number of nodes - promote the last one
          nextLayer.push(currentLayer[i]);
        }
      }
      
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  getRoot() {
    const topLayer = this.layers[this.layers.length - 1];
    return topLayer.length > 0 ? topLayer[0] : Buffer.alloc(32);
  }

  getRootHex() {
    return "0x" + this.getRoot().toString("hex");
  }

  getProof(index) {
    if (index >= this.leaves.length) {
      throw new Error("Index out of bounds");
    }

    const proof = [];
    let currentIndex = index;

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < layer.length) {
        proof.push("0x" + layer[siblingIndex].toString("hex"));
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }
}

// ============ Memory Reading ============

function getAllMemoryFiles() {
  const files = [];

  // Core memory files
  for (const filePath of MEMORY_PATHS) {
    if (fs.existsSync(filePath)) {
      files.push({
        path: filePath,
        relativePath: path.basename(filePath),
      });
    }
  }

  // Daily memory files
  if (fs.existsSync(MEMORY_DIR)) {
    const dailyFiles = fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith(".md"))
      .map(f => ({
        path: path.join(MEMORY_DIR, f),
        relativePath: `memory/${f}`,
      }));
    files.push(...dailyFiles);
  }

  return files;
}

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  // Use keccak256 to match Solidity
  return Buffer.from(ethers.keccak256(content).slice(2), "hex");
}

function buildMemoryCheckpoint() {
  const files = getAllMemoryFiles();
  console.log(`\n📁 Found ${files.length} memory files:\n`);

  const fileHashes = files.map(f => {
    const hash = hashFile(f.path);
    const stat = fs.statSync(f.path);
    console.log(`  ${f.relativePath}`);
    console.log(`    Hash: ${hash.toString("hex").slice(0, 16)}...`);
    console.log(`    Size: ${stat.size} bytes`);
    console.log(`    Modified: ${stat.mtime.toISOString()}`);
    return {
      ...f,
      hash,
      size: stat.size,
      modified: stat.mtime,
    };
  });

  // Build merkle tree
  const tree = new MerkleTree(fileHashes.map(f => f.hash), true); // already hashed
  
  return {
    files: fileHashes,
    tree,
    root: tree.getRootHex(),
    fileCount: files.length,
    totalBytes: fileHashes.reduce((sum, f) => sum + f.size, 0),
    timestamp: new Date().toISOString(),
  };
}

// ============ On-chain Publishing ============

async function publishCheckpoint(checkpoint, network, dryRun) {
  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", "deployment-registry.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("\n❌ No deployment found. Run deploy-registry.js first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath));
  console.log(`\n📍 Using contract at ${deployment.address}`);

  // Load wallet
  const walletPath = path.join(process.env.HOME, ".evm-wallet.json");
  if (!fs.existsSync(walletPath)) {
    console.error("\n❌ No wallet found at ~/.evm-wallet.json");
    process.exit(1);
  }

  const wallet = JSON.parse(fs.readFileSync(walletPath));
  
  // Connect to network
  const networkConfig = NETWORKS[network];
  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const signer = new ethers.Wallet(wallet.privateKey, provider);

  console.log(`\n🔗 Network: ${network} (chain ${networkConfig.chainId})`);
  console.log(`👤 Wallet: ${signer.address}`);

  const balance = await provider.getBalance(signer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} MON`);

  if (dryRun) {
    console.log("\n🧪 DRY RUN - not publishing to chain");
    return;
  }

  // Load contract ABI
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "AgentMemoryRegistry.sol", "AgentMemoryRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath));
  
  const contract = new ethers.Contract(deployment.address, artifact.abi, signer);

  // Build metadata
  const metadata = JSON.stringify({
    files: checkpoint.fileCount,
    bytes: checkpoint.totalBytes,
    timestamp: checkpoint.timestamp,
  });

  console.log(`\n📤 Publishing checkpoint...`);
  console.log(`   Root: ${checkpoint.root}`);
  console.log(`   Metadata: ${metadata}`);

  const tx = await contract.publishCheckpointSimple(checkpoint.root, metadata);
  console.log(`   TX: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

  // Save checkpoint locally
  const checkpointRecord = {
    ...checkpoint,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    network,
    contractAddress: deployment.address,
  };
  
  // Remove tree (not serializable) and add proof info
  delete checkpointRecord.tree;
  checkpointRecord.proofs = checkpoint.files.map((f, i) => ({
    file: f.relativePath,
    hash: "0x" + f.hash.toString("hex"),
    proof: checkpoint.tree.getProof(i),
  }));

  const checkpointsDir = path.join(__dirname, "..", "checkpoints");
  if (!fs.existsSync(checkpointsDir)) {
    fs.mkdirSync(checkpointsDir);
  }

  const checkpointFile = path.join(checkpointsDir, `checkpoint-${Date.now()}.json`);
  fs.writeFileSync(checkpointFile, JSON.stringify(checkpointRecord, null, 2));
  console.log(`\n💾 Checkpoint saved to ${checkpointFile}`);

  return checkpointRecord;
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const networkArg = args.find(a => a.startsWith("--network="));
  const network = networkArg ? networkArg.split("=")[1] : "testnet";

  console.log("🧠 Agent Memory Registry - Checkpoint Publisher");
  console.log("================================================");

  // Build checkpoint
  const checkpoint = buildMemoryCheckpoint();

  console.log(`\n📊 Checkpoint Summary:`);
  console.log(`   Files: ${checkpoint.fileCount}`);
  console.log(`   Total size: ${checkpoint.totalBytes} bytes`);
  console.log(`   Merkle root: ${checkpoint.root}`);

  // Publish
  await publishCheckpoint(checkpoint, network, dryRun);

  console.log("\n🎉 Done!");
}

main().catch(console.error);
