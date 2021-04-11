// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import {IDiamondCut} from "./IDiamondCut.sol";
import {IDiamondLoupe} from "./IDiamondLoupe.sol";
import {
    TaskReceipt
} from "@gelatonetwork/core/contracts/gelato_core/interfaces/IGelatoCore.sol";

// solhint-disable ordering

/// @dev includes the interfaces of all facets
interface IGelato {
    // ########## Diamond Cut Facet #########
    event DiamondCut(
        IDiamondCut.FacetCut[] _diamondCut,
        address _init,
        bytes _calldata
    );

    function diamondCut(
        IDiamondCut.FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external;

    // ########## DiamondLoupeFacet #########
    function facets()
        external
        view
        returns (IDiamondLoupe.Facet[] memory facets_);

    function facetFunctionSelectors(address _facet)
        external
        view
        returns (bytes4[] memory facetFunctionSelectors_);

    function facetAddresses()
        external
        view
        returns (address[] memory facetAddresses_);

    function facetAddress(bytes4 _functionSelector)
        external
        view
        returns (address facetAddress_);

    function supportsInterface(bytes4 _interfaceId)
        external
        view
        returns (bool);

    // ########## Ownership Facet #########
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    function transferOwnership(address _newOwner) external;

    function owner() external view returns (address owner_);

    // ########## AddressFacet #########
    event LogSetOracleAggregator(address indexed oracleAggregator);
    event LogSetGasPriceOracle(address indexed gasPriceOracle);

    function setOracleAggregator(address _oracleAggregator)
        external
        returns (address);

    function setGasPriceOracle(address _gasPriceOracle)
        external
        returns (address);

    function getOracleAggregator() external view returns (address);

    function getGasPriceOracle() external view returns (address);

    // ########## ConcurrentCanExecFacet #########
    enum SlotStatus {Open, Closing, Closed}

    function setSlotLength(uint256 _slotLength) external;

    function slotLength() external view returns (uint256);

    function concurrentCanExec(uint256 _buffer) external view returns (bool);

    function getCurrentExecutorIndex()
        external
        view
        returns (uint256 executorIndex, uint256 remainingBlocksInSlot);

    function currentExecutor()
        external
        view
        returns (
            address executor,
            uint256 executorIndex,
            uint256 remainingBlocksInSlot
        );

    function mySlotStatus(uint256 _buffer) external view returns (SlotStatus);

    function calcExecutorIndex(
        uint256 _currentBlock,
        uint256 _blocksPerSlot,
        uint256 _numberOfExecutors
    )
        external
        pure
        returns (uint256 executorIndex, uint256 remainingBlocksInSlot);

    // ########## ExecFacet #########
    event LogExecSuccess(
        address indexed executor,
        address indexed service,
        bool indexed wasExecutorPaid
    );

    event LogSetGasMargin(uint256 oldGasMargin, uint256 newGasMargin);

    function addExecutors(address[] calldata _executors) external;

    function removeExecutors(address[] calldata _executors) external;

    function setGasMargin(uint256 _gasMargin) external;

    function exec(
        address _service,
        bytes calldata _data,
        address _creditToken
    ) external;

    function estimateExecGasDebit(
        address _service,
        bytes calldata _data,
        address _creditToken
    ) external returns (uint256 gasDebitInETH, uint256 gasDebitInCreditToken);

    function canExec(address _executor) external view returns (bool);

    function isExecutor(address _executor) external view returns (bool);

    function executors() external view returns (address[] memory);

    function numberOfExecutors() external view returns (uint256);

    function gasMargin() external view returns (uint256);

    // ########## GelatoV1Facet #########
    struct Response {
        uint256 taskReceiptId;
        uint256 taskGasLimit;
        string response;
    }

    function stakeExecutor(address _gelatoCore) external payable;

    function unstakeExecutor(address _gelatoCore, address payable _to) external;

    function multiReassignProviders(
        address _gelatoCore,
        address[] calldata _providers,
        address _newExecutor
    ) external;

    function providerRefund(
        address _gelatoCore,
        address _provider,
        uint256 _amount
    ) external;

    function withdrawExcessExecutorStake(
        address _gelatoCore,
        uint256 _withdrawAmount,
        address payable _to
    ) external;

    function v1ConcurrentMultiCanExec(
        address _gelatoCore,
        TaskReceipt[] calldata _taskReceipts,
        uint256 _gelatoGasPrice,
        uint256 _buffer
    )
        external
        view
        returns (
            bool canExecRes,
            uint256 blockNumber,
            Response[] memory responses
        );

    function v1MultiCanExec(
        address _gelatoCore,
        TaskReceipt[] calldata _taskReceipts,
        uint256 _gelatoGasPrice
    ) external view returns (uint256 blockNumber, Response[] memory responses);

    function getGasLimit(
        TaskReceipt calldata _taskReceipt,
        uint256 _gelatoMaxGas
    ) external pure returns (uint256);
}
