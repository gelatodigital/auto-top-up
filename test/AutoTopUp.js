const { expect } = require("chai");
const { ethers, network, waffle } = require("hardhat");
const { getGasPrice } = require("./helpers/gelatoHelper");
const { utils } = ethers;

const ETH = network.config.ETH;
const MAX_GAS = ethers.utils.parseUnits("90", "gwei");
let owner;
let user;
let receiver;
let ownerAddress;
let userAddress;
let receiverAddress;
let executor;
let executorAddress = network.config.Gelato;
let autoTopUp;
let autoTopUpFactory;
let pokeMe;
let gasPrice;
let resolverHash;

describe("Gelato Auto Top Up Test Suite", function () {
  this.timeout(0);
  before("tests", async () => {
    [owner, user, receiver] = await ethers.getSigners();
    userAddress = await user.getAddress();
    ownerAddress = await owner.getAddress();
    receiverAddress = await receiver.getAddress();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [executorAddress],
    });

    gasPrice = await getGasPrice();

    executor = await ethers.provider.getSigner(executorAddress);

    pokeMe = await ethers.getContractAt("IPokeMe", network.config.PokeMe);

    const autoTopUpDeployer = await ethers.getContractFactory("AutoTopUp");
    autoTopUp = await autoTopUpDeployer.deploy(network.config.PokeMe);

    const autoTopUpFactoryDeployer = await ethers.getContractFactory(
      "AutoTopUpFactory"
    );
    autoTopUpFactory = await autoTopUpFactoryDeployer.deploy(
      network.config.PokeMe
    );
  });

  it("Create task on pokeMe", async () => {
    const resolverData = autoTopUpFactory.interface.encodeFunctionData(
      "checker",
      [autoTopUp.address, MAX_GAS]
    );

    resolverHash = await pokeMe.getResolverHash(
      autoTopUpFactory.address,
      resolverData
    );

    await pokeMe
      .connect(owner)
      .createTaskNoPrepayment(
        autoTopUp.address,
        autoTopUp.interface.getSighash("topUp"),
        autoTopUpFactory.address,
        resolverData,
        ETH
      );

    const ids = await pokeMe.getTaskIdsByUser(ownerAddress);
    expect(ids.length).to.be.eql(1);
  });

  it("Admin can deposit funds", async () => {
    const deposit = utils.parseEther("60");

    // Encode Task
    const preBalance = await waffle.provider.getBalance(autoTopUp.address);
    await owner.sendTransaction({
      value: deposit,
      to: autoTopUp.address,
    });
    const postBalance = await waffle.provider.getBalance(autoTopUp.address);

    expect(postBalance.sub(preBalance)).to.be.eq(deposit);
  });

  it("Everyone can deposit funds", async () => {
    const deposit = utils.parseEther("1");

    await expect(
      user.sendTransaction({
        value: deposit,
        to: autoTopUp.address,
      })
    ).to.emit(autoTopUp, "LogFundsDeposited");
  });

  it("Only owner can withdraw funds", async () => {
    const amount = utils.parseEther("10");

    const preBalance = await waffle.provider.getBalance(ownerAddress);
    const txReceipt = await autoTopUp
      .connect(owner)
      .withdraw(amount, ownerAddress, {
        gasPrice: gasPrice,
      });
    const { gasUsed } = await txReceipt.wait();
    const postBalance = await waffle.provider.getBalance(ownerAddress);
    expect(postBalance.sub(preBalance).add(gasUsed.mul(gasPrice))).to.be.eq(
      amount
    );

    await expect(autoTopUp.connect(user).withdraw(amount, userAddress)).to.be
      .reverted;
  });

  it("Only owner should be able to stat an auto pay up", async () => {
    const amount = utils.parseEther("10");
    const balanceThreshold = utils.parseEther("10");

    await expect(
      autoTopUp
        .connect(user)
        .startAutoPay(receiverAddress, amount, balanceThreshold)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      autoTopUp
        .connect(owner)
        .startAutoPay(receiverAddress, amount, balanceThreshold)
    ).to.emit(autoTopUp, "LogTaskSubmitted");
  });

  it("Owner should not be able to schedule 2 auto top ups for the same receiver", async () => {
    const amount = utils.parseEther("10");
    const balanceThreshold = utils.parseEther("10");

    await expect(
      autoTopUp
        .connect(owner)
        .startAutoPay(receiverAddress, amount, balanceThreshold)
    ).to.be.revertedWith("AutoTopUp: startAutoPay: Receiver already assigned");
  });

  it("Owner should be able to stop existing auto top ups", async () => {
    await expect(autoTopUp.connect(owner).stopAutoPay(receiverAddress)).to.emit(
      autoTopUp,
      "LogTaskCancelled"
    );

    // Owner should not be able to cancel again
    await expect(
      autoTopUp.connect(owner).stopAutoPay(receiverAddress)
    ).to.be.revertedWith("AutoTopUp: stopAutoPay: Invalid Autopay");
  });

  it("gelato should only be able to execute auto topup if balance balanceThreshold is met", async () => {
    const amount = utils.parseEther("10");
    const balanceThreshold = utils.parseEther("10");

    // Submit AutoPay task
    await expect(
      autoTopUp
        .connect(owner)
        .startAutoPay(receiverAddress, amount, balanceThreshold)
    ).to.emit(autoTopUp, "LogTaskSubmitted");

    let [canExec, execPayload] = await autoTopUpFactory.checker(
      autoTopUp.address,
      MAX_GAS
    );

    expect(canExec).to.be.eql(false);

    const balance = await ethers.provider.getBalance(receiverAddress);
    const ethToWithdraw = balance.sub(balanceThreshold);

    await receiver.sendTransaction({
      value: ethToWithdraw,
      to: executorAddress,
      gasPrice: gasPrice,
    });

    const preBalance = await ethers.provider.getBalance(receiverAddress);

    // !canExec when gasprice > maxGasPrice
    [canExec, execPayload] = await autoTopUpFactory.checker(
      autoTopUp.address,
      MAX_GAS,
      { gasPrice: MAX_GAS.add(1) }
    );

    expect(canExec).to.be.eql(false);

    [canExec, execPayload] = await autoTopUpFactory.checker(
      autoTopUp.address,
      MAX_GAS,
      { gasPrice: MAX_GAS }
    );

    expect(canExec).to.be.eql(true);

    await pokeMe
      .connect(executor)
      .exec(
        ethers.utils.parseEther("1"),
        ETH,
        ownerAddress,
        false,
        resolverHash,
        autoTopUp.address,
        execPayload
      );

    const postBalance = await ethers.provider.getBalance(receiverAddress);

    expect(postBalance.gt(preBalance)).to.be.eql(true);

    [canExec] = await autoTopUpFactory.checker(autoTopUp.address, MAX_GAS);

    expect(canExec).to.be.eql(false);
  });

  it("Receiver should be querieable off-chain", async () => {
    const currentReceivers = await autoTopUp.getReceivers();

    expect(currentReceivers[0]).to.be.eq(receiverAddress);
  });
});
