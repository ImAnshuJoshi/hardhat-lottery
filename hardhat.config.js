/** @type import('hardhat/config').HardhatUserConfig */

require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()


const GOERLI_RPC_URL =
    process.env.GOERLI_RPC_URL || `https://eth-goerli.alchemyapi.io/v2/${process.env.PRIVATE_KEY}`
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x"


module.exports = {
  solidity: "0.8.17",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
        chainId: 31337,
    },
    localhost: {
        chainId: 31337,
    },
    goerli: {
        url: GOERLI_RPC_URL,
        accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
        saveDeployments: true,
        chainId: 5,
    },
},
  namedAccounts:{
    deployer:{
      default:0,
    },
    player:{
      default:1 
    },
  }
};
