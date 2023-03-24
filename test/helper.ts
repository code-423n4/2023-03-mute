const BigNumber = require('bignumber.js');
const { expect } = require('chai');

export const DEFAULT_FEE = 30 // 0.3%
export const ONE_PERCENT_FEE = 100

export function toTokenDenomination (x: any) {
  return new BigNumber(x).toFixed(0);
}

export const MaxUint256 = new BigNumber('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF').toFixed()

export async function factoryFixture() {
  const [owner, feeTo] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("MuteSwitchFactoryDynamic");

  const factory = await Factory.deploy();
  //await factory.setProtocolFeeFixed(0);
  //await factory.setProtocolFeeDynamic(500);

  await factory.setFeeTo(feeTo.address)

  const WETH = await ethers.getContractFactory("WETH");

  const weth = await WETH.deploy();

  return { factory, owner, feeTo, weth }
}

export async function pairFixture() {
  const { factory, owner, feeTo, weth } = await factoryFixture()

  const ERC20V2 = await ethers.getContractFactory("ERC20Default");
  const PairV2 = await ethers.getContractFactory("MuteSwitchPairDynamic");

  const tokenA = await ERC20V2.deploy(toTokenDenomination(new BigNumber(1).times(Math.pow(10, 32))));
  const tokenB = await ERC20V2.deploy(toTokenDenomination(new BigNumber(1).times(Math.pow(10, 32))));

  await factory.createPair(tokenA.address, tokenB.address, DEFAULT_FEE, true)

  const pairAddress = await factory.getPair(tokenA.address, tokenB.address, true)
  const pair = await PairV2.attach(pairAddress)

  const token0Address = await pair.token0()

  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  const Router = await ethers.getContractFactory("MuteSwitchRouterDynamic");

  var router = await Router.deploy(factory.address, weth.address)

  const SwitchLimitOrder = await ethers.getContractFactory("SwitchLimitOrderFactory");
  const limitOrder = await SwitchLimitOrder.deploy(router.address, weth.address);

  const SwitchLimitOrderBot = await ethers.getContractFactory("SwitchLimitOrderBot");
  const limitOrderBot = await SwitchLimitOrderBot.deploy(limitOrder.address);

  return { factory, router, pair, token0, token1, owner, feeTo, weth, limitOrder, limitOrderBot }
}

export async function pairFixtureDeflating() {
  const { factory, owner, feeTo, weth } = await factoryFixture()

  const ERC20V2 = await ethers.getContractFactory("ERC20Default");
  const PairV2 = await ethers.getContractFactory("MuteSwitchPairDynamic");

  const tokenA = await ERC20V2.deploy(toTokenDenomination(10000 * Math.pow(10,18)));
  const tokenB = await ERC20V2.deploy(toTokenDenomination(10000 * Math.pow(10,18)));

  await factory.createPair(tokenA.address, tokenB.address, DEFAULT_FEE, false)

  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)
  const pair = await PairV2.attach(pairAddress)

  const token0Address = await pair.token0()

  const DTT = tokenA.address === token0Address ? tokenA : tokenB
  const DTT2 = tokenA.address === token0Address ? tokenB : tokenA

  const Router = await ethers.getContractFactory("MuteSwitchRouterDynamic");

  var router = await Router.deploy(factory.address, weth.address)

  const SwitchLimitOrder = await ethers.getContractFactory("SwitchLimitOrderFactory");
  const limitOrder = await SwitchLimitOrder.deploy(router.address, weth.address);

  const SwitchLimitOrderBot = await ethers.getContractFactory("SwitchLimitOrderBot");
  const limitOrderBot = await SwitchLimitOrderBot.deploy(limitOrder.address);

  return { factory, router, pair, DTT, DTT2, owner, feeTo, weth, limitOrder, limitOrderBot }
}

export async function pairFixtureLimitOrder() {
  const { factory, owner, feeTo, weth } = await factoryFixture()

  const ERC20V2 = await ethers.getContractFactory("ERC20Default");
  const PairV2 = await ethers.getContractFactory("MuteSwitchPairDynamic");


  const tokenA = await ERC20V2.deploy(toTokenDenomination(10000 * Math.pow(10,18)))
  const tokenB = await ERC20V2.deploy(toTokenDenomination(10000 * Math.pow(10,18)))

  await factory.createPair(tokenA.address, tokenB.address, DEFAULT_FEE, false)
  await factory.createPair(tokenA.address, weth.address, DEFAULT_FEE, false)
  await factory.createPair(tokenB.address, weth.address, DEFAULT_FEE, false)

  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)
  const pair = await PairV2.attach(pairAddress)

  const token0Address = await pair.token0()

  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  const RouterV2 = await ethers.getContractFactory("MuteSwitchRouterDynamic");

  var router = await RouterV2.deploy(factory.address, weth.address)

  const SwitchLimitOrder = await ethers.getContractFactory("SwitchLimitOrderFactory");
  const limitOrder = await SwitchLimitOrder.deploy(router.address, weth.address);

  const SwitchLimitOrderBot = await ethers.getContractFactory("SwitchLimitOrderBot");
  const limitOrderBot = await SwitchLimitOrderBot.deploy(limitOrder.address);

  return { factory, router, pair, token0, token1, owner, feeTo, weth, limitOrder, limitOrderBot }
}

