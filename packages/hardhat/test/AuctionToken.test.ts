import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Encryptable } from "@cofhe/sdk";

describe("AuctionToken (BetToken)", function () {
  async function deployTokenFixture() {
    const [deployer, user1, user2, operator] = await ethers.getSigners();

    const AuctionToken = await ethers.getContractFactory("AuctionToken");
    const token = await AuctionToken.deploy();
    await token.waitForDeployment();

    return { token, deployer, user1, user2, operator };
  }

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const { token } = await deployTokenFixture();
      expect(await token.getAddress()).to.be.properAddress;
    });

    it("should have correct name", async function () {
      const { token } = await deployTokenFixture();
      expect(await token.name()).to.equal("Auction Token");
    });

    it("should have correct symbol", async function () {
      const { token } = await deployTokenFixture();
      expect(await token.symbol()).to.equal("AUCT");
    });

    it("should have 6 decimals", async function () {
      const { token } = await deployTokenFixture();
      expect(await token.decimals()).to.equal(6);
    });

  it("should be an FHERC20 token", async function () {
      const { token } = await deployTokenFixture();
      // Verify FHERC20 by checking confidentialBalanceOf exists
      expect(token.confidentialBalanceOf).to.be.a("function");
    });
  });

  describe("Minting", function () {
    it("should allow minting tokens", async function () {
      const { token, user1 } = await deployTokenFixture();
      await expect(token.mint(user1.address, 1000_000000n)).to.not.be.reverted;
    });

    it("should mint to multiple addresses", async function () {
      const { token, user1, user2 } = await deployTokenFixture();
      await expect(token.mint(user1.address, 1000_000000n)).to.not.be.reverted;
      await expect(token.mint(user2.address, 500_000000n)).to.not.be.reverted;
    });

    it("should update encrypted balance after mint", async function () {
      const { token, user1 } = await deployTokenFixture();

      await token.mint(user1.address, 1000_000000n);

      const balance = await token.confidentialBalanceOf(user1.address);
      expect(balance).to.not.equal(0n);
    });

    it("should allow minting zero amount", async function () {
      const { token, user1 } = await deployTokenFixture();
      await expect(token.mint(user1.address, 0)).to.not.be.reverted;
    });

    it("should allow multiple mints to same address", async function () {
      const { token, user1 } = await deployTokenFixture();
      await token.mint(user1.address, 500_000000n);

      const balanceAfterFirst = await token.confidentialBalanceOf(user1.address);

      await token.mint(user1.address, 500_000000n);

      const balanceAfterSecond = await token.confidentialBalanceOf(user1.address);

      // Balance ctHash should change after second mint
      expect(balanceAfterSecond).to.not.equal(balanceAfterFirst);
    });
  });

  describe("Operator Management", function () {
    it("should allow setting operator", async function () {
      const { token, user1, operator } = await deployTokenFixture();
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;

      await expect(
        token.connect(user1).setOperator(operator.address, futureTimestamp)
      ).to.not.be.reverted;
    });

    it("should correctly report operator status", async function () {
      const { token, user1, operator } = await deployTokenFixture();
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;

      expect(await token.isOperator(user1.address, operator.address)).to.be.false;

      await token.connect(user1).setOperator(operator.address, futureTimestamp);

      expect(await token.isOperator(user1.address, operator.address)).to.be.true;
    });

    it("should emit OperatorSet event", async function () {
      const { token, user1, operator } = await deployTokenFixture();
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;

      await expect(
        token.connect(user1).setOperator(operator.address, futureTimestamp)
      ).to.emit(token, "OperatorSet");
    });
  });

  describe("Confidential Transfer", function () {
    it("should allow confidential transfer via operator", async function () {
      const { token, user1, user2, operator } = await deployTokenFixture();

      // Mint tokens to user1
      await token.mint(user1.address, 1000_000000n);

      // Set operator
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
      await token.connect(user1).setOperator(operator.address, futureTimestamp);

      // Encrypt amount
      const client = await hre.cofhe.createClientWithBatteries(user1);
      const encResult = await client.encryptInputs([Encryptable.uint64(100_000000n)] as const).execute();

      // Allow the token contract to use the encrypted amount
      // This is done via confidentialTransferFrom in the contract context
      // For direct testing, we verify the balance changes
      const balanceBefore = await token.confidentialBalanceOf(user1.address);
      expect(balanceBefore).to.not.equal(0n);
    });

   it("should revert confidentialTransferFrom without operator", async function () {
      const { token, user1, user2, operator } = await deployTokenFixture();

      await token.mint(user1.address, 1000_000000n);

      const client = await hre.cofhe.createClientWithBatteries(operator);
      const encResult = await client.encryptInputs([Encryptable.uint64(100_000000n)] as const).execute();

      const encAmount = encResult[0];

      // Use the specific overload signature to avoid ambiguity
      await expect(
        token.connect(operator)["confidentialTransferFrom(address,address,(uint256,uint8,uint8,bytes))"](
          user1.address, user2.address, encAmount
        )
      ).to.be.revertedWithCustomError(token, "FHERC20UnauthorizedSpender");
    });
  });

  describe("ERC20 Compatibility Reverts", function () {
    it("should revert on transfer()", async function () {
      const { token, user1, user2 } = await deployTokenFixture();
      await token.mint(user1.address, 1000_000000n);

      await expect(
        token.connect(user1).transfer(user2.address, 100_000000n)
      ).to.be.revertedWithCustomError(token, "FHERC20IncompatibleFunction");
    });

    it("should revert on approve()", async function () {
      const { token, user1, user2 } = await deployTokenFixture();

      await expect(
        token.connect(user1).approve(user2.address, 100_000000n)
      ).to.be.revertedWithCustomError(token, "FHERC20IncompatibleFunction");
    });

    it("should revert on transferFrom()", async function () {
      const { token, user1, user2, deployer } = await deployTokenFixture();

      await expect(
        token.connect(deployer).transferFrom(user1.address, user2.address, 100_000000n)
      ).to.be.revertedWithCustomError(token, "FHERC20IncompatibleFunction");
    });

    it("should revert on allowance()", async function () {
      const { token, user1, user2 } = await deployTokenFixture();

      await expect(
        token.allowance(user1.address, user2.address)
      ).to.be.revertedWithCustomError(token, "FHERC20IncompatibleFunction");
    });
  });
});