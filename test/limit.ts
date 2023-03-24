import {factoryFixture, pairFixture, pairFixtureDeflating, pairFixtureLimitOrder, daoFixture,
        rich_list, MaxUint256, DEFAULT_FEE, toTokenDenomination}  from './helper'

const BigNumber = require('bignumber.js');
const { expect } = require("chai");

// make sure there is no rounding up
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN })

describe('SwitchLimitOrder', function () {
  let token0
  let token1
  let router
  let pair
  let factory
  let owner
  let feeAddress
  let weth
  let limitOrder
  let limitOrderBot

  beforeEach(async function() {
    let fixture = await pairFixtureLimitOrder()

    factory = fixture.factory
    router = fixture.router
    pair = fixture.pair
    token0 = fixture.token0
    token1 = fixture.token1
    owner = fixture.owner
    feeAddress = fixture.feeTo
    weth = fixture.weth
    limitOrder = fixture.limitOrder
    limitOrderBot = fixture.limitOrderBot
  })

  describe('Limit order', function () {
    it('createLimitOrderTokenForETH', async function () {
      var tx = await token0.transfer(feeAddress.address, toTokenDenomination(1))


      tx = await token0.connect(owner).approve(limitOrder.address, MaxUint256)

      tx = await token1.connect(owner).approve(limitOrder.address, MaxUint256)


      tx = await token0.connect(feeAddress).approve(limitOrder.address, MaxUint256)

      tx = await token1.connect(feeAddress).approve(limitOrder.address, MaxUint256)


      var initBal = await token0.balanceOf(owner.address)
      var initBal2 = await token0.balanceOf(feeAddress.address)
      var initBal3 = await ethers.provider.getBalance(owner.address)
      var initBal4 = await ethers.provider.getBalance(feeAddress.address)


      tx = await limitOrder.createLimitOrderTokenForETH(toTokenDenomination(10), toTokenDenomination(1), [token0.address, weth.address], owner.address)

      tx = await limitOrder.connect(feeAddress).OrderMatchETHForToken(0, {value: toTokenDenomination(20)})

      var finalBal = await token0.balanceOf(owner.address)
      var finalBal2 = await token0.balanceOf(feeAddress.address)
      var finalBal3 = await ethers.provider.getBalance(owner.address)
      var finalBal4 = await ethers.provider.getBalance(feeAddress.address)

      //maker should have 10 less token
      expect(initBal.sub(finalBal).toString()).to.deep.eq(toTokenDenomination(10))
      //taker should have 10 more token
      expect(finalBal2.sub(initBal2).toString()).to.deep.eq(toTokenDenomination(10))
      //maker should have 1 more eth
      //expect(finalBal3.sub(initBal2).toString()).to.deep.eq(toTokenDenomination(1))
      //taker should have 1 less eth
      //expect(initBal4.sub(finalBal4).toString()).to.deep.eq(toTokenDenomination(1))
    })


    it('createLimitOrderETHForToken', async function () {
      var tx = await token0.transfer(feeAddress.address, toTokenDenomination(1))


      tx = await token0.connect(owner).approve(limitOrder.address, MaxUint256)

      tx = await token1.connect(owner).approve(limitOrder.address, MaxUint256)


      tx = await token0.connect(feeAddress).approve(limitOrder.address, MaxUint256)

      tx = await token1.connect(feeAddress).approve(limitOrder.address, MaxUint256)


      var initBal = await token0.balanceOf(owner.address)
      var initBal2 = await token0.balanceOf(feeAddress.address)
      var initBal3 = await ethers.provider.getBalance(owner.address)
      var initBal4 = await ethers.provider.getBalance(feeAddress.address)

      tx = await limitOrder.createLimitOrderETHForToken(toTokenDenomination(1), [weth.address, token0.address], owner.address, {value: toTokenDenomination(10)})

      tx = await limitOrder.connect(feeAddress).OrderMatchTokenForETH(0)

      var finalBal = await token0.balanceOf(owner.address)
      var finalBal2 = await token0.balanceOf(feeAddress.address)
      var finalBal3 = await ethers.provider.getBalance(owner.address)
      var finalBal4 = await ethers.provider.getBalance(feeAddress.address)

      //maker should have 1 more token
      expect(finalBal.sub(initBal).toString()).to.deep.eq(toTokenDenomination(1))
      //taker should have 1 less token
      expect(initBal2.sub(finalBal2).toString()).to.deep.eq(toTokenDenomination(1))
      //maker should have 10 less eth... account for gas here
      //expect(initBal3.sub(finalBal3).toString()).to.deep.eq(toTokenDenomination(10))
      //taker should have made 10 eth... account for gas here
      //expect(finalBal4.sub(initBal4).toString()).to.deep.eq(toTokenDenomination(10))
    })

    it('createLimitOrderTokenForToken', async function () {
      var tx = await token0.connect(owner).approve(limitOrder.address, MaxUint256)

      tx = await token1.connect(owner).approve(limitOrder.address, MaxUint256)


      tx = await token0.connect(feeAddress).approve(limitOrder.address, MaxUint256)

      tx = await token1.connect(feeAddress).approve(limitOrder.address, MaxUint256)


      tx = await limitOrder.createLimitOrderTokenForToken(toTokenDenomination(10), toTokenDenomination(1), [token0.address, token1.address], owner.address)

      tx = await token1.transfer(feeAddress.address, toTokenDenomination(1))


      var initBal = await token0.balanceOf(feeAddress.address)
      var initBal2 = await token1.balanceOf(owner.address)

      tx = await limitOrder.connect(feeAddress).OrderMatchTokenforToken(0)

      var finalBal = await token0.balanceOf(feeAddress.address)
      var finalBal2 = await token1.balanceOf(owner.address)

      //should have 10 tokens from the order
      expect(finalBal.sub(initBal).toString()).to.deep.eq(toTokenDenomination(10))
      expect(finalBal2.sub(initBal2).toString()).to.deep.eq(toTokenDenomination(1))

    })

  })

})
