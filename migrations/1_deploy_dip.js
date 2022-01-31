var Dips = artifacts.require("./DIPS.sol");
var Minter = artifacts.require("./Minter.sol")

module.exports = (deployer, network, accounts) => {
  deployer.then(async () => {
    await deployer.deploy(Dips, { from: accounts[0] });

    await deployer.deploy(Minter, Dips.address, 50, 20, 500, { from: accounts[0]})
  });
};
