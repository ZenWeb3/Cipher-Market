import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { FheTypes } from "@cofhe/sdk";
import {
  deployCipherMarketContracts,
  createMarketFixture,
  createActiveMarketFixture,
  encryptBetAmount,
  decryptForTx,
  settleMarket,
  decryptBettorDeposit,
  createMarketWithBetFixture,
  createMarketReadyForResolutionFixture,
  DEFAULT_QUESTION,
} from "./helpers/ciphermarket-setup";

describe("CipherMarket", function () {
  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const { cipherMarket } = await deployCipherMarketContracts();
      expect(await cipherMarket.getAddress()).to.be.properAddress;
    });

    it("should initialize nextMarketId to 0", async function () {
      const { cipherMarket } = await deployCipherMarketContracts();
      expect(await cipherMarket.nextMarketId()).to.equal(0);
    });
  });

  describe("createMarket", function () {
    it("should create market with correct creator", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      const market = await cipherMarket.getMarket(0);
      expect(market.creator).to.equal(creator.address);
    });

    it("should create market with correct question", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      const market = await cipherMarket.getMarket(0);
      expect(market.question).to.equal(DEFAULT_QUESTION);
    });

    it("should create market with Active status", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      const market = await cipherMarket.getMarket(0);
      expect(market.status).to.equal(0);
    });

    it("should increment nextMarketId", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      expect(await cipherMarket.nextMarketId()).to.equal(0);

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      expect(await cipherMarket.nextMarketId()).to.equal(1);
    });

    it("should emit MarketCreated event", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await expect(
        cipherMarket
          .connect(creator)
          .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime)
      )
        .to.emit(cipherMarket, "MarketCreated")
        .withArgs(
          0,
          creator.address,
          DEFAULT_QUESTION,
          await betToken.getAddress(),
          startTime,
          endTime
        );
    });

    it("should revert if question is empty", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await expect(
        cipherMarket
          .connect(creator)
          .createMarket("", await betToken.getAddress(), startTime, endTime)
      ).to.be.revertedWithCustomError(cipherMarket, "QuestionRequired");
    });

    it("should revert if question is too long", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      const longQuestion = "A".repeat(201);

      await expect(
        cipherMarket
          .connect(creator)
          .createMarket(longQuestion, await betToken.getAddress(), startTime, endTime)
      ).to.be.revertedWithCustomError(cipherMarket, "QuestionTooLong");
    });

    it("should allow exactly 200 character question", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      const maxQuestion = "A".repeat(200);

      await cipherMarket
        .connect(creator)
        .createMarket(maxQuestion, await betToken.getAddress(), startTime, endTime);

      const market = await cipherMarket.getMarket(0);
      expect(market.question).to.equal(maxQuestion);
    });

    it("should revert if endTime <= startTime", async function () {
      const { betToken, cipherMarket, creator, startTime } =
        await createMarketFixture();

      await expect(
        cipherMarket
          .connect(creator)
          .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, startTime)
      ).to.be.revertedWithCustomError(cipherMarket, "InvalidTimeRange");
    });

    it("should revert if startTime is in the past", async function () {
      const { betToken, cipherMarket, creator, endTime } =
        await createMarketFixture();

      const pastTime = (await time.latest()) - 100;

      await expect(
        cipherMarket
          .connect(creator)
          .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), pastTime, endTime)
      ).to.be.revertedWithCustomError(cipherMarket, "InvalidTimeRange");
    });

    it("should allow creating multiple markets", async function () {
      const { betToken, cipherMarket, creator, bettor1, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket("Question 1?", await betToken.getAddress(), startTime, endTime);

      await cipherMarket
        .connect(bettor1)
        .createMarket("Question 2?", await betToken.getAddress(), startTime, endTime);

      expect(await cipherMarket.nextMarketId()).to.equal(2);

      const market0 = await cipherMarket.getMarket(0);
      const market1 = await cipherMarket.getMarket(1);

      expect(market0.creator).to.equal(creator.address);
      expect(market1.creator).to.equal(bettor1.address);
    });
  });

  describe("placeBet", function () {
    it("should place encrypted Yes bet successfully", async function () {
      const { cipherMarket, bettor1, marketId } = await createActiveMarketFixture();

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);

      await expect(cipherMarket.connect(bettor1).placeBet(marketId, 0, encryptedBet))
        .to.emit(cipherMarket, "BetPlaced");
    });

    it("should place encrypted No bet successfully", async function () {
      const { cipherMarket, bettor1, marketId } = await createActiveMarketFixture();

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);

      await expect(cipherMarket.connect(bettor1).placeBet(marketId, 1, encryptedBet))
        .to.emit(cipherMarket, "BetPlaced");
    });

    it("should mark bettor as having bet", async function () {
      const { cipherMarket, bettor1, marketId } = await createActiveMarketFixture();

      expect(await cipherMarket.hasBetOnMarket(marketId, bettor1.address)).to.be.false;

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);
      await cipherMarket.connect(bettor1).placeBet(marketId, 0, encryptedBet);

      expect(await cipherMarket.hasBetOnMarket(marketId, bettor1.address)).to.be.true;
    });

    it("should store bettor outcome", async function () {
      const { cipherMarket, bettor1, marketId } = await createActiveMarketFixture();

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);
      await cipherMarket.connect(bettor1).placeBet(marketId, 1, encryptedBet);

      expect(await cipherMarket.getBettorOutcome(marketId, bettor1.address)).to.equal(1);
    });

    it("should increment totalBets and outcome counters", async function () {
      const { cipherMarket, bettor1, bettor2, marketId } = await createActiveMarketFixture();

      const enc1 = await encryptBetAmount(bettor1, 100_000000n);
      await cipherMarket.connect(bettor1).placeBet(marketId, 0, enc1);

      const enc2 = await encryptBetAmount(bettor2, 150_000000n);
      await cipherMarket.connect(bettor2).placeBet(marketId, 1, enc2);

      const market = await cipherMarket.getMarket(marketId);
      expect(market.totalBets).to.equal(2);
      expect(market.yesBettors).to.equal(1);
      expect(market.noBettors).to.equal(1);
    });

    it("should revert if bettor has already bet", async function () {
      const { cipherMarket, bettor1, marketId } = await createMarketWithBetFixture();

      const encryptedBet = await encryptBetAmount(bettor1, 200_000000n);

      await expect(
        cipherMarket.connect(bettor1).placeBet(marketId, 0, encryptedBet)
      ).to.be.revertedWithCustomError(cipherMarket, "AlreadyBet");
    });

    it("should revert if betting has not started", async function () {
      const { betToken, cipherMarket, creator, bettor1 } = await createMarketFixture();

      const now = await time.latest();
      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), now + 3600, now + 7200);

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);

      await expect(
        cipherMarket.connect(bettor1).placeBet(0, 0, encryptedBet)
      ).to.be.revertedWithCustomError(cipherMarket, "BettingNotStarted");
    });

    it("should revert if betting has ended", async function () {
      const { cipherMarket, bettor1, marketId, endTime } = await createActiveMarketFixture();

      await time.increaseTo(endTime + 1);

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);

      await expect(
        cipherMarket.connect(bettor1).placeBet(marketId, 0, encryptedBet)
      ).to.be.revertedWithCustomError(cipherMarket, "BettingEnded");
    });

    it("should revert if market is cancelled", async function () {
      const { betToken, cipherMarket, creator, bettor1, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      await cipherMarket.connect(creator).cancelMarket(0);
      await time.increaseTo(startTime + 1);

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);

      await expect(
        cipherMarket.connect(bettor1).placeBet(0, 0, encryptedBet)
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotActive");
    });

    it("should revert if bettor has not set operator", async function () {
      const { betToken, cipherMarket, bettor3, marketId } = await createActiveMarketFixture();

      await betToken.mint(bettor3.address, 1000_000000n);

      const encryptedBet = await encryptBetAmount(bettor3, 100_000000n);

      await expect(
        cipherMarket.connect(bettor3).placeBet(marketId, 0, encryptedBet)
      ).to.be.revertedWithCustomError(betToken, "FHERC20UnauthorizedSpender");
    });
  });

  describe("resolveMarket", function () {
    it("should resolve market with Yes outcome", async function () {
      const { cipherMarket, creator, marketId } =
        await createMarketReadyForResolutionFixture();

      await expect(cipherMarket.connect(creator).resolveMarket(marketId, 0))
        .to.emit(cipherMarket, "MarketResolved")
        .withArgs(marketId, 0);
    });

    it("should resolve market with No outcome", async function () {
      const { cipherMarket, creator, marketId } =
        await createMarketReadyForResolutionFixture();

      await expect(cipherMarket.connect(creator).resolveMarket(marketId, 1))
        .to.emit(cipherMarket, "MarketResolved")
        .withArgs(marketId, 1);
    });

    it("should change status to Resolved", async function () {
      const { cipherMarket, creator, marketId } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);

      const market = await cipherMarket.getMarket(marketId);
      expect(market.status).to.equal(2);
    });

    it("should emit SettlementRequested with ctHashes", async function () {
      const { cipherMarket, creator, marketId } =
        await createMarketReadyForResolutionFixture();

      await expect(cipherMarket.connect(creator).resolveMarket(marketId, 0))
        .to.emit(cipherMarket, "SettlementRequested");
    });

    it("should revert if caller is not creator", async function () {
      const { cipherMarket, bettor1, marketId } =
        await createMarketReadyForResolutionFixture();

      await expect(
        cipherMarket.connect(bettor1).resolveMarket(marketId, 0)
      ).to.be.revertedWithCustomError(cipherMarket, "NotCreator");
    });

    it("should revert if market has not ended", async function () {
      const { cipherMarket, creator, bettor1, marketId } = await createActiveMarketFixture();

      const encryptedBet = await encryptBetAmount(bettor1, 100_000000n);
      await cipherMarket.connect(bettor1).placeBet(marketId, 0, encryptedBet);

      await expect(
        cipherMarket.connect(creator).resolveMarket(marketId, 0)
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotClosed");
    });

    it("should revert if no bets were placed", async function () {
      const { cipherMarket, creator, marketId, endTime } = await createActiveMarketFixture();

      await time.increaseTo(endTime + 1);

      await expect(
        cipherMarket.connect(creator).resolveMarket(marketId, 0)
      ).to.be.revertedWithCustomError(cipherMarket, "NoBetsPlaced");
    });

    it("should revert if already resolved", async function () {
      const { cipherMarket, creator, marketId } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);

      await expect(
        cipherMarket.connect(creator).resolveMarket(marketId, 1)
      ).to.be.revertedWithCustomError(cipherMarket, "MarketAlreadyResolved");
    });
  });

  describe("finalizeSettlement", function () {
    it("should finalize settlement with decrypted pool totals", async function () {
      const { cipherMarket, deployer, creator, marketId, betAmount1, betAmount2 } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      const market = await cipherMarket.getMarket(marketId);
      expect(market.status).to.equal(3);
      expect(market.decryptedYesPool).to.equal(betAmount1);
      expect(market.decryptedNoPool).to.equal(betAmount2);
    });

    it("should emit MarketSettled event", async function () {
      const { cipherMarket, deployer, creator, marketId, betAmount1, betAmount2 } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);

      const ctHashes = await cipherMarket.getSettlementCtHashes(marketId);
      const yesResult = await decryptForTx(deployer, ctHashes.yesCt);
      const noResult = await decryptForTx(deployer, ctHashes.noCt);

      await expect(
        cipherMarket.finalizeSettlement(
          marketId,
          yesResult.decryptedValue,
          noResult.decryptedValue,
          yesResult.signature,
          noResult.signature
        )
      )
        .to.emit(cipherMarket, "MarketSettled")
        .withArgs(marketId, betAmount1, betAmount2);
    });

    it("should revert if market is not resolved", async function () {
      const { cipherMarket, marketId } =
        await createMarketReadyForResolutionFixture();

      await expect(
        cipherMarket.finalizeSettlement(marketId, 100n, 150n, "0x", "0x")
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotResolved");
    });

    it("should revert if already settled", async function () {
      const { cipherMarket, deployer, creator, marketId } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      await expect(
        cipherMarket.finalizeSettlement(marketId, 100n, 150n, "0x", "0x")
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotResolved");
    });
  });

  describe("claimWinnings", function () {
    it("should allow winner to claim", async function () {
      const { cipherMarket, deployer, creator, marketId, yesBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      const depositResult = await decryptBettorDeposit(cipherMarket, yesBettor, marketId);

      await expect(
        cipherMarket.connect(yesBettor).claimWinnings(
          marketId,
          depositResult.decryptedValue,
          depositResult.signature
        )
      ).to.emit(cipherMarket, "WinningsClaimed");
    });

    it("should mark as claimed", async function () {
      const { cipherMarket, deployer, creator, marketId, yesBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      const depositResult = await decryptBettorDeposit(cipherMarket, yesBettor, marketId);

      await cipherMarket.connect(yesBettor).claimWinnings(
        marketId, depositResult.decryptedValue, depositResult.signature
      );

      expect(await cipherMarket.hasClaimedFromMarket(marketId, yesBettor.address)).to.be.true;
    });

    it("should revert if not a winner", async function () {
      const { cipherMarket, deployer, creator, marketId, noBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      const depositResult = await decryptBettorDeposit(cipherMarket, noBettor, marketId);

      await expect(
        cipherMarket.connect(noBettor).claimWinnings(
          marketId, depositResult.decryptedValue, depositResult.signature
        )
      ).to.be.revertedWithCustomError(cipherMarket, "NotWinner");
    });

    it("should revert if already claimed", async function () {
      const { cipherMarket, deployer, creator, marketId, yesBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      const depositResult = await decryptBettorDeposit(cipherMarket, yesBettor, marketId);

      await cipherMarket.connect(yesBettor).claimWinnings(
        marketId, depositResult.decryptedValue, depositResult.signature
      );

      await expect(
        cipherMarket.connect(yesBettor).claimWinnings(
          marketId, depositResult.decryptedValue, depositResult.signature
        )
      ).to.be.revertedWithCustomError(cipherMarket, "AlreadyClaimed");
    });

    it("should revert if market not settled", async function () {
      const { cipherMarket, yesBettor, marketId } =
        await createMarketReadyForResolutionFixture();

      await expect(
        cipherMarket.connect(yesBettor).claimWinnings(marketId, 100_000000n, "0x")
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotSettled");
    });

    it("should revert if caller never bet", async function () {
      const { cipherMarket, deployer, creator, bettor3, marketId } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      await expect(
        cipherMarket.connect(bettor3).claimWinnings(marketId, 100_000000n, "0x")
      ).to.be.revertedWithCustomError(cipherMarket, "NotBettor");
    });
  });

  describe("claimRefund", function () {
    it("should allow loser to claim refund after settlement", async function () {
      const { cipherMarket, deployer, creator, marketId, noBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      await expect(cipherMarket.connect(noBettor).claimRefund(marketId))
        .to.emit(cipherMarket, "RefundClaimed")
        .withArgs(marketId, noBettor.address);
    });

    it("should mark as claimed", async function () {
      const { cipherMarket, deployer, creator, marketId, noBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      expect(await cipherMarket.hasClaimedFromMarket(marketId, noBettor.address)).to.be.false;
      await cipherMarket.connect(noBettor).claimRefund(marketId);
      expect(await cipherMarket.hasClaimedFromMarket(marketId, noBettor.address)).to.be.true;
    });

    it("should revert if winner tries to claim refund", async function () {
      const { cipherMarket, deployer, creator, marketId, yesBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      await expect(
        cipherMarket.connect(yesBettor).claimRefund(marketId)
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotSettled");
    });

    it("should revert if already claimed", async function () {
      const { cipherMarket, deployer, creator, marketId, noBettor } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      await cipherMarket.connect(noBettor).claimRefund(marketId);

      await expect(
        cipherMarket.connect(noBettor).claimRefund(marketId)
      ).to.be.revertedWithCustomError(cipherMarket, "AlreadyClaimed");
    });

    it("should revert if caller never bet", async function () {
      const { cipherMarket, deployer, creator, bettor3, marketId } =
        await createMarketReadyForResolutionFixture();

      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      await settleMarket(cipherMarket, deployer, marketId);

      await expect(
        cipherMarket.connect(bettor3).claimRefund(marketId)
      ).to.be.revertedWithCustomError(cipherMarket, "NotBettor");
    });
  });

  describe("cancelMarket", function () {
    it("should allow creator to cancel market", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      await cipherMarket.connect(creator).cancelMarket(0);

      const market = await cipherMarket.getMarket(0);
      expect(market.status).to.equal(4);
    });

    it("should emit MarketCancelled event", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      await expect(cipherMarket.connect(creator).cancelMarket(0))
        .to.emit(cipherMarket, "MarketCancelled")
        .withArgs(0);
    });

    it("should revert if caller is not creator", async function () {
      const { betToken, cipherMarket, creator, bettor1, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      await expect(
        cipherMarket.connect(bettor1).cancelMarket(0)
      ).to.be.revertedWithCustomError(cipherMarket, "NotCreator");
    });

    it("should revert if already cancelled", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      await cipherMarket.connect(creator).cancelMarket(0);

      await expect(
        cipherMarket.connect(creator).cancelMarket(0)
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotActive");
    });
  });

  describe("View Functions", function () {
    it("should return correct market details", async function () {
      const { betToken, cipherMarket, creator, startTime, endTime } =
        await createMarketFixture();

      await cipherMarket
        .connect(creator)
        .createMarket(DEFAULT_QUESTION, await betToken.getAddress(), startTime, endTime);

      const market = await cipherMarket.getMarket(0);

      expect(market.question).to.equal(DEFAULT_QUESTION);
      expect(market.creator).to.equal(creator.address);
      expect(market.fherc20Token).to.equal(await betToken.getAddress());
      expect(market.startTime).to.equal(startTime);
      expect(market.endTime).to.equal(endTime);
      expect(market.status).to.equal(0);
      expect(market.totalBets).to.equal(0);
    });

    it("should revert getSettlementCtHashes if not resolved", async function () {
      const { cipherMarket, marketId } = await createActiveMarketFixture();

      await expect(
        cipherMarket.getSettlementCtHashes(marketId)
      ).to.be.revertedWithCustomError(cipherMarket, "MarketNotResolved");
    });
  });

  describe("Full Market Flow (E2E)", function () {
    it("should complete full prediction market lifecycle", async function () {
      const { cipherMarket, deployer, creator, marketId, yesBettor, noBettor, betAmount1, betAmount2 } =
        await createMarketReadyForResolutionFixture();

      // Verify market state after bets
      let market = await cipherMarket.getMarket(marketId);
      expect(market.totalBets).to.equal(2);
      expect(market.yesBettors).to.equal(1);
      expect(market.noBettors).to.equal(1);
      expect(market.status).to.equal(0);

      // Resolve: Yes wins
      await cipherMarket.connect(creator).resolveMarket(marketId, 0);
      market = await cipherMarket.getMarket(marketId);
      expect(market.status).to.equal(2);

      // Finalize settlement
      await settleMarket(cipherMarket, deployer, marketId);
      market = await cipherMarket.getMarket(marketId);
      expect(market.status).to.equal(3);
      expect(market.decryptedYesPool).to.equal(betAmount1);
      expect(market.decryptedNoPool).to.equal(betAmount2);

      // Winner claims
      const winnerDecrypt = await decryptBettorDeposit(cipherMarket, yesBettor, marketId);
      await cipherMarket.connect(yesBettor).claimWinnings(
        marketId, winnerDecrypt.decryptedValue, winnerDecrypt.signature
      );
      expect(await cipherMarket.hasClaimedFromMarket(marketId, yesBettor.address)).to.be.true;

      // Loser claims refund
      await cipherMarket.connect(noBettor).claimRefund(marketId);
      expect(await cipherMarket.hasClaimedFromMarket(marketId, noBettor.address)).to.be.true;
    });
  });
});