// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

/**
 * @dev Interface for the Bingo Game contract
 */
interface IBingoGame {
    /**
     * @dev Emitted when a bingo game is created with index gameId
     * */
    event GameCreated(uint256 indexed gameId);

    /**
     * @dev Emintted when minimum Join duration for a game on BingoGame is updated
     * */
    event JoinDurationUpdated(uint256 indexed newMinJoinDuration);

    /**
     * @dev Emintted when minimum Turn duration for a game on BingoGame is updated
     * */
    event TurnDurationUpdated(uint256 indexed newMinTurnDuration);

    /**
     * @dev Emintted when Entry Fee to join a game on BingoGame is updated
     * */
    event EntryFeeUpdated(uint256 indexed newEntryFee);

    /**
     * @dev Emintted when A player with address "player" joins a game with game Index "gameIndex" on BingoGame is updated
     * */
    event PlayerJoined(uint256 indexed gameIndex, address indexed player);

    /**
     * @dev Emitted when a number is drawn for a game with game index "gameIndex"
     * */
    event Draw(uint256 indexed gameIndex);

    /**
     * @dev Emitted when a game with game index "gameIndex" is finished
     **/
    event GameOver(uint256 indexed gameIndex);

    /**
     * @dev Updates the minumum join duration for games
     * Emits the JoinDurationUpdated event
     * Can only be called by the owner of the BingoGame contract
     * */
    function updateMinJoinDuration(uint256 _newMinJoinDuration) external;

    /**
     * @dev Updates the minimum duration between draw
     * Emist TurnDurationUpdated event
     * Can only be called by the owner of the BingoGame contract
     * */
    function updateMinTurnDuration(uint256 _newMinTurnDuration) external;

    /**
     * @dev Updates the entry fee to join a game
     * Emits EntryFeeUpdated event
     * Can only be called by the owner of the BingoGame contract
     * */
    function updateEntryFee(uint256 _newEntryFee) external;

    /**
     * @dev Gives the board number for a game with game index "_gameIndex" of a player with address _player
     **/
    function getBoard(uint256 _gameIndex, address _player)
        external
        view
        returns (uint8[24] memory _board);

    /**
     * @dev Creates a board for the sender and make him join a game with game index "_gameIndex"
     * Emits the PlayerJoined event
     * */
    function joinGame(uint256 _gameIndex) external;

    /**
     * @dev Draws a number for the game with game index "_gameIndex"
     * Emits the Draw event
     * */
    function draw(uint256 _gameIndex) external;

    /**
     * @dev registers a new bingo game, entry fee is set at game creation and connot be updated later
     * Emits the GameCreated event
     * */
    function createGame() external;

    /**
     * @dev Checks if the sender has won the game with game index "_gameIndex" with patter of index "patternIndex" with number with drawn on indexs drawIndexes
     * Emits GameOver event
     * */
    function bingo(
        uint256 _gameIndex,
        uint256 patternIndex,
        uint256[5] calldata drawnIndexes
    ) external;
}
