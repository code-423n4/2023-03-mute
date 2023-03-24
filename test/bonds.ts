import {bondFixture, rich_list, MaxUint256, DEFAULT_FEE, toTokenDenomination, Time, expectEvent}  from './helper'

const { expect } = require("chai");
const BigNumber = require('bignumber.js');
// make sure there is no rounding up
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN })

var time = new Time()

describe('MuteBonds', function () {

  let muteToken
  let dMuteToken
  let bondContract
  let bondTreasury
  let lpToken
  let owner
  let buyer1

  beforeEach(async function() {
    let fixture = await bondFixture()

    muteToken = fixture.muteToken
    dMuteToken = fixture.dMuteToken
    bondContract = fixture.bondContract
    lpToken = fixture.lpToken
    bondTreasury = fixture.bondTreasury
    buyer1 = fixture.buyer1
    owner = fixture.owner

    await muteToken.transfer(bondTreasury.address, new BigNumber(100000).times(Math.pow(10,18)).toFixed())
    await lpToken.transfer(buyer1.address, new BigNumber(100000).times(Math.pow(10,18)).toFixed())
    await lpToken.approve(bondContract.address, MaxUint256)
    await lpToken.connect(buyer1).approve(bondContract.address, MaxUint256)

    await bondTreasury.whitelistBondContract(bondContract.address)
  })

  it('Price ceiling after 7 days passed', async function () {
    await time.increase(60 * 60 * 24 * 10)

    var price = await bondContract.bondPrice()
    var max_price = await bondContract.maxPrice()


    expect(price.toString()).to.eq(max_price.toString())
  })

  it('Purchase under max payout', async function () {
    await time.increase(60 * 60 * 24 * 3.5)

    var init_dmute = await dMuteToken.GetUnderlyingTokens(buyer1.address)
    var price = await bondContract.connect(buyer1).deposit(new BigNumber(10).times(Math.pow(10,18)).toFixed(), buyer1.address, false)
    var post_dmute = await dMuteToken.GetUnderlyingTokens(buyer1.address)

    var receipt = (await price.wait())
    expectEvent(receipt, "BondCreated", {
      deposit: new BigNumber(10).times(Math.pow(10,18)).toString(),
      payout: post_dmute.toString(),
      depositor: buyer1.address,
      time: (await time.latest()).toString()
    });
  })

  it('Single purchase over max amount during single epoch', async function () {
    await expect(bondContract.connect(buyer1).deposit(new BigNumber(100).times(Math.pow(10,18)).toFixed(), buyer1.address, false)).to.be.revertedWith("Bond too large")
  })

  it('Purchase too little during single epoch', async function () {
    await expect(bondContract.connect(buyer1).deposit(new BigNumber(1).times(Math.pow(10,10)).toFixed(), buyer1.address, false)).to.be.revertedWith("Bond too small")
  })

  it('Purchase too much during single epoch', async function () {
    await time.increase(60 * 60 * 24 * 3.5)

    await bondContract.connect(buyer1).deposit(new BigNumber(50).times(Math.pow(10,18)).toFixed(), buyer1.address, false)
    await expect(bondContract.connect(buyer1).deposit(new BigNumber(50).times(Math.pow(10,18)).toFixed(), buyer1.address, false)).to.be.revertedWith("Deposit too large")
  })

  it('Purchase exact amount of bond', async function () {
    //await time.increase(60 * 60 * 24 * 3.5)
    var set_time = (await time.latest()).plus(60 * 60 * 24 * 3.5)
    var epoch_start = new BigNumber((await bondContract.epochStart()).toString())
    var current_epoch = await bondContract.epoch()

    await time.setNextBlockTime(set_time)
    var init_bal = await lpToken.balanceOf(buyer1.address)

    await bondContract.connect(buyer1).deposit('0', buyer1.address, true)

    var post_dmute = await dMuteToken.GetUnderlyingTokens(buyer1.address)
    var post_bal = await lpToken.balanceOf(buyer1.address)
    var post_epoch = await bondContract.epoch()

    //console.log(new BigNumber(init_bal.toString()).div(Math.pow(10,18)).toFixed())
    //console.log(new BigNumber(post_bal.toString()).div(Math.pow(10,18)).toFixed())

    expect(post_dmute.toString()).to.eq((await bondContract.maxPayout()).toString())
    expect(new BigNumber(post_epoch).toString()).to.eq(new BigNumber(current_epoch).plus(1).toString())
  })

  it('Purchase two epochs with max bidding', async function () {
    //await time.increase(60 * 60 * 24 * 3.5)
    var set_time = (await time.latest()).plus(60 * 60 * 24 * 3.5)
    var epoch_start = new BigNumber((await bondContract.epochStart()).toString())
    var current_epoch = await bondContract.epoch()

    await time.setNextBlockTime(set_time)
    var init_bal = await lpToken.balanceOf(buyer1.address)

    await bondContract.connect(buyer1).deposit('0', buyer1.address, true)

    var post_dmute = await dMuteToken.GetUnderlyingTokens(buyer1.address)
    var post_bal = await lpToken.balanceOf(buyer1.address)
    var post_epoch = await bondContract.epoch()

    //console.log(new BigNumber(init_bal.toString()).div(Math.pow(10,18)).toFixed())
    //console.log(new BigNumber(post_bal.toString()).div(Math.pow(10,18)).toFixed())

    expect(post_dmute.toString()).to.eq((await bondContract.maxPayout()).toString())
    expect(new BigNumber(post_epoch).toString()).to.eq(new BigNumber(current_epoch).plus(1).toString())

    set_time = (await time.latest()).plus(60 * 60 * 24 * 3.5)

    await time.setNextBlockTime(set_time)

    await bondContract.connect(buyer1).deposit('0', buyer1.address, true)

    post_dmute = await dMuteToken.GetUnderlyingTokens(buyer1.address)

    expect(post_dmute.toString()).to.eq(new BigNumber((await bondContract.maxPayout()).toString()).times(2).toFixed())

  })
})
