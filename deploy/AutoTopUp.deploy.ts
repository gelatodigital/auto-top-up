import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { sleep } from "../src/utils/sleep";
import { getOpsAddress } from "../src/config";
import { ethers } from "hardhat";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name !== "hardhat") {
    console.log(`Deploying Ops to ${hre.network.name}. Hit ctrl + c to abort`);
    await sleep(10000);
  }

  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  const opsAddress = getOpsAddress(hre);
  const autoTopUpFactory = (await ethers.getContract("AutoTopUpFactory"))
    .address;

  await deploy("AutoTopUp", {
    from: deployer,

    args: [opsAddress, autoTopUpFactory],
  });
};

export default func;

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const shouldSkip = hre.network.name !== "hardhat";
  return shouldSkip;
};

func.tags = ["AutoTopUp"];
func.dependencies = ["AutoTopUpFactory"];
