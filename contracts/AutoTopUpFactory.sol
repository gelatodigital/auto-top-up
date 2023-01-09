// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    EnumerableSet
} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {AutoTopUp} from "./AutoTopUp.sol";
import {IAutoTopUp} from "./interfaces/IAutoTopUp.sol";
import "./ops/OpsTaskCreator.sol";

contract AutoTopUpFactory is Ownable, OpsTaskCreator {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => AutoTopUp) public autoTopUpByOwner;
    mapping(AutoTopUp => address) public ownerByAutoTopUp;

    EnumerableSet.AddressSet internal _autoTopUps;

    event LogContractDeployed(
        address indexed autoTopUp,
        address indexed owner,
        bytes32 indexed taskId
    );

    // solhint-disable no-empty-blocks
    constructor(address _ops) OpsTaskCreator(_ops, msg.sender) {}

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

        autoTopUp = new AutoTopUp(address(ops), address(this));
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

        bytes32 taskId = _createOpsTask(address(autoTopUp));

        emit LogContractDeployed(address(autoTopUp), msg.sender, taskId);
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

    function checker(address _autoTopUp)
        external
        view
        returns (bool, bytes memory)
    {
        IAutoTopUp autoTopUp = IAutoTopUp(_autoTopUp);

        address[] memory receivers = autoTopUp.getReceivers();

        for (uint256 x; x < receivers.length; x++) {
            address receiver = receivers[x];

            IAutoTopUp.TopUpData memory topUpData =
                autoTopUp.receiverDetails(receiver);

            if (receiver.balance < topUpData.balanceThreshold) {
                if (_autoTopUp.balance < topUpData.amount)
                    return (
                        false,
                        bytes("Insufficient funds to top up receiver")
                    );

                bytes memory execData =
                    abi.encodeWithSelector(
                        IAutoTopUp.topUp.selector,
                        receiver,
                        topUpData.amount,
                        topUpData.balanceThreshold
                    );

                return (true, execData);
            }
        }

        return (false, bytes("No address to top up"));
    }

    function _createOpsTask(address _autoTopUp)
        private
        returns (bytes32 taskId)
    {
        ModuleData memory moduleData =
            ModuleData({modules: new Module[](2), args: new bytes[](2)});

        moduleData.modules[0] = Module.RESOLVER;
        moduleData.modules[1] = Module.PROXY;

        moduleData.args[0] = _resolverModuleArg(
            address(this),
            abi.encodeCall(this.checker, (_autoTopUp))
        );
        moduleData.args[1] = _proxyModuleArg();

        taskId = _createTask(
            _autoTopUp,
            abi.encode(IAutoTopUp.topUp.selector),
            moduleData,
            ETH
        );
    }
}
