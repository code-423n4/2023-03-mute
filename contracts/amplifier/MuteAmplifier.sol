// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../libraries/SafeMath.sol';
import '../libraries/TransferHelper.sol';
import '../libraries/Ownable.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IMuteSwitchPairDynamic.sol';


/// @notice Stake Token-Token Mute LP tokens for Token rewards
contract MuteAmplifier is Ownable{
    using SafeMath for uint256;
    using TransferHelper for address;

    /* ======== EVENTS ======== */
    event Deposit(uint256 totalRewards, uint256 startTime, uint256 endTime);
    event Stake(address indexed staker, uint256 lpTokenIn);
    event Payout(address indexed staker, uint256 reward, uint256 remainder);
    event FeePayout(address indexed staker, uint256 fee0, uint256 fee1);
    event Withdraw(address indexed staker, uint256 lpTokenOut, uint256 remainder);
    event Refresh(uint256 totalRewards, uint256 startTime, uint256 endTime);


    /* ======== STATE VARIABLES ======== */

    address public lpToken; // MuteSwitchPairDynamic token
    address public muteToken; // mute token
    address public dToken; // dmute contract

    uint256 public totalStakers; // total # of individual stakers
    uint256 public totalRewards; // total amount of mute emissions
    uint256 public totalFees0; // total fees accumulated for the lp token0
    uint256 public totalFees1; // total fees accumulated for the lp token1
    uint256 public totalReclaimed; // total amount of mute reclaimed to treasury
    uint256 public totalClaimedRewards; // total amount of mute claimed by stakers
    uint256 public totalClaimedFees0; // total amount of lp token0 fees claimed by stakers
    uint256 public totalClaimedFees1; // total amount of lp token1 fees claimed by stakers

    uint256 public startTime; // when to start emissions
    uint256 public firstStakeTime; // timestamp of first deposit
    uint256 public endTime; // when to end emissions

    uint256 private _totalStakeLpToken; // total amount of lp tokens staked
    uint256 private _totalWeight; // total weight of rewards to lp tokens
    uint256 private _totalWeightFee0; // total weight of lp token0 fees to lp tokens
    uint256 private _totalWeightFee1; // total weight of lp token1 fees to lp tokens

    uint256 private _mostRecentValueCalcTime; // latest update modifier timestamp

    uint256 public _stakeDivisor; // divisor set in place for modification of reward boost

    uint256 public management_fee; // lp withdrawal fee
    address public treasury; // address that receives the lp withdrawal fee

    uint private unlocked = 1;

    mapping(address => uint256) public userClaimedRewards; // total mute rewards users have claimed

    mapping(address => uint256) private _userStakedLpToken; // total lp tokens a user has deposited
    mapping(address => uint256) private _userWeighted; // a users weight of rewards to lp tokens at the moment of a users deposit
    mapping(address => uint256) private _userWeightedFee0; // a users weight of lp token0 fees to lp tokens at the moment of a users deposit
    mapping(address => uint256) private _userWeightedFee1; // a users weight of lp token1 fees to lp tokens at the moment of a users deposit

    mapping(address => uint256) private _userAccumulated; // cache of rewards users have not yet pulled out yet
    mapping(address => uint256) private _userStakedBlock; // the latest block a user deposited - used for dMute multipler

    // contract view info for a specific user
    struct DripInfo {
      uint256 perSecondReward;
      uint256 totalLP;
      uint256 multiplier_current;
      uint256 multiplier_last;
      uint256 currentReward;
      uint256 fee0;
      uint256 fee1;
    }

    /* ======== MODIFIERS ======== */

    modifier nonReentrant() {
        require(unlocked == 1, 'ReentrancyGuard: reentrant call');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    modifier update() {
        if (_mostRecentValueCalcTime == 0) {
            _mostRecentValueCalcTime = firstStakeTime;
        }

        uint256 totalCurrentStake = totalStake();

        if (totalCurrentStake > 0 && _mostRecentValueCalcTime < endTime) {
            uint256 value = 0;
            uint256 sinceLastCalc = block.timestamp.sub(_mostRecentValueCalcTime);
            uint256 perSecondReward = totalRewards.div(endTime.sub(firstStakeTime));

            if (block.timestamp < endTime) {
                value = sinceLastCalc.mul(perSecondReward);
            } else {
                uint256 sinceEndTime = block.timestamp.sub(endTime);
                value = (sinceLastCalc.sub(sinceEndTime)).mul(perSecondReward);
            }

            _totalWeight = _totalWeight.add(value.mul(10**18).div(totalCurrentStake));

            _mostRecentValueCalcTime = block.timestamp;

            (uint fee0, uint fee1) = IMuteSwitchPairDynamic(lpToken).claimFees();

            _totalWeightFee0 = _totalWeightFee0.add(fee0.mul(10**18).div(totalCurrentStake));
            _totalWeightFee1 = _totalWeightFee1.add(fee1.mul(10**18).div(totalCurrentStake));

            totalFees0 = totalFees0.add(fee0);
            totalFees1 = totalFees1.add(fee1);
        }

        _;
    }

    /* ======== CONSTRUCTOR ======== */

    /**
     *  @notice sets the amplifier pool variables on launch
     *  @param _lpToken address
     *  @param _muteToken address
     *  @param _dToken address
     *  @param divisor uint
     *  @param _mgmt_fee uint
     *  @param _treasury address
     */
    constructor (address _lpToken, address _muteToken, address _dToken, uint256 divisor, uint256 _mgmt_fee, address _treasury) {
        require(divisor >= 10 ** 18, "MuteAmplifier: invalid _stakeDivisor");
        require(_lpToken != address(0), "MuteAmplifier: invalid lpToken");
        require(_muteToken != address(0), "MuteAmplifier: invalid muteToken");
        require(_dToken != address(0), "MuteAmplifier: invalid dToken");
        require(_mgmt_fee >= 0 && _mgmt_fee <= 1000, "MuteAmplifier: invalid _mgmt_fee");
        require(_treasury != address(0), "MuteAmplifier: invalid treasury");

        lpToken = _lpToken;
        muteToken = _muteToken;
        dToken = _dToken;
        _stakeDivisor = divisor;
        management_fee = _mgmt_fee; //bps 10k
        treasury = _treasury;

        TransferHelper.safeApprove(muteToken, _dToken, type(uint256).max);
    }


    /* ======== OWNER FUNCTIONS ======== */

    /**
     *  @notice sets the start and end time of this pool. Rewards must be sent in prior to calling this function. Can only be called once
     *  @param _startTime address
     *  @param _endTime address
     */
    function initializeDeposit(uint256 _startTime, uint256 _endTime) external virtual onlyOwner {
        require(startTime == 0, "MuteAmplifier::deposit: already received deposit");
        require(_startTime >= block.timestamp, "MuteAmplifier::deposit: start time must be in future");
        require(_endTime > _startTime, "MuteAmplifier::deposit: end time must after start time");

        totalRewards = IERC20(muteToken).balanceOf(address(this));
        require(totalRewards > 0, "MuteAmplifier::deposit: no rewards");

        startTime = _startTime;
        endTime = _endTime;

        emit Deposit(totalRewards, _startTime, _endTime);
    }

    /**
     *  @notice withdraws tokens not meant to be in this contract
     *  @param tokenToRescue address
     *  @param to address
     *  @param amount uint256
     */
    function rescueTokens(address tokenToRescue, address to, uint256 amount) external virtual onlyOwner nonReentrant {
        if (tokenToRescue == lpToken) {
            require(amount <= IERC20(lpToken).balanceOf(address(this)).sub(_totalStakeLpToken),
                "MuteAmplifier::rescueTokens: that Token-Eth belongs to stakers"
            );
        } else if (tokenToRescue == muteToken) {
            if (totalStakers > 0) {
                require(amount <= IERC20(muteToken).balanceOf(address(this)).sub(totalRewards.sub(totalClaimedRewards)),
                    "MuteAmplifier::rescueTokens: that muteToken belongs to stakers"
                );
            }
        }

        IERC20(tokenToRescue).transfer(to, amount);
    }


    /* ======== USER FUNCTIONS ======== */

    /**
     *  @notice stakes a certain amount of lp tokens
     *  @param lpTokenIn uint
     */
    function stake(uint256 lpTokenIn) external virtual update nonReentrant {
        require(lpTokenIn > 0, "MuteAmplifier::stake: missing stake");
        require(block.timestamp >= startTime && startTime !=0, "MuteAmplifier::stake: not live yet");
        require(IERC20(muteToken).balanceOf(address(this)) > 0, "MuteAmplifier::stake: no reward balance");

        if (firstStakeTime == 0) {
            firstStakeTime = block.timestamp;
        } else {
            require(block.timestamp < endTime, "MuteAmplifier::stake: staking is over");
        }

        lpToken.safeTransferFrom(msg.sender, address(this), lpTokenIn);

        if (totalUserStake(msg.sender) == 0) {
            totalStakers = totalStakers.add(1);
        }

        _stake(lpTokenIn, msg.sender);

        emit Stake(msg.sender, lpTokenIn);
    }

    /**
     * @notice  Transfer reward tokens from contract to sender, withdraw lp and apply tax
     */
    function withdraw() external virtual update nonReentrant returns (uint256 lpTokenOut, uint256 reward, uint256 remainder, uint256 fee0, uint256 fee1) {
        totalStakers = totalStakers.sub(1);

        (lpTokenOut, reward, remainder, fee0, fee1) = _applyReward(msg.sender);

        if (lpTokenOut > 0) {
            uint256 fee = lpTokenOut.mul(management_fee).div(10000);
            lpToken.safeTransfer(msg.sender, lpTokenOut.sub(fee));
            lpToken.safeTransfer(treasury, fee);
        }

        // remaining allocated rewards sent back
        if(remainder > 0){
          totalReclaimed = totalReclaimed.add(remainder);
          IERC20(muteToken).transfer(treasury, remainder);
        }
        // payout rewards
        if (reward > 0) {
            uint256 week_time = 60 * 60 * 24 * 7;
            IDMute(dToken).LockTo(reward, week_time ,msg.sender);

            userClaimedRewards[msg.sender] = userClaimedRewards[msg.sender].add(
                reward
            );
            totalClaimedRewards = totalClaimedRewards.add(reward);

            emit Payout(msg.sender, reward, remainder);
        }

        // payout fee0 fee1
        if ((fee0 > 0 || fee1 > 0) && fee0 <= totalFees0 && fee1 <= totalFees1) {
            address(IMuteSwitchPairDynamic(lpToken).token0()).safeTransfer(msg.sender, fee0);
            address(IMuteSwitchPairDynamic(lpToken).token1()).safeTransfer(msg.sender, fee1);

            totalClaimedFees0 = totalClaimedFees0.add(fee0);
            totalClaimedFees1 = totalClaimedFees1.add(fee1);

            emit FeePayout(msg.sender, fee0, fee1);
        }


        emit Withdraw(msg.sender, lpTokenOut, remainder);
    }

    /**
     * @notice  Transfer reward tokens from contract to sender, restake lp
     */
    function payout() external virtual update nonReentrant returns (uint256 reward) {
        require(block.timestamp < endTime, "MuteAmplifier::payout: withdraw instead");

        (uint256 lpTokenOut, uint256 _reward, uint256 remainder, uint fee0, uint fee1) = _applyReward(msg.sender);

        reward = _reward;
        // remaining allocated rewards sent back
        if(remainder > 0){
          totalReclaimed = totalReclaimed.add(remainder);
          IERC20(muteToken).transfer(treasury, remainder);
        }
        // payout rewards
        if (reward > 0) {
            uint256 week_time = 1 weeks;
            IDMute(dToken).LockTo(reward, week_time ,msg.sender);

            userClaimedRewards[msg.sender] = userClaimedRewards[msg.sender].add(
                reward
            );
            totalClaimedRewards = totalClaimedRewards.add(reward);
        }

        // payout fee0 fee1
        if ((fee0 > 0 || fee1 > 0) && fee0 <= totalFees0 && fee1 <= totalFees1) {
            address(IMuteSwitchPairDynamic(lpToken).token0()).safeTransfer(msg.sender, fee0);
            address(IMuteSwitchPairDynamic(lpToken).token1()).safeTransfer(msg.sender, fee1);

            totalClaimedFees0 = totalClaimedFees0.add(fee0);
            totalClaimedFees1 = totalClaimedFees1.add(fee1);

            emit FeePayout(msg.sender, fee0, fee1);
        }

        _stake(lpTokenOut, msg.sender);

        emit Payout(msg.sender, _reward, remainder);
    }

    /**
     *  @notice stakes a certain amount of lp tokens to an account
     *  @param lpTokenIn uint
     *  @param account address
     */
    function _stake(uint256 lpTokenIn, address account) private {
        uint256 addBackLpToken;

        if (totalUserStake(account) > 0) {
            (uint256 lpTokenOut, uint256 reward, uint256 remainder, uint fee0, uint fee1) = _applyReward(account);
            addBackLpToken = lpTokenOut;
            _userStakedLpToken[account] = lpTokenOut;
            _userAccumulated[account] = reward;

            // remaining allocated rewards sent back
            if(remainder > 0){
              totalReclaimed = totalReclaimed.add(remainder);
              IERC20(muteToken).transfer(treasury, remainder);
            }

            // payout fee0 fee1
            if ((fee0 > 0 || fee1 > 0) && fee0 <= totalFees0 && fee1 <= totalFees1) {
                address(IMuteSwitchPairDynamic(lpToken).token0()).safeTransfer(account, fee0);
                address(IMuteSwitchPairDynamic(lpToken).token1()).safeTransfer(account, fee1);

                totalClaimedFees0 = totalClaimedFees0.add(fee0);
                totalClaimedFees1 = totalClaimedFees1.add(fee1);

                emit FeePayout(account, fee0, fee1);
            }
        }

        _userStakedLpToken[account] = _userStakedLpToken[account].add(
            lpTokenIn
        );

        _userWeighted[account] = _totalWeight;
        _userWeightedFee0[account] = _totalWeightFee0;
        _userWeightedFee1[account] = _totalWeightFee1;

        _userStakedBlock[account] = block.number;

        _totalStakeLpToken = _totalStakeLpToken.add(lpTokenIn);

        if (addBackLpToken > 0) {
            _totalStakeLpToken = _totalStakeLpToken.add(addBackLpToken);
        }
    }

    /**
     *  @notice applys the current reward for an account and resets its state
     *  @param account address
     */
    function _applyReward(address account) private returns (uint256 lpTokenOut, uint256 reward, uint256 remainder, uint256 fee0, uint256 fee1) {
        lpTokenOut = totalUserStake(account);
        require(lpTokenOut > 0, "MuteAmplifier::_applyReward: no coins staked");

        // current rewards based on multiplier
        reward = lpTokenOut.mul(_totalWeight.sub(_userWeighted[account])).div(calculateMultiplier(account, true));
        // max possible rewards
        remainder = lpTokenOut.mul(_totalWeight.sub(_userWeighted[account])).div(10**18);
        // calculate left over rewards
        remainder = remainder.sub(reward);
        // add back any accumulated rewards
        reward = reward.add(_userAccumulated[account]);

        fee0 = lpTokenOut.mul(_totalWeightFee0.sub(_userWeightedFee0[account])).div(10**18);

        fee1 = lpTokenOut.mul(_totalWeightFee1.sub(_userWeightedFee1[account])).div(10**18);

        _totalStakeLpToken = _totalStakeLpToken.sub(lpTokenOut);

        _userStakedLpToken[account] = 0;

        _userAccumulated[account] = 0;
    }

    /* ======== HELPER FUNCTIONS ======== */

    /**
     *  @notice returns total lp tokens staked
     */
    function totalStake() public view returns (uint256 total) {
        total = _totalStakeLpToken;
    }

    /**
     *  @notice returns total lp tokens staked for a certain user
     */
    function totalUserStake(address user) public view returns (uint256 total) {
        total = _userStakedLpToken[user];
    }

    /**
     *  @notice returns the latest block a user staked at
     */
    function userStakedBlock(address user) external view returns (uint256 num) {
        num = _userStakedBlock[user];
    }

    /**
     *  @notice returns drip info for certain user
     *  @param user address
     */
    function dripInfo(address user) external view returns (DripInfo memory info) {

        info.perSecondReward = totalRewards.div(endTime.sub(firstStakeTime));
        info.totalLP = _totalStakeLpToken;
        info.multiplier_current = calculateMultiplier(user, false);
        info.multiplier_last = calculateMultiplier(user, true);


        uint256 totalCurrentStake = totalStake();
        if (totalCurrentStake > 0 && _mostRecentValueCalcTime < endTime) {
            uint256 value = 0;
            uint256 sinceLastCalc = block.timestamp.sub(_mostRecentValueCalcTime);

            if (block.timestamp < endTime) {
                value = sinceLastCalc.mul(info.perSecondReward);
            } else {
                uint256 sinceEndTime = block.timestamp.sub(endTime);
                value = (sinceLastCalc.sub(sinceEndTime)).mul(info.perSecondReward);
            }

            uint256 totWeightLocal = _totalWeight.add(value.mul(10**18).div(totalCurrentStake));

            (uint fee0, uint fee1) = IMuteSwitchPairDynamic(lpToken).claimFeesView(user);

            uint256 _totalWeightFee0Local = _totalWeightFee0.add(fee0.mul(10**18).div(totalCurrentStake));
            uint256 _totalWeightFee1Local = _totalWeightFee1.add(fee1.mul(10**18).div(totalCurrentStake));

            // current rewards based on multiplier
            info.currentReward = totalUserStake(user).mul(totWeightLocal.sub(_userWeighted[user])).div(info.multiplier_last);
            // add back any accumulated rewards
            info.currentReward = info.currentReward.add(_userAccumulated[user]);


            info.fee0 = totalUserStake(user).mul(_totalWeightFee0Local.sub(_userWeightedFee0[user])).div(10**18);
            info.fee1 = totalUserStake(user).mul(_totalWeightFee1Local.sub(_userWeightedFee1[user])).div(10**18);

        } else {
          // current rewards based on multiplier
          info.currentReward = totalUserStake(user).mul(_totalWeight.sub(_userWeighted[user])).div(info.multiplier_last);
          // add back any accumulated rewards
          info.currentReward = info.currentReward.add(_userAccumulated[user]);
        }

    }



    /**
     *  @notice returns the multiplier for a certain user based on their dMute holdings to pool ratio.
     *  toggling enforce shows the account difference betweeen its staked multiplier and current
     *  e.g stakedivisor of 2e18 = 50% starting point
     *  1e18 = max reward value
     *  2e18 - (((2e18- 1e18) * (5000 * 10e18 / 10000) / 10e18)) = 1.5e18
     *  @param account address
     *  @param enforce bool
     */
    function calculateMultiplier(address account, bool enforce) public view returns (uint256) {
        require(account != address(0), "MuteAmplifier::calculateMultiplier: missing account");

        uint256 accountDTokenValue;

        // zkSync block.number = L1 batch number. This at times is the same for a few minutes. To avoid breaking the call to the dMute contract
        // we take the previous block into account
        uint256 staked_block =  _userStakedBlock[account] == block.number ? _userStakedBlock[account] - 1 : _userStakedBlock[account];

        if(staked_block != 0 && enforce)
          accountDTokenValue = IDMute(dToken).getPriorVotes(account, staked_block);
        else
          accountDTokenValue = IDMute(dToken).getPriorVotes(account, block.number - 1);

        if(accountDTokenValue == 0){
          return _stakeDivisor;
        }

        uint256 stakeDifference = _stakeDivisor.sub(10 ** 18);

        // ratio of dMute holdings to pool
        uint256 tokenRatio = accountDTokenValue.mul(10**18).div(totalRewards);

        stakeDifference = stakeDifference.mul(clamp_value(tokenRatio, 10**18)).div(10**18);

        return _stakeDivisor.sub(stakeDifference);
    }




    /**
     *  @notice returns the multiplier for a certain user based on their dMute underlying usd value their staked lp usd value.
     *  toggling enforce shows the account difference betweeen its staked multiplier and current
     *  e.g stakedivisor of 2e18 = 50% starting point
     *  1e18 = max reward value
     *  2e18 - (((2e18- 1e18) * (5000 * 10e18 / 10000) / 10e18)) = 1.5e18
     *  @param account address
     *  @param enforce bool
     */

    /*
    function calculateMultiplier(address account, bool enforce) public view returns (uint256) {
        require(account != address(0), "MuteAmplifier::calculateMultiplier: missing account");

        uint ratio;

        // zkSync block.number = L1 batch number. This at times is the same for a few minutes. To avoid breaking the call to the dMute contract
        // we take the previous block into account
        uint256 staked_block =  _userStakedBlock[account] == block.number ? _userStakedBlock[account] - 1 : _userStakedBlock[account];

        if(staked_block!= 0 && enforce)
          ratio = IAmplifierOracleHub().holdingsToMuteRatio(account, _lpToken, _userStakedLpToken[account], staked_block);
        else
          ratio = IAmplifierOracleHub().holdingsToMuteRatio(account, _lpToken, _userStakedLpToken[account], block.number - 1);

        if(ratio == 0){
          return _stakeDivisor;
        }

        uint256 stakeDifference = _stakeDivisor.sub(10 ** 18).mul(clamp_value(ratio.div(10**18), 10**18)).div(10**18);

        return _stakeDivisor.sub(stakeDifference);
    }
    */


    /**
     *  @notice returns the clamped value based on the max clamp limit
     *  @param min uint
     *  @param max uint
     */
    function clamp_value(uint min, uint max) pure public returns (uint) {
        if (min < max) {
            return min;
        } else {
            return max;
        }
    }
}


interface IDMute {
    function balanceOf(address account) external view returns(uint256 amount);
    function getPriorVotes(address account, uint256 block) external view returns(uint256 amount);
    function LockTo(uint256 _amount, uint256 _lock_time, address to) external;
}
