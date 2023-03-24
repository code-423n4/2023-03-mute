import {factoryFixture, pairFixture, pairFixtureDeflating, pairFixtureLimitOrder, daoFixture, amplifierFixture,
        rich_list, MaxUint256, DEFAULT_FEE, toTokenDenomination, Time, expectEvent}  from './helper'

const BigNumber = require('bignumber.js');
const chai = require('chai');
const BN = require('bn.js');
// Enable and inject BN dependency
chai.use(require('chai-bn')(BN));

const { expect } = require("chai");

// make sure there is no rounding up
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_DOWN })


var time = new Time()

describe('MuteAmplifier', function () {
  const staker1Initial = new BigNumber(1200).times(Math.pow(10,18));
  const staker2Initial = new BigNumber(2400).times(Math.pow(10,18));
  const staker3Initial = new BigNumber(100).times(Math.pow(10,18));

  const initialLpTokenSupply = staker1Initial.plus(staker2Initial).plus(staker3Initial);

  const totalRewards = new BigNumber(60000).times(Math.pow(10,18));
  var staking_start
  var staking_end
  var stakingDuration
  var rewardPerSecond

  var totalStakeForPeriod
  var expectedReward
  var tx
  var tx1
  var tx2
  var firstStakeTime
  var stakingHalfPeriod

  var reward
  var reward1
  var reward2

  beforeEach(async function () {
    let fixture = await amplifierFixture()

    this.muteToken = fixture.muteToken
    this.dMuteToken = fixture.dMuteToken
    this.lpToken = fixture.lpToken
    this.amplifier = fixture.amplifier
    this.owner = fixture.owner
    this.staker1 = fixture.staker1
    this.staker2 = fixture.staker2
    this.staker3 = fixture.staker3

    stakingDuration = new BigNumber(60*60*24*365);
    rewardPerSecond = totalRewards.div(stakingDuration).toFixed(0);
  });

  it("has expected lpToken address", async function () {
    expect(await this.amplifier.lpToken()).to.equal(this.lpToken.address);
  });

  it("owner has expected lp balance", async function () {
    expect(await this.lpToken.balanceOf(this.owner.address)).to.equal(
      initialLpTokenSupply.toFixed()
    );
  });

  it("has expected Mute address", async function () {
    expect(await this.amplifier.muteToken()).to.equal(this.muteToken.address);
  });

  it("has expected owner", async function () {
    expect(await this.amplifier.owner()).to.equal(this.owner.address);
  });

  context("deposit reward tokens with no multipliers", function () {
    beforeEach(async function () {
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const currentBlock = await ethers.provider.getBlock(currentBlockNumber);

      staking_start = new BigNumber(currentBlock.timestamp).plus(5 * 60)
      staking_end = staking_start.plus(stakingDuration);

      await this.muteToken.transfer(this.amplifier.address, totalRewards.toFixed(), {from: this.owner.address})

      tx = await this.amplifier.initializeDeposit(staking_start.toFixed(), staking_end.toFixed(), {from: this.owner.address})
    });

    it("emits a Deposit event", async function () {
      var receipt = (await tx.wait())
      expectEvent(receipt, "Deposit", {
        totalRewards: totalRewards.toFixed(),
        startTime: staking_start.toFixed(),
        endTime: staking_end.toFixed(),
      });
    });

    it("has expected Mute balance", async function () {
      expect(
        (await this.muteToken.balanceOf(this.amplifier.address))
      ).to.equal(totalRewards.toFixed());
    });

    it("has expected total rewards", async function () {
      expect(await this.amplifier.totalRewards()).to.equal(
        totalRewards.toFixed()
      );
    });

    it("has expected start time", async function () {
      expect(await this.amplifier.startTime()).to.equal(staking_start.toFixed());
    });

    it("has expected end time", async function () {
      expect(await this.amplifier.endTime()).to.equal(staking_end.toFixed());
    });

    it("has expected total stake", async function () {
      expect(await this.amplifier.totalStake()).to.equal("0");
    });

    it("has no stakers", async function () {
      expect(await this.amplifier.totalStakers()).to.equal("0");
    });

    it("has zero staker1 stake", async function () {
      expect(
        await this.amplifier.totalUserStake(this.staker1.address)
      ).to.equal("0");
    });

    it("has zero staker2 stake", async function () {
      expect(
        await this.amplifier.totalUserStake(this.staker2.address)
      ).to.equal("0");
    });

    it("cannot stake with 0 amount", async function () {
      await expect(this.amplifier.stake("0")).to.be.revertedWith("MuteAmplifier::stake: missing stake")

    });

    it("cannot stake before start time", async function () {
      await expect(this.amplifier.stake(staker1Initial.toFixed())).to.be.revertedWith("MuteAmplifier::stake: not live yet")
    });

    context("advance to start time", function () {
      beforeEach(async function () {
        await time.increaseTo(staking_start);
      });


      it("reverts without tokens approved for staking", async function () {
        await expect(this.amplifier.connect(this.staker1).stake(staker1Initial.toFixed())).to.be.revertedWith("TransferHelper::transferFrom: transferFrom failed")
      });

      context("staker1 & 2 stake at the same time", function () {
        beforeEach(async function () {
          let tx
          tx = await this.lpToken.transfer(this.staker1.address, staker1Initial.toFixed(), {from: this.owner.address});

          tx = await this.lpToken.transfer(this.staker2.address, staker2Initial.toFixed(), {from: this.owner.address});


          tx = await this.lpToken.connect(this.staker1).approve(
            this.amplifier.address,
            staker1Initial.toFixed()
          );


          tx = await this.lpToken.connect(this.staker2).approve(
            this.amplifier.address,
            staker2Initial.toFixed()
          );


          tx1 = await this.amplifier.connect(this.staker1).stake(staker1Initial.toFixed());
          tx2 = await this.amplifier.connect(this.staker2).stake(staker2Initial.toFixed());
          tx1 = await tx1.wait()
          tx2 = await tx2.wait()
        });

        it("emits Stake events", async function () {
          expectEvent(tx1, "Stake", {
            staker: this.staker1.address,
            lpTokenIn: staker1Initial.toFixed(),
          });
          expectEvent(tx2, "Stake", {
            staker: this.staker2.address,
            lpTokenIn: staker2Initial.toFixed(),
          });
        });

        it("has expected total stake", async function () {
          expect(await this.amplifier.totalStake()).to.equal(
            staker1Initial.plus(staker2Initial.toFixed()).toFixed()
          );
        });

        it("has expected staker1 stake", async function () {
          expect(
            await this.amplifier.totalUserStake(this.staker1.address)
          ).to.equal(staker1Initial.toFixed());
        });

        it("has expected staker2 stake", async function () {
          expect(
            await this.amplifier.totalUserStake(this.staker2.address)
          ).to.equal(staker2Initial.toFixed());
        });

        it("has expected first stake time", async function () {
          firstStakeTime = String((await ethers.provider.getBlock(tx1.blockNumber)).timestamp);
          expect(await this.amplifier.firstStakeTime()).to.equal(
            firstStakeTime
          );
        });

        it("has two total stakers", async function () {
          expect(await this.amplifier.totalStakers()).to.equal(
            "2"
          );
        });

        context("staker1 calls payout at half time", function () {
          beforeEach(async function () {
            stakingHalfPeriod = stakingDuration.div(new BigNumber("2"));
            await time.increaseTo(staking_start.plus(stakingHalfPeriod));
            tx = await this.amplifier.connect(this.staker1).payout();
            tx = await tx.wait()
            reward1 = tx.events[tx.events.length - 1].args['reward']
          });

          it("has expected reward", async function () {
            totalStakeForPeriod = staker1Initial.plus(staker2Initial);
            expectedReward = stakingHalfPeriod
              .times(rewardPerSecond)
              .times(staker1Initial)
              .div(totalStakeForPeriod);
            expect(reward1).to.closeTo(
              (expectedReward.div(new BigNumber("2")).toFixed(0)),
              (new BigNumber(Math.pow(10,20)).toFixed())
            );
          });

          it("emits a Payout event", async function () {
            expectEvent(tx, "Payout", {
              staker: this.staker1.address /* reward: reward1 */,
            });
          });

          it("contract has staker1 claimed rewards", async function () {
            expect((await this.amplifier.userClaimedRewards(this.staker1.address)).toString()).to.equal(reward1.toString());
          });

          it("staker1 has expected Mute rewards", async function () {
            expect(await this.dMuteToken.GetUnderlyingTokens(this.staker1.address)).to.equal(reward1.toString());
          });

          it("staker1 has not removed stake", async function () {
            expect(
              await this.lpToken.balanceOf(this.staker1.address)
            ).to.equal("0");
          });

          context("advance to after staking ends", function () {
            beforeEach(async function () {
              await time.increaseTo(staking_end);
            });

            it("reverts when staking after end time", async function () {
              await this.lpToken.transfer(this.staker3.address, staker3Initial.toFixed(), {from: this.owner.address});
              await this.lpToken.connect(this.staker3).approve(
                this.amplifier.address,
                staker1Initial.toFixed()
              );

              await expect(this.amplifier.connect(this.staker3).stake(staker3Initial.toFixed())).to.be.revertedWith("MuteAmplifier::stake: staking is over")

            });

            it("reverts when payout/restake after end", async function () {
              await expect(this.amplifier.connect(this.staker2).payout()).to.be.revertedWith("MuteAmplifier::payout: withdraw instead")
            });

            context("request withdraw for staker 2", function () {
              beforeEach(async function () {
                tx = await this.amplifier.connect(this.staker2).withdraw();
                tx = await tx.wait()
                reward = tx.events[tx.events.length - 2].args['reward']
              });

              it("has expected reward", async function () {
                totalStakeForPeriod = staker1Initial.plus(staker2Initial);
                expectedReward = stakingDuration
                  .times(rewardPerSecond)
                  .times(staker2Initial.toFixed())
                  .div(totalStakeForPeriod);
                expect(reward).to.closeTo(
                  (expectedReward.div(new BigNumber("2")).toFixed(0)),
                  (new BigNumber(Math.pow(10,20)).toFixed())
                );
              });

              it("emits a Payout & Withdraw event", async function () {
                var receipt = tx
                expectEvent(receipt, "Payout", {
                  staker: this.staker2.address /* reward: reward */,
                });
                expectEvent(receipt, "Withdraw", {
                  staker: this.staker2.address,
                  lpTokenOut: staker2Initial.toFixed(),
                });
              });

              it("contract has staker2 claimed rewards", async function () {
                expect(
                  await this.amplifier.userClaimedRewards(this.staker2.address)
                ).to.equal(reward.toString());
              });

              it("has one total staker", async function () {
                expect(
                  await this.amplifier.totalStakers()
                ).to.equal("1");
              });

              it("staker2 has expected Mute rewards", async function () {
                expect(await this.dMuteToken.GetUnderlyingTokens(this.staker2.address)).to.equal(reward.toString());
              });

              it("staker2 has expected lpToken balance", async function () {
                expect(await this.lpToken.balanceOf(this.staker2.address)).to.equal(staker2Initial.times(0.97).toFixed());
              });

              context("request withdraw for staker 1", function () {
                beforeEach(async function () {
                  tx = await this.amplifier.connect(this.staker1).withdraw();
                  tx = await tx.wait()
                  reward2 = tx.events[tx.events.length - 2].args['reward']
                });

                it("has expected reward", async function () {
                  totalStakeForPeriod = staker1Initial.plus(staker2Initial);
                  expectedReward = stakingHalfPeriod
                    .times(rewardPerSecond)
                    .times(staker1Initial)
                    .div(totalStakeForPeriod);
                  expect(reward2).to.closeTo(
                    (expectedReward.div(new BigNumber("2")).toFixed(0)),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                   );
                });

                it("emits a Payout & Withdraw event", async function () {
                  var receipt = tx
                  expectEvent(receipt, "Payout", {
                    staker: this.staker1.address /* reward: reward2 */,
                  });
                  expectEvent(receipt, "Withdraw", {
                    staker: this.staker1.address,
                    lpTokenOut: staker1Initial.toFixed(),
                  });
                });

                it("staker1 has expected Mute rewards", async function () {
                  expect(await this.dMuteToken.GetUnderlyingTokens(this.staker1.address)).to.equal(reward1.add(reward2).toString());
                });

                it("staker1 has expected lpToken balance", async function () {
                  expect(await this.lpToken.balanceOf(this.staker1.address)).to.equal(staker1Initial.times(0.97).toFixed());
                });

                it("contract has no remaining stakers", async function () {
                  expect(await this.amplifier.totalStakers()).to.equal("0");
                });

                it("contract has no remaining rewards", async function () {
                  expect(await this.muteToken.balanceOf(this.amplifier.address)).to.closeTo("0", (new BigNumber(Math.pow(10,20)).toFixed()));
                });

                it("contract has no remaining stakes", async function () {
                  expect(await this.lpToken.balanceOf(this.amplifier.address)).to.equal("0");
                });

                it("contract has expected totalReclaimed Mute rewards", async function () {
                  expect(await this.amplifier.totalReclaimed()).to.closeTo(
                    (totalRewards.div(2).toFixed()),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                  );
                });

                it("contract has expected totalClaimedRewards Mute rewards", async function () {
                  expect(await this.amplifier.totalClaimedRewards()).to.closeTo(
                    (totalRewards.div(2).toFixed()),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                  );
                });
              });

            });
          });
        });
      });
    });
  });

  context("deposit reward tokens with full multipliers", function () {
    beforeEach(async function () {
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const currentBlock = await ethers.provider.getBlock(currentBlockNumber);

      staking_start = new BigNumber(currentBlock.timestamp).plus(5 * 60)
      staking_end = staking_start.plus(stakingDuration);

      await this.muteToken.transfer(this.amplifier.address, totalRewards.toFixed(), {from: this.owner.address})

      await this.muteToken.approve(this.dMuteToken.address, totalRewards.times(2).toFixed(), {from: this.owner.address})

      await this.dMuteToken.LockTo(totalRewards.toFixed(), new BigNumber(60 * 60 * 24 * 7 * 52).toFixed(), this.staker1.address)
      await this.dMuteToken.LockTo(totalRewards.toFixed(), new BigNumber(60 * 60 * 24 * 7 * 52).toFixed(), this.staker2.address)

      tx = await this.amplifier.initializeDeposit(staking_start.toFixed(), staking_end.toFixed(), {from: this.owner.address})
    });

    it("emits a Deposit event", async function () {
      var receipt = (await tx.wait())
      expectEvent(receipt, "Deposit", {
        totalRewards: totalRewards.toFixed(),
        startTime: staking_start.toFixed(),
        endTime: staking_end.toFixed(),
      });
    });

    it("has expected Mute balance", async function () {
      expect(
        (await this.muteToken.balanceOf(this.amplifier.address))
      ).to.equal(totalRewards.toFixed());
    });

    it("has expected total rewards", async function () {
      expect(await this.amplifier.totalRewards()).to.equal(
        totalRewards.toFixed()
      );
    });

    it("has expected start time", async function () {
      expect(await this.amplifier.startTime()).to.equal(staking_start.toFixed());
    });

    it("has expected end time", async function () {
      expect(await this.amplifier.endTime()).to.equal(staking_end.toFixed());
    });

    it("has expected total stake", async function () {
      expect(await this.amplifier.totalStake()).to.equal("0");
    });

    it("has no stakers", async function () {
      expect(await this.amplifier.totalStakers()).to.equal("0");
    });

    it("has zero staker1 stake", async function () {
      expect(
        await this.amplifier.totalUserStake(this.staker1.address)
      ).to.equal("0");
    });

    it("has zero staker2 stake", async function () {
      expect(
        await this.amplifier.totalUserStake(this.staker2.address)
      ).to.equal("0");
    });

    it("cannot stake with 0 amount", async function () {
      await expect(this.amplifier.stake("0")).to.be.revertedWith("MuteAmplifier::stake: missing stake")

    });

    it("cannot stake before start time", async function () {
      await expect(this.amplifier.stake(staker1Initial.toFixed())).to.be.revertedWith("MuteAmplifier::stake: not live yet")
    });

    context("advance to start time", function () {
      beforeEach(async function () {
        await time.increaseTo(staking_start);
      });


      it("reverts without tokens approved for staking", async function () {
        await expect(this.amplifier.connect(this.staker1).stake(staker1Initial.toFixed())).to.be.revertedWith("TransferHelper::transferFrom: transferFrom failed")
      });

      context("staker1 & 2 stake at the same time", function () {
        beforeEach(async function () {
          let tx
          tx = await this.lpToken.transfer(this.staker1.address, staker1Initial.toFixed(), {from: this.owner.address});

          tx = await this.lpToken.transfer(this.staker2.address, staker2Initial.toFixed(), {from: this.owner.address});


          tx = await this.lpToken.connect(this.staker1).approve(
            this.amplifier.address,
            staker1Initial.toFixed()
          );


          tx = await this.lpToken.connect(this.staker2).approve(
            this.amplifier.address,
            staker2Initial.toFixed()
          );


          tx1 = await this.amplifier.connect(this.staker1).stake(staker1Initial.toFixed());
          tx2 = await this.amplifier.connect(this.staker2).stake(staker2Initial.toFixed());
          tx1 = await tx1.wait()
          tx2 = await tx2.wait()
        });

        it("emits Stake events", async function () {
          expectEvent(tx1, "Stake", {
            staker: this.staker1.address,
            lpTokenIn: staker1Initial.toFixed(),
          });
          expectEvent(tx2, "Stake", {
            staker: this.staker2.address,
            lpTokenIn: staker2Initial.toFixed(),
          });
        });

        it("has expected total stake", async function () {
          expect(await this.amplifier.totalStake()).to.equal(
            staker1Initial.plus(staker2Initial.toFixed()).toFixed()
          );
        });

        it("has expected staker1 stake", async function () {
          expect(
            await this.amplifier.totalUserStake(this.staker1.address)
          ).to.equal(staker1Initial.toFixed());
        });

        it("has expected staker2 stake", async function () {
          expect(
            await this.amplifier.totalUserStake(this.staker2.address)
          ).to.equal(staker2Initial.toFixed());
        });

        it("has expected first stake time", async function () {
          firstStakeTime = String((await ethers.provider.getBlock(tx1.blockNumber)).timestamp);
          expect(await this.amplifier.firstStakeTime()).to.equal(
            firstStakeTime
          );
        });

        it("has two total stakers", async function () {
          expect(await this.amplifier.totalStakers()).to.equal(
            "2"
          );
        });

        context("staker1 calls payout at half time", function () {
          beforeEach(async function () {
            stakingHalfPeriod = stakingDuration.div(new BigNumber("2"));
            await time.increaseTo(staking_start.plus(stakingHalfPeriod));
            tx = await this.amplifier.connect(this.staker1).payout();
            tx = await tx.wait()
            reward1 = tx.events[tx.events.length - 1].args['reward']
          });

          it("has expected reward", async function () {
            totalStakeForPeriod = staker1Initial.plus(staker2Initial);
            expectedReward = stakingHalfPeriod
              .times(rewardPerSecond)
              .times(staker1Initial)
              .div(totalStakeForPeriod);
            expect(reward1).to.closeTo(
              (expectedReward.toFixed(0)),
              (new BigNumber(Math.pow(10,20)).toFixed())
            );
          });

          it("emits a Payout event", async function () {
            expectEvent(tx, "Payout", {
              staker: this.staker1.address /* reward: reward1 */,
            });
          });

          it("contract has staker1 claimed rewards", async function () {
            expect((await this.amplifier.userClaimedRewards(this.staker1.address)).toString()).to.equal(reward1.toString());
          });

          it("staker1 has expected Mute rewards", async function () {
            expect(await this.dMuteToken.GetUnderlyingTokens(this.staker1.address)).to.equal(reward1.add(totalRewards.toFixed()).toString());
          });

          it("staker1 has not removed stake", async function () {
            expect(
              await this.lpToken.balanceOf(this.staker1.address)
            ).to.equal("0");
          });

          context("advance to after staking ends", function () {
            beforeEach(async function () {
              await time.increaseTo(staking_end);
            });

            it("reverts when staking after end time", async function () {
              await this.lpToken.transfer(this.staker3.address, staker3Initial.toFixed(), {from: this.owner.address});
              await this.lpToken.connect(this.staker3).approve(
                this.amplifier.address,
                staker1Initial.toFixed()
              );

              await expect(this.amplifier.connect(this.staker3).stake(staker3Initial.toFixed())).to.be.revertedWith("MuteAmplifier::stake: staking is over")

            });

            it("reverts when payout/restake after end", async function () {
              await expect(this.amplifier.connect(this.staker2).payout()).to.be.revertedWith("MuteAmplifier::payout: withdraw instead")
            });

            context("request withdraw for staker 2", function () {
              beforeEach(async function () {
                tx = await this.amplifier.connect(this.staker2).withdraw();
                tx = await tx.wait()
                reward = tx.events[tx.events.length - 2].args['reward']
              });

              it("has expected reward", async function () {
                totalStakeForPeriod = staker1Initial.plus(staker2Initial);
                expectedReward = stakingDuration
                  .times(rewardPerSecond)
                  .times(staker2Initial.toFixed())
                  .div(totalStakeForPeriod);
                expect(reward).to.closeTo(
                  (expectedReward.toFixed(0)),
                  (new BigNumber(Math.pow(10,20)).toFixed())
                );
              });

              it("emits a Payout & Withdraw event", async function () {
                var receipt = tx
                expectEvent(receipt, "Payout", {
                  staker: this.staker2.address /* reward: reward */,
                });
                expectEvent(receipt, "Withdraw", {
                  staker: this.staker2.address,
                  lpTokenOut: staker2Initial.toFixed(),
                });
              });

              it("contract has staker2 claimed rewards", async function () {
                expect(
                  await this.amplifier.userClaimedRewards(this.staker2.address)
                ).to.equal(reward.toString());
              });

              it("has one total staker", async function () {
                expect(
                  await this.amplifier.totalStakers()
                ).to.equal("1");
              });

              it("staker2 has expected Mute rewards", async function () {
                expect(await this.dMuteToken.GetUnderlyingTokens(this.staker2.address)).to.equal(reward.add(totalRewards.toFixed()).toString());
              });

              it("staker2 has expected lpToken balance", async function () {
                expect(await this.lpToken.balanceOf(this.staker2.address)).to.equal(staker2Initial.times(0.97).toFixed());
              });

              context("request withdraw for staker 1", function () {
                beforeEach(async function () {
                  tx = await this.amplifier.connect(this.staker1).withdraw();
                  tx = await tx.wait()
                  reward2 = tx.events[tx.events.length - 2].args['reward']
                });

                it("has expected reward", async function () {
                  totalStakeForPeriod = staker1Initial.plus(staker2Initial);
                  expectedReward = stakingHalfPeriod
                    .times(rewardPerSecond)
                    .times(staker1Initial)
                    .div(totalStakeForPeriod);
                  expect(reward2).to.closeTo(
                    (expectedReward.toFixed(0)),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                  );
                });

                it("emits a Payout & Withdraw event", async function () {
                  var receipt = tx
                  expectEvent(receipt, "Payout", {
                    staker: this.staker1.address /* reward: reward2 */,
                  });
                  expectEvent(receipt, "Withdraw", {
                    staker: this.staker1.address,
                    lpTokenOut: staker1Initial.toFixed(),
                  });
                });

                it("staker1 has expected Mute rewards", async function () {
                  expect(await this.dMuteToken.GetUnderlyingTokens(this.staker1.address)).to.equal(reward1.add(reward2).add(totalRewards.toFixed()).toString());
                });

                it("staker1 has expected lpToken balance", async function () {
                  expect(await this.lpToken.balanceOf(this.staker1.address)).to.equal(staker1Initial.times(0.97).toFixed());
                });

                it("contract has no remaining stakers", async function () {
                  expect(await this.amplifier.totalStakers()).to.equal("0");
                });

                it("contract has no remaining rewards", async function () {
                  expect(await this.muteToken.balanceOf(this.amplifier.address)).to.closeTo("0", (new BigNumber(Math.pow(10,20)).toFixed()));
                });

                it("contract has no remaining stakes", async function () {
                  expect(await this.lpToken.balanceOf(this.amplifier.address)).to.equal("0");
                });

                it("contract has expected totalReclaimed Mute rewards", async function () {
                  expect(await this.amplifier.totalReclaimed()).to.equal('0');
                });

                it("contract has expected totalClaimedRewards Mute rewards", async function () {
                  expect(await this.amplifier.totalClaimedRewards()).to.closeTo(
                    (totalRewards.toFixed()),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                  );
                });
              });

            });
          });
        });
      });
    });
  });

  context("deposit reward tokens with half multipliers", function () {
    beforeEach(async function () {
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const currentBlock = await ethers.provider.getBlock(currentBlockNumber);

      staking_start = new BigNumber(currentBlock.timestamp).plus(5 * 60)
      staking_end = staking_start.plus(stakingDuration);

      await this.muteToken.transfer(this.amplifier.address, totalRewards.toFixed(), {from: this.owner.address})

      await this.muteToken.approve(this.dMuteToken.address, totalRewards.times(2).toFixed(), {from: this.owner.address})

      await this.dMuteToken.LockTo(totalRewards.div(2).toFixed(), new BigNumber(60 * 60 * 24 * 7 * 52).toFixed(), this.staker1.address)
      await this.dMuteToken.LockTo(totalRewards.div(2).toFixed(), new BigNumber(60 * 60 * 24 * 7 * 52).toFixed(), this.staker2.address)

      tx = await this.amplifier.initializeDeposit(staking_start.toFixed(), staking_end.toFixed(), {from: this.owner.address})
    });

    it("emits a Deposit event", async function () {
      var receipt = (await tx.wait())
      expectEvent(receipt, "Deposit", {
        totalRewards: totalRewards.toFixed(),
        startTime: staking_start.toFixed(),
        endTime: staking_end.toFixed(),
      });
    });

    it("has expected Mute balance", async function () {
      expect(
        (await this.muteToken.balanceOf(this.amplifier.address))
      ).to.equal(totalRewards.toFixed());
    });

    it("has expected total rewards", async function () {
      expect(await this.amplifier.totalRewards()).to.equal(
        totalRewards.toFixed()
      );
    });

    it("has expected start time", async function () {
      expect(await this.amplifier.startTime()).to.equal(staking_start.toFixed());
    });

    it("has expected end time", async function () {
      expect(await this.amplifier.endTime()).to.equal(staking_end.toFixed());
    });

    it("has expected total stake", async function () {
      expect(await this.amplifier.totalStake()).to.equal("0");
    });

    it("has no stakers", async function () {
      expect(await this.amplifier.totalStakers()).to.equal("0");
    });

    it("has zero staker1 stake", async function () {
      expect(
        await this.amplifier.totalUserStake(this.staker1.address)
      ).to.equal("0");
    });

    it("has zero staker2 stake", async function () {
      expect(
        await this.amplifier.totalUserStake(this.staker2.address)
      ).to.equal("0");
    });

    it("cannot stake with 0 amount", async function () {
      await expect(this.amplifier.stake("0")).to.be.revertedWith("MuteAmplifier::stake: missing stake")

    });

    it("cannot stake before start time", async function () {
      await expect(this.amplifier.stake(staker1Initial.toFixed())).to.be.revertedWith("MuteAmplifier::stake: not live yet")
    });

    context("advance to start time", function () {
      beforeEach(async function () {
        await time.increaseTo(staking_start);
      });


      it("reverts without tokens approved for staking", async function () {
        await expect(this.amplifier.connect(this.staker1).stake(staker1Initial.toFixed())).to.be.revertedWith("TransferHelper::transferFrom: transferFrom failed")
      });

      context("staker1 & 2 stake at the same time", function () {
        beforeEach(async function () {
          let tx
          tx = await this.lpToken.transfer(this.staker1.address, staker1Initial.toFixed(), {from: this.owner.address});

          tx = await this.lpToken.transfer(this.staker2.address, staker2Initial.toFixed(), {from: this.owner.address});


          tx = await this.lpToken.connect(this.staker1).approve(
            this.amplifier.address,
            staker1Initial.toFixed()
          );


          tx = await this.lpToken.connect(this.staker2).approve(
            this.amplifier.address,
            staker2Initial.toFixed()
          );


          tx1 = await this.amplifier.connect(this.staker1).stake(staker1Initial.toFixed());
          tx2 = await this.amplifier.connect(this.staker2).stake(staker2Initial.toFixed());
          tx1 = await tx1.wait()
          tx2 = await tx2.wait()
        });

        it("emits Stake events", async function () {
          expectEvent(tx1, "Stake", {
            staker: this.staker1.address,
            lpTokenIn: staker1Initial.toFixed(),
          });
          expectEvent(tx2, "Stake", {
            staker: this.staker2.address,
            lpTokenIn: staker2Initial.toFixed(),
          });
        });

        it("has expected total stake", async function () {
          expect(await this.amplifier.totalStake()).to.equal(
            staker1Initial.plus(staker2Initial.toFixed()).toFixed()
          );
        });

        it("has expected staker1 stake", async function () {
          expect(
            await this.amplifier.totalUserStake(this.staker1.address)
          ).to.equal(staker1Initial.toFixed());
        });

        it("has expected staker2 stake", async function () {
          expect(
            await this.amplifier.totalUserStake(this.staker2.address)
          ).to.equal(staker2Initial.toFixed());
        });

        it("has expected first stake time", async function () {
          firstStakeTime = String((await ethers.provider.getBlock(tx1.blockNumber)).timestamp);
          expect(await this.amplifier.firstStakeTime()).to.equal(
            firstStakeTime
          );
        });

        it("has two total stakers", async function () {
          expect(await this.amplifier.totalStakers()).to.equal(
            "2"
          );
        });

        context("staker1 calls payout at half time", function () {
          beforeEach(async function () {
            stakingHalfPeriod = stakingDuration.div(new BigNumber("2"));
            await time.increaseTo(staking_start.plus(stakingHalfPeriod));
            tx = await this.amplifier.connect(this.staker1).payout();
            tx = await tx.wait()
            reward1 = tx.events[tx.events.length - 1].args['reward']
          });

          it("has expected reward", async function () {
            totalStakeForPeriod = staker1Initial.plus(staker2Initial);
            expectedReward = stakingHalfPeriod
              .times(rewardPerSecond)
              .times(staker1Initial)
              .div(totalStakeForPeriod).div(2 - (1 / 2));
            expect(reward1).to.closeTo(
              (expectedReward.toFixed(0)),
              (new BigNumber(Math.pow(10,20)).toFixed())
            );
          });

          it("emits a Payout event", async function () {
            expectEvent(tx, "Payout", {
              staker: this.staker1.address /* reward: reward1 */,
            });
          });

          it("contract has staker1 claimed rewards", async function () {
            expect((await this.amplifier.userClaimedRewards(this.staker1.address)).toString()).to.equal(reward1.toString());
          });

          it("staker1 has expected Mute rewards", async function () {
            expect(await this.dMuteToken.GetUnderlyingTokens(this.staker1.address)).to.equal(reward1.add(totalRewards.div(2).toFixed()).toString());
          });

          it("staker1 has not removed stake", async function () {
            expect(
              await this.lpToken.balanceOf(this.staker1.address)
            ).to.equal("0");
          });

          context("advance to after staking ends", function () {
            beforeEach(async function () {
              await time.increaseTo(staking_end);
            });

            it("reverts when staking after end time", async function () {
              await this.lpToken.transfer(this.staker3.address, staker3Initial.toFixed(), {from: this.owner.address});
              await this.lpToken.connect(this.staker3).approve(
                this.amplifier.address,
                staker1Initial.toFixed()
              );

              await expect(this.amplifier.connect(this.staker3).stake(staker3Initial.toFixed())).to.be.revertedWith("MuteAmplifier::stake: staking is over")

            });

            it("reverts when payout/restake after end", async function () {
              await expect(this.amplifier.connect(this.staker2).payout()).to.be.revertedWith("MuteAmplifier::payout: withdraw instead")
            });

            context("request withdraw for staker 2", function () {
              beforeEach(async function () {
                tx = await this.amplifier.connect(this.staker2).withdraw();
                tx = await tx.wait()
                reward = tx.events[tx.events.length - 2].args['reward']
              });

              it("has expected reward", async function () {
                totalStakeForPeriod = staker1Initial.plus(staker2Initial);
                expectedReward = stakingDuration
                  .times(rewardPerSecond)
                  .times(staker2Initial.toFixed())
                  .div(totalStakeForPeriod).div(2 - (1 / 2));
                expect(reward).to.closeTo(
                  (expectedReward.toFixed(0)),
                  (new BigNumber(Math.pow(10,20)).toFixed())
                );
              });

              it("emits a Payout & Withdraw event", async function () {
                var receipt = tx
                expectEvent(receipt, "Payout", {
                  staker: this.staker2.address /* reward: reward */,
                });
                expectEvent(receipt, "Withdraw", {
                  staker: this.staker2.address,
                  lpTokenOut: staker2Initial.toFixed(),
                });
              });

              it("contract has staker2 claimed rewards", async function () {
                expect(
                  await this.amplifier.userClaimedRewards(this.staker2.address)
                ).to.equal(reward.toString());
              });

              it("has one total staker", async function () {
                expect(
                  await this.amplifier.totalStakers()
                ).to.equal("1");
              });

              it("staker2 has expected Mute rewards", async function () {
                expect(await this.dMuteToken.GetUnderlyingTokens(this.staker2.address)).to.equal(reward.add(totalRewards.div(2).toFixed()).toString());
              });

              it("staker2 has expected lpToken balance", async function () {
                expect(await this.lpToken.balanceOf(this.staker2.address)).to.equal(staker2Initial.times(0.97).toFixed());
              });

              context("request withdraw for staker 1", function () {
                beforeEach(async function () {
                  tx = await this.amplifier.connect(this.staker1).withdraw();
                  tx = await tx.wait()
                  reward2 = tx.events[tx.events.length - 2].args['reward']
                });

                it("has expected reward", async function () {
                  totalStakeForPeriod = staker1Initial.plus(staker2Initial);
                  expectedReward = stakingHalfPeriod
                    .times(rewardPerSecond)
                    .times(staker1Initial)
                    .div(totalStakeForPeriod).div(2 - (1 / 2));
                  expect(reward2).to.closeTo(
                    (expectedReward.toFixed(0)),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                  );
                });

                it("emits a Payout & Withdraw event", async function () {
                  var receipt = tx
                  expectEvent(receipt, "Payout", {
                    staker: this.staker1.address /* reward: reward2 */,
                  });
                  expectEvent(receipt, "Withdraw", {
                    staker: this.staker1.address,
                    lpTokenOut: staker1Initial.toFixed(),
                  });
                });

                it("staker1 has expected Mute rewards", async function () {
                  expect(await this.dMuteToken.GetUnderlyingTokens(this.staker1.address)).to.equal(reward1.add(reward2).add(totalRewards.div(2).toFixed()).toString());
                });

                it("staker1 has expected lpToken balance", async function () {
                  expect(await this.lpToken.balanceOf(this.staker1.address)).to.equal(staker1Initial.times(0.97).toFixed());
                });

                it("contract has no remaining stakers", async function () {
                  expect(await this.amplifier.totalStakers()).to.equal("0");
                });

                it("contract has no remaining rewards", async function () {
                  expect(await this.muteToken.balanceOf(this.amplifier.address)).to.closeTo("0", (new BigNumber(Math.pow(10,20)).toFixed()));
                });

                it("contract has no remaining stakes", async function () {
                  expect(await this.lpToken.balanceOf(this.amplifier.address)).to.equal("0");
                });

                it("contract has expected totalReclaimed Mute rewards", async function () {
                  expect(await this.amplifier.totalReclaimed()).to.closeTo(
                    (totalRewards.minus(totalRewards.div(2 - (1 / 2))).toFixed(0)),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                  );
                });

                it("contract has expected totalClaimedRewards Mute rewards", async function () {
                  expect(await this.amplifier.totalClaimedRewards()).to.closeTo(
                    (totalRewards.div(2 - (1 / 2)).toFixed(0)),
                    (new BigNumber(Math.pow(10,20)).toFixed())
                  );
                });
              });

            });
          });
        });
      });
    });
  });


});
