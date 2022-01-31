// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Minter is Ownable, ERC721Enumerable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    //total supply of nfts
    uint256 public immutable MAX_SUPPLY;
    uint256 public immutable WL_SPPLY;
    uint256 public immutable RESERVED;

    uint256 public maxPublicMint = 5;
    uint256 public maxWlMint = 3;

    uint256 public wlPrice = 0.04 ether;
    uint256 public publicPrice = 0.05 ether;

    //allocation
    uint256 public reserved;

    /** 
        base uri will be replace after complete mint 
        s3 bucket implmenting metadata data will help user to see what they mint
        before the replace happens
    **/

    bool public revealed = false;
    string public tokenBaseURI = "https://idgafbucket.s3.amazonaws.com/";

    /** 
        Tracking the minting status of sales
    **/

    mapping(address => uint256) public _mintStatus;
    mapping(address => uint256) public _wlMintStatus;

    /**
        Whitelist allocation for early adopters as well as dip holders
        50/50
        so total presale nft count is 2000
     **/
    
    //track remaining counts for views

    uint256 public adopterMints;
    uint256 public dipHolderMints;

    //merkle root for dipHoldes and early adopters

    bytes32 dipHolderRoot;
    bytes32 earlyAdopterRoot;

    /**
        Flags to say, nft presale or mint started
     **/

    uint256 public saleState = 0; // 0 = paused, 1 = presale, 2 = live

    /**
        Dip token to check balance of dip holder mints 
     **/

    IERC20 public dipToken;

    /**
        Total number of whitelist is divided in two parts
        For adopters and holders 50/50 percent spot
     */

    constructor(IERC20 dip, uint256 _totalWlist, uint256 _reserveAmount, uint256 _maxSupply) ERC721("IDGAF NFT", "IDGAF") {
        dipToken = dip;
        WL_SPPLY = _totalWlist;

        //allocation for whitelist
        adopterMints = _totalWlist/2;
        dipHolderMints = _totalWlist/2;

        //for reserve
        RESERVED = _reserveAmount;
        reserved = _reserveAmount; //for tracking reserve
        //for max supply
        MAX_SUPPLY = _maxSupply;
    }

    /**
        Function to mint internal
     */

    function _mintIdag(address to, uint256 numberOfTokens) internal {
        for (uint256 i = 1; i <= numberOfTokens; i++) {
            _tokenIds.increment();
            _safeMint(to, _tokenIds.current());
        }
    }

    /** 
        Whitelist minting for dipHolders
     */

    function mintIdagWithDip(uint256 numberOfTokens, bytes32[] calldata proofs)
        external
        payable
    {
        require(verifyMerkleProof(msg.sender, proofs, 0), "Wrong Proof"); //0 for dipHolder
        require(dipToken.balanceOf(msg.sender) >= 10e18, "Not Enough balance");

        require(
            numberOfTokens > 0 && numberOfTokens <= dipHolderMints,
            "Dip holders Sale Finished"
        );

        _mintForWhitelist(numberOfTokens, 0); 
    }

    function adopterMintIdag(uint256 numberOfTokens, bytes32[] calldata proofs)
        external
        payable
    {
        require(verifyMerkleProof(msg.sender, proofs, 1),  "Wrong Proof"); //1 for early adopters
        require(
            numberOfTokens > 0 && numberOfTokens <= adopterMints,
            "Adopter Holder Sale Finished"
        );

        _mintForWhitelist(numberOfTokens, 1);
    }

    function _mintForWhitelist(uint256 numberOfTokens, uint256 mintType)
        internal
    {
        require(saleState == 1, "Private Sale Not Started");

        require(
            _wlMintStatus[msg.sender] + numberOfTokens <= maxWlMint,
            "Exceesd max limit"
        );
        require(
            totalSupply() + numberOfTokens <= MAX_SUPPLY - reserved,
            "Exceeds max supply"
        );
        require(
            msg.value >= wlPrice * numberOfTokens,
            "Ether sent is not correct"
        );

        _wlMintStatus[msg.sender] += numberOfTokens;

        if (mintType == 0) {
            dipHolderMints -= numberOfTokens;
        } else {
            adopterMints -= numberOfTokens;
        }

        _mintIdag(msg.sender, numberOfTokens);
    }

    function mintIDGAF(uint256 numberOfTokens) external payable {
        require(saleState == 2, "Sale must be active to mint");
        require(
            numberOfTokens > 0 &&
                _mintStatus[msg.sender] + numberOfTokens <= maxPublicMint,
            "Exceeds maximum allowded mint"
        );
        require(
            totalSupply() + numberOfTokens <= MAX_SUPPLY - reserved,
            "Exceeds Max Supply"
        );
        require(
            msg.value >= publicPrice * numberOfTokens,
            "Ether sent is not correct"
        );

        _mintStatus[msg.sender] += numberOfTokens;
        _mintIdag(msg.sender, numberOfTokens);
    }

    function giveAway(address _toAddress, uint256 numberOfTokens)
        public
        onlyOwner
    {
        require(numberOfTokens <= reserved, "Exceeds reserved supply");

        reserved -= numberOfTokens;
        _mintIdag(_toAddress, numberOfTokens);
    }

    function walletOfOwner(address _owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 tokenCount = balanceOf(_owner);
        uint256[] memory tokensId = new uint256[](tokenCount);
        for (uint256 i; i < tokenCount; i++) {
            tokensId[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return tokensId;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return tokenBaseURI;
    }

    //update only one time ipfs after all minting finish
    function updateBaseUri(string memory baseURI) public onlyOwner {
        require(revealed == false, "Already Revealed");
        revealed = true;
        tokenBaseURI = baseURI;
    }

    //set then public sale price
    function setPrice(uint256 _newPrice) public onlyOwner {
        publicPrice = _newPrice;
    }

    //set whitelist sale price
    function setWListPrice(uint256 _wlPrice) public onlyOwner {
        wlPrice = _wlPrice;
    }

    function startPrivateSale() public onlyOwner {
        saleState = 1; //for private
    }

    //set sale status
    function startPublicSale() public onlyOwner {
        saleState = 2; //for private
    }

    //set max allowded purchase per account
    function setMaxPerAccount(uint256 _maxPerAccount) public onlyOwner {
        maxPublicMint = _maxPerAccount;
    }

    function setWlMaxPerAccount(uint256 _maxPerAccount) public onlyOwner {
        maxWlMint = _maxPerAccount;
    }

    function withdrawEth() public onlyOwner {
        (bool os, ) = payable(msg.sender).call{value: address(this).balance}(
            ""
        );
        require(os);
    }

    function setWlMarkeleRoot(bytes32 _dipRoot, bytes32 _earlyRoot) public onlyOwner {
        //first for dip holders
        //second for early adopters
        dipHolderRoot = _dipRoot;
        earlyAdopterRoot = _earlyRoot;
    }

    //merkle based whitelisting of nft
    //index 0 for dip holders
    //index 1 for early adotpers

    function verifyMerkleProof(
        address user,
        bytes32[] calldata merkleProof,
        uint256 index
    ) public view returns (bool) {
        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(user));
        bytes32 root;
        if (index == 0) {
            root = dipHolderRoot;
        } else if (index == 1) {
            root = earlyAdopterRoot;
        }
        return MerkleProof.verify(merkleProof, root, node);
    }

    //for frontend,
    //if all whitelist not done, 
    //for debug

    function remainingSales() public view returns(uint256[] memory) {
        uint256[] memory stat = new uint256[](2);

        uint256 remaingWl = adopterMints + dipHolderMints; //show remaining whitelist
        stat[0] = remaingWl;
        if(saleState == 2 ) {
            stat[1] = MAX_SUPPLY - (totalSupply() + reserved);
            stat[0] = 0;
        }
        else{
            uint256 currentStat = ( totalSupply() + reserved + stat[0] );
            stat[1] = MAX_SUPPLY - currentStat;
        }
        return stat;
    }
}