export async function daoFixture() {
  const [owner] = await ethers.getSigners();

  const ERC20V2 = await ethers.getContractFactory("ERC20Default");
  const DMute = await ethers.getContractFactory("dMute");

  const muteToken = await ERC20V2.deploy(new BigNumber(40000000).times(Math.pow(10,18)).toFixed())
  const dMuteToken = await DMute.deploy(muteToken.address)

  return { muteToken, dMuteToken, owner }
}

export async function amplifierFixture() {
  const [owner, staker1, staker2, staker3, staker4, staker5] = await ethers.getSigners();

  const ERC20V2 = await ethers.getContractFactory("ERC20Default");
  const DMute = await ethers.getContractFactory("dMute");
  const MuteAmplifier = await ethers.getContractFactory("MuteAmplifier");

  const muteToken = await ERC20V2.deploy(new BigNumber(40000000).times(Math.pow(10,18)).toFixed())
  const dMuteToken = await DMute.deploy(muteToken.address)

  const lpToken = await ERC20V2.deploy(new BigNumber(3700).times(Math.pow(10,18)).toFixed())

  const amplifier = await MuteAmplifier.deploy(lpToken.address, muteToken.address, dMuteToken.address, new BigNumber(Math.pow(10,18)).times(2).toFixed(), 300, owner.address)

  return { muteToken, dMuteToken, lpToken, amplifier, owner, staker1, staker2, staker3, staker4, staker5 }
}

export async function bondFixture() {
  const [owner, buyer1] = await ethers.getSigners();

  const ERC20V2 = await ethers.getContractFactory("ERC20Default");
  const DMute = await ethers.getContractFactory("dMute");
  const BondTreasury = await ethers.getContractFactory("BondTreasury");
  const MuteBond = await ethers.getContractFactory("MuteBond");

  const muteToken = await ERC20V2.deploy(new BigNumber(40000000).times(Math.pow(10,18)).toFixed())
  const lpToken = await ERC20V2.deploy(new BigNumber(40000000).times(Math.pow(10,18)).toFixed())

  const dMuteToken = await DMute.deploy(muteToken.address)
  const bondTreasury = await BondTreasury.deploy(muteToken.address)

  //lp token is $113.7
  //mute is $0.90
  // mute to lp is 126.33
  // bond can be purchased from 100 to 200 over 7 day period
  const maxPrice = new BigNumber(200).times(Math.pow(10,18))
  const startPrice = new BigNumber(100).times(Math.pow(10,18))

  const maxPayout = new BigNumber(10000).times(Math.pow(10,18))

  const bondContract = await MuteBond.deploy(bondTreasury.address, lpToken.address, dMuteToken.address, maxPrice.toFixed(), startPrice.toFixed(), maxPayout.toFixed() )

  return { muteToken, dMuteToken, bondContract, bondTreasury, lpToken, owner, buyer1 }
}


export class Time {
  constructor() {}

  async increase(amount){
    await ethers.provider.send("evm_increaseTime", [new BigNumber(amount).toNumber()])
    await ethers.provider.send("evm_mine")
  }

  async increaseTo(amount) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [new BigNumber(amount).toNumber()])
    await ethers.provider.send("evm_mine")
  }

  async latest(){
    return new BigNumber((await ethers.provider.getBlock("latest")).timestamp)
  }

  async setNextBlockTime(amount){
    await ethers.provider.send("evm_setNextBlockTimestamp", [new BigNumber(amount).toNumber()])
  }


}



const web3 = require('web3');
const BN = web3.utils.BN;

export function expectEvent (receipt, eventName, eventArgs = {}) {
  const logs = Object.keys(receipt.events).map(name => {
    return ({ event: receipt.events[name].event, args: receipt.events[name].args });
  });
  return inLogs(logs, eventName, eventArgs);
}


function inLogs (logs, eventName, eventArgs = {}) {
  const events = logs.filter(e => e.event === eventName);
  expect(events.length > 0).to.equal(true, `No '${eventName}' events found`);

  const exception = [];
  const event = events.find(function (e) {
    for (const [k, v] of Object.entries(eventArgs)) {
      try {
        contains(e.args, k, v);
      } catch (error) {
        exception.push(error);
        return false;
      }
    }
    return true;
  });

  if (event === undefined) {
    throw exception[0];
  }

  return event;
}


function contains (args, key, value) {
  expect(key in args).to.equal(true, `Event argument '${key}' not found`);

  if (value === null) {
    expect(args[key]).to.equal(null,
      `expected event argument '${key}' to be null but got ${args[key]}`);
  } else if (isBN(args[key]) || isBN(value)) {
    const actual = isBN(args[key]) ? args[key].toString() : args[key];
    const expected = isBN(value) ? value.toString() : value;
    expect(args[key]).to.be.bignumber.equal(value,
      `expected event argument '${key}' to have value ${expected} but got ${actual}`);
  } else {
    expect(args[key]).to.be.deep.equal(value,
      `expected event argument '${key}' to have value ${value} but got ${args[key]}`);
  }
}

function isBN (object) {
  return BN.isBN(object) || object instanceof BN;
}
