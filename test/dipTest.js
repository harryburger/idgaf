var Dips = artifacts.require("./DIPS.sol");
var Minter = artifacts.require("./Minter.sol")
var { MerkleTree } = require('merkletreejs')
var keccak256 = require("keccak256");

contract("IDGAF2", function (accounts) {
    var dips, minter, totalWl = 20; //10 for adopter and 10 for dipholder
    var dipHolders, earlyAdopters = []

    before(async () => {
        dips = await Dips.deployed();
        minter = await Minter.deployed();
    });

    function rounded(amount) {
        return web3.utils.toBN(amount * 1e18).toString()
    }

    function getMerkleTree(elements) {

        elements = elements.map((addr) => {
            return web3.utils.keccak256(addr);
        })

        const tree = new MerkleTree(elements, keccak256, { sort: true });

        return { tree, elements }
    }

    if ("Should have the total nft supply", async () => {
        var maxSupply = await minter.MAX_SUPPLY();
        assert.equal(500, maxSupply)
    });

    it("Should have the dip deployer got his balance", async () => {
        var theBalance = await dips.balanceOf(accounts[0])
        assert.equal(1000000 * 1e18, theBalance)
        var cap = await dips.cap();
        assert.equal(1000000000 * 1e18, cap)
    })

    it("Should transfer to another account", async () => {
        await dips.transfer(accounts[1], rounded(100), {
            from: accounts[0]
        })
        var theBalance = await dips.balanceOf(accounts[1])
        assert.equal(rounded(100), theBalance)
    })

    it("Admin can mint", async () => {
        await dips.mint(accounts[2], rounded(200), { from: accounts[0] })
        var afterMintBalance = await dips.balanceOf(accounts[2])
        assert.equal(rounded(200), afterMintBalance)
    })

    it("User can approve to spend tokens", async () => {
        await dips.approve(accounts[3], rounded(50), {
            from: accounts[2]
        })

        await dips.transferFrom(accounts[2], accounts[3], rounded(1), {
            from: accounts[3]
        });

        var transffered = await dips.balanceOf(accounts[3]);
        assert.equal(rounded(1), transffered)
    });

    it("Get Whitelisted users and early adopter users", () => {

        dipHolders = accounts.slice(1, 11);
        earlyAdopters = accounts.slice(12, 22);

        assert.equal(10, dipHolders.length)
        assert.equal(10, earlyAdopters.length)

    })

    it("Shoulb update the merkle tree for whitelist minting ", async () => {

        var { tree: adopterTree } = getMerkleTree(earlyAdopters)
        var { tree: dipHolderTree } = getMerkleTree(dipHolders)

        var adopterRoot = adopterTree.getHexRoot();
        var dipHolderRoot = dipHolderTree.getHexRoot();

        await minter.setWlMarkeleRoot(dipHolderRoot, adopterRoot, {
            from: accounts[0]
        })

    });

    it("Should verify the merkle root", async () => {
        var { tree: dipHolderTree } = getMerkleTree(dipHolders)
        var { tree: adopterTree } = getMerkleTree(earlyAdopters)

        theProofOfDipHolder = dipHolderTree.getHexProof(
            web3.utils.sha3(dipHolders[0])
        );

        var ifVerified = await minter.verifyMerkleProof(
            dipHolders[0],
            theProofOfDipHolder,
            0
        )

        assert.equal(true, ifVerified)

        theProofOfAdopter = adopterTree.getHexProof(
            web3.utils.sha3(earlyAdopters[0])
        );

        //for early adopters
        ifVerified = await minter.verifyMerkleProof(
            earlyAdopters[0],
            theProofOfAdopter,
            1
        )

        //to check if dip holder tried using random proofs
        assert.equal(true, ifVerified)

        ifVerified = await minter.verifyMerkleProof(
            earlyAdopters[0],
            theProofOfAdopter,
            0
        )

        assert.equal(false, ifVerified)
    });

    it("Should Start whitelist sale", async () => {
        await minter.startPrivateSale({
            from: accounts[0]
        });
        var saleState = await minter.saleState();
        assert.equal(saleState, "1", "Sale state mismatched");
    });

    it("Should mint for dip holder", async () => {

        var { tree: dipHolderTree } = getMerkleTree(dipHolders)

        var theProofOfDipHolder = dipHolderTree.getHexProof(
            web3.utils.sha3(dipHolders[0])
        );

        await minter.mintIdagWithDip(3, theProofOfDipHolder, {
            from: dipHolders[0],
            value: 0.04 * 1e18 * 3
        })

        var balanceOfAc1 = await minter.balanceOf(dipHolders[0])
        assert.equal(3, balanceOfAc1)
    });

    it("should check if dip holder cannot remint after limit", async () => {

        try {
            var { tree: dipHolderTree } = getMerkleTree(dipHolders)

            var theProofOfDipHolder = dipHolderTree.getHexProof(
                web3.utils.sha3(dipHolders[0])
            );

            await minter.mintIdagWithDip(3, theProofOfDipHolder, {
                from: dipHolders[0],
                value: 0.04 * 1e18 * 3
            })
        }
        catch (e) {
            assert.equal(false, !e)
        }
    });


    it("should check if dip holder tries to mint with wrong sig", async () => {
        try {
            var { tree: adopterTree } = getMerkleTree(earlyAdopters)

            var theProofOfDipHolder = adopterTree.getHexProof(
                web3.utils.sha3(dipHolders[1])
            );

            await minter.mintIdagWithDip(3, theProofOfDipHolder, {
                from: dipHolders[1],
                value: 0.04 * 1e18 * 3
            })
        }
        catch (e) {
            assert.equal(false, !e)
        }
    })



    it("Should make dip holder ready", async () => {

        for (var i = 1; i <= 9; i++) {

            var uBalance = await dips.balanceOf(accounts[i + 3]);
            assert.equal(rounded(0), uBalance)

            await dips.transfer(accounts[i + 3], rounded(30), {
                from: accounts[0]
            })

            uBalance = await dips.balanceOf(accounts[i + 3]);
            assert.equal(rounded(30), uBalance)
        }

    });

    // it("Should limit ")

    it("Should massive mints for dipHolders", async () => {

        for (var i = 3; i <= 9; i++) {
            var { tree: dipHolderTree } = getMerkleTree(dipHolders)

            var theProofOfDipHolder = dipHolderTree.getHexProof(
                web3.utils.sha3(dipHolders[i])
            );


            await minter.mintIdagWithDip(3, theProofOfDipHolder, {
                from: dipHolders[i],
                value: 0.04 * 1e18 * 3
            })
        }
    })


    it("Should hit the limit of dip holder sale", async () => {
        //hit the limit
        var { tree: dipHolderTree } = getMerkleTree(dipHolders)

        try {
            var theProofOfDipHolder = dipHolderTree.getHexProof(
                web3.utils.sha3(dipHolders[5])
            );

            await minter.mintIdagWithDip(3, theProofOfDipHolder, {
                from: dipHolders[5],
                value: 0.04 * 1e18 * 3
            })
        }
        catch (e) {
            assert.equal(true, e != null)
        }
    })

    it("Should give away", async () => {

        await minter.giveAway(accounts[555], 20, { from: accounts[0] });
        var myBalance = await minter.balanceOf(accounts[555]);
        assert.equal(20, myBalance, "Minting Failed");

    });


    it("Should mint for early adopters", async () => {

        var { tree: adopterTree } = getMerkleTree(earlyAdopters)

        for (var i = 1; i < 9; i++) {


            var theProofOfEarlyAdoper = adopterTree.getHexProof(
                web3.utils.sha3(earlyAdopters[i])
            );

            await minter.adopterMintIdag(3, theProofOfEarlyAdoper, {
                from: earlyAdopters[i],
                value: 0.04 * 1e18 * 3
            })

            var balanceOfAc1 = await minter.balanceOf(earlyAdopters[i])
            assert.equal(3, balanceOfAc1)
        }


    });

    it("Should hit the limit earlyadoper sales and fullfill limit", async () => {

        var { tree: adopterTree } = getMerkleTree(earlyAdopters)

        var theProofOfEarlyAdoper = adopterTree.getHexProof(
            web3.utils.sha3(earlyAdopters[0])
        );

        try {

            await minter.adopterMintIdag(3, theProofOfEarlyAdoper, {
                from: earlyAdopters[0],
                value: 0.04 * 1e18 * 3
            })
        }
        catch (e) {
            assert.equal(true, e != null)
        }

        await minter.adopterMintIdag(1, theProofOfEarlyAdoper, {
            from: earlyAdopters[0],
            value: 0.04 * 1e18 * 1
        })

        var balanceOfAc1 = await minter.balanceOf(earlyAdopters[0])
        assert.equal(1, balanceOfAc1)

    });

    it("Should start public sale", async () => {

        await minter.startPublicSale({
            from: accounts[0]
        });
        var saleState = await minter.saleState();
        assert.equal(saleState, "2", "Sale state mismatched");
    });

    it("Should mint for public", async () => {

        for (var i = 1; i <= 86; i++) {

            await minter.mintIDGAF(5, {
                from: accounts[i + 100],
                value: 0.05 * 1e18 * 5
            })

            var balanceOfAc1 = await minter.balanceOf(accounts[i + 100])
            assert.equal(5, balanceOfAc1)
        }
    });

    it("Should finish the sale", async () => {
        await minter.mintIDGAF(1, {
            from: accounts[655],
            value: 0.05 * 1e18 * 1
        })

        var balanceOfAc1 = await minter.balanceOf(accounts[655])
        assert.equal(1, balanceOfAc1)
    })

    it("Should Start whitelist sale", async () => {
        await minter.startPrivateSale({
            from: accounts[0]
        });
        var saleState = await minter.saleState();
        assert.equal(saleState, "1", "Sale state mismatched");
    });

    it("Should end the dip holder sales", async () => {

        try {
            var { tree: dipHolderTree } = getMerkleTree(dipHolders)
            var theProofOfDipHolder = dipHolderTree.getHexProof(
                web3.utils.sha3(dipHolders[2])
            );

            var num7 = await minter.balanceOf(dipHolders[2]);
            assert.equal(0, num7)

            await dips.mint(dipHolders[2], rounded(50), {
                from: accounts[0]
            })

            await minter.mintIdagWithDip(1, theProofOfDipHolder, {
                from: dipHolders[2],
                value: 0.04 * 1e18 * 1
            })

            var balance = await minter.balanceOf(dipHolders[2]);
            assert.equal(1, balance)
        }

        catch (e) {
            assert.equal(true, e != null)
        }

    });


    it("Should read frontend view", async () => {
        var theViews = (await minter.remainingSales()).map(v => v.toString())
        var totalSupply = (await minter.totalSupply()).toString()
        var remainingAdopter = (await minter.adopterMints()).toString()
        var remainingDipHolder = (await minter.dipHolderMints()).toString()
        var remainingReserves = (await minter.reserved()).toString()

        console.log({
            theViews,
            totalSupply,
            remainingAdopter,
            remainingReserves,
            remainingDipHolder
        })
    })

})