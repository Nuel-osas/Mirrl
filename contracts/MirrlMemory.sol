// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MirrlMemory
/// @notice On-chain ownership registry for Mirrl memory. Each owner (wallet)
/// points at the 0G Storage root hash of their current, encrypted memory.md.
/// The chain is the source of truth for "who owns which memory blob"; the blob
/// itself lives on 0G Storage and is decryptable only by the owner's wallet key.
contract MirrlMemory {
    /// owner => current memory.md 0G Storage root hash
    mapping(address => string) public root;
    /// owner => number of commits (version)
    mapping(address => uint256) public version;

    event Updated(address indexed owner, string root, uint256 version);

    /// Point the caller's memory at a new 0G Storage root hash.
    function setRoot(string calldata newRoot) external {
        root[msg.sender] = newRoot;
        uint256 v = version[msg.sender] + 1;
        version[msg.sender] = v;
        emit Updated(msg.sender, newRoot, v);
    }

    /// Read any owner's current memory root hash.
    function rootOf(address owner) external view returns (string memory) {
        return root[owner];
    }
}
