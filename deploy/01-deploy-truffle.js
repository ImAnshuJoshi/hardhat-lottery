const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat.config")
const { verify } = require("../utils/verify")

const FUND_AMOUNT = ethers.utils.parseEther("1")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address

        const txRes = await VRFCoordinatorV2Mock.createSubscription()
        const txReceipt = await txRes.wait(1)
        subscriptionId = txReceipt.events[0].args.subId

        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["raffleEntranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const keepersUpdateInterval = networkConfig[chainId]["keepersUpdateInterval"]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: [
            vrfCoordinatorV2Address,
            entranceFee,
            gasLane,
            subscriptionId,
            callbackGasLimit,
            keepersUpdateInterval,
        ],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("verifyingggggg.......")
        await verify(vrfCoordinatorV2Address, [
            vrfCoordinatorV2Address,
            entranceFee,
            gasLane,
            subscriptionId,
            callbackGasLimit,
            keepersUpdateInterval,
        ])
    }
    log("----------------------------------------------------")
}
module.exports.tags = ["all", "raffle"]
