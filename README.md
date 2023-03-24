# Mute.io contest details
- Total Prize Pool: $24,000 USDC
  - HM awards: $15,725 USDC
  - QA report awards: $1,850 USDC
  - Gas report awards: $925 USDC
  - Judge + presort awards: $5,000 USDC
  - Scout awards: $500 USDC
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2023-03-mute-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 28, 2023 20:00 UTC
- Ends April 03, 2023 20:00 UTC

## Automated Findings / Publicly Known Issues

Automated findings output for the contest can be found [here](link to come) within an hour of contest opening.

*Note for C4 wardens: Anything included in the automated findings output is considered a publicly known issue and is ineligible for awards.*

# Overview

Mute is a native DeFi platform built on zkSync. The platform includes an AMM w/ stable and normal pools, bond platform, and amplifier platform. 

The primary focus of this audit is to identify any areas of concern within the bond & amplifier contracts - specifically for loss of funds.

The [Mute Docs](https://wiki.mute.io) has detailed information on the platform, how the systems are integrated, and specific calulations made inside certain contracts. 

# Scope


| Contract | SLOC | Purpose |  
| ----------- | ----------- | ----------- |
| [contracts/amplifier/MuteAmplifier.sol](contracts/amplifier/MuteAmplifier.sol) | 305 | This contract drips Mute tokens as reward for depositing LP tokens over the course of startTime and endTime. The ratio of rewards is depends on a users weight and their dMute holding balance in relation to the overall contract rewards. The higher their dMute underlying holdings are, the more Mute tokens they receive. |
| [contracts/bonds/MuteBond.sol](contracts/bonds/MuteBond.sol) | 146 | This contract allows users to bond their LP tokens in return for native Mute tokens. The contract continuously creates new bond epochs as long as it is funded with Mute tokens. Mute payout are received in dMute and timelocked for 7 days |
| [contracts/dao/dMute.sol](contracts/dao/dMute.sol) | 84 | This contract allows users to lock up their mute tokens to receive a soul-bound ERC20 dMute token. This is used as a governance token for Mute. Locking up mute for dMute requires a min 7 day vest with max 365 day period. Users can redeem their mute after the timelock is expired.  |
## Out of scope

| Contracts |  
| ----------- |
| [contracts/interfaces/*](contracts/interfaces)|
| [contracts/libraries/*](contracts/libraries)|
| [contracts/dynamic/*](contracts/dynamic)|
| [contracts/test/*](contracts/test)|

# Additional Context

- [dMute Vote Weight Calculations](https://wiki.mute.io/mute/mute-dao/introduction)
- [Amplifier Pool Boosted APY Calculation](https://wiki.mute.io/mute/mute-switch/amplifier)

## Scoping Details 
```
- If you have a public code repo, please share it here:  N/A
- How many contracts are in scope?:   3
- Total SLoC for these contracts?:  535
- How many external imports are there?: 8
- How many separate interfaces and struct definitions are there for the contracts within scope?:  8
- Does most of your code generally use composition or inheritance?:   Composition
- How many external calls?:   0
- What is the overall line coverage percentage provided by your tests?:  75
- Is there a need to understand a separate part of the codebase / get context in order to audit this part of the protocol?:  false 
- Please describe required context:   n/a
- Does it use an oracle?:  no
- Does the token conform to the ERC20 standard?:  Yes
- Are there any novel or unique curve logic or mathematical models?: Yes
- Does it use a timelock function?:  Yes
- Is it an NFT?: No
- Does it have an AMM?:   Yes
- Is it a fork of a popular project?:   Yes - the AMM is; We use the Velodrome Stable Curve which is a fork of uniV2 with modifications. We have applied LP governance & a dynamic fee model. This is outside the scope of the contracts being audited. 
- Does it use rollups?:   Yes (zkSync)
- Is it multi-chain?:  No
- Does it use a side-chain?: Yes; EVM-compatible side-chain
- Specific areas to be addressed: We want to find any exploits that result in loss of funds for our bond contract and amplifier contract. We are not concerned heavily with our AMM as it uses battle tested code, however is in the scope still as our bond / amplifier contracts utilize it.
```

# Tests

Using Node v12.18.3 and npm 8.3.0

```bash
# Install project dependencies
npm install
# Compile using hardhat
npx hardhat compile
```

Run unit tests

``` bash
# Run Amplifier unit tests
npm run test-amplifier
# Run Bond unit tests
npm run test-bond
# Run dmute unit tests
npm run test-dao
````
