const { ethers, network } = require("hardhat")
const fs = require("fs")
const FRONTEND_ADRESSES_FILE = "../client/constants/contractAddresses.json"
const FRONTEND_ABI_FILE = "../client/constants/abi.json"

module.exports = async function () {
    if (process.env.UPDATE_FRONTEND) {
        console.log("Updating frontend...")
        updateContractAddresses()
        updateAbi()
    }
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle")
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADRESSES_FILE, "utf8"))
    if (chainId in currentAddresses) {
        currentAddresses[chainId].push(raffle.address)
    } else {
        currentAddresses[chainId] = [raffle.address]
    }
    fs.writeFileSync(FRONTEND_ADRESSES_FILE, JSON.stringify(currentAddresses))
}

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle")
    const abi = raffle.interface.format(ethers.utils.FormatTypes.json)
    fs.writeFileSync(FRONTEND_ABI_FILE, JSON.stringify(abi))
}

module.exports.tags = ["all", "frontend"]
