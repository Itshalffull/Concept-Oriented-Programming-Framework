// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ContentParser.sol";

contract ContentParserTest is Test {
    ContentParser public target;

    event FormatRegistered(bytes32 indexed formatId);

    function setUp() public {
        target = new ContentParser();
    }

    // --- registerFormat tests ---

    function test_registerFormat_stores_format() public {
        bytes32 id = keccak256("markdown");
        target.registerFormat(id, '{"type":"markdown"}');

        (bool found, string memory config) = target.getFormat(id);
        assertTrue(found);
        assertEq(config, '{"type":"markdown"}');
    }

    function test_registerFormat_emits_event() public {
        bytes32 id = keccak256("markdown");

        vm.expectEmit(true, false, false, false);
        emit FormatRegistered(id);

        target.registerFormat(id, '{"type":"markdown"}');
    }

    function test_registerFormat_zero_id_reverts() public {
        vm.expectRevert("Format ID cannot be zero");
        target.registerFormat(bytes32(0), "config");
    }

    function test_registerFormat_duplicate_reverts() public {
        bytes32 id = keccak256("markdown");
        target.registerFormat(id, "config1");

        vm.expectRevert("Format already registered");
        target.registerFormat(id, "config2");
    }

    // --- getFormat tests ---

    function test_getFormat_missing_returns_false() public {
        (bool found, string memory config) = target.getFormat(keccak256("missing"));
        assertFalse(found);
        assertEq(bytes(config).length, 0);
    }

    // --- formatExists tests ---

    function test_formatExists_returns_false_for_unknown() public {
        assertFalse(target.formatExists(keccak256("unknown")));
    }

    function test_formatExists_returns_true_after_register() public {
        bytes32 id = keccak256("markdown");
        target.registerFormat(id, "config");
        assertTrue(target.formatExists(id));
    }
}
