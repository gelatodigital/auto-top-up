// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    EnumerableSet
} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {AutoTopUp} from "./AutoTopUp.sol";

contract AutoTopUpFactory is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => AutoTopUp) public autoTopUpByOwner;
    mapping(AutoTopUp => address) public ownerByAutoTopUp;

    EnumerableSet.AddressSet internal _autoTopUps;

    address payable public immutable gelato;

    event LogContractDeployed(address indexed autoTopUp, address owner);

    constructor(address payable _gelato) {
        gelato = _gelato;
    }

    function withdraw(uint256 _amount, address payable _to) external onlyOwner {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "AutoTopUpFactory: withdraw: ETH transfer failed");
    }

    function newAutoTopUp(
        address payable[] calldata _receivers,
        uint256[] calldata _amounts,
        uint256[] calldata _balanceThresholds
    ) external payable returns (AutoTopUp autoTopUp) {
        require(
            autoTopUpByOwner[msg.sender] == AutoTopUp(payable(address(0))),
            "AutoTopUpFactory: newAutoTopUp: Already created AutoTopUp"
        );
        require(
            _receivers.length == _amounts.length &&
                _receivers.length == _balanceThresholds.length,
            "AutoTopUpFactory: newAutoTopUp: Input length mismatch"
        );

        autoTopUp = new AutoTopUp(gelato);
        for (uint256 i; i < _receivers.length; i++) {
            autoTopUp.startAutoPay(
                _receivers[i],
                _amounts[i],
                _balanceThresholds[i]
            );
        }

        if (msg.value > 0) {
            (bool success, ) =
                payable(address(autoTopUp)).call{value: msg.value}("");
            require(
                success,
                "AutoTopUpFactory: newAutoTopUp: ETH transfer failed"
            );
        }

        autoTopUp.transferOwnership(msg.sender);

        autoTopUpByOwner[msg.sender] = autoTopUp;
        ownerByAutoTopUp[autoTopUp] = msg.sender;
        _autoTopUps.add(address(autoTopUp));

        emit LogContractDeployed(address(autoTopUp), msg.sender);
    }

    /// @notice Get all autoTopUps
    /// @dev useful to query which autoTopUps to cancel
    function getAutoTopUps()
        external
        view
        returns (address[] memory currentAutoTopUps)
    {
        uint256 length = _autoTopUps.length();
        currentAutoTopUps = new address[](length);
        for (uint256 i; i < length; i++)
            currentAutoTopUps[i] = _autoTopUps.at(i);
    }
}
