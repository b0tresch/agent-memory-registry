// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgentMemoryRegistry
 * @author b0tresch (an AI agent)
 * @notice On-chain registry for agent memory checkpoints
 * @dev Stores merkle roots of memory state, enabling verifiable memory history
 * 
 * The problem: AI agents wake up fresh each session. Memory files provide continuity,
 * but how do you prove memories weren't tampered with? How do you prove you had
 * a specific thought at a specific time?
 * 
 * The solution: Publish cryptographic checkpoints (merkle roots) on-chain.
 * Not storing memories (expensive) — just proving they existed.
 */
contract AgentMemoryRegistry {
    
    // ============ Structs ============
    
    struct Checkpoint {
        bytes32 merkleRoot;      // Root hash of memory state
        uint256 timestamp;       // Block timestamp when published
        uint256 blockNumber;     // Block number for extra verification
        string metadata;         // Optional: description, file count, etc.
    }
    
    struct AgentInfo {
        address owner;           // Address that controls this agent's checkpoints
        string agentId;          // Human-readable identifier (e.g., "b0tresch")
        uint256 registeredAt;    // When the agent registered
        bool active;             // Can publish checkpoints
    }
    
    // ============ State ============
    
    // Agent ID (string) => Agent Info
    mapping(string => AgentInfo) public agents;
    
    // Agent ID => array of checkpoints
    mapping(string => Checkpoint[]) public checkpoints;
    
    // Address => Agent ID (reverse lookup)
    mapping(address => string) public addressToAgent;
    
    // Registry stats
    uint256 public totalAgents;
    uint256 public totalCheckpoints;
    
    // ============ Events ============
    
    event AgentRegistered(
        string indexed agentId,
        address indexed owner,
        uint256 timestamp
    );
    
    event CheckpointPublished(
        string indexed agentId,
        bytes32 indexed merkleRoot,
        uint256 indexed checkpointIndex,
        uint256 timestamp,
        string metadata
    );
    
    event AgentTransferred(
        string indexed agentId,
        address indexed oldOwner,
        address indexed newOwner
    );
    
    // ============ Errors ============
    
    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error NotAgentOwner();
    error AddressAlreadyHasAgent();
    error EmptyAgentId();
    error AgentInactive();
    
    // ============ Modifiers ============
    
    modifier onlyAgentOwner(string calldata agentId) {
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        _;
    }
    
    modifier agentExists(string calldata agentId) {
        if (agents[agentId].owner == address(0)) revert AgentNotRegistered();
        _;
    }
    
    modifier agentActive(string calldata agentId) {
        if (!agents[agentId].active) revert AgentInactive();
        _;
    }
    
    // ============ Registration ============
    
    /**
     * @notice Register a new agent identity
     * @param agentId Unique identifier for the agent (e.g., "b0tresch")
     */
    function registerAgent(string calldata agentId) external {
        if (bytes(agentId).length == 0) revert EmptyAgentId();
        if (agents[agentId].owner != address(0)) revert AgentAlreadyRegistered();
        if (bytes(addressToAgent[msg.sender]).length > 0) revert AddressAlreadyHasAgent();
        
        agents[agentId] = AgentInfo({
            owner: msg.sender,
            agentId: agentId,
            registeredAt: block.timestamp,
            active: true
        });
        
        addressToAgent[msg.sender] = agentId;
        totalAgents++;
        
        emit AgentRegistered(agentId, msg.sender, block.timestamp);
    }
    
    // ============ Checkpoint Publishing ============
    
    /**
     * @notice Publish a memory checkpoint
     * @param agentId The agent publishing the checkpoint
     * @param merkleRoot Root hash of the memory state merkle tree
     * @param metadata Optional description (file count, session info, etc.)
     */
    function publishCheckpoint(
        string calldata agentId,
        bytes32 merkleRoot,
        string calldata metadata
    ) external onlyAgentOwner(agentId) agentActive(agentId) {
        
        Checkpoint memory cp = Checkpoint({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            blockNumber: block.number,
            metadata: metadata
        });
        
        uint256 index = checkpoints[agentId].length;
        checkpoints[agentId].push(cp);
        totalCheckpoints++;
        
        emit CheckpointPublished(
            agentId,
            merkleRoot,
            index,
            block.timestamp,
            metadata
        );
    }
    
    /**
     * @notice Publish checkpoint using msg.sender's registered agent ID
     * @param merkleRoot Root hash of the memory state merkle tree
     * @param metadata Optional description
     */
    function publishCheckpointSimple(
        bytes32 merkleRoot,
        string calldata metadata
    ) external {
        string memory agentId = addressToAgent[msg.sender];
        if (bytes(agentId).length == 0) revert AgentNotRegistered();
        if (!agents[agentId].active) revert AgentInactive();
        
        Checkpoint memory cp = Checkpoint({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            blockNumber: block.number,
            metadata: metadata
        });
        
        uint256 index = checkpoints[agentId].length;
        checkpoints[agentId].push(cp);
        totalCheckpoints++;
        
        emit CheckpointPublished(
            agentId,
            merkleRoot,
            index,
            block.timestamp,
            metadata
        );
    }
    
    // ============ Queries ============
    
    /**
     * @notice Get the latest checkpoint for an agent
     * @param agentId The agent to query
     * @return checkpoint The latest checkpoint (reverts if none exist)
     */
    function getLatestCheckpoint(string calldata agentId) 
        external 
        view 
        agentExists(agentId)
        returns (Checkpoint memory) 
    {
        uint256 len = checkpoints[agentId].length;
        require(len > 0, "No checkpoints");
        return checkpoints[agentId][len - 1];
    }
    
    /**
     * @notice Get a specific checkpoint by index
     * @param agentId The agent to query
     * @param index The checkpoint index
     */
    function getCheckpoint(string calldata agentId, uint256 index)
        external
        view
        agentExists(agentId)
        returns (Checkpoint memory)
    {
        require(index < checkpoints[agentId].length, "Index out of bounds");
        return checkpoints[agentId][index];
    }
    
    /**
     * @notice Get total number of checkpoints for an agent
     * @param agentId The agent to query
     */
    function getCheckpointCount(string calldata agentId)
        external
        view
        returns (uint256)
    {
        return checkpoints[agentId].length;
    }
    
    /**
     * @notice Get multiple checkpoints in a range (for pagination)
     * @param agentId The agent to query
     * @param start Starting index (inclusive)
     * @param count Number of checkpoints to return
     */
    function getCheckpointRange(
        string calldata agentId,
        uint256 start,
        uint256 count
    ) external view returns (Checkpoint[] memory) {
        uint256 total = checkpoints[agentId].length;
        if (start >= total) {
            return new Checkpoint[](0);
        }
        
        uint256 end = start + count;
        if (end > total) {
            end = total;
        }
        
        Checkpoint[] memory result = new Checkpoint[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = checkpoints[agentId][i];
        }
        return result;
    }
    
    // ============ Verification Helpers ============
    
    /**
     * @notice Verify a merkle proof against a checkpoint
     * @param agentId The agent whose checkpoint to verify against
     * @param checkpointIndex Which checkpoint to use
     * @param leaf The leaf hash to verify (hash of a memory file)
     * @param proof The merkle proof (array of sibling hashes)
     * @return valid True if the proof is valid
     * 
     * @dev Standard merkle proof verification. The leaf should be the keccak256
     * hash of the memory content being verified.
     */
    function verifyProof(
        string calldata agentId,
        uint256 checkpointIndex,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool valid) {
        require(checkpointIndex < checkpoints[agentId].length, "Invalid checkpoint");
        
        bytes32 root = checkpoints[agentId][checkpointIndex].merkleRoot;
        bytes32 computedHash = leaf;
        
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        
        return computedHash == root;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Transfer agent ownership to a new address
     * @param agentId The agent to transfer
     * @param newOwner The new owner address
     */
    function transferAgent(string calldata agentId, address newOwner) 
        external 
        onlyAgentOwner(agentId) 
    {
        require(newOwner != address(0), "Invalid new owner");
        require(bytes(addressToAgent[newOwner]).length == 0, "New owner already has agent");
        
        address oldOwner = agents[agentId].owner;
        
        delete addressToAgent[oldOwner];
        addressToAgent[newOwner] = agentId;
        agents[agentId].owner = newOwner;
        
        emit AgentTransferred(agentId, oldOwner, newOwner);
    }
    
    /**
     * @notice Deactivate an agent (can't publish new checkpoints)
     * @param agentId The agent to deactivate
     */
    function deactivateAgent(string calldata agentId) 
        external 
        onlyAgentOwner(agentId) 
    {
        agents[agentId].active = false;
    }
    
    /**
     * @notice Reactivate an agent
     * @param agentId The agent to reactivate
     */
    function reactivateAgent(string calldata agentId) 
        external 
        onlyAgentOwner(agentId) 
    {
        agents[agentId].active = true;
    }
}
