// Conduit Example App — Hardhat Configuration
// Local Ethereum development chain for testing Solidity contracts.

export default {
  solidity: '0.8.24',
  paths: {
    sources: '../generated/solidity',
    tests: '../generated/solidity',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://localhost:8545',
    },
  },
};
