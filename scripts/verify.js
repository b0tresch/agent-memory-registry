#!/usr/bin/env node
/**
 * Memory Verification Tool
 * 
 * Verify that a specific memory file was part of a checkpoint.
 * 
 * Usage:
 *   node scripts/verify.js <file> [--checkpoint=N] [--agent=ID]
 *   
 * Examples:
 *   node scripts/verify.js MEMORY.md
 *   node scripts/verify.js memory/2026-02-03.md --checkpoint=0
 *   node scripts/verify.js GOALS.md --agent=b0tresch
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE = "/root/.openclaw/workspace";

const NETWORKS = {
  testnet: {
    rpc: "https://testnet-rpc.monad.xyz",
    chainId: 10143,
  }
};

function hashContent(content) {
  // Use keccak256 to match Solidity
  return Buffer.from(ethers.keccak256(content).slice(2), "hex");
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "--help") {
    console.log(`
🔍 Memory Verification Tool

Verify that a specific memory file was part of an on-chain checkpoint.

Usage:
  node scripts/verify.js <file> [options]

Options:
  --checkpoint=N    Verify against checkpoint N (default: latest)
  --agent=ID        Agent ID to verify (default: b0tresch)
  --network=NET     Network to use (default: testnet)
  --content=TEXT    Verify specific content instead of file

Examples:
  node scripts/verify.js MEMORY.md
  node scripts/verify.js memory/2026-02-03.md --checkpoint=0
  node scripts/verify.js --content="I decided to pivot" --checkpoint=1
`);
    return;
  }

  // Parse arguments
  const fileArg = args.find(a => !a.startsWith("--"));
  const checkpointArg = args.find(a => a.startsWith("--checkpoint="));
  const agentArg = args.find(a => a.startsWith("--agent="));
  const contentArg = args.find(a => a.startsWith("--content="));
  
  const agentId = agentArg ? agentArg.split("=")[1] : "b0tresch";
  const checkpointIndex = checkpointArg ? parseInt(checkpointArg.split("=")[1]) : null;

  console.log("🔍 Memory Verification Tool");
  console.log("===========================\n");

  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", "deployment-registry.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No deployment found. Deploy the contract first.");
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath));

  // Connect to network
  const provider = new ethers.JsonRpcProvider(NETWORKS.testnet.rpc);
  
  // Load contract
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "AgentMemoryRegistry.sol", "AgentMemoryRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath));
  const contract = new ethers.Contract(deployment.address, artifact.abi, provider);

  // Get checkpoint info
  const checkpointCount = await contract.getCheckpointCount(agentId);
  console.log(`📊 Agent "${agentId}" has ${checkpointCount} checkpoint(s)\n`);

  if (checkpointCount === 0n) {
    console.log("❌ No checkpoints to verify against.");
    process.exit(1);
  }

  const targetIndex = checkpointIndex !== null ? checkpointIndex : Number(checkpointCount) - 1;
  const checkpoint = await contract.getCheckpoint(agentId, targetIndex);
  
  console.log(`🎯 Verifying against checkpoint #${targetIndex}:`);
  console.log(`   Merkle Root: ${checkpoint.merkleRoot}`);
  console.log(`   Timestamp: ${new Date(Number(checkpoint.timestamp) * 1000).toISOString()}`);
  console.log(`   Block: ${checkpoint.blockNumber}`);
  
  // Parse metadata if present
  try {
    const meta = JSON.parse(checkpoint.metadata);
    console.log(`   Files: ${meta.files}, Bytes: ${meta.bytes}`);
  } catch {}
  
  console.log();

  // Find local checkpoint file with proofs
  const checkpointsDir = path.join(__dirname, "..", "checkpoints");
  if (!fs.existsSync(checkpointsDir)) {
    console.log("⚠️  No local checkpoint records. Can show on-chain data but not verify proofs.");
    console.log("   Run checkpoint.js to create local proof records.");
    return;
  }

  // Find checkpoint file matching this root
  const checkpointFiles = fs.readdirSync(checkpointsDir).filter(f => f.endsWith(".json"));
  let localCheckpoint = null;
  
  for (const file of checkpointFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(checkpointsDir, file)));
    if (data.root === checkpoint.merkleRoot) {
      localCheckpoint = data;
      break;
    }
  }

  if (!localCheckpoint) {
    console.log("⚠️  No local record for this checkpoint root.");
    console.log("   The checkpoint exists on-chain, but I don't have the proofs locally.");
    return;
  }

  // If verifying specific content
  if (contentArg) {
    const content = contentArg.split("=").slice(1).join("=");
    const contentHash = "0x" + hashContent(Buffer.from(content)).toString("hex");
    console.log(`📝 Verifying content: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`);
    console.log(`   Hash: ${contentHash}\n`);
    
    // Check if this hash matches any file in the checkpoint
    const match = localCheckpoint.proofs.find(p => p.hash === contentHash);
    if (match) {
      console.log(`✅ VERIFIED! This content was in file: ${match.file}`);
    } else {
      console.log(`❌ NOT FOUND. This exact content was not in the checkpoint.`);
      console.log(`   (Note: File hashes include the entire file, not substrings)`);
    }
    return;
  }

  // Verify file
  if (!fileArg) {
    console.log("📁 Files in this checkpoint:");
    for (const proof of localCheckpoint.proofs) {
      console.log(`   ${proof.file}`);
    }
    return;
  }

  // Resolve file path
  let filePath = fileArg;
  if (!path.isAbsolute(filePath)) {
    filePath = path.join(WORKSPACE, filePath);
  }

  const relativePath = fileArg.includes("/") ? fileArg : path.basename(fileArg);
  
  // Find proof for this file
  const proof = localCheckpoint.proofs.find(p => 
    p.file === relativePath || 
    p.file === path.basename(fileArg)
  );

  if (!proof) {
    console.log(`❌ File "${relativePath}" not found in checkpoint.`);
    console.log("\n📁 Files in this checkpoint:");
    for (const p of localCheckpoint.proofs) {
      console.log(`   ${p.file}`);
    }
    return;
  }

  console.log(`📄 File: ${proof.file}`);
  console.log(`   Checkpoint hash: ${proof.hash}`);

  // Check current file if it exists
  if (fs.existsSync(filePath)) {
    const currentContent = fs.readFileSync(filePath);
    const currentHash = "0x" + hashContent(currentContent).toString("hex");
    console.log(`   Current hash:    ${currentHash}`);
    
    if (currentHash === proof.hash) {
      console.log(`\n✅ VERIFIED: File unchanged since checkpoint!`);
    } else {
      console.log(`\n⚠️  FILE MODIFIED since checkpoint`);
      console.log(`   The current file differs from the checkpointed version.`);
    }
  } else {
    console.log(`   (File no longer exists locally)`);
  }

  // Verify on-chain
  console.log(`\n🔗 Verifying merkle proof on-chain...`);
  
  const isValid = await contract.verifyProof(
    agentId,
    targetIndex,
    proof.hash,
    proof.proof
  );

  if (isValid) {
    console.log(`✅ ON-CHAIN VERIFIED: Proof is valid!`);
    console.log(`\n   This proves "${proof.file}" with hash ${proof.hash.slice(0, 18)}...`);
    console.log(`   was part of ${agentId}'s memory at ${new Date(Number(checkpoint.timestamp) * 1000).toISOString()}`);
  } else {
    console.log(`❌ VERIFICATION FAILED: Proof is invalid.`);
  }
}

main().catch(console.error);
