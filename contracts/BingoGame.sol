// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "contracts/Interfaces/IBingoGame.sol";
import "contracts/libs/libMask.sol";

/// @title BingoGame contract to create and play multiple bingo games simultaneously
/// @author blockchainguyy
/// @dev This contract can be used to create multiple bingo games simultaneoulsy
///         A Player can join any number of games but one board per game
///         The creator can draw the numbers and any player who completes bingo can claim his winnings and the game finishes
contract BingoGame is Ownable, IBingoGame {
    using SafeERC20 for IERC20;
    using libMask for bytes32;

    struct GameData {
        bool isGameComplete;
        bool isGameInProcess;
        uint64 startTime;
        uint64 lastDrawTime;
        uint256 gameEntryFee;
        uint256 playerCount;
        mapping(uint8 => bool) drawnNumbers; //check uint8
    }

    uint8[5][12] private _PATTERNS = [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8, 9],
        [10, 11, 12, 13, 0],
        [14, 15, 16, 17, 18],
        [19, 20, 21, 22, 23],
        [0, 5, 10, 14, 19],
        [1, 6, 11, 15, 20],
        [2, 7, 16, 21, 0],
        [3, 8, 12, 17, 22],
        [4, 9, 13, 18, 23],
        [0, 6, 17, 23, 0],
        [4, 8, 15, 19, 0]
    ];
    // TODO: check gas costs during hardhat tests for uint8

    // only first 24 bytes are stored but using bytes32 saves type conversion costs during operations
    // gameId => player's Address => board
    mapping(uint256 => mapping(address => bytes32)) private _playerBoard; //TODO: explore bytes
    //TODO: readable getter

    uint256 public entryFee;
    IERC20 public immutable feeToken;

    // Host cannot start draw for the first time in a game until this duration is complete
    // All the players participating in the game should join before first draw
    uint256 public minJoinDuration;

    // Host needs to wait for this duration between two consecutive draws
    uint256 public minTurnDuration;

    uint256 public gameCount;

    // gameID => game
    mapping(uint256 => GameData) public games;

    /// @param _feeToken address of fee token to be set
    /// @param _entryFee the entry fee per user per game
    /// @param _minJoinDuration the min duration between start of the game and first draw
    /// @param  _minTurnDuration the min duration between two consecutive draws
    constructor(
        address _feeToken,
        uint256 _entryFee,
        uint256 _minJoinDuration,
        uint256 _minTurnDuration
    ) Ownable() {
        feeToken = IERC20(_feeToken);
        entryFee = _entryFee;
        minJoinDuration = _minJoinDuration;
        minTurnDuration = _minTurnDuration;
    }

    /// @notice updated the minumum join duration before game can start
    /// @param _newMinJoinDuration new minimum join duration to set
    /// only owner can executed this function
    function updateMinJoinDuration(uint256 _newMinJoinDuration)
        external
        onlyOwner
    {
        minJoinDuration = _newMinJoinDuration;
        emit JoinDurationUpdated(_newMinJoinDuration);
    }

    /// @notice updated the minumum turn duration between 2 consicutive
    /// @param _newMinTurnDuration new minumum turn duration to set
    /// only owner can executed this function
    function updateMinTurnDuration(uint256 _newMinTurnDuration)
        external
        onlyOwner
    {
        minTurnDuration = _newMinTurnDuration;
        emit TurnDurationUpdated(_newMinTurnDuration);
    }

    /// @notice updated the entry fee for a player to join a game
    /// @param _newEntryFee new entry fee
    /// only owner can executed this function
    function updateEntryFee(uint256 _newEntryFee) external onlyOwner {
        entryFee = _newEntryFee;
        emit EntryFeeUpdated(_newEntryFee);
    }

    /// @notice returns the board of a player for a game
    /// @param  _gameIndex index of the game to of which the user wants their board
    /// @param _player address of the player to get the board of
    /// @return _board  numbers on the board .
    function getBoard(uint256 _gameIndex, address _player)
        external
        view
        returns (uint8[24] memory _board)
    {
        bytes32 boardBytes = _playerBoard[_gameIndex][_player];
        if (boardBytes == bytes32(0)) revert NotAPlayer();
        for (uint256 i; i < 24; i++) {
            _board[i] = uint8(boardBytes[31 - i]);
        }
    }

    /// @notice creates a game of bingo
    /// @dev increase game counter and sets the games start time and entry fee
    function createGame() external returns (uint256) {
        gameCount++; // First game index is 1
        games[gameCount].startTime = uint64(block.timestamp);
        // entryFee for a game cannot be changed once a game is created
        games[gameCount].gameEntryFee = entryFee;

        emit GameCreated(gameCount);
        return gameCount;
    }

    /// @notice function to join a game.
    /// @param _gameIndex index of the game to join
    function joinGame(uint256 _gameIndex) external {
        GameData storage game = games[_gameIndex];
        if (game.isGameComplete) revert GameIsOver();
        if (game.startTime == 0) revert GameNotCreated();
        if (game.isGameInProcess) revert GameInProgress();
        if (_playerBoard[_gameIndex][msg.sender] != bytes32(0))
            revert CannotJoinTwice();

        uint256 playerCount = game.playerCount;
        bytes32 blockHash = blockhash(block.number - 1);

        // board Index starts from 0
        // playerCount is used to ensure that no board collision happens in a single block for a given gameIndex
        // gameIndex is used to achieve different boards with saame player count and block number
        _playerBoard[_gameIndex][msg.sender] = keccak256(
            abi.encodePacked(blockHash, playerCount, _gameIndex)
        ).keepFirst24Bytes();
        games[_gameIndex].playerCount++;

        feeToken.safeTransferFrom(msg.sender, address(this), game.gameEntryFee);

        emit PlayerJoined(_gameIndex, msg.sender);
    }

    /// @notice function to draw a number for a game.
    /// @param _gameIndex index of the game to join
    function draw(uint256 _gameIndex) external {
        uint64 currentTime = uint64(block.timestamp);
        GameData storage game = games[_gameIndex];
        if (game.isGameComplete) revert GameIsOver();

        if (game.isGameInProcess) {
            if (currentTime < game.lastDrawTime + minTurnDuration)
                revert WaitForNextTurn();
        } else {
            if (currentTime < game.startTime + minJoinDuration)
                revert GameNotStarted();
            game.isGameInProcess = true;
        }

        uint8 numberDrawn = uint8(blockhash(block.number - 1)[0]);
        game.drawnNumbers[numberDrawn] = true;
        game.lastDrawTime = currentTime;

        emit Draw(_gameIndex, numberDrawn);
    }

    /// @notice function for the players to call bingo if they win
    /// @param _gameIndex index of the game to join
    function bingo(uint256 _gameIndex) public {
        GameData storage game = games[_gameIndex];
        bytes32 board = _playerBoard[_gameIndex][msg.sender];
        require(board != bytes32(0), "Bingo: not a player");
        bool result = true;

        for (uint256 j; j < 12; j++) {
            uint8[5] memory pattern = _PATTERNS[j];
            uint256 patternLength = (j == 2 || j == 7 || j == 10 || j == 11)
                ? 4
                : 5;

            for (uint256 i; i < patternLength; i++) {
                result =
                    result &&
                    game.drawnNumbers[uint8(board[31 - pattern[i]])];
            }
            if (result) break;
            if (j < 11) result = true;
        }
        if (!result) revert BingoCheckFailed();

        uint256 totalFee = game.gameEntryFee * game.playerCount;
        feeToken.safeTransfer(msg.sender, totalFee);

        games[_gameIndex].isGameComplete = true;
        emit GameOver(_gameIndex, msg.sender, totalFee);
    }
}
