import hre, { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Encryptable, FheTypes } from "@cofhe/sdk";

export const DEFAULT_QUESTION = "Will ETH hit $5k by June 30?";

export async function deployCipherMarketContracts() {
  const [deployer, creator, bettor1, bettor2, bettor3] = await ethers.getSigners();

  // Deploy AuctionToken (FHERC20) — reused as the bet token
  const AuctionToken = await ethers.getContractFactory("AuctionToken");
  const betToken = await AuctionToken.deploy();
  await betToken.waitForDeployment();

  // Deploy CipherMarket
  const CipherMarket = await ethers.getContractFactory("CipherMarket");
  const cipherMarket = await CipherMarket.deploy();
  await cipherMarket.waitForDeployment();

  return {
    betToken,
    cipherMarket,
    deployer,
    creator,
    bettor1,
    bettor2,
    bettor3,
  };
}

export async function createMarketFixture() {
  const contracts = await deployCipherMarketContracts();
  const { betToken, cipherMarket, bettor1, bettor2 } = contracts;

  // Mint tokens to bettors (1000 tokens each with 6 decimals)
  await betToken.mint(bettor1.address, 1000_000000n);
  await betToken.mint(bettor2.address, 1000_000000n);

  // Set CipherMarket contract as operator for bettors
  const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
  await betToken.connect(bettor1).setOperator(await cipherMarket.getAddress(), futureTimestamp);
  await betToken.connect(bettor2).setOperator(await cipherMarket.getAddress(), futureTimestamp);

  // Set up market times
  const now = await time.latest();
  const startTime = now + 60;   // 1 minute from now
  const endTime = now + 3600;   // 1 hour from now

  return {
    ...contracts,
    startTime,
    endTime,
  };
}

export async function createActiveMarketFixture(question: string = DEFAULT_QUESTION) {
  const fixture = await createMarketFixture();
  const { betToken, cipherMarket, creator, startTime, endTime } = fixture;

  // Create the market
  await cipherMarket
    .connect(creator)
    .createMarket(
      question,
      await betToken.getAddress(),
      startTime,
      endTime
    );

  // Advance time to start of market
  await time.increaseTo(startTime + 1);

  return {
    ...fixture,
    marketId: 0n,
    question,
  };
}

/**
 * Helper to encrypt a bet amount for a specific bettor
 */
export async function encryptBetAmount(bettor: any, amount: bigint) {
  const client = await hre.cofhe.createClientWithBatteries(bettor);
  const result = await client.encryptInputs([Encryptable.uint64(amount)] as const).execute();
  return result[0];
}

/**
 * Helper to decrypt a ciphertext hash for use in a transaction
 * Returns { decryptedValue, signature } for passing to contract functions
 */
export async function decryptForTx(signer: any, ctHash: string | bigint, fheType: any = FheTypes.Uint64) {
  const client = await hre.cofhe.createClientWithBatteries(signer) as any;
  const result = await client.decryptForTx(ctHash, fheType).withoutPermit().execute();
  return result;
}

/**
 * Helper to settle a resolved market (decrypt pools + call finalizeSettlement)
 */
export async function settleMarket(cipherMarket: any, signer: any, marketId: bigint) {
  const ctHashes = await cipherMarket.getSettlementCtHashes(marketId);

  const yesResult = await decryptForTx(signer, ctHashes.yesCt);
  const noResult = await decryptForTx(signer, ctHashes.noCt);

  await cipherMarket.finalizeSettlement(
    marketId,
    yesResult.decryptedValue,
    noResult.decryptedValue,
    yesResult.signature,
    noResult.signature
  );

  return { yesResult, noResult };
}

/**
 * Helper to request bet decryption and get the result.
 * The bettor must first call requestBetDecryption on-chain (to allowPublic their deposit),
 * then we can decrypt it off-chain for use in claimWinnings.
 */
export async function decryptBettorDeposit(cipherMarket: any, bettor: any, marketId: bigint) {
  // Request public decryption via contract
  await cipherMarket.connect(bettor).requestBetDecryption(marketId);

  // Now decrypt the deposit
  const depositCtHash = await cipherMarket.getBettorDeposit(marketId, bettor.address);
  const result = await decryptForTx(bettor, depositCtHash);
  return result;
}

/**
 * Creates a fixture with an active market where bettor1 has bet Yes
 */
export async function createMarketWithBetFixture() {
  const fixture = await createActiveMarketFixture();
  const { cipherMarket, bettor1, marketId } = fixture;

  const betAmount = 100_000000n;
  const encryptedBet = await encryptBetAmount(bettor1, betAmount);

  // Place Yes bet
  await cipherMarket.connect(bettor1).placeBet(marketId, 0, encryptedBet); // 0 = Outcome.Yes

  return {
    ...fixture,
    betAmount,
  };
}

/**
 * Creates a fixture with bets on both sides, ready for resolution
 */
export async function createMarketReadyForResolutionFixture() {
  const fixture = await createActiveMarketFixture();
  const { cipherMarket, bettor1, bettor2, marketId, endTime } = fixture;

  // bettor1 bets Yes (100 tokens)
  const betAmount1 = 100_000000n;
  const encryptedBet1 = await encryptBetAmount(bettor1, betAmount1);
  await cipherMarket.connect(bettor1).placeBet(marketId, 0, encryptedBet1); // Yes

  // bettor2 bets No (150 tokens)
  const betAmount2 = 150_000000n;
  const encryptedBet2 = await encryptBetAmount(bettor2, betAmount2);
  await cipherMarket.connect(bettor2).placeBet(marketId, 1, encryptedBet2); // No

  // Advance time past market end
  await time.increaseTo(endTime + 1);

  return {
    ...fixture,
    betAmount1,
    betAmount2,
    yesBettor: bettor1,
    noBettor: bettor2,
  };
}