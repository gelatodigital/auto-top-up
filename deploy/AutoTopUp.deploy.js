const sleep = "../src/utils/sleep.js";
const { network } = require("hardhat");

module.exports = async (hre) => {
  /*if (hre.network.name=='ropsten') {
      return   // dumb hack to deploy after oracle aggregator
  }*/
  if (hre.network.name === "mainnet") {
    console.log("\n\n Deploying AutoTopUp to mainnet. Hit ctrl + c to abort");
    console.log("❗ AutoTopUp DEPLOYMENT: VERIFY");
    await sleep(10000);
  }
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy("AutoTopUp", {
    from: deployer,
    args: [hre.network.config.Gelato],
    gasPrice: network.config.gasPrice,
    gasLimit: 5000000,
  });
};

module.exports.tags = ["AutoTopUp"];
