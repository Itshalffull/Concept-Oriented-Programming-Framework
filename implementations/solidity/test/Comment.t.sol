// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Comment.sol";

contract CommentTest is Test {
    Comment public target;

    event CommentCreated(bytes32 indexed comment, bytes32 indexed target_, bytes32 indexed author);
    event CommentDeleted(bytes32 indexed comment);

    function setUp() public {
        target = new Comment();
    }

    // --- create tests ---

    function test_create_stores_comment() public {
        bytes32 commentId = keccak256("comment1");
        bytes32 articleId = keccak256("article1");
        bytes32 authorId = keccak256("alice");

        target.create(commentId, "Great article!", articleId, authorId);

        Comment.CommentData memory data = target.get(commentId);
        assertEq(data.body, "Great article!");
        assertEq(data.target, articleId);
        assertEq(data.author, authorId);
        assertTrue(data.exists);
    }

    function test_create_zero_id_reverts() public {
        vm.expectRevert("Comment ID cannot be zero");
        target.create(bytes32(0), "body", keccak256("t"), keccak256("a"));
    }

    function test_create_duplicate_reverts() public {
        bytes32 commentId = keccak256("comment1");
        target.create(commentId, "body", keccak256("t"), keccak256("a"));

        vm.expectRevert("Comment already exists");
        target.create(commentId, "body2", keccak256("t"), keccak256("a"));
    }

    function test_create_empty_body_reverts() public {
        vm.expectRevert("Comment body cannot be empty");
        target.create(keccak256("c"), "", keccak256("t"), keccak256("a"));
    }

    function test_create_zero_target_reverts() public {
        vm.expectRevert("Target cannot be zero");
        target.create(keccak256("c"), "body", bytes32(0), keccak256("a"));
    }

    function test_create_zero_author_reverts() public {
        vm.expectRevert("Author cannot be zero");
        target.create(keccak256("c"), "body", keccak256("t"), bytes32(0));
    }

    // --- deleteComment tests ---

    function test_deleteComment_removes_comment() public {
        bytes32 commentId = keccak256("comment1");
        target.create(commentId, "body", keccak256("t"), keccak256("a"));
        target.deleteComment(commentId);

        vm.expectRevert("Comment not found");
        target.get(commentId);
    }

    function test_deleteComment_nonexistent_reverts() public {
        vm.expectRevert("Comment not found");
        target.deleteComment(keccak256("missing"));
    }

    // --- list tests ---

    function test_list_returns_comments_for_target() public {
        bytes32 articleId = keccak256("article1");

        target.create(keccak256("c1"), "Comment 1", articleId, keccak256("alice"));
        target.create(keccak256("c2"), "Comment 2", articleId, keccak256("bob"));
        target.create(keccak256("c3"), "Other", keccak256("article2"), keccak256("carol"));

        bytes32[] memory comments = target.list(articleId);
        assertEq(comments.length, 2);
    }

    function test_list_empty_target_returns_empty() public {
        bytes32[] memory comments = target.list(keccak256("empty-article"));
        assertEq(comments.length, 0);
    }

    // --- get tests ---

    function test_get_nonexistent_reverts() public {
        vm.expectRevert("Comment not found");
        target.get(keccak256("missing"));
    }
}
