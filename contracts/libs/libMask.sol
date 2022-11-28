// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

library libMask {
    bytes32 private constant _BOARD_MASK = bytes32(uint256(type(uint192).max));

    function keepFirst24Bytes(bytes32 _board)
        internal
        pure
        returns (bytes32 _maskedBoard)
    {
        _maskedBoard = _board & _BOARD_MASK;
    }
}
