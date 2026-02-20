// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Article.sol";

contract ArticleTest is Test {
    Article public target;

    bytes32 constant ARTICLE_1 = keccak256("article1");
    bytes32 constant ARTICLE_2 = keccak256("article2");
    bytes32 constant AUTHOR_1 = keccak256("author1");

    function setUp() public {
        target = new Article();
    }

    // --- create tests ---

    function test_create_success() public {
        target.create(ARTICLE_1, "Hello World", "A greeting", "Body text here", AUTHOR_1);

        assertTrue(target.exists(ARTICLE_1), "Article should exist after creation");
        assertEq(target.count(), 1, "Article count should be 1");
    }

    function test_create_stores_data() public {
        target.create(ARTICLE_1, "Hello World", "A greeting", "Body text here", AUTHOR_1);

        Article.ArticleData memory data = target.get(ARTICLE_1);

        assertEq(data.title, "Hello World", "Title should match");
        assertEq(data.description, "A greeting", "Description should match");
        assertEq(data.body, "Body text here", "Body should match");
        assertEq(data.author, AUTHOR_1, "Author should match");
        assertTrue(data.exists, "Exists flag should be true");
        assertGt(data.createdAt, 0, "Created timestamp should be set");
        assertEq(data.createdAt, data.updatedAt, "Created and updated should match initially");
    }

    function test_create_generates_slug() public {
        target.create(ARTICLE_1, "Hello World", "desc", "body", AUTHOR_1);

        Article.ArticleData memory data = target.get(ARTICLE_1);
        assertEq(data.slug, "hello-world", "Slug should be lowercased with hyphens");
    }

    function test_create_slug_strips_special_chars() public {
        target.create(ARTICLE_1, "Hello, World! #1", "desc", "body", AUTHOR_1);

        Article.ArticleData memory data = target.get(ARTICLE_1);
        assertEq(data.slug, "hello-world-1", "Slug should strip special characters");
    }

    function test_create_duplicate_reverts() public {
        target.create(ARTICLE_1, "Hello World", "desc", "body", AUTHOR_1);

        vm.expectRevert("Article already exists");
        target.create(ARTICLE_1, "Another Title", "desc", "body", AUTHOR_1);
    }

    function test_create_empty_title_reverts() public {
        vm.expectRevert("Title cannot be empty");
        target.create(ARTICLE_1, "", "desc", "body", AUTHOR_1);
    }

    function test_create_zero_id_reverts() public {
        vm.expectRevert("Article ID cannot be zero");
        target.create(bytes32(0), "Title", "desc", "body", AUTHOR_1);
    }

    function test_create_zero_author_reverts() public {
        vm.expectRevert("Author cannot be zero");
        target.create(ARTICLE_1, "Title", "desc", "body", bytes32(0));
    }

    // --- update tests ---

    function test_update_success() public {
        target.create(ARTICLE_1, "Hello World", "desc", "body", AUTHOR_1);

        // Advance time so updatedAt changes
        vm.warp(block.timestamp + 100);

        target.update(ARTICLE_1, "Updated Title", "new desc", "new body");

        Article.ArticleData memory data = target.get(ARTICLE_1);
        assertEq(data.title, "Updated Title", "Title should be updated");
        assertEq(data.description, "new desc", "Description should be updated");
        assertEq(data.body, "new body", "Body should be updated");
        assertEq(data.slug, "updated-title", "Slug should be regenerated");
        assertGt(data.updatedAt, data.createdAt, "Updated timestamp should be later");
    }

    function test_update_nonexistent_reverts() public {
        vm.expectRevert("Article not found");
        target.update(ARTICLE_1, "Title", "desc", "body");
    }

    function test_update_empty_title_reverts() public {
        target.create(ARTICLE_1, "Hello World", "desc", "body", AUTHOR_1);

        vm.expectRevert("Title cannot be empty");
        target.update(ARTICLE_1, "", "desc", "body");
    }

    // --- deleteArticle tests ---

    function test_delete_success() public {
        target.create(ARTICLE_1, "Hello World", "desc", "body", AUTHOR_1);
        target.deleteArticle(ARTICLE_1);

        assertFalse(target.exists(ARTICLE_1), "Article should not exist after deletion");
        assertEq(target.count(), 0, "Article count should be 0 after deletion");
    }

    function test_delete_nonexistent_reverts() public {
        vm.expectRevert("Article not found");
        target.deleteArticle(ARTICLE_1);
    }

    function test_delete_one_of_many() public {
        target.create(ARTICLE_1, "First", "desc", "body", AUTHOR_1);
        target.create(ARTICLE_2, "Second", "desc", "body", AUTHOR_1);

        target.deleteArticle(ARTICLE_1);

        assertFalse(target.exists(ARTICLE_1), "Deleted article should not exist");
        assertTrue(target.exists(ARTICLE_2), "Other article should still exist");
        assertEq(target.count(), 1, "Count should be 1 after deleting one");
    }

    // --- get tests ---

    function test_get_nonexistent_reverts() public {
        vm.expectRevert("Article not found");
        target.get(ARTICLE_1);
    }

    // --- multiple articles ---

    function test_create_multiple() public {
        target.create(ARTICLE_1, "First", "desc1", "body1", AUTHOR_1);
        target.create(ARTICLE_2, "Second", "desc2", "body2", AUTHOR_1);

        assertEq(target.count(), 2, "Should have 2 articles");
        assertTrue(target.exists(ARTICLE_1), "Article 1 should exist");
        assertTrue(target.exists(ARTICLE_2), "Article 2 should exist");
    }
}
