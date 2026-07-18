// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TimeSettlement {
    using SafeERC20 for IERC20;

    struct Settlement {
        bytes32 inviteHash;
        address payee;
        address payer;
        uint128 amount;
        uint64 startedAt;
        uint64 endsAt;
        uint256 withdrawn;
        bool joined;
        bool cancelled;
        string serviceName;
    }

    error InvalidInviteCode();
    error InvalidSettlementTerms();
    error InviteCodeAlreadyExists();
    error SettlementNotFound();
    error SettlementNotJoined();
    error SettlementCancelled();
    error Unauthorized();
    error NothingToWithdraw();

    event SettlementCreated(
        uint256 indexed settlementId,
        bytes32 indexed inviteHash,
        address indexed payee,
        uint128 amount,
        uint64 duration,
        string serviceName
    );
    event SettlementJoined(
        uint256 indexed settlementId,
        address indexed payer,
        uint64 startedAt,
        uint64 endsAt
    );
    event SettlementWithdrawn(
        uint256 indexed settlementId,
        address indexed payee,
        uint256 amount
    );
    event SettlementCanceled(
        uint256 indexed settlementId,
        address indexed payer,
        uint256 paidToLeader,
        uint256 refundedToMember
    );

    IERC20 public immutable point;
    uint256 public nextSettlementId = 1;

    mapping(uint256 settlementId => Settlement settlement) private settlements;
    mapping(bytes32 inviteHash => uint256 settlementId)
        public getSettlementIdByInviteHash;

    constructor(address pointAddress) {
        if (pointAddress == address(0)) revert InvalidSettlementTerms();
        point = IERC20(pointAddress);
    }

    function createSettlement(
        bytes32 inviteHash,
        string calldata serviceName,
        uint128 amount,
        uint64 duration
    ) external returns (uint256 settlementId) {
        if (
            inviteHash == bytes32(0) ||
            bytes(serviceName).length == 0 ||
            amount == 0 ||
            duration == 0
        ) revert InvalidSettlementTerms();
        if (getSettlementIdByInviteHash[inviteHash] != 0) {
            revert InviteCodeAlreadyExists();
        }

        settlementId = nextSettlementId++;
        settlements[settlementId] = Settlement({
            inviteHash: inviteHash,
            payee: msg.sender,
            payer: address(0),
            amount: amount,
            startedAt: 0,
            endsAt: duration,
            withdrawn: 0,
            joined: false,
            cancelled: false,
            serviceName: serviceName
        });
        getSettlementIdByInviteHash[inviteHash] = settlementId;

        emit SettlementCreated(
            settlementId,
            inviteHash,
            msg.sender,
            amount,
            duration,
            serviceName
        );
    }

    function joinSettlement(string calldata inviteCode) external {
        bytes32 inviteHash = keccak256(bytes(inviteCode));
        uint256 settlementId = getSettlementIdByInviteHash[inviteHash];
        if (settlementId == 0) revert InvalidInviteCode();

        Settlement storage settlement = settlements[settlementId];
        uint64 duration = settlement.endsAt;
        uint64 startedAt = uint64(block.timestamp);

        delete getSettlementIdByInviteHash[inviteHash];
        settlement.payer = msg.sender;
        settlement.startedAt = startedAt;
        settlement.endsAt = startedAt + duration;
        settlement.joined = true;

        point.safeTransferFrom(msg.sender, address(this), settlement.amount);

        emit SettlementJoined(
            settlementId,
            msg.sender,
            startedAt,
            settlement.endsAt
        );
    }

    function withdraw(uint256 settlementId) external {
        Settlement storage settlement = _getSettlement(settlementId);
        if (!settlement.joined) revert SettlementNotJoined();
        if (settlement.cancelled) revert SettlementCancelled();
        if (msg.sender != settlement.payee) revert Unauthorized();

        (, uint256 withdrawable, ) = getFinancials(settlementId);
        if (withdrawable == 0) revert NothingToWithdraw();

        settlement.withdrawn += withdrawable;
        point.safeTransfer(settlement.payee, withdrawable);

        emit SettlementWithdrawn(
            settlementId,
            settlement.payee,
            withdrawable
        );
    }

    function cancel(uint256 settlementId) external {
        Settlement storage settlement = _getSettlement(settlementId);
        if (!settlement.joined) revert SettlementNotJoined();
        if (settlement.cancelled) revert SettlementCancelled();
        if (msg.sender != settlement.payer) revert Unauthorized();

        (, uint256 withdrawable, uint256 refundable) = getFinancials(
            settlementId
        );
        settlement.cancelled = true;
        settlement.withdrawn += withdrawable;

        if (withdrawable != 0) {
            point.safeTransfer(settlement.payee, withdrawable);
        }
        if (refundable != 0) {
            point.safeTransfer(settlement.payer, refundable);
        }

        emit SettlementCanceled(
            settlementId,
            settlement.payer,
            withdrawable,
            refundable
        );
    }

    function getSettlement(
        uint256 settlementId
    ) external view returns (Settlement memory) {
        Settlement storage settlement = _getSettlement(settlementId);
        return settlement;
    }

    function getFinancials(
        uint256 settlementId
    ) public view returns (uint256 earned, uint256 withdrawable, uint256 refundable) {
        Settlement storage settlement = _getSettlement(settlementId);
        if (!settlement.joined || settlement.cancelled) return (0, 0, 0);

        uint256 effectiveTime = block.timestamp < settlement.endsAt
            ? block.timestamp
            : settlement.endsAt;
        uint256 elapsed = effectiveTime - settlement.startedAt;
        uint256 duration = settlement.endsAt - settlement.startedAt;

        earned = (uint256(settlement.amount) * elapsed) / duration;
        withdrawable = earned - settlement.withdrawn;
        refundable = uint256(settlement.amount) - earned;
    }

    function _getSettlement(
        uint256 settlementId
    ) private view returns (Settlement storage settlement) {
        settlement = settlements[settlementId];
        if (settlement.payee == address(0)) revert SettlementNotFound();
    }
}
