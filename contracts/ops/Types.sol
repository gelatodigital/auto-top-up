// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

enum Module {RESOLVER, TIME, PROXY, SINGLE_EXEC}

struct ModuleData {
    Module[] modules;
    bytes[] args;
}

interface IOps {
    function createTask(
        address execAddress,
        bytes calldata execDataOrSelector,
        ModuleData calldata moduleData,
        address feeToken
    ) external returns (bytes32 taskId);

    function cancelTask(bytes32 taskId) external;

    function exec(
        address taskCreator,
        address execAddress,
        bytes memory execData,
        ModuleData calldata moduleData,
        uint256 txFee,
        address feeToken,
        bool useTaskTreasuryFunds,
        bool revertOnFailure
    ) external;

    function getFeeDetails() external view returns (uint256, address);

    function gelato() external view returns (address payable);

    function getTaskIdsByUser(address taskCreator)
        external
        view
        returns (bytes32[] memory);

    function taskTreasury() external view returns (ITaskTreasuryUpgradable);
}

interface ITaskTreasuryUpgradable {
    function depositFunds(
        address receiver,
        address token,
        uint256 amount
    ) external payable;

    function withdrawFunds(
        address payable receiver,
        address token,
        uint256 amount
    ) external;
}

interface IOpsProxyFactory {
    function getProxyOf(address account) external view returns (address, bool);
}
