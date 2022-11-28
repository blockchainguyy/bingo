// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

import "contracts/BingoGame.sol";

contract MockBingoGame is BingoGame {
    constructor(
        address _feeToken,
        uint256 _entryFee,
        uint256 _minJoinDuration,
        uint256 _minTurnDuration
    ) BingoGame(_feeToken, _entryFee, _minJoinDuration, _minTurnDuration) {}

    function setDrawNumbers(uint8[] calldata numbers, uint256 _gameIndex)
        external
    {
        for (uint256 i = 0; i < numbers.length; i++) {
            games[_gameIndex].drawnNumbers.push(bytes1(numbers[i]));
        }
    }

    function setGameCompletion(bool value, uint256 _gameIndex) external {
        games[_gameIndex].isGameComplete = value;
    }
}
