const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

let owner;
let minter;
let player1;
let player2;
let player3;
let player4;
let bingo;
let erc20;
const entryFee = 10000;
const minTurnWait = 180;
const minJoinWindow = 180;
const patterns = [
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
  [4, 8, 15, 19, 0],
];

describe("Bingo Game", function () {
  beforeEach("deployments", async function () {
    [owner, minter, player1, player2, player3, player4] = await ethers.getSigners();
    const testERC20 = await ethers.getContractFactory("TestERC20");
    erc20 = await testERC20.connect(owner).deploy("testToken", "T");
    await erc20.deployed();
    const bingoGame = await ethers.getContractFactory("MockBingoGame");
    bingo = await bingoGame.connect(owner).deploy(erc20.address, entryFee, minJoinWindow, minTurnWait);
    await bingo.deployed();
  });

  describe("Admin functions", function () {
    it("Only owner can set entry fee", async function () {
      expect(await bingo.entryFee()).to.be.equal(entryFee);
      await bingo.connect(owner).updateEntryFee(2 * entryFee);
      expect(await bingo.entryFee()).to.be.equal(2 * entryFee);
      await expect(bingo.connect(minter).updateEntryFee(entryFee)).to.revertedWith("Ownable: caller is not the owner");
    });

    it("Only owner can set minimum join duration", async function () {
      expect(await bingo.minJoinDuration()).to.be.equal(minJoinWindow);
      await bingo.connect(owner).updateMinJoinDuration(2 * minJoinWindow);
      expect(await bingo.minJoinDuration()).to.be.equal(2 * minJoinWindow);
      await expect(bingo.connect(minter).updateMinJoinDuration(minJoinWindow)).to.revertedWith("Ownable: caller is not the owner");
    });

    it("Only owner can set minimum Turn duration", async function () {
      expect(await bingo.minTurnDuration()).to.be.equal(minTurnWait);
      await bingo.connect(owner).updateMinTurnDuration(2 * minTurnWait);
      expect(await bingo.minTurnDuration()).to.be.equal(2 * minTurnWait);
      await expect(bingo.connect(minter).updateMinTurnDuration(minTurnWait)).to.revertedWith("Ownable: caller is not the owner");
    });
  });

  it("Should revert if player doesn't have enough token as fee", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await erc20.connect(minter).mint(player1.address, entryFee / 2);
    await erc20.connect(player1).approve(bingo.address, entryFee);
    await expect(bingo.connect(player1).joinGame(gameCount)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("Should revert if player doesn't give approval to bingo contract", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await erc20.connect(minter).mint(player1.address, entryFee);
    await expect(bingo.connect(player1).joinGame(gameCount)).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("Should add player to the game with proper funds and approvals", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await erc20.connect(minter).mint(player1.address, entryFee);
    expect(await erc20.balanceOf(player1.address)).to.be.equal(entryFee);
    expect(await erc20.balanceOf(bingo.address)).to.be.equal(0);
    await erc20.connect(player1).approve(bingo.address, entryFee);
    await bingo.connect(player1).joinGame(gameCount);
    expect(await erc20.balanceOf(bingo.address)).to.be.equal(entryFee);
    expect(await erc20.balanceOf(player1.address)).to.be.equal(0);
  });
  it("Multiple players can join a game", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    const gameData = await bingo.games(gameCount);
    expect(gameData.playerCount).to.be.equal(0);

    await erc20.connect(minter).mint(player1.address, entryFee);
    expect(await erc20.balanceOf(player1.address)).to.be.equal(entryFee);
    await erc20.connect(minter).mint(player2.address, entryFee);
    expect(await erc20.balanceOf(player2.address)).to.be.equal(entryFee);
    await erc20.connect(minter).mint(player3.address, entryFee);
    expect(await erc20.balanceOf(player3.address)).to.be.equal(entryFee);
    await erc20.connect(minter).mint(player4.address, entryFee);
    expect(await erc20.balanceOf(player4.address)).to.be.equal(entryFee);
    expect(await erc20.balanceOf(bingo.address)).to.be.equal(0);

    await erc20.connect(player1).approve(bingo.address, entryFee);
    await erc20.connect(player2).approve(bingo.address, entryFee);
    await erc20.connect(player3).approve(bingo.address, entryFee);
    await erc20.connect(player4).approve(bingo.address, entryFee);

    await bingo.connect(player1).joinGame(gameCount);
    await bingo.connect(player2).joinGame(gameCount);
    await bingo.connect(player3).joinGame(gameCount);
    await bingo.connect(player4).joinGame(gameCount);

    expect(await erc20.balanceOf(bingo.address)).to.be.equal(4 * entryFee);
    expect(await erc20.balanceOf(player1.address)).to.be.equal(0);
    expect(await erc20.balanceOf(player2.address)).to.be.equal(0);
    expect(await erc20.balanceOf(player3.address)).to.be.equal(0);
    expect(await erc20.balanceOf(player4.address)).to.be.equal(0);

    const gameDataNew = await bingo.games(gameCount);
    expect(gameDataNew.playerCount).to.be.equal(4);
  });

  it("Multiple games can be created", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    const gameData1 = await bingo.games(gameCount);
    expect(gameData1.playerCount).to.be.equal(0);
    await bingo.connect(owner).createGame();
    gameCount++;
    const gameData2 = await bingo.games(gameCount);
    expect(gameData2.playerCount).to.be.equal(0);
    await bingo.connect(owner).createGame();
    gameCount++;
    const gameData3 = await bingo.games(gameCount);
    expect(gameData3.playerCount).to.be.equal(0);
    await bingo.connect(owner).createGame();
    gameCount++;
    const gameData4 = await bingo.games(gameCount);
    expect(gameData4.playerCount).to.be.equal(0);

    await erc20.connect(minter).mint(player1.address, entryFee);
    expect(await erc20.balanceOf(player1.address)).to.be.equal(entryFee);
    await erc20.connect(minter).mint(player2.address, entryFee);
    expect(await erc20.balanceOf(player2.address)).to.be.equal(entryFee);
    await erc20.connect(minter).mint(player3.address, entryFee);
    expect(await erc20.balanceOf(player3.address)).to.be.equal(entryFee);
    await erc20.connect(minter).mint(player4.address, entryFee);
    expect(await erc20.balanceOf(player4.address)).to.be.equal(entryFee);
    expect(await erc20.balanceOf(bingo.address)).to.be.equal(0);

    await erc20.connect(player1).approve(bingo.address, entryFee);
    await erc20.connect(player2).approve(bingo.address, entryFee);
    await erc20.connect(player3).approve(bingo.address, entryFee);
    await erc20.connect(player4).approve(bingo.address, entryFee);

    await bingo.connect(player1).joinGame(gameCount - 3);
    await bingo.connect(player2).joinGame(gameCount - 2);
    await bingo.connect(player3).joinGame(gameCount - 1);
    await bingo.connect(player4).joinGame(gameCount);

    expect(await erc20.balanceOf(bingo.address)).to.be.equal(4 * entryFee);
    expect(await erc20.balanceOf(player1.address)).to.be.equal(0);
    expect(await erc20.balanceOf(player2.address)).to.be.equal(0);
    expect(await erc20.balanceOf(player3.address)).to.be.equal(0);
    expect(await erc20.balanceOf(player4.address)).to.be.equal(0);
    const gameDataNew1 = await bingo.games(gameCount - 3);
    expect(gameDataNew1.playerCount).to.be.equal(1);
    const gameDataNew2 = await bingo.games(gameCount - 2);
    expect(gameDataNew2.playerCount).to.be.equal(1);
    const gameDataNew3 = await bingo.games(gameCount - 1);
    expect(gameDataNew3.playerCount).to.be.equal(1);
    const gameDataNew4 = await bingo.games(gameCount);
    expect(gameDataNew4.playerCount).to.be.equal(1);
  });
  it("Can join a game before the minimum join time", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await erc20.connect(minter).mint(player1.address, entryFee);
    expect(await erc20.balanceOf(player1.address)).to.be.equal(entryFee);
    await erc20.connect(minter).mint(player2.address, entryFee);
    expect(await erc20.balanceOf(player2.address)).to.be.equal(entryFee);

    await erc20.connect(player1).approve(bingo.address, entryFee);
    await erc20.connect(player2).approve(bingo.address, entryFee);

    await bingo.connect(player1).joinGame(gameCount);

    await expect(bingo.draw(gameCount)).to.be.revertedWithCustomError(bingo, "GameNotStarted");
    await time.increase(minJoinWindow);
    await bingo.draw(gameCount);
    await expect(bingo.connect(player2).joinGame(gameCount)).to.be.revertedWithCustomError(bingo, "GameInProgress");
  });

  it("Can draw next number after the minimum turn time", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await expect(bingo.draw(gameCount)).to.be.revertedWithCustomError(bingo, "GameNotStarted");
    await time.increase(minJoinWindow);
    await bingo.draw(gameCount);
    await expect(bingo.draw(gameCount)).to.be.revertedWithCustomError(bingo, "WaitForNextTurn");
    await time.increase(minTurnWait);
    await bingo.draw(gameCount);
  });

  for (let j = 0; j < patterns.length; j++) {
    it(`Winner with pattern ${j} takes all the fee`, async function () {
      let gameCount = 0;
      await bingo.connect(owner).createGame();
      gameCount++;
      await erc20.connect(minter).mint(player1.address, entryFee);
      expect(await erc20.balanceOf(player1.address)).to.be.equal(entryFee);
      await erc20.connect(minter).mint(player2.address, entryFee);
      expect(await erc20.balanceOf(player2.address)).to.be.equal(entryFee);

      await erc20.connect(player1).approve(bingo.address, entryFee);
      await erc20.connect(player2).approve(bingo.address, entryFee);

      await bingo.connect(player1).joinGame(gameCount);

      await bingo.connect(player2).joinGame(gameCount);

      expect(await erc20.balanceOf(bingo.address)).to.be.equal(2 * entryFee);

      await time.increase(minJoinWindow);

      const boardPlayer1 = await bingo.getBoard(gameCount, player1.address);

      let numbersToSet = [];
      let drawnIndexes = [];
      for (let i = 0; i < 5; i++) {
        numbersToSet.push(boardPlayer1[patterns[j][i]]);
        drawnIndexes.push(i);
      }
      await bingo.setDrawNumbers(numbersToSet, gameCount);
      await bingo.connect(player1).bingo(gameCount);

      expect(await erc20.balanceOf(bingo.address)).to.be.equal(0);
      expect(await erc20.balanceOf(player1.address)).to.be.equal(2 * entryFee);
    });
  }

  it("Can't retrive the board of a player not joined game", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await expect(bingo.getBoard(gameCount, player1.address)).to.be.reverted;
  });

  it("Can't call bingo without joining a game", async function () {
    let gameCount = 0;
    let drawnIndexes = [1, 2, 3, 4, 5];
    await bingo.connect(owner).createGame();
    gameCount++;
    await expect(bingo.connect(player1).bingo(gameCount)).to.be.reverted;
  });

  it("Can't join a completed game", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await bingo.setGameCompletion(true, gameCount);
    await expect(bingo.connect(player1).joinGame(gameCount)).to.be.reverted;
  });

  it("Can't join a game twice", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await erc20.connect(minter).mint(player1.address, 2 * entryFee);
    await erc20.connect(player1).approve(bingo.address, 2 * entryFee);
    await bingo.connect(player1).joinGame(gameCount);
    await expect(bingo.connect(player1).joinGame(gameCount)).to.be.reverted;
  });

  it("Can't join a running game", async function () {
    let gameCount = 0;
    await bingo.connect(owner).createGame();
    gameCount++;
    await time.increase(minJoinWindow);
    await bingo.draw(gameCount);
    await erc20.connect(minter).mint(player1.address, 2 * entryFee);
    await erc20.connect(player1).approve(bingo.address, 2 * entryFee);
    await expect(bingo.connect(player1).joinGame(gameCount)).to.be.reverted;
  });

  it("Can't join a game not started", async function () {
    let gameCount = 0;
    gameCount++;
    await expect(bingo.connect(player1).joinGame(gameCount)).to.be.reverted;
  });
});
