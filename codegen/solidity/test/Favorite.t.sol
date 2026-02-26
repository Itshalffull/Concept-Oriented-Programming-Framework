// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Favorite.sol";

contract FavoriteTest is Test {
    Favorite public target;

    event Favorited(bytes32 indexed user, bytes32 indexed article);
    event Unfavorited(bytes32 indexed user, bytes32 indexed article);

    function setUp() public {
        target = new Favorite();
    }

    // --- favorite tests ---

    function test_favorite_marks_article() public {
        bytes32 user = keccak256("alice");
        bytes32 article = keccak256("article1");

        target.favorite(user, article);

        assertTrue(target.isFavorited(user, article));
    }

    function test_favorite_emits_event() public {
        bytes32 user = keccak256("alice");
        bytes32 article = keccak256("article1");

        vm.expectEmit(true, true, false, false);
        emit Favorited(user, article);

        target.favorite(user, article);
    }

    function test_favorite_zero_user_reverts() public {
        vm.expectRevert("User cannot be zero");
        target.favorite(bytes32(0), keccak256("article"));
    }

    function test_favorite_zero_article_reverts() public {
        vm.expectRevert("Article cannot be zero");
        target.favorite(keccak256("user"), bytes32(0));
    }

    function test_favorite_duplicate_reverts() public {
        bytes32 user = keccak256("alice");
        bytes32 article = keccak256("article1");

        target.favorite(user, article);

        vm.expectRevert("Already favorited");
        target.favorite(user, article);
    }

    function test_favorite_increments_count() public {
        bytes32 article = keccak256("article1");

        target.favorite(keccak256("alice"), article);
        target.favorite(keccak256("bob"), article);

        assertEq(target.count(article), 2);
    }

    // --- unfavorite tests ---

    function test_unfavorite_removes_favorite() public {
        bytes32 user = keccak256("alice");
        bytes32 article = keccak256("article1");

        target.favorite(user, article);
        target.unfavorite(user, article);

        assertFalse(target.isFavorited(user, article));
    }

    function test_unfavorite_emits_event() public {
        bytes32 user = keccak256("alice");
        bytes32 article = keccak256("article1");

        target.favorite(user, article);

        vm.expectEmit(true, true, false, false);
        emit Unfavorited(user, article);

        target.unfavorite(user, article);
    }

    function test_unfavorite_not_favorited_reverts() public {
        vm.expectRevert("Not favorited");
        target.unfavorite(keccak256("alice"), keccak256("article"));
    }

    function test_unfavorite_decrements_count() public {
        bytes32 article = keccak256("article1");
        bytes32 user = keccak256("alice");

        target.favorite(user, article);
        assertEq(target.count(article), 1);

        target.unfavorite(user, article);
        assertEq(target.count(article), 0);
    }

    // --- isFavorited tests ---

    function test_isFavorited_returns_false_by_default() public {
        assertFalse(target.isFavorited(keccak256("user"), keccak256("article")));
    }

    // --- count tests ---

    function test_count_starts_at_zero() public {
        assertEq(target.count(keccak256("article")), 0);
    }

    // --- getUserFavorites tests ---

    function test_getUserFavorites_returns_articles() public {
        bytes32 user = keccak256("alice");

        target.favorite(user, keccak256("a1"));
        target.favorite(user, keccak256("a2"));

        bytes32[] memory favorites = target.getUserFavorites(user);
        assertEq(favorites.length, 2);
    }

    function test_getUserFavorites_empty_returns_empty() public {
        bytes32[] memory favorites = target.getUserFavorites(keccak256("nobody"));
        assertEq(favorites.length, 0);
    }
}
