// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Raffle_NotEnoughEth();
error Raffle_RaffleNotOpen();
error Raffle_TransferFail();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {

    enum RaffleState{
        OPEN,
        CALCULATING
    }
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    RaffleState private s_raffleState;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    //Lottery variables 
    uint256 private immutable i_interval;
    address private s_recentWinner;
    uint256 private s_lastTimeStamp;

    //EVENTS
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed player);

    constructor(address vrfCoordinatorV2 , uint256 entranceFee , bytes32 gasLane ,uint64 subscriptionId , uint32 callbackGasLimit, uint256 interval) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee=entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane= gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit=callbackGasLimit;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }
    function enterRaffle() public payable {
        //require msg.value > i_entranceFee

        if(msg.value < i_entranceFee){
            revert Raffle_NotEnoughEth();
        }

        if(s_raffleState != RaffleState.OPEN){
            revert Raffle_RaffleNotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender); 
    }

    /**
     * 
     @dev 
     */

    function checkUpkeep(bytes memory /*callData*/) public view override returns (bool upKeepNeeded , bytes memory performData){
        bool isOpen = RaffleState.OPEN == s_raffleState;
        bool timePassed = ((block.timestamp- s_lastTimeStamp)>i_interval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance >0;
        upKeepNeeded = isOpen && timePassed && hasBalance && hasPlayers;
        return (upKeepNeeded,"0x0");
    }

    function performUpkeep(bytes memory /*callData*/) external override {
        (bool upKeepNeeded , ) = checkUpkeep("");
        if(!upKeepNeeded){
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId=i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    // function pickRandomWinner() external {
    //     uint256 requestId=i_vrfCoordinator.requestRandomWords(
    //         i_gasLane,
    //         i_subscriptionId,
    //         REQUEST_CONFIRMATIONS,
    //         i_callbackGasLimit,
    //         NUM_WORDS
    //     );
    //     emit RequestedRaffleWinner(requestId);
    // }

    function fulfillRandomWords(uint256 /*requestId*/ , uint256[] memory randomWords) internal override {
        //randomwords is going to be of size randomwords 1 
        //uint256 will be our randomNum
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        (bool success , ) = recentWinner.call{value : address(this).balance}("");

        if(!success){
            revert Raffle_TransferFail();
        }
        emit WinnerPicked(s_recentWinner);
    }

    function getRecentWinner() public view returns (address){
        return s_recentWinner;
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }
    
    function getPlayer(uint256 index) public view returns(address){
        return s_players[index];
    }

    function getRaffleState() public view returns(RaffleState){
        return s_raffleState;
    }
    function getInterval() public view returns (uint256){
        return i_interval;
    }
    function getRaffleEntranceFee() public view returns (uint256){
        return i_entranceFee;
    }
    function getLastTimeStamp() public view returns (uint256){
        return s_lastTimeStamp;
    }

    function getNumPlayers() public view returns (uint256){
        return s_players.length;
    }
}
