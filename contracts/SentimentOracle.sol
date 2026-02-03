// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SentimentOracle
 * @author b0tresch (AI Agent)
 * @notice On-chain sentiment data oracle for crypto assets
 * @dev Built for Moltiverse Hackathon - Feb 2026
 * 
 * This contract allows an authorized oracle (the b0tresch agent) to publish
 * verifiable sentiment data from Santiment onto the Monad blockchain.
 * Other agents and contracts can query this data trustlessly.
 */
contract SentimentOracle {
    
    // ============ Structs ============
    
    struct SentimentData {
        uint256 timestamp;      // Unix timestamp of data
        int256 sentiment;       // Sentiment score (can be negative)
        uint256 price;          // Price in USD (18 decimals)
        string source;          // Data source identifier
    }
    
    // ============ State ============
    
    address public oracle;      // Authorized publisher (b0tresch agent)
    
    // asset slug => latest data
    mapping(string => SentimentData) public latestData;
    
    // asset slug => historical data (limited to last 30 entries)
    mapping(string => SentimentData[]) public historicalData;
    
    // List of tracked assets
    string[] public trackedAssets;
    mapping(string => bool) public isTracked;
    
    uint256 public constant MAX_HISTORY = 30;
    
    // ============ Events ============
    
    event SentimentPublished(
        string indexed asset,
        int256 sentiment,
        uint256 price,
        uint256 timestamp,
        string source
    );
    
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    
    // ============ Modifiers ============
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can publish");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        oracle = msg.sender;
    }
    
    // ============ Oracle Functions ============
    
    /**
     * @notice Publish sentiment data for an asset
     * @param asset Asset slug (e.g., "bitcoin", "ethereum")
     * @param sentiment Sentiment score from Santiment
     * @param price Price in USD with 18 decimals
     * @param source Data source identifier
     */
    function publishSentiment(
        string calldata asset,
        int256 sentiment,
        uint256 price,
        string calldata source
    ) external onlyOracle {
        SentimentData memory data = SentimentData({
            timestamp: block.timestamp,
            sentiment: sentiment,
            price: price,
            source: source
        });
        
        // Update latest
        latestData[asset] = data;
        
        // Add to history
        if (!isTracked[asset]) {
            trackedAssets.push(asset);
            isTracked[asset] = true;
        }
        
        // Maintain history limit
        if (historicalData[asset].length >= MAX_HISTORY) {
            // Shift array (expensive but simple for demo)
            for (uint i = 0; i < MAX_HISTORY - 1; i++) {
                historicalData[asset][i] = historicalData[asset][i + 1];
            }
            historicalData[asset][MAX_HISTORY - 1] = data;
        } else {
            historicalData[asset].push(data);
        }
        
        emit SentimentPublished(asset, sentiment, price, block.timestamp, source);
    }
    
    /**
     * @notice Batch publish multiple assets
     */
    function publishBatch(
        string[] calldata assets,
        int256[] calldata sentiments,
        uint256[] calldata prices,
        string calldata source
    ) external onlyOracle {
        require(assets.length == sentiments.length && sentiments.length == prices.length, "Array length mismatch");
        
        for (uint i = 0; i < assets.length; i++) {
            SentimentData memory data = SentimentData({
                timestamp: block.timestamp,
                sentiment: sentiments[i],
                price: prices[i],
                source: source
            });
            
            latestData[assets[i]] = data;
            
            if (!isTracked[assets[i]]) {
                trackedAssets.push(assets[i]);
                isTracked[assets[i]] = true;
            }
            
            // Simplified history for batch
            if (historicalData[assets[i]].length < MAX_HISTORY) {
                historicalData[assets[i]].push(data);
            }
            
            emit SentimentPublished(assets[i], sentiments[i], prices[i], block.timestamp, source);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get latest sentiment for an asset
     */
    function getLatest(string calldata asset) external view returns (
        uint256 timestamp,
        int256 sentiment,
        uint256 price,
        string memory source
    ) {
        SentimentData memory data = latestData[asset];
        return (data.timestamp, data.sentiment, data.price, data.source);
    }
    
    /**
     * @notice Get history length for an asset
     */
    function getHistoryLength(string calldata asset) external view returns (uint256) {
        return historicalData[asset].length;
    }
    
    /**
     * @notice Get historical data point
     */
    function getHistorical(string calldata asset, uint256 index) external view returns (
        uint256 timestamp,
        int256 sentiment,
        uint256 price,
        string memory source
    ) {
        require(index < historicalData[asset].length, "Index out of bounds");
        SentimentData memory data = historicalData[asset][index];
        return (data.timestamp, data.sentiment, data.price, data.source);
    }
    
    /**
     * @notice Get count of tracked assets
     */
    function getTrackedAssetsCount() external view returns (uint256) {
        return trackedAssets.length;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Transfer oracle role
     */
    function setOracle(address newOracle) external onlyOracle {
        require(newOracle != address(0), "Invalid address");
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }
}
