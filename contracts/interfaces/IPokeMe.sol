// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface IPokeMe {
    function exec(
        uint256 _txFee,
        address _feeToken,
        address _taskCreator,
        bool _useTaskTreasuryFunds,
        bytes32 _resolverHash,
        address _execAddress,
        bytes calldata _execData
    ) external;

    function createTaskNoPrepayment(
        address _execAddress,
        bytes4 _execSelector,
        address _resolverAddress,
        bytes calldata _resolverData,
        address _feeToken
    ) external returns (bytes32 task);

    function gelato() external view returns (address payable);

    function getFeeDetails() external view returns (uint256, address);

    function getTaskIdsByUser(address _taskCreator)
        external
        view
        returns (bytes32[] memory);

    function getResolverHash(
        address _resolverAddress,
        bytes memory _resolverData
    ) external pure returns (bytes32);
}
