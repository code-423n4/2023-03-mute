import {factoryFixture, pairFixture, pairFixtureDeflating, pairFixtureLimitOrder, daoFixture,
        rich_list, MaxUint256, DEFAULT_FEE, toTokenDenomination}  from './helper'

const BigNumber = require('bignumber.js');
const { expect } = require("chai");
// make sure there is no rounding up
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN })

describe('MuteSwitchRouter', function () {

  let token0
  let token1
  let router
  let factory
  let pair
  let feeAddress
  let weth


  beforeEach(async function() {

    let fixture = await pairFixture()

    factory = fixture.factory
    router = fixture.router
    pair = fixture.pair
    token0 = fixture.token0
    token1 = fixture.token1
    this.owner = fixture.owner
    feeAddress = fixture.feeTo
    weth = fixture.weth
  })

  it('quote', async function () {
    expect((await router.quote(toTokenDenomination(1), toTokenDenomination(100), toTokenDenomination(200))).toString()).to.eq(toTokenDenomination(2))
    expect((await router.quote(toTokenDenomination(2), toTokenDenomination(200), toTokenDenomination(100))).toString()).to.eq(toTokenDenomination(1))
    await expect(router.getAmountOut(toTokenDenomination(0), toTokenDenomination(100), toTokenDenomination(200), DEFAULT_FEE)).to.be.reverted
    await expect(router.getAmountOut(toTokenDenomination(1), toTokenDenomination(0), toTokenDenomination(200), DEFAULT_FEE)).to.be.reverted
    await expect(router.getAmountOut(toTokenDenomination(1), toTokenDenomination(100), toTokenDenomination(0), DEFAULT_FEE)).to.be.reverted
  })

  it('getAmountOut', async function () {
    expect((await router.getAmountOut(toTokenDenomination(2), toTokenDenomination(100), toTokenDenomination(100), DEFAULT_FEE)).toString()).to.eq(toTokenDenomination(1))
    await expect(router.getAmountOut(toTokenDenomination(0), toTokenDenomination(100), toTokenDenomination(100), DEFAULT_FEE)).to.be.reverted
    await expect(router.getAmountOut(toTokenDenomination(2), toTokenDenomination(0), toTokenDenomination(100), DEFAULT_FEE)).to.be.reverted
    await expect(router.getAmountOut(toTokenDenomination(2), toTokenDenomination(100), toTokenDenomination(0), DEFAULT_FEE)).to.be.reverted
  })

  it('getAmountIn', async function () {
    expect((await router.getAmountIn(toTokenDenomination(1), toTokenDenomination(100), toTokenDenomination(100), DEFAULT_FEE)).toString()).to.eq(toTokenDenomination(2))
    await expect(router.getAmountOut(toTokenDenomination(0), toTokenDenomination(100), toTokenDenomination(100), DEFAULT_FEE)).to.be.reverted
    await expect(router.getAmountOut(toTokenDenomination(1), toTokenDenomination(0), toTokenDenomination(100), DEFAULT_FEE)).to.be.reverted
    await expect(router.getAmountOut(toTokenDenomination(1), toTokenDenomination(100), toTokenDenomination(0), DEFAULT_FEE)).to.be.reverted
  })

  it('getAmountsOut', async function () {
    var tx = await token0.approve(router.address, MaxUint256)

    tx = await token1.approve(router.address, MaxUint256)


    tx = await router.addLiquidity(
      token0.address,
      token1.address,
      toTokenDenomination(10000),
      toTokenDenomination(10000),
      '0',
      '0',
      this.owner.address,
      MaxUint256,
      DEFAULT_FEE
    )



    await expect(router.getAmountsOut(toTokenDenomination(2), [token0.address])).to.be.reverted

    const path = [token0.address, token1.address]
    expect((await router.getAmountsOut(toTokenDenomination(2), path)).toString()).to.deep.eq('2,1')
  })

  it('getAmountsIn', async function () {
    var tx = await token0.approve(router.address, MaxUint256)

    tx = await token1.approve(router.address, MaxUint256)


    tx = await router.addLiquidity(
      token0.address,
      token1.address,
      toTokenDenomination(10000),
      toTokenDenomination(10000),
      '0',
      '0',
      this.owner.address,
      MaxUint256,
      DEFAULT_FEE
    )




    await expect(router.getAmountsIn(toTokenDenomination(1), [token0.address])).to.be.reverted

    const path = [token0.address, token1.address]
    expect((await router.getAmountsIn(toTokenDenomination(1), path)).toString()).to.deep.eq('2,1')
  })
})

