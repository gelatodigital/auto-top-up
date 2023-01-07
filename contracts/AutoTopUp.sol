// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import {
    EnumerableSet
} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {
    SafeERC20,
    IERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./ops/OpsReady.sol";

contract AutoTopUp is Ownable, OpsReady {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct TopUpData {
        uint256 amount;
        uint256 balanceThreshold;
    }

    EnumerableSet.AddressSet internal _receivers;
    mapping(address => bytes32) public hashes;
    mapping(address => TopUpData) public receiverDetails;

    event LogFundsDeposited(address indexed sender, uint256 amount);
    event LogFundsWithdrawn(
        address indexed sender,
        uint256 amount,
        address receiver
    );
    event LogTaskSubmitted(
        address indexed receiver,
        uint256 amount,
        uint256 balanceThreshold
    );
    event LogTaskCancelled(address indexed receiver, bytes32 cancelledHash);

    // solhint-disable no-empty-blocks
    constructor(address _ops, address _autoTopUpFactory)
        OpsReady(_ops, _autoTopUpFactory)
    {}

    /// @notice deposit funds
    receive() external payable {
        emit LogFundsDeposited(msg.sender, msg.value);
    }

    /// @notice withdraw fuds
    function withdraw(uint256 _amount, address payable _receiver)
        external
        onlyOwner
    {
        (bool success, ) = _receiver.call{value: _amount}("");
        require(success, "AutoTopUp: exec: Receiver payment failed");

        emit LogFundsWithdrawn(msg.sender, _amount, _receiver);
    }

    /// @notice start an autopay
    function startAutoPay(
        address payable _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) external payable onlyOwner {
        require(
            !_receivers.contains(_receiver),
            "AutoTopUp: startAutoPay: Receiver already assigned"
        );

        require(
            hashes[_receiver] == bytes32(0),
            "AutoTopUp: startAutoPay: Hash already assigned"
        );

        _receivers.add(_receiver);

        hashes[_receiver] = keccak256(abi.encode(_amount, _balanceThreshold));
        receiverDetails[_receiver] = TopUpData({
            amount: _amount,
            balanceThreshold: _balanceThreshold
        });

        emit LogTaskSubmitted(_receiver, _amount, _balanceThreshold);
    }

    /// @notice stop an autopay
    function stopAutoPay(address payable _receiver) external onlyOwner {
        require(
            _receivers.contains(_receiver),
            "AutoTopUp: stopAutoPay: Invalid Autopay"
        );

        bytes32 storedHash = hashes[_receiver];

        require(
            storedHash != bytes32(0),
            "AutoTopUp: stopAutoPay: Hash not found"
        );

        // store receiver
        _receivers.remove(_receiver);

        delete hashes[_receiver];
        delete receiverDetails[_receiver];

        emit LogTaskCancelled(_receiver, storedHash);
    }

    /// @dev entry point for gelato executiom
    /// @notice overcharging is prevented on Gelato.sol
    function topUp(
        address payable _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) external onlyDedicatedMsgSender {
        require(
            isScheduled(_receiver, _amount, _balanceThreshold),
            "AutoTopUp: exec: Hash invalid"
        );
        require(
            _receiver.balance <= _balanceThreshold,
            "AutoTopUp: exec: Balance not below threshold"
        );

        bool success;
        (success, ) = _receiver.call{value: _amount}("");
        require(success, "AutoTopUp: exec: Receiver payment failed");

        uint256 fee;
        address feeToken;
        (fee, feeToken) = ops.getFeeDetails();

        _transfer(fee, feeToken);
    }

    /// @notice Get all receivers
    /// @dev useful to query which autoPays to cancel
    function getReceivers()
        external
        view
        returns (address[] memory currentReceivers)
    {
        uint256 length = _receivers.length();
        currentReceivers = new address[](length);
        for (uint256 i; i < length; i++) currentReceivers[i] = _receivers.at(i);
    }

    function isScheduled(
        address payable _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) public view returns (bool) {
        return
            hashes[_receiver] ==
            keccak256(abi.encode(_amount, _balanceThreshold));
    }
}
