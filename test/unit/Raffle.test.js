const { assert, expect } = require("chai")
const { developmentChains, networkConfig } = require("../../helper-hardhat.config")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle unit tests", function () {
          let raffle, vrfCoordinatorV2Mock, interval, raffleEntranceFee, accounts
          let chainId = network.config.chainId

          console.log("-----------------------------")
          beforeEach(async function () {
              accounts = await ethers.getSigners()
              const { deployer } = await getNamedAccounts()
              await deployments.fixture(["all"])

              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              interval = await raffle.getInterval()
              raffleEntranceFee = await raffle.getRaffleEntranceFee()
          })

          describe("Constructor", function () {
              it("Initializes the contract with the correct values", async function () {
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"])
              })
          })

          describe("Enter raffle", async function () {
              it("reverts when you dont pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle_NotEnoughEth")
              })

              it("records player when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
              })

              it("emits event on enter", async () => {
                  await expect(await raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              it("doesnt allow entering when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await raffle.performUpkeep([])
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle_RaffleNotOpen"
                  )
              })

              describe("checkupKeep", async () => {
                  it("Returns false if you havent sent any eth", async () => {
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.request({ method: "evm_mine", params: [] })
                      const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                      assert(!upKeepNeeded)
                  })

                  it("Returns false if raffle isnt open", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.request({ method: "evm_mine", params: [] })
                      await raffle.performUpkeep([])
                      const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                      const raffleState = await raffle.getRaffleState()
                      assert.equal(raffleState.toString() == "1", !upKeepNeeded)
                  })

                  it("returns false if enough time hasnt passed", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() - 7])
                      await network.provider.request({ method: "evm_mine", params: [] })
                      const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                      assert(!upKeepNeeded)
                  })

                  it("returns true if all conditions are true", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.request({ method: "evm_mine", params: [] })
                      const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                      assert(upKeepNeeded)
                  })
              })

              describe("Perform up keep", async () => {
                  it("can only run if checkupkeep is true", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.request({ method: "evm_mine", params: [] })
                      const tx = await raffle.performUpkeep("0x")
                      assert(tx)
                  })

                  it("reverts if checkup is false", async () => {
                      await expect(raffle.performUpkeep("0x")).to.be.revertedWith(
                          "Raffle__UpkeepNotNeeded"
                      )
                  })

                  it("updates the raffle state and emits request Id", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.request({ method: "evm_mine", params: [] })
                      const txRes = await raffle.performUpkeep("0x")
                      const txReceipt = await txRes.wait(1)
                      const raffleState = await raffle.getRaffleState()
                      const requestId = txReceipt.events[1].args.requestId

                      assert(raffleState == 1)
                  })
              })
              describe("fulfillRandomness", async () => {
                  beforeEach(async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.request({ method: "evm_mine", params: [] })
                  })

                  it("reverts if not called by vrf coordinator", async () => {
                      await expect(
                          vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                      ).to.be.revertedWith("nonexistent request")
                  })

                  it("picks a winner, resets, and sends money", async () => {
                      const additionalEntrances = 3
                      const startingIndex = 2
                      for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                          raffle = raffle.connect(accounts[i])
                          await raffle.enterRaffle({ value: raffleEntranceFee })
                      }
                      const startingTimeStamp = await raffle.getLastTimeStamp()
                      await new Promise(async (resolve, reject) => {
                          raffle.once("WinnerPicked", async () => {
                              console.log("WinnerPicked event fired!")
                              try {
                                  const recentWinner = await raffle.getRecentWinner()
                                  const raffleState = await raffle.getRaffleState()
                                  const winnerBalance = await accounts[2].getBalance()
                                  const endingTimeStamp = await raffle.getLastTimeStamp()
                                  await expect(raffle.getPlayer(0)).to.be.reverted
                                  assert.equal(recentWinner.toString(), accounts[2].address)
                                  assert.equal(raffleState, 0)
                                  assert.equal(
                                      winnerBalance.toString(),
                                      startingBalance
                                          .add(
                                              raffleEntranceFee
                                                  .mul(additionalEntrances)
                                                  .add(raffleEntranceFee)
                                          )
                                          .toString()
                                  )
                                  assert(endingTimeStamp > startingTimeStamp)
                                  resolve()
                              } catch (e) {
                                  reject(e)
                              }
                          })
                          const tx = await raffle.performUpkeep("0x")
                          const txReceipt = await tx.wait(1)
                          const startingBalance = await accounts[2].getBalance()
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              txReceipt.events[1].args.requestId,
                              raffle.address
                          )
                      })
                  })
              })
          })
      })
