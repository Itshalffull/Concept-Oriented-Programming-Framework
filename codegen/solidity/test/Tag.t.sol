// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Tag.sol";

contract TagTest is Test {
    Tag public target;

    event TagAdded(bytes32 indexed tag, bytes32 indexed article);
    event TagRemoved(bytes32 indexed tag, bytes32 indexed article);

    function setUp() public {
        target = new Tag();
    }

    // --- add tests ---

    function test_add_tags_article() public {
        bytes32 tag = keccak256("solidity");
        bytes32 article = keccak256("article1");

        target.add(tag, article);

        assertTrue(target.isTagged(tag, article));
    }

    function test_add_emits_event() public {
        bytes32 tag = keccak256("solidity");
        bytes32 article = keccak256("article1");

        vm.expectEmit(true, true, false, false);
        emit TagAdded(tag, article);

        target.add(tag, article);
    }

    function test_add_zero_tag_reverts() public {
        vm.expectRevert("Tag cannot be zero");
        target.add(bytes32(0), keccak256("article"));
    }

    function test_add_zero_article_reverts() public {
        vm.expectRevert("Article cannot be zero");
        target.add(keccak256("tag"), bytes32(0));
    }

    function test_add_duplicate_reverts() public {
        bytes32 tag = keccak256("solidity");
        bytes32 article = keccak256("article1");

        target.add(tag, article);

        vm.expectRevert("Article already tagged");
        target.add(tag, article);
    }

    // --- remove tests ---

    function test_remove_untags_article() public {
        bytes32 tag = keccak256("solidity");
        bytes32 article = keccak256("article1");

        target.add(tag, article);
        target.remove(tag, article);

        assertFalse(target.isTagged(tag, article));
    }

    function test_remove_emits_event() public {
        bytes32 tag = keccak256("solidity");
        bytes32 article = keccak256("article1");

        target.add(tag, article);

        vm.expectEmit(true, true, false, false);
        emit TagRemoved(tag, article);

        target.remove(tag, article);
    }

    function test_remove_not_tagged_reverts() public {
        vm.expectRevert("Article not tagged with this tag");
        target.remove(keccak256("tag"), keccak256("article"));
    }

    // --- list tests ---

    function test_list_returns_all_tags() public {
        target.add(keccak256("tag1"), keccak256("article1"));
        target.add(keccak256("tag2"), keccak256("article1"));

        bytes32[] memory tags = target.list();
        assertEq(tags.length, 2);
    }

    function test_list_empty_returns_empty() public {
        bytes32[] memory tags = target.list();
        assertEq(tags.length, 0);
    }

    // --- articlesByTag tests ---

    function test_articlesByTag_returns_articles() public {
        bytes32 tag = keccak256("solidity");

        target.add(tag, keccak256("a1"));
        target.add(tag, keccak256("a2"));

        bytes32[] memory articles = target.articlesByTag(tag);
        assertEq(articles.length, 2);
    }

    function test_articlesByTag_empty_tag_returns_empty() public {
        bytes32[] memory articles = target.articlesByTag(keccak256("unused"));
        assertEq(articles.length, 0);
    }

    // --- isTagged tests ---

    function test_isTagged_returns_false_for_untagged() public {
        assertFalse(target.isTagged(keccak256("tag"), keccak256("article")));
    }
}
