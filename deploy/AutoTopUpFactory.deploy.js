const sleep = "../src/utils/sleep.js";

module.exports = async (hre) => {
  /*if (hre.network.name=='ropsten') {
      return   // dumb hack to deploy after oracle aggregator
  }*/
  if (hre.network.name === "mainnet") {
    console.log(
      "\n\n Deploying AutoTopUpFactory to mainnet. Hit ctrl + c to abort"
    );
    console.log("❗ AutoTopUp DEPLOYMENT: VERIFY");
    await sleep(10000);
  }
  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy("AutoTopUpFactory", {
    from: deployer,
    args: [hre.network.config.Gelato],
    gasPrice: hre.network.config.gasPrice,
    gasLimit: 5000000,
  });
};

module.exports.tags = ["AutoTopUpFactory"];
