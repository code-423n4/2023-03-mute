import {factoryFixture, pairFixture, pairFixtureDeflating, pairFixtureLimitOrder, daoFixture,
        rich_list, MaxUint256, DEFAULT_FEE, ONE_PERCENT_FEE, toTokenDenomination}  from './helper'

const BigNumber = require('bignumber.js');
const { expect } = require("chai");
// make sure there is no rounding up
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN })


describe('Testing AMM fee balance', function () {
  let token0
  let token1
  let router
  let pair
  let factory
  let owner
  let feeAddress
  let weth

  beforeEach(async function() {
    let fixture = await pairFixture()

    factory = fixture.factory
    router = fixture.router
    pair = fixture.pair
    token0 = fixture.token0
    token1 = fixture.token1
    owner = fixture.owner
    feeAddress = fixture.feeTo
    weth = fixture.weth
  })


  async function addLiquidity(DTTAmount, DTT2Amount) {
    var tx = await token0.approve(router.address, MaxUint256)
    tx = await token1.approve(router.address, MaxUint256)

    tx = await router.addLiquidity(
      token0.address,
      token1.address,
      DTTAmount,
      DTT2Amount,
      '0',
      '0',
      owner.address,
      MaxUint256,
      DEFAULT_FEE,
      true
    )
    await pair.changeFeeType(5)

  }

  describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', function () {
    const DTTAmount = toTokenDenomination(new BigNumber(1).times(Math.pow(10, 30)))
    const DTT2Amount = toTokenDenomination(new BigNumber(1).times(Math.pow(10, 30)))
    const amountIn = toTokenDenomination(new BigNumber(1).times(Math.pow(10, 25)))

    beforeEach(async function () {
      await addLiquidity(DTTAmount, DTT2Amount)
    })

    it('Swap back and forth 100 times', async function () {
      var initBal0 = await token0.balanceOf(owner.address)
      var initBal1 = await token1.balanceOf(owner.address)

      var initBal0_fee = await token0.balanceOf(feeAddress.address)
      var initBal1_fee = await token1.balanceOf(feeAddress.address)

      initBal0 = initBal0.add(amountIn)
      console.log(await pair.getReserves());
      console.log(await pair.getAmountOut(amountIn, token0.address))

      for(let i = 0; i < 100; i++){
        //console.log(await pair.getReserves());
        //console.log(i)
        if(i % 2 == 0){
          let cur_bal = await token0.balanceOf(owner.address)

          let tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,//initBal0.sub(cur_bal),
            0,
            [token0.address, token1.address],
            owner.address,
            MaxUint256,
            [true]
          )


        } else {
          let cur_bal = await token0.balanceOf(owner.address)

          let tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,//initBal1.sub(cur_bal),
            0,
            [token1.address, token0.address],
            owner.address,
            MaxUint256,
            [true]
          )

        }

      }

      var reserves_new = await pair.getReserves();

      console.log(reserves_new)

      console.log(initBal0_fee)
      console.log(initBal1_fee)
      console.log(await token0.balanceOf(feeAddress.address))
      console.log(await token1.balanceOf(feeAddress.address))

      await pair.transfer(owner.address, '0')
      console.log(await pair.claimable0(owner.address))
      console.log(await pair.claimable1(owner.address))


      //LP fee is 0.3% of a trade, protocol fee is 0.1% of the 0.3%
      // 1 * 0.1%
      //expect(finalBal.sub(initBal).toString()).to.deep.eq(toTokenDenomination(0.001 * Math.pow(10,18)))
    })
  })
})
