const { network } = require("hardhat");
const {developmentChains,networkConfig} = require('../helper-hardhat-config.js')
const {verify} = require('../utils/verify.js')

// const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");
const VRF_SUB_FUND_AMOUNT = "2000000000000000000"

module.exports = async function ({getNamedAccounts,deployments}){
    const {deploy,log} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorV2Address, subscriptionId;
    
    
    // if(developmentChains.includes(network.name)){
    //     console.log("Deploying Raffle Contract");
    //     vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
    //     vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    //     const transactionResponse = await vrfCoordinatorV2Mock.createSusbcription();
    //     const transactionReciept = await transactionResponse.wait(1);
    //     subscriptionId = transactionReciept.events[0].args.subId;

    //     //Fund the subscription
    //     await vrfCoordinatorV2Mock.fundSubscription(subscriptionId,VRF_SUB_FUND_AMOUNT);
    // }
    // else{
    //     vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    //     subscriptionId = networkConfig[chainId]["subscriptionId"];
    // }
    
    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const tx = await vrfCoordinatorV2Mock.createSubscription();
        const txReciept = await tx.wait(1);
        subscriptionId = txReciept.events[0].args[0];
        console.log( "sub iD: ",  subscriptionId);
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
      } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2;
        subscriptionId = networkConfig[chainId].subscriptionId;
      }

    const entranceFee = networkConfig[chainId]["raffleEntranceFee"] ;
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["keepersUpdateInterval"];

    const args=[vrfCoordinatorV2Address,entranceFee,gasLane,subscriptionId,callbackGasLimit,interval]

    const raffle = await deploy('Raffle',{
        from:deployer,
        args:args,
        log:true,
        waitConfirmations: network.config.blockConfirmations || 1
    })

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY){
        log('Verifying.....');
        await verify(raffle.address,args);
    }
    log('-----------------------------------------------------------');
}

module.exports.tags =["all","raffle"];