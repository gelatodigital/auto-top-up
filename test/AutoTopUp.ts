import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signer, utils } from "ethers";
import hre = require("hardhat");
import { getGelatoAddress, getOpsAddress } from "../src/config";
const { ethers, deployments } = hre;
import { AutoTopUp, AutoTopUpFactory, IOps } from "../typechain";
import { encodeResolverArgs, Module, ModuleData } from "./utils/modules";

const executorAddress = getGelatoAddress(hre.network.name);
const opsAddress = getOpsAddress(hre);
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

let owner: SignerWithAddress;
let user: SignerWithAddress;
let receiver: SignerWithAddress;
let executor: Signer;

let ownerAddress: string;
let userAddress: string;
let receiverAddress: string;

let autoTopUp: AutoTopUp;
let autoTopUpFactory: AutoTopUpFactory;
let ops: IOps;

describe("Gelato Auto Top Up Test Suite", function () {
  this.timeout(0);
  before("tests", async () => {
    await deployments.fixture();

    [owner, user, receiver] = await ethers.getSigners();
    userAddress = await user.getAddress();
    ownerAddress = await owner.getAddress();
    receiverAddress = await receiver.getAddress();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [executorAddress],
    });

    executor = ethers.provider.getSigner(executorAddress);

    ops = <IOps>await ethers.getContractAt("IOps", opsAddress);

    autoTopUpFactory = <AutoTopUpFactory>(
      await ethers.getContract("AutoTopUpFactory")
    );

    const tx = await autoTopUpFactory.newAutoTopUp(
      [ownerAddress],
      [ethers.utils.parseEther("10")],
      [ethers.utils.parseEther("10")]
    );
    const events = (await tx.wait()).events;
    const logContractDeployedEvent = events?.at(-1);
    const autoTopUpAddress = logContractDeployedEvent?.args?.autoTopUp;

    autoTopUp = <AutoTopUp>(
      await ethers.getContractAt("AutoTopUp", autoTopUpAddress)
    );
  });

  it("Admin can deposit funds", async () => {
    const deposit = utils.parseEther("60");

    // Encode Task
    const preBalance = await ethers.provider.getBalance(autoTopUp.address);
    await owner.sendTransaction({
      value: deposit,
      to: autoTopUp.address,
    });
    const postBalance = await ethers.provider.getBalance(autoTopUp.address);

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

    await expect(autoTopUp.connect(owner).withdraw(amount, ownerAddress)).to.not
      .be.reverted;

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
    ).to.emit(autoTopUp, "LogAddReceiver");
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
      "LogRemoveReceiver"
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
    ).to.emit(autoTopUp, "LogAddReceiver");

    let [canExec, execPayload] = await autoTopUpFactory.checker(
      autoTopUp.address
    );

    expect(canExec).to.be.eql(false);

    const balance = await ethers.provider.getBalance(receiverAddress);
    const ethToWithdraw = balance.sub(balanceThreshold);

    await receiver.sendTransaction({
      value: ethToWithdraw,
      to: executorAddress,
    });

    const preBalance = await ethers.provider.getBalance(receiverAddress);

    [canExec, execPayload] = await autoTopUpFactory.checker(autoTopUp.address);

    expect(canExec).to.be.eql(true);

    const resolverData = autoTopUpFactory.interface.encodeFunctionData(
      "checker",
      [autoTopUp.address]
    );

    const modules = [Module.RESOLVER, Module.PROXY];
    const args = [
      encodeResolverArgs(autoTopUpFactory.address, resolverData),
      "0x",
    ];
    const moduleData: ModuleData = { modules, args };

    const txFee = utils.parseEther("0.1");

    await ops
      .connect(executor)
      .exec(
        autoTopUpFactory.address,
        autoTopUp.address,
        execPayload,
        moduleData,
        txFee,
        ETH,
        false,
        true
      );

    const postBalance = await ethers.provider.getBalance(receiverAddress);

    expect(postBalance.gt(preBalance)).to.be.eql(true);

    [canExec] = await autoTopUpFactory.checker(autoTopUp.address);

    expect(canExec).to.be.eql(false);
  });

  it("Receiver should be querieable off-chain", async () => {
    const currentReceivers = await autoTopUp.getReceivers();

    expect(currentReceivers).to.include(receiverAddress);
    expect(currentReceivers).to.include(ownerAddress);
  });
});
