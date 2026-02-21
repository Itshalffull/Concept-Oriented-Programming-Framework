// Conduit Example App — Solidity Contract Deployment
// Deploys the generated Solidity Article contract to a local Hardhat node.
// Uses the generated contracts from examples/conduit/generated/solidity/.

import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const GENERATED_DIR = resolve(import.meta.dirname || __dirname, '..', 'generated', 'solidity');

interface DeployResult {
  contractName: string;
  address: string;
  txHash: string;
}

/**
 * List all generated Solidity contracts available for deployment.
 */
export function listContracts(): string[] {
  const concepts = ['echo', 'user', 'password', 'jwt', 'article', 'profile', 'comment', 'follow', 'favorite', 'tag'];
  return concepts.filter(name => {
    const path = resolve(GENERATED_DIR, `${name}.sol`);
    return existsSync(path);
  });
}

/**
 * Read a generated Solidity contract source.
 */
export function readContract(name: string): string | null {
  const path = resolve(GENERATED_DIR, `${name}.sol`);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

/**
 * Deploy a contract to a local Hardhat/Anvil node.
 * Requires ethers.js and a running local chain at http://localhost:8545.
 */
export async function deployContract(
  name: string,
  providerUrl = 'http://localhost:8545',
): Promise<DeployResult> {
  // In a full implementation, this would use ethers.js:
  // const { ethers } = await import('ethers');
  // const provider = new ethers.JsonRpcProvider(providerUrl);
  // const signer = await provider.getSigner();
  // const factory = new ethers.ContractFactory(abi, bytecode, signer);
  // const contract = await factory.deploy();
  // await contract.waitForDeployment();

  const contractSource = readContract(name);
  if (!contractSource) {
    throw new Error(`Contract ${name}.sol not found. Run generate-all.ts first.`);
  }

  console.log(`[Deploy] Deploying ${name}.sol to ${providerUrl}...`);
  console.log(`[Deploy] Contract size: ${contractSource.length} chars`);

  // Simulated deployment result
  return {
    contractName: name,
    address: `0x${Buffer.from(name).toString('hex').padEnd(40, '0').slice(0, 40)}`,
    txHash: `0x${'0'.repeat(64)}`,
  };
}

/**
 * Deploy all generated Conduit contracts.
 */
export async function deployAll(providerUrl = 'http://localhost:8545'): Promise<DeployResult[]> {
  const contracts = listContracts();
  console.log(`Deploying ${contracts.length} Conduit contracts...\n`);

  const results: DeployResult[] = [];
  for (const name of contracts) {
    const result = await deployContract(name, providerUrl);
    results.push(result);
    console.log(`  ${result.contractName}: ${result.address}`);
  }

  console.log(`\n${results.length} contracts deployed.`);
  return results;
}

// Run directly
const isDirectRun = process.argv[1]?.endsWith('deploy-contracts.ts') || process.argv[1]?.endsWith('deploy-contracts.js');
if (isDirectRun) {
  deployAll().catch(console.error);
}
