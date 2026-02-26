// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ComputationToken.sol";

contract ComputationTokenTest is Test {
    ComputationToken public target;

    event ProviderRegistered(bytes32 indexed tokenType);

    function setUp() public {
        target = new ComputationToken();
    }

    // --- registerProvider tests ---

    function test_registerProvider_stores_provider() public {
        bytes32 tt = keccak256("date");
        target.registerProvider(tt, '{"resolver":"DateResolver"}');

        (bool found, string memory config) = target.getProvider(tt);
        assertTrue(found);
        assertEq(config, '{"resolver":"DateResolver"}');
    }

    function test_registerProvider_emits_event() public {
        bytes32 tt = keccak256("date");

        vm.expectEmit(true, false, false, false);
        emit ProviderRegistered(tt);

        target.registerProvider(tt, "config");
    }

    function test_registerProvider_zero_type_reverts() public {
        vm.expectRevert("Token type cannot be zero");
        target.registerProvider(bytes32(0), "config");
    }

    function test_registerProvider_empty_config_reverts() public {
        vm.expectRevert("Resolver config cannot be empty");
        target.registerProvider(keccak256("date"), "");
    }

    function test_registerProvider_overwrites_existing() public {
        bytes32 tt = keccak256("date");
        target.registerProvider(tt, "old_config");
        target.registerProvider(tt, "new_config");

        (bool found, string memory config) = target.getProvider(tt);
        assertTrue(found);
        assertEq(config, "new_config");
    }

    // --- getProvider tests ---

    function test_getProvider_returns_false_for_unknown() public {
        (bool found, string memory config) = target.getProvider(keccak256("unknown"));
        assertFalse(found);
        assertEq(bytes(config).length, 0);
    }

    // --- providerExists tests ---

    function test_providerExists_returns_true() public {
        bytes32 tt = keccak256("date");
        target.registerProvider(tt, "config");

        assertTrue(target.providerExists(tt));
    }

    function test_providerExists_returns_false() public {
        assertFalse(target.providerExists(keccak256("unknown")));
    }
}
