// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Taxonomy
/// @notice Manages hierarchical vocabularies and terms for structured classification of entities.
contract Taxonomy {
    struct Vocabulary {
        string name;
        bool exists;
    }

    struct Term {
        bytes32 vocabId;
        string name;
        bytes32 parentTermId;
        uint256 weight;
        bool exists;
    }

    mapping(bytes32 => Vocabulary) private _vocabularies;
    mapping(bytes32 => Term) private _terms;
    mapping(bytes32 => bytes32[]) private _termChildren; // termId -> child termIds
    mapping(bytes32 => mapping(bytes32 => bool)) private _entityTerms; // nodeId -> termId -> tagged

    event VocabularyCreated(bytes32 indexed vocabId, string name);
    event TermAdded(bytes32 indexed termId, bytes32 indexed vocabId);
    event EntityTagged(bytes32 indexed nodeId, bytes32 indexed termId);
    event EntityUntagged(bytes32 indexed nodeId, bytes32 indexed termId);

    /// @notice Creates a new vocabulary.
    /// @param vocabId Unique identifier for the vocabulary.
    /// @param name Human-readable vocabulary name.
    function createVocabulary(bytes32 vocabId, string calldata name) external {
        require(!_vocabularies[vocabId].exists, "Vocabulary already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _vocabularies[vocabId] = Vocabulary({name: name, exists: true});

        emit VocabularyCreated(vocabId, name);
    }

    /// @notice Adds a term to an existing vocabulary.
    /// @param termId Unique identifier for the term.
    /// @param vocabId The vocabulary this term belongs to.
    /// @param name Human-readable term name.
    /// @param parentTermId Optional parent term for hierarchy (bytes32(0) for root).
    function addTerm(bytes32 termId, bytes32 vocabId, string calldata name, bytes32 parentTermId) external {
        require(_vocabularies[vocabId].exists, "Vocabulary does not exist");
        require(!_terms[termId].exists, "Term already exists");
        require(bytes(name).length > 0, "Term name cannot be empty");

        if (parentTermId != bytes32(0)) {
            require(_terms[parentTermId].exists, "Parent term does not exist");
        }

        _terms[termId] = Term({
            vocabId: vocabId,
            name: name,
            parentTermId: parentTermId,
            weight: 0,
            exists: true
        });

        if (parentTermId != bytes32(0)) {
            _termChildren[parentTermId].push(termId);
        }

        emit TermAdded(termId, vocabId);
    }

    /// @notice Changes the parent of a term.
    /// @param termId The term to reparent.
    /// @param parentTermId The new parent term ID (bytes32(0) for root).
    function setParent(bytes32 termId, bytes32 parentTermId) external {
        require(_terms[termId].exists, "Term does not exist");
        if (parentTermId != bytes32(0)) {
            require(_terms[parentTermId].exists, "Parent term does not exist");
        }

        // Remove from old parent's children
        bytes32 oldParent = _terms[termId].parentTermId;
        if (oldParent != bytes32(0)) {
            bytes32[] storage children = _termChildren[oldParent];
            for (uint256 i = 0; i < children.length; i++) {
                if (children[i] == termId) {
                    children[i] = children[children.length - 1];
                    children.pop();
                    break;
                }
            }
        }

        _terms[termId].parentTermId = parentTermId;

        if (parentTermId != bytes32(0)) {
            _termChildren[parentTermId].push(termId);
        }
    }

    /// @notice Tags an entity with a taxonomy term.
    /// @param nodeId The entity to tag.
    /// @param termId The term to apply.
    function tagEntity(bytes32 nodeId, bytes32 termId) external {
        require(_terms[termId].exists, "Term does not exist");
        require(!_entityTerms[nodeId][termId], "Entity already tagged with term");

        _entityTerms[nodeId][termId] = true;

        emit EntityTagged(nodeId, termId);
    }

    /// @notice Removes a taxonomy term from an entity.
    /// @param nodeId The entity to untag.
    /// @param termId The term to remove.
    function untagEntity(bytes32 nodeId, bytes32 termId) external {
        require(_entityTerms[nodeId][termId], "Entity not tagged with term");

        _entityTerms[nodeId][termId] = false;

        emit EntityUntagged(nodeId, termId);
    }

    /// @notice Retrieves term data.
    /// @param termId The term to look up.
    /// @return The term struct.
    function getTerm(bytes32 termId) external view returns (Term memory) {
        require(_terms[termId].exists, "Term does not exist");
        return _terms[termId];
    }

    /// @notice Retrieves the children of a term.
    /// @param termId The parent term.
    /// @return Array of child term IDs.
    function getTermChildren(bytes32 termId) external view returns (bytes32[] memory) {
        return _termChildren[termId];
    }
}
