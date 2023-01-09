import { HardhatUserConfig } from "hardhat/config";

// PLUGINS
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-deploy";

// Process Env Variables
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/.env" });

// Libraries
import assert from "assert";

// @dev Put this in .env
const ALCHEMY_ID = process.env.ALCHEMY_ID;
assert.ok(ALCHEMY_ID, "no Alchemy ID in process.env");

// @dev fill this out
const DEPLOYER_PK_MAINNET = process.env.DEPLOYER_PK_MAINNET;
const ETHERSCAN_API = process.env.ETHERSCAN_API;

// ================================= CONFIG =========================================
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  namedAccounts: {
    deployer: {
      default: 0,
    },
  },

  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
        blockNumber: 16367100,
      },
    },
    mainnet: {
      accounts: DEPLOYER_PK_MAINNET ? [DEPLOYER_PK_MAINNET] : [],
      chainId: 1,
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.8.16",
      },
    ],
  },

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },

  verify: {
    etherscan: {
      apiKey: ETHERSCAN_API,
    },
  },
};

export default config;
