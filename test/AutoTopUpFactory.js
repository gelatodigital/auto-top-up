const { expect } = require("chai");
const { ethers, network, deployments, waffle } = require("hardhat");
const { utils } = ethers;

let owner;
let user;
let receiver;

let userAddress;
let receiverAddress;

let executorAddress = network.config.GelatoExecutor;
let autoTopUpFactory;

describe("Gelato Auto Top Up Factory Test Suite", function () {
  this.timeout(0);
  before("tests", async () => {
    [owner, user, receiver] = await ethers.getSigners();
    userAddress = await user.getAddress();
    receiverAddress = await receiver.getAddress();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [executorAddress],
    });

    const autoTopUpFactoryDeployer = await ethers.getContractFactory(
      "AutoTopUpFactory"
    );
    autoTopUpFactory = await autoTopUpFactoryDeployer.deploy(
      network.config.PokeMe
    );
  });

  it("Check if AutoTopTop deploys correctly", async () => {
    const deposit = utils.parseEther("40");
    const amount = utils.parseEther("10");
    const balanceThreshold = utils.parseEther("10");

    await autoTopUpFactory
      .connect(owner)
      .newAutoTopUp(
        [receiverAddress, userAddress],
        [amount, amount],
        [balanceThreshold, balanceThreshold],
        {
          value: deposit,
        }
      );

    const block = await ethers.provider.getBlock();
    const topics = autoTopUpFactory.filters.LogContractDeployed().topics;
    const filter = {
      address: autoTopUpFactory.address.toLowerCase(),
      blockhash: block.hash,
      topics,
    };
    const logs = await ethers.provider.getLogs(filter);
    if (logs.length !== 1) {
      throw Error("cannot find AutoTopUp");
    }
    const event = autoTopUpFactory.interface.parseLog(logs[0]);
    const autoTopUpAddress = event.args.autoTopUp;

    const autoTopUp = await ethers.getContractAt("AutoTopUp", autoTopUpAddress);

    // Check if auto Top Up was actiaved
    const currentReceivers = await autoTopUp.getReceivers();
    expect(currentReceivers[0]).to.be.eq(receiverAddress);

    // check that no one else can withdraw funds form auto top up
    await expect(
      autoTopUp.connect(user).withdraw(amount, userAddress)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    // Check balance of autoTopUp
    const balance = await waffle.provider.getBalance(autoTopUp.address);
    expect(balance).to.be.eq(deposit);

    // owner can cancel auto to up
    await expect(autoTopUp.connect(owner).stopAutoPay(receiverAddress)).to.emit(
      autoTopUp,
      "LogTaskCancelled"
    );
  });
});
