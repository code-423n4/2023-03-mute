// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../dynamic/MuteSwitchERC20Dynamic.sol';

contract ERC20 is MuteSwitchERC20Dynamic {
    constructor(uint _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }
}
