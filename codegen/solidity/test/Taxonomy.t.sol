// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Taxonomy.sol";

contract TaxonomyTest is Test {
    Taxonomy public target;

    event VocabularyCreated(bytes32 indexed vocabId, string name);
    event TermAdded(bytes32 indexed termId, bytes32 indexed vocabId);
    event EntityTagged(bytes32 indexed nodeId, bytes32 indexed termId);
    event EntityUntagged(bytes32 indexed nodeId, bytes32 indexed termId);

    function setUp() public {
        target = new Taxonomy();
    }

    // --- createVocabulary tests ---

    function test_createVocabulary_succeeds() public {
        bytes32 vocabId = keccak256("topics");

        target.createVocabulary(vocabId, "Topics");

        // Verify by adding a term (would revert if vocab doesn't exist)
        target.addTerm(keccak256("term1"), vocabId, "Science", bytes32(0));
    }

    function test_createVocabulary_emits_event() public {
        bytes32 vocabId = keccak256("topics");

        vm.expectEmit(true, false, false, true);
        emit VocabularyCreated(vocabId, "Topics");

        target.createVocabulary(vocabId, "Topics");
    }

    function test_createVocabulary_duplicate_reverts() public {
        bytes32 vocabId = keccak256("topics");
        target.createVocabulary(vocabId, "Topics");

        vm.expectRevert("Vocabulary already exists");
        target.createVocabulary(vocabId, "Topics v2");
    }

    function test_createVocabulary_empty_name_reverts() public {
        vm.expectRevert("Name cannot be empty");
        target.createVocabulary(keccak256("topics"), "");
    }

    // --- addTerm tests ---

    function test_addTerm_creates_term() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Science", bytes32(0));

        Taxonomy.Term memory term = target.getTerm(termId);
        assertEq(term.name, "Science");
        assertEq(term.vocabId, vocabId);
        assertTrue(term.exists);
    }

    function test_addTerm_emits_event() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");

        target.createVocabulary(vocabId, "Topics");

        vm.expectEmit(true, true, false, false);
        emit TermAdded(termId, vocabId);

        target.addTerm(termId, vocabId, "Science", bytes32(0));
    }

    function test_addTerm_nonexistent_vocab_reverts() public {
        vm.expectRevert("Vocabulary does not exist");
        target.addTerm(keccak256("term"), keccak256("missing"), "Term", bytes32(0));
    }

    function test_addTerm_duplicate_reverts() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Science", bytes32(0));

        vm.expectRevert("Term already exists");
        target.addTerm(termId, vocabId, "Science v2", bytes32(0));
    }

    function test_addTerm_empty_name_reverts() public {
        bytes32 vocabId = keccak256("topics");
        target.createVocabulary(vocabId, "Topics");

        vm.expectRevert("Term name cannot be empty");
        target.addTerm(keccak256("term"), vocabId, "", bytes32(0));
    }

    function test_addTerm_nonexistent_parent_reverts() public {
        bytes32 vocabId = keccak256("topics");
        target.createVocabulary(vocabId, "Topics");

        vm.expectRevert("Parent term does not exist");
        target.addTerm(keccak256("child"), vocabId, "Child", keccak256("missing-parent"));
    }

    function test_addTerm_with_parent_creates_hierarchy() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 parent = keccak256("science");
        bytes32 child = keccak256("physics");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(parent, vocabId, "Science", bytes32(0));
        target.addTerm(child, vocabId, "Physics", parent);

        bytes32[] memory children = target.getTermChildren(parent);
        assertEq(children.length, 1);
        assertEq(children[0], child);
    }

    // --- setParent tests ---

    function test_setParent_reparents_term() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 parent1 = keccak256("science");
        bytes32 parent2 = keccak256("arts");
        bytes32 child = keccak256("music");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(parent1, vocabId, "Science", bytes32(0));
        target.addTerm(parent2, vocabId, "Arts", bytes32(0));
        target.addTerm(child, vocabId, "Music", parent1);

        target.setParent(child, parent2);

        assertEq(target.getTermChildren(parent1).length, 0);
        assertEq(target.getTermChildren(parent2).length, 1);
    }

    function test_setParent_nonexistent_term_reverts() public {
        vm.expectRevert("Term does not exist");
        target.setParent(keccak256("missing"), bytes32(0));
    }

    function test_setParent_nonexistent_parent_reverts() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("term1");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Term", bytes32(0));

        vm.expectRevert("Parent term does not exist");
        target.setParent(termId, keccak256("missing-parent"));
    }

    // --- tagEntity / untagEntity tests ---

    function test_tagEntity_tags_node() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");
        bytes32 nodeId = keccak256("article1");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Science", bytes32(0));
        target.tagEntity(nodeId, termId);

        // No direct getter; verify via event or non-revert of untagEntity
    }

    function test_tagEntity_emits_event() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");
        bytes32 nodeId = keccak256("article1");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Science", bytes32(0));

        vm.expectEmit(true, true, false, false);
        emit EntityTagged(nodeId, termId);

        target.tagEntity(nodeId, termId);
    }

    function test_tagEntity_nonexistent_term_reverts() public {
        vm.expectRevert("Term does not exist");
        target.tagEntity(keccak256("node"), keccak256("missing"));
    }

    function test_tagEntity_duplicate_reverts() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");
        bytes32 nodeId = keccak256("article1");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Science", bytes32(0));
        target.tagEntity(nodeId, termId);

        vm.expectRevert("Entity already tagged with term");
        target.tagEntity(nodeId, termId);
    }

    function test_untagEntity_removes_tag() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");
        bytes32 nodeId = keccak256("article1");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Science", bytes32(0));
        target.tagEntity(nodeId, termId);
        target.untagEntity(nodeId, termId);

        // Re-tagging should succeed (proving untag worked)
        target.tagEntity(nodeId, termId);
    }

    function test_untagEntity_emits_event() public {
        bytes32 vocabId = keccak256("topics");
        bytes32 termId = keccak256("science");
        bytes32 nodeId = keccak256("article1");

        target.createVocabulary(vocabId, "Topics");
        target.addTerm(termId, vocabId, "Science", bytes32(0));
        target.tagEntity(nodeId, termId);

        vm.expectEmit(true, true, false, false);
        emit EntityUntagged(nodeId, termId);

        target.untagEntity(nodeId, termId);
    }

    function test_untagEntity_not_tagged_reverts() public {
        vm.expectRevert("Entity not tagged with term");
        target.untagEntity(keccak256("node"), keccak256("term"));
    }

    // --- getTerm tests ---

    function test_getTerm_nonexistent_reverts() public {
        vm.expectRevert("Term does not exist");
        target.getTerm(keccak256("missing"));
    }

    // --- getTermChildren tests ---

    function test_getTermChildren_empty_returns_empty() public {
        bytes32[] memory children = target.getTermChildren(keccak256("no-children"));
        assertEq(children.length, 0);
    }
}
