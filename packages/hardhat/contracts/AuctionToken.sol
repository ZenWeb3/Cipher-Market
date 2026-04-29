// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { FHE, euint64 } from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import { FHERC20 } from "fhenix-confidential-contracts/contracts/FHERC20/FHERC20.sol";

/// @title AuctionToken
/// @notice A simple FHERC20 token for the sealed bid auction demo
contract AuctionToken is FHERC20 {
    constructor() FHERC20("Auction Token", "AUCT", 6, "") {}

    /// @notice Mint tokens to an address (for demo purposes)
    /// @param to The address to mint to
    /// @param amount The amount to mint (in 6 decimal precision)
    function mint(address to, uint64 amount) external {
        euint64 encAmount = FHE.asEuint64(amount);
        FHE.allowThis(encAmount);
        _mint(to, encAmount);
    }
}
