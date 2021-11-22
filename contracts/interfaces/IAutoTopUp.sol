// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface IAutoTopUp {
    struct TopUpData {
        uint256 amount;
        uint256 balanceThreshold;
    }

    function topUp(
        address payable _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) external;

    function getReceivers()
        external
        view
        returns (address[] memory currentReceivers);

    function receiverDetails(address receiver)
        external
        view
        returns (TopUpData memory topUpData);
}
