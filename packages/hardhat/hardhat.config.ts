import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "@cofhe/hardhat-plugin";
import * as dotenv from "dotenv";


dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  defaultNetwork: "hardhat",
  // defaultNetwork: 'localcofhe',
  networks: {
    // The plugin already provides localcofhe configuration

    // Sepolia testnet configuration
    "eth-sepolia": {
      url:
        process.env.SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasMultiplier: 1.2,
      timeout: 60000,
      httpHeaders: {},
    },

    // Arbitrum Sepolia testnet configuration
    "arb-sepolia": {
      url:
        process.env.ARBITRUM_SEPOLIA_RPC_URL ||
        "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 421614,
      gasMultiplier: 1.2,
      timeout: 60000,
      httpHeaders: {},
    },

    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      gasMultiplier: 1.2,
      timeout: 60000,
      httpHeaders: {},
    },
  },
};

export default config;
