import toolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [toolboxMochaEthersPlugin],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    default: {
      type: "edr-simulated",
      allowBlocksWithSameTimestamp: true,
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
  },
});
