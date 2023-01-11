import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { utils } from "ethers";
import hre = require("hardhat");
import { getGelatoAddress, getOpsAddress } from "../src/config";
const { ethers, deployments } = hre;
import { AutoTopUpFactory, IOps } from "../typechain";

const executorAddress = getGelatoAddress(hre.network.name);
const opsAddress = getOpsAddress(hre);

let owner: SignerWithAddress;
let user: SignerWithAddress;
let receiver: SignerWithAddress;

let userAddress: string;
let receiverAddress: string;

let autoTopUpFactory: AutoTopUpFactory;
let ops: IOps;

describe("Gelato Auto Top Up Factory Test Suite", function () {
  this.timeout(0);
  before("tests", async () => {
    await deployments.fixture();

    [owner, user, receiver] = await ethers.getSigners();
    userAddress = await user.getAddress();
    receiverAddress = await receiver.getAddress();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [executorAddress],
    });

    autoTopUpFactory = <AutoTopUpFactory>(
      await ethers.getContract("AutoTopUpFactory")
    );
    ops = <IOps>await ethers.getContractAt("IOps", opsAddress);
  });

  it("Check if AutoTopUpFactory deploys correctly", async () => {
    const deposit = utils.parseEther("40");
    const amount = utils.parseEther("10");
    const balanceThreshold = utils.parseEther("10");

    const tx = await autoTopUpFactory
      .connect(owner)
      .newAutoTopUp(
        [receiverAddress, userAddress],
        [amount, amount],
        [balanceThreshold, balanceThreshold],
        {
          value: deposit,
        }
      );

    const events = (await tx.wait()).events;
    const logContractDeployedEvent = events?.at(-1);
    const autoTopUpAddress = logContractDeployedEvent?.args?.autoTopUp;
    const opsTaskId = logContractDeployedEvent?.args?.taskId;

    const autoTopUp = await ethers.getContractAt("AutoTopUp", autoTopUpAddress);

    // Check if auto Top Up was actiaved
    const currentReceivers = await autoTopUp.getReceivers();
    expect(currentReceivers[0]).to.be.eq(receiverAddress);

    // check that no one else can withdraw funds form auto top up
    await expect(
      autoTopUp.connect(user).withdraw(amount, userAddress)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    // Check balance of autoTopUp
    const balance = await ethers.provider.getBalance(autoTopUp.address);
    expect(balance).to.be.eq(deposit);

    // owner can cancel auto to up
    await expect(autoTopUp.connect(owner).stopAutoPay(receiverAddress)).to.emit(
      autoTopUp,
      "LogRemoveReceiver"
    );

    // check if task was created on ops
    const taskIds = await ops.getTaskIdsByUser(autoTopUpFactory.address);
    expect(taskIds).include(opsTaskId);
  });
});