describe('fee-on-transfer tokens', function () {
  let DTT
  let DTT2
  let router
  let pair
  let factory
  let owner
  let feeAddress
  let weth
  let limitOrder
  let limitOrderBot

  beforeEach(async function() {
    let fixture = await pairFixtureDeflating()

    factory = fixture.factory
    router = fixture.router
    pair = fixture.pair
    DTT = fixture.DTT
    DTT2 = fixture.DTT2
    owner = fixture.owner
    feeAddress = fixture.feeTo
    weth = fixture.weth
    limitOrder = fixture.limitOrder
    limitOrderBot = fixture.limitOrderBot
  })


  afterEach(async function() {
    expect((await ethers.provider.getBalance(router.address)).toString()).to.eq('0')
  })

  async function addLiquidity(DTTAmount, DTT2Amount) {
    var tx = await DTT.approve(router.address, MaxUint256)

    tx = await DTT2.approve(router.address, MaxUint256)

    tx = await router.addLiquidity(
      DTT.address,
      DTT2.address,
      DTTAmount,
      DTT2Amount,
      DTTAmount,
      DTT2Amount,
      owner.address,
      MaxUint256,
      DEFAULT_FEE
    )

  }

  it('removeLiquidity', async function () {
    const DTTAmount = toTokenDenomination(1 * Math.pow(10,18))
    const DTT2Amount = toTokenDenomination(4 * Math.pow(10,18))
    await addLiquidity(DTTAmount, DTT2Amount)

    const DTTInPair = await DTT.balanceOf(pair.address)
    const DTT2InPair = await DTT2.balanceOf(pair.address)
    const liquidity = await pair.balanceOf(owner.address)
    const totalSupply = await pair.totalSupply()
    const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
    const DTT2Expected = DTT2InPair.mul(liquidity).div(totalSupply)

    var tx = await pair.approve(router.address, MaxUint256)


    await router.removeLiquidity(
      DTT.address,
      DTT2.address,
      liquidity,
      NaiveDTTExpected,
      DTT2Expected,
      owner.address,
      MaxUint256
    )


  })

  describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', function () {
    const DTTAmount = toTokenDenomination(5 * Math.pow(10,18) * 100 / 99)
    const DTT2Amount = toTokenDenomination(10 * Math.pow(10,18))
    const amountIn = toTokenDenomination(1 * Math.pow(10,18))

    beforeEach(async function () {
      await addLiquidity(DTTAmount, DTT2Amount)
    })

    it('DTT -> DTT2', async function () {
      var tx = await DTT.approve(router.address, MaxUint256)


      var initBal = await DTT.balanceOf(feeAddress.address)

      tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTT.address, DTT2.address],
        owner.address,
        MaxUint256,
      )



      var finalBal = await DTT.balanceOf(feeAddress.address)

      //LP fee is 0.3% of a trade, protocol fee is 0.1% of the 0.3%
      // 1 * 0.1%
      expect(finalBal.sub(initBal).toString()).to.deep.eq(toTokenDenomination(0.001 * Math.pow(10,18)))
    })
  })

  describe('swapTokensForExactTokens', function () {
    const DTTAmount = toTokenDenomination(5 * Math.pow(10,18) * 100 / 99)
    const DTT2Amount = toTokenDenomination(10 * Math.pow(10,18))
    const amountOut = toTokenDenomination(1 * Math.pow(10,18))

    beforeEach(async function () {
      await addLiquidity(DTTAmount, DTT2Amount)
    })

    it('DTT -> DTT2', async function () {
      var tx = await DTT.approve(router.address, MaxUint256)


      var initBal = await DTT.balanceOf(feeAddress.address)
      var amounts =  await router.getAmountsIn(amountOut, [DTT.address, DTT2.address]);

      tx = await router.swapTokensForExactTokens(
        amountOut,
        amounts[0],
        [DTT.address, DTT2.address],
        owner.address,
        MaxUint256,
      )



      var finalBal = await DTT.balanceOf(feeAddress.address)

      var reserves = await pair.getReserves()
      var DTTBal = await DTT.balanceOf(pair.address)
      var DTT2Bal = await DTT2.balanceOf(pair.address)

      expect(reserves._reserve0.toString()).to.deep.eq(DTTBal.toString())
      expect(reserves._reserve1.toString()).to.deep.eq(DTT2Bal.toString())

      //protocol fee is 0.1% of any trade
      expect(finalBal.sub(initBal).toString()).to.deep.eq(toTokenDenomination(0.001 * Number(amounts[0].toString())))
    })
  })
})
