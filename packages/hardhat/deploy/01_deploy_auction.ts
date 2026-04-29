import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployCipherMarket: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy BetToken (FHERC20)
  const betToken = await deploy("AuctionToken", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
  console.log("BetToken (AuctionToken) deployed to:", betToken.address);

  // Deploy CipherMarket
  const cipherMarket = await deploy("CipherMarket", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
  console.log("CipherMarket deployed to:", cipherMarket.address);

  console.log("\n=== CipherMarket Deployment Summary ===");
  console.log("BetToken:", betToken.address);
  console.log("CipherMarket:", cipherMarket.address);
};

export default deployCipherMarket;
deployCipherMarket.tags = ["BetToken", "CipherMarket"];