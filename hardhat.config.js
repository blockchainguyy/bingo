require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");
require("hardhat-gas-reporter");

module.exports = {
  solidity: "0.8.17",
  gasReporter: {
    enabled: true,
    currency: "CHF",
    gasPrice: 21,
  },
};
