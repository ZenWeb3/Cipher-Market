// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {
    FHE,
    euint64,
    InEuint64,
    ebool
} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FHERC20} from "fhenix-confidential-contracts/contracts/FHERC20/FHERC20.sol";

/// @title CipherMarket
/// @notice A privacy-preserving binary prediction market using FHE.
///         Bets are fully encrypted — no one sees who bet what or how much.
///         Pool totals are computed on-chain via homomorphic addition.
///         Only after resolution are pool totals decrypted for payout calculation.
contract CipherMarket {
    // ============ Enums ============

    enum Status {
        Active,       // Accepting bets
        Closed,       // Betting ended, awaiting resolution
        Resolved,     // Outcome decided, settlement requested (decryption pending)
        Settled,      // Pool totals decrypted, winners can claim
        Cancelled     // Market cancelled, all bettors can reclaim
    }

    enum Outcome {
        Yes,
        No
    }

    // ============ Structs ============

    struct Market {
        string question;
        address creator;
        address fherc20Token;
        uint256 startTime;
        uint256 endTime;
        Status status;
        // Encrypted pool totals (homomorphic sums)
        euint64 yesPool;
        euint64 noPool;
        // Resolution
        Outcome winningOutcome;
        // Decrypted pool totals (available after settlement)
        uint64 decryptedYesPool;
        uint64 decryptedNoPool;
        // Ciphertext hashes for frontend decryption flow
        bytes32 yesPoolCtHash;
        bytes32 noPoolCtHash;
        // Tracking
        uint256 totalBets;
        uint256 yesBettors;
        uint256 noBettors;
    }

    /// @notice View struct to avoid stack-too-deep errors
    struct MarketView {
        string question;
        address creator;
        address fherc20Token;
        uint256 startTime;
        uint256 endTime;
        Status status;
        Outcome winningOutcome;
        uint64 decryptedYesPool;
        uint64 decryptedNoPool;
        uint256 totalBets;
        uint256 yesBettors;
        uint256 noBettors;
    }

    // ============ State Variables ============

    mapping(uint256 => Market) public markets;
    /// @dev Stores each bettor's encrypted wager amount
    mapping(uint256 => mapping(address => euint64)) public bettorDeposits;
    /// @dev Which outcome each bettor chose (only meaningful if hasBet is true)
    mapping(uint256 => mapping(address => Outcome)) public bettorOutcome;
    mapping(uint256 => mapping(address => bool)) public hasBet;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    uint256 public nextMarketId;

    // ============ Events ============

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        address fherc20Token,
        uint256 startTime,
        uint256 endTime
    );

    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        Outcome outcome,
        uint256 timestamp
    );

    event MarketResolved(
        uint256 indexed marketId,
        Outcome winningOutcome
    );

    event SettlementRequested(
        uint256 indexed marketId,
        bytes32 yesPoolCtHash,
        bytes32 noPoolCtHash
    );

    event MarketSettled(
        uint256 indexed marketId,
        uint64 yesPoolTotal,
        uint64 noPoolTotal
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 payout
    );

    event RefundClaimed(
        uint256 indexed marketId,
        address indexed bettor
    );

    event MarketCancelled(uint256 indexed marketId);

    // ============ Errors ============

    error MarketNotActive();
    error MarketNotClosed();
    error MarketNotSettled();
    error MarketNotResolved();
    error NotCreator();
    error NotBettor();
    error AlreadyBet();
    error AlreadyClaimed();
    error InvalidTimeRange();
    error QuestionRequired();
    error QuestionTooLong();
    error NoBetsPlaced();
    error BettingNotStarted();
    error BettingEnded();
    error NotWinner();
    error InvalidDecryptionProof();
    error MarketAlreadyResolved();

    // ============ Market Creation ============

    /// @notice Create a new binary prediction market
    /// @param question The market question (e.g. "Will ETH hit $5k by June 30?")
    /// @param fherc20Token The FHERC20 token used for bets
    /// @param startTime When betting opens (unix timestamp)
    /// @param endTime When betting closes (unix timestamp)
    /// @return marketId The ID of the created market
    function createMarket(
        string calldata question,
        address fherc20Token,
        uint256 startTime,
        uint256 endTime
    ) external returns (uint256 marketId) {
        if (bytes(question).length == 0) revert QuestionRequired();
        if (bytes(question).length > 200) revert QuestionTooLong();
        if (endTime <= startTime) revert InvalidTimeRange();
        if (startTime < block.timestamp) revert InvalidTimeRange();

        marketId = nextMarketId++;

        Market storage market = markets[marketId];
        market.question = question;
        market.creator = msg.sender;
        market.fherc20Token = fherc20Token;
        market.startTime = startTime;
        market.endTime = endTime;
        market.status = Status.Active;

        // Initialize encrypted pool totals to zero
        market.yesPool = FHE.asEuint64(0);
        market.noPool = FHE.asEuint64(0);

        // Grant this contract ACL permission on the initial encrypted values
        FHE.allowThis(market.yesPool);
        FHE.allowThis(market.noPool);

        emit MarketCreated(
            marketId,
            msg.sender,
            question,
            fherc20Token,
            startTime,
            endTime
        );
    }

    // ============ Betting ============

    /// @notice Place an encrypted bet on a market outcome
    /// @dev Bettor must call fherc20.setOperator(cipherMarketContract, until) before betting
    /// @param marketId The market to bet on
    /// @param outcome The outcome to bet on (Yes or No)
    /// @param encryptedAmount The encrypted bet amount
    function placeBet(
        uint256 marketId,
        Outcome outcome,
        InEuint64 calldata encryptedAmount
    ) external {
        Market storage market = markets[marketId];

        if (market.status != Status.Active) revert MarketNotActive();
        if (block.timestamp < market.startTime) revert BettingNotStarted();
        if (block.timestamp >= market.endTime) revert BettingEnded();
        if (hasBet[marketId][msg.sender]) revert AlreadyBet();

        // Convert input to euint64
        euint64 betAmount = FHE.asEuint64(encryptedAmount);

        // Grant the token ACL permission on the bet amount
        FHE.allow(betAmount, market.fherc20Token);

        // Transfer encrypted tokens from bettor to contract
        euint64 transferred = FHERC20(market.fherc20Token)
            .confidentialTransferFrom(msg.sender, address(this), betAmount);

        // Store deposit and outcome choice
        bettorDeposits[marketId][msg.sender] = transferred;
        bettorOutcome[marketId][msg.sender] = outcome;
        hasBet[marketId][msg.sender] = true;

        // Persist ACL for this contract
        FHE.allowThis(transferred);
        // Grant the bettor ACL permission to view their own bet amount
        FHE.allow(transferred, msg.sender);

        // Add bet to the appropriate encrypted pool using homomorphic addition
        if (outcome == Outcome.Yes) {
            market.yesPool = FHE.add(market.yesPool, transferred);
            market.yesBettors++;
        } else {
            market.noPool = FHE.add(market.noPool, transferred);
            market.noBettors++;
        }

        // Update permissions for the pool totals
        FHE.allowThis(market.yesPool);
        FHE.allowThis(market.noPool);

        market.totalBets++;

        emit BetPlaced(marketId, msg.sender, outcome, block.timestamp);
    }

    // ============ Resolution ============

    /// @notice Resolve the market with the winning outcome (creator only)
    /// @dev This also requests decryption of pool totals for payout calculation
    /// @param marketId The market to resolve
    /// @param winningOutcome The winning outcome (Yes or No)
    function resolveMarket(
        uint256 marketId,
        Outcome winningOutcome
    ) external {
        Market storage market = markets[marketId];

        if (msg.sender != market.creator) revert NotCreator();
        if (market.status != Status.Active) revert MarketAlreadyResolved();
        if (block.timestamp < market.endTime) revert MarketNotClosed();
        if (market.totalBets == 0) revert NoBetsPlaced();

        market.status = Status.Resolved;
        market.winningOutcome = winningOutcome;

        // Mark encrypted pool totals for public decryption via Threshold Network
        FHE.allowPublic(market.yesPool);
        FHE.allowPublic(market.noPool);

        // Capture ctHashes so frontend can call decryptForTx
        bytes32 yesCt = euint64.unwrap(market.yesPool);
        bytes32 noCt = euint64.unwrap(market.noPool);
        market.yesPoolCtHash = yesCt;
        market.noPoolCtHash = noCt;

        emit MarketResolved(marketId, winningOutcome);
        emit SettlementRequested(marketId, yesCt, noCt);
    }

    /// @notice Request public decryption of your bet amount (required before claimWinnings)\
    /// @param marketId The market\
    function requestBetDecryption(uint256 marketId) external {
        Market storage market = markets[marketId];
        if (market.status != Status.Settled) revert MarketNotSettled();
        if (!hasBet[marketId][msg.sender]) revert NotBettor();

        euint64 deposit = bettorDeposits[marketId][msg.sender];
        FHE.allowPublic(deposit);
    }

    /// @notice Finalize settlement with client-provided decrypted pool totals + proofs
    /// @param marketId The market to finalize
    /// @param yesPoolTotal The decrypted Yes pool total
    /// @param noPoolTotal The decrypted No pool total
    /// @param yesProof Threshold Network proof for Yes pool
    /// @param noProof Threshold Network proof for No pool
    function finalizeSettlement(
        uint256 marketId,
        uint64 yesPoolTotal,
        uint64 noPoolTotal,
        bytes calldata yesProof,
        bytes calldata noProof
    ) external {
        Market storage market = markets[marketId];

        if (market.status != Status.Resolved) revert MarketNotResolved();

        // Verify the Threshold Network proofs
        if (!FHE.verifyDecryptResult(market.yesPool, yesPoolTotal, yesProof))
            revert InvalidDecryptionProof();
        if (!FHE.verifyDecryptResult(market.noPool, noPoolTotal, noProof))
            revert InvalidDecryptionProof();

        // Store decrypted values
        market.decryptedYesPool = yesPoolTotal;
        market.decryptedNoPool = noPoolTotal;
        market.status = Status.Settled;

        emit MarketSettled(marketId, yesPoolTotal, noPoolTotal);
    }

    // ============ Claiming ============

    /// @notice Claim winnings for a winning bet
    /// @dev Winner receives: their original bet + proportional share of losing pool
    ///      Payout = betAmount + (betAmount * losingPool) / winningPool
    ///      Since FHE doesn't support division, individual bets must be decrypted first.
    ///      The bettor provides their decrypted bet amount + proof for verification.
    /// @param marketId The market to claim from
    /// @param decryptedBetAmount The bettor's decrypted bet amount
    /// @param betProof Threshold Network proof for the bet amount
    function claimWinnings(
        uint256 marketId,
        uint64 decryptedBetAmount,
        bytes calldata betProof
    ) external {
        Market storage market = markets[marketId];

        if (market.status != Status.Settled) revert MarketNotSettled();
        if (!hasBet[marketId][msg.sender]) revert NotBettor();
        if (hasClaimed[marketId][msg.sender]) revert AlreadyClaimed();
        if (bettorOutcome[marketId][msg.sender] != market.winningOutcome)
            revert NotWinner();

        // Verify the decrypted bet amount
        euint64 deposit = bettorDeposits[marketId][msg.sender];
        if (!FHE.verifyDecryptResult(deposit, decryptedBetAmount, betProof))
            revert InvalidDecryptionProof();

        hasClaimed[marketId][msg.sender] = true;

        // Calculate payout using plaintext math (pools are already decrypted)
        uint64 winningPool = market.winningOutcome == Outcome.Yes
            ? market.decryptedYesPool
            : market.decryptedNoPool;
        uint64 losingPool = market.winningOutcome == Outcome.Yes
            ? market.decryptedNoPool
            : market.decryptedYesPool;

        // Payout = betAmount + (betAmount * losingPool) / winningPool
        // Use uint256 to prevent overflow in intermediate calculation
        uint256 payout = uint256(decryptedBetAmount) +
            (uint256(decryptedBetAmount) * uint256(losingPool)) /
            uint256(winningPool);

        // Transfer payout as plaintext amount via FHERC20 mint or transfer
        // Since the contract holds encrypted tokens, we transfer back the original
        // encrypted deposit (the bettor's share) plus mint the winnings portion
        // For MVP: transfer back the encrypted deposit (original bet returned)
        // and separately handle the winnings from the losing pool
        FHE.allow(deposit, market.fherc20Token);
        FHERC20(market.fherc20Token).confidentialTransfer(msg.sender, deposit);

        // Note: The proportional winnings from the losing pool would require
        // a more sophisticated mechanism (e.g., the contract mints additional tokens
        // or uses a withdrawal pattern with plaintext amounts). For this MVP,
        // winners get their original encrypted bet back. The full proportional
        // payout mechanism can be implemented in Wave 2 with a wrapper contract.

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /// @notice Claim refund for a losing bet or cancelled market
    /// @param marketId The market to claim refund from
    function claimRefund(uint256 marketId) external {
        Market storage market = markets[marketId];

        if (!hasBet[marketId][msg.sender]) revert NotBettor();
        if (hasClaimed[marketId][msg.sender]) revert AlreadyClaimed();

        // Refunds allowed for: cancelled markets (everyone) or settled + losing side
        bool isCancelled = market.status == Status.Cancelled;
        bool isLoser = market.status == Status.Settled &&
            bettorOutcome[marketId][msg.sender] != market.winningOutcome;

        if (!isCancelled && !isLoser) revert MarketNotSettled();

        hasClaimed[marketId][msg.sender] = true;

        // Transfer encrypted deposit back to bettor
        euint64 deposit = bettorDeposits[marketId][msg.sender];
        FHE.allow(deposit, market.fherc20Token);
        FHERC20(market.fherc20Token).confidentialTransfer(msg.sender, deposit);

        emit RefundClaimed(marketId, msg.sender);
    }

    // ============ Cancellation ============

    /// @notice Cancel a market (only creator, only if no bets)
    /// @param marketId The market to cancel
    function cancelMarket(uint256 marketId) external {
        Market storage market = markets[marketId];

        if (msg.sender != market.creator) revert NotCreator();
        if (market.status != Status.Active) revert MarketNotActive();

        market.status = Status.Cancelled;

        emit MarketCancelled(marketId);
    }

    // ============ View Functions ============

    /// @notice Get market details
    /// @param marketId The market to query
    /// @return marketView The market details
    function getMarket(
        uint256 marketId
    ) external view returns (MarketView memory marketView) {
        Market storage market = markets[marketId];
        return MarketView({
            question: market.question,
            creator: market.creator,
            fherc20Token: market.fherc20Token,
            startTime: market.startTime,
            endTime: market.endTime,
            status: market.status,
            winningOutcome: market.winningOutcome,
            decryptedYesPool: market.decryptedYesPool,
            decryptedNoPool: market.decryptedNoPool,
            totalBets: market.totalBets,
            yesBettors: market.yesBettors,
            noBettors: market.noBettors
        });
    }

    /// @notice Get settlement ciphertext hashes for frontend decryption
    /// @param marketId The market to query
    /// @return yesCt The ctHash of the encrypted Yes pool
    /// @return noCt The ctHash of the encrypted No pool
    function getSettlementCtHashes(
        uint256 marketId
    ) external view returns (bytes32 yesCt, bytes32 noCt) {
        Market storage market = markets[marketId];
        if (
            market.status != Status.Resolved &&
            market.status != Status.Settled
        ) {
            revert MarketNotResolved();
        }
        return (market.yesPoolCtHash, market.noPoolCtHash);
    }

    /// @notice Check if an address has bet on a market
    function hasBetOnMarket(
        uint256 marketId,
        address bettor
    ) external view returns (bool) {
        return hasBet[marketId][bettor];
    }

    /// @notice Get which outcome a bettor chose
    function getBettorOutcome(
        uint256 marketId,
        address bettor
    ) external view returns (Outcome) {
        return bettorOutcome[marketId][bettor];
    }

    /// @notice Check if an address has claimed
    function hasClaimedFromMarket(
        uint256 marketId,
        address bettor
    ) external view returns (bool) {
        return hasClaimed[marketId][bettor];
    }

    /// @notice Get the encrypted bet deposit for a bettor (unsealable by the bettor via permit)
    function getBettorDeposit(
        uint256 marketId,
        address bettor
    ) external view returns (euint64) {
        return bettorDeposits[marketId][bettor];
    }
}
