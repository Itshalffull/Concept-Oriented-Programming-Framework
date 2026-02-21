// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ThreadedComment.sol";

contract ThreadedCommentTest is Test {
    ThreadedComment public target;

    event CommentAdded(bytes32 indexed commentId, bytes32 indexed hostNodeId);
    event Replied(bytes32 indexed commentId, bytes32 indexed parentId);
    event Published(bytes32 indexed commentId);
    event Unpublished(bytes32 indexed commentId);
    event CommentDeleted(bytes32 indexed commentId);

    function setUp() public {
        target = new ThreadedComment();
    }

    // --- addComment tests ---

    function test_addComment_stores_comment() public {
        bytes32 cid = keccak256("c1");
        bytes32 host = keccak256("host1");
        bytes32 author = keccak256("alice");
        target.addComment(cid, host, "Great post!", author);

        ThreadedComment.CommentData memory c = target.getComment(cid);
        assertEq(c.hostNodeId, host);
        assertEq(c.content, "Great post!");
        assertEq(c.author, author);
        assertFalse(c.published);
        assertTrue(c.exists);
    }

    function test_addComment_emits_event() public {
        bytes32 cid = keccak256("c1");
        bytes32 host = keccak256("host1");

        vm.expectEmit(true, true, false, false);
        emit CommentAdded(cid, host);

        target.addComment(cid, host, "Hello", keccak256("alice"));
    }

    function test_addComment_duplicate_reverts() public {
        bytes32 cid = keccak256("c1");
        bytes32 host = keccak256("host1");
        target.addComment(cid, host, "Hello", keccak256("alice"));

        vm.expectRevert("Comment already exists");
        target.addComment(cid, host, "Hello again", keccak256("bob"));
    }

    function test_addComment_zero_host_reverts() public {
        vm.expectRevert("Invalid host node ID");
        target.addComment(keccak256("c1"), bytes32(0), "Hello", keccak256("alice"));
    }

    function test_addComment_empty_content_reverts() public {
        vm.expectRevert("Content cannot be empty");
        target.addComment(keccak256("c1"), keccak256("host"), "", keccak256("alice"));
    }

    // --- reply tests ---

    function test_reply_creates_reply() public {
        bytes32 parentId = keccak256("c1");
        bytes32 replyId = keccak256("r1");
        bytes32 host = keccak256("host1");
        target.addComment(parentId, host, "Parent", keccak256("alice"));
        target.reply(replyId, parentId, "Reply text", keccak256("bob"));

        ThreadedComment.CommentData memory r = target.getComment(replyId);
        assertEq(r.hostNodeId, host);
        assertEq(r.parentCommentId, parentId);
        assertEq(r.content, "Reply text");
    }

    function test_reply_emits_event() public {
        bytes32 parentId = keccak256("c1");
        bytes32 replyId = keccak256("r1");
        target.addComment(parentId, keccak256("host1"), "Parent", keccak256("alice"));

        vm.expectEmit(true, true, false, false);
        emit Replied(replyId, parentId);

        target.reply(replyId, parentId, "Reply text", keccak256("bob"));
    }

    function test_reply_nonexistent_parent_reverts() public {
        vm.expectRevert("Parent comment does not exist");
        target.reply(keccak256("r1"), keccak256("nonexistent"), "Reply", keccak256("bob"));
    }

    function test_reply_empty_content_reverts() public {
        bytes32 parentId = keccak256("c1");
        target.addComment(parentId, keccak256("host1"), "Parent", keccak256("alice"));

        vm.expectRevert("Content cannot be empty");
        target.reply(keccak256("r1"), parentId, "", keccak256("bob"));
    }

    // --- publish tests ---

    function test_publish_sets_published_true() public {
        bytes32 cid = keccak256("c1");
        target.addComment(cid, keccak256("host1"), "Hello", keccak256("alice"));
        target.publish(cid);

        ThreadedComment.CommentData memory c = target.getComment(cid);
        assertTrue(c.published);
    }

    function test_publish_emits_event() public {
        bytes32 cid = keccak256("c1");
        target.addComment(cid, keccak256("host1"), "Hello", keccak256("alice"));

        vm.expectEmit(true, false, false, false);
        emit Published(cid);

        target.publish(cid);
    }

    function test_publish_already_published_reverts() public {
        bytes32 cid = keccak256("c1");
        target.addComment(cid, keccak256("host1"), "Hello", keccak256("alice"));
        target.publish(cid);

        vm.expectRevert("Already published");
        target.publish(cid);
    }

    function test_publish_nonexistent_reverts() public {
        vm.expectRevert("Comment does not exist");
        target.publish(keccak256("nonexistent"));
    }

    // --- unpublish tests ---

    function test_unpublish_sets_published_false() public {
        bytes32 cid = keccak256("c1");
        target.addComment(cid, keccak256("host1"), "Hello", keccak256("alice"));
        target.publish(cid);
        target.unpublish(cid);

        ThreadedComment.CommentData memory c = target.getComment(cid);
        assertFalse(c.published);
    }

    function test_unpublish_already_unpublished_reverts() public {
        bytes32 cid = keccak256("c1");
        target.addComment(cid, keccak256("host1"), "Hello", keccak256("alice"));

        vm.expectRevert("Already unpublished");
        target.unpublish(cid);
    }

    // --- deleteComment tests ---

    function test_deleteComment_marks_nonexistent() public {
        bytes32 cid = keccak256("c1");
        target.addComment(cid, keccak256("host1"), "Hello", keccak256("alice"));
        target.deleteComment(cid);

        vm.expectRevert("Comment does not exist");
        target.getComment(cid);
    }

    function test_deleteComment_emits_event() public {
        bytes32 cid = keccak256("c1");
        target.addComment(cid, keccak256("host1"), "Hello", keccak256("alice"));

        vm.expectEmit(true, false, false, false);
        emit CommentDeleted(cid);

        target.deleteComment(cid);
    }

    function test_deleteComment_nonexistent_reverts() public {
        vm.expectRevert("Comment does not exist");
        target.deleteComment(keccak256("nonexistent"));
    }

    // --- getHostComments tests ---

    function test_getHostComments_returns_all_comments() public {
        bytes32 host = keccak256("host1");
        bytes32 c1 = keccak256("c1");
        bytes32 c2 = keccak256("c2");
        target.addComment(c1, host, "First", keccak256("alice"));
        target.addComment(c2, host, "Second", keccak256("bob"));

        bytes32[] memory comments = target.getHostComments(host);
        assertEq(comments.length, 2);
        assertEq(comments[0], c1);
        assertEq(comments[1], c2);
    }

    function test_getHostComments_empty_for_unknown_host() public {
        bytes32[] memory comments = target.getHostComments(keccak256("unknown"));
        assertEq(comments.length, 0);
    }
}
