const { ethers } = require("hardhat")

const enterRaffle = async () => {
    const raffle = await ethers.getContract("Raffle")
    const entranceFee = await raffle.getRaffleEntranceFee()
    await raffle.enterRaffle({ value: entranceFee + 1 })
    console.log("Entered the raffle!!!")
}

enterRaffle
    .then(() => {
        process.exit(0)
    })
    .catch(() => {
        process.exit(1)
    })
