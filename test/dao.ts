import {factoryFixture, pairFixture, pairFixtureDeflating, pairFixtureLimitOrder, daoFixture,
        rich_list, MaxUint256, DEFAULT_FEE, toTokenDenomination, Time}  from './helper'

const { expect } = require("chai");
const BigNumber = require('bignumber.js');
// make sure there is no rounding up
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN })

var time = new Time()

describe('MuteDAO', function () {

  let muteToken
  let dMuteToken
  let owner

  beforeEach(async function() {
    let fixture = await daoFixture()

    muteToken = fixture.muteToken
    dMuteToken = fixture.dMuteToken
    owner = fixture.owner

  })

  it('Lock', async function () {
    var tx = await muteToken.approve(dMuteToken.address, MaxUint256)


    let lock_time_week = new BigNumber(60 * 60 * 24 * 7);
    let max_lock = lock_time_week.times(52);

    let lock_amount = new BigNumber(10000).times(Math.pow(10,18))
    tx = await dMuteToken.Lock(lock_amount.toFixed(0), lock_time_week.toFixed())


    let lock_ratio = lock_time_week.times(Math.pow(10,18)).div(max_lock).toFixed(0)

    let expected_bal = lock_amount.times(lock_ratio).div(Math.pow(10,18)).toFixed(0)
    expect((await dMuteToken.balanceOf(owner.address)).toString()).to.eq(expected_bal)
  })

  it('Redeem', async function () {
    var tx = await muteToken.approve(dMuteToken.address, MaxUint256)


    let lock_time_week = new BigNumber(60 * 60 * 24 * 7);
    let max_lock = lock_time_week.times(52);

    let lock_amount = new BigNumber(10000).times(Math.pow(10,18)).toFixed()
    tx = await dMuteToken.Lock(lock_amount, lock_time_week.toFixed())


    let mute_bal_pre = await muteToken.balanceOf(owner.address)

    // Increase time
    await time.increase(60 * 60 * 24 * 7)

    tx = await dMuteToken.Redeem([0])

    let mute_bal_post = await muteToken.balanceOf(owner.address)

    expect((await dMuteToken.balanceOf(owner.address)).toString()).to.eq('0')
    expect(mute_bal_post.sub(mute_bal_pre).toString()).to.eq(lock_amount)
  })

  it('Redeem too soon', async function () {
    var tx = await muteToken.approve(dMuteToken.address, MaxUint256)


    let lock_time_week = new BigNumber(60 * 60 * 24 * 7);
    let max_lock = lock_time_week.times(52);

    let lock_amount = new BigNumber(10000).times(Math.pow(10,18)).toFixed()
    tx = await dMuteToken.Lock(lock_amount, lock_time_week.toFixed())


    await expect(dMuteToken.Redeem([0])).to.be.reverted
  })

  it('Lock too little', async function () {
    var tx = await muteToken.approve(dMuteToken.address, MaxUint256)


    let lock_time_week = new BigNumber(60 * 60 * 24 * 1);
    let max_lock = lock_time_week.times(52);

    let lock_amount = new BigNumber(10000).times(Math.pow(10,18))
    await expect(dMuteToken.Lock(lock_amount.toFixed(0), lock_time_week.toFixed())).to.be.reverted
  })

  it('Lock too long', async function () {
    var tx = await muteToken.approve(dMuteToken.address, MaxUint256)

    let lock_time_week = new BigNumber(60 * 60 * 24 * 500);
    let max_lock = lock_time_week.times(52);

    let lock_amount = new BigNumber(10000).times(Math.pow(10,18))
    await expect(dMuteToken.Lock(lock_amount.toFixed(0), lock_time_week.toFixed())).to.be.reverted
  })
})
