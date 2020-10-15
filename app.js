const mayi = require("./MayI"); /** mayi game */
const express = require("express"); /** require express */
const socketio = require("socket.io"); /** require socket io */

const app = express(); /** create an instance of express server */
const expressServer = app.listen(3000); /** express server */

/** create an instance of socketio and pass it our http server we are binding to */
const io = socketio(expressServer, { forceNew: true });

/** All the currently active game rooms */
const rooms = {};

/** All the data for each currently active game room */
const gameData = {};

/**
 * Get personal player profile including socketID, name, # of Buys, Hand
 * @param {string} room - The room ID
 * @param {string} user - The user ID
 * @returns {object} object - returns player object with id, socketid, name, buys, points, and current hand
 */
function getMyPlayer(room, user) {
  return rooms[room].players[user];
}

/**
 * Get all opponent profile data
 * @param {string} room - The room ID
 * @param {string} user - The user ID
 * @returns {array} object - returns array of objects containing id, name, buys, and card count for each opponent
 */
function getOtherPlayers(room, user) {
  let players = [...rooms[room].turnOrder];
  let i = 0;

  // remove requesting user
  while (players[i] !== user) i++;
  players = [...players.slice(i + 1, players.length), ...players.slice(0, i)];

  // construct object of player data to return
  for (let i = 0; i < players.length; i++) {
    let player = rooms[room].players[players[i]];
    players[i] = {
      id: player.id,
      name: player.name,
      buys: player.buys,
      cardCount: player.hand.length
    };
  }

  return players;
}

/**
 * Get current game round
 * @param {string} room - The room ID
 * @returns {string} round - Current game round
 */
function getCurrentRound(room) {
  return rooms[room].round.toString();
}

/**
 * Remove a card from a players hand
 * @param {string} room - The room ID
 * @param {string} user - The user ID
 * @param {object} card - Card object
 */
function removeCardFromPlayer(room, user, card) {
  rooms[room].discard(user, card);
}

/**
 * Create new meld(s)
 * @param {string} room - The room ID
 * @param {string} user - The user ID
 * @returns {boolean} returns true if meld was created, false otherwise
 */
function newMeld(room, user, melds) {
  return rooms[room].meld(user, melds);
}

/**
 * Get all data pertaining to the current deck
 * @param {string} room - The room ID
 * @returns {object} return an object containing the most recently discarded card and the number of active cards in the deck
 */
function getDeck(room) {
  let d = rooms[room].deck;
  const deck = {};
  deck["count"] = d.deck.length.toString();
  if (d.discarded.length === 0) {
    deck["discarded"] = {
      id: null,
      rank: null,
      suit: null,
      value: null,
      order: null
    };
  } else {
    deck["discarded"] = d.discarded[d.discarded.length - 1];
  }
  return deck;
}

/**
 * Get current game scores
 * @param {string} room - The room ID
 * @returns {array} scores - An array of objects that contains the id, name, and number of points for each player in a room
 */
function getScores(room) {
  const game = rooms[room];
  const scores = [];
  for (let player in game.players) {
    let { id, name, points } = game.players[player];
    scores.push({
      id,
      name,
      points
    });
  }
  return scores;
}

/**
 * Gets curent turn
 * @param {string} room - The room ID
 * @returns {string} returns ID of the user whos turn it is
 */
function getTurn(room) {
  return rooms[room].turnOrder[rooms[room].turn];
}

/**
 *
 * @param {string} room - The room ID
 * @param {string} user - The user ID
 * @returns {boolean} returns true if user has melded this round, otherwise false
 */
function didPlayerMeld(room, user) {
  return rooms[room].hasMeld(user);
}

/**
 * Gets all meld(s)
 * @param {string} room - The room ID
 * @returns {array} returns an array of Meld objects
 */
function getMelds(room) {
  return rooms[room].melds;
}

/** Handles all communication to and from client for each socket connection */
io.on("connection", socket => {
  console.log(`New Connection from socket ${socket.id}`);

  /**
   *
   * CreateRoom
   *
   * Handles the creation process of and error handling of a clients request to
   * create a new game room.  If successful - gameData is initialized and the requesting
   * user is added to the game.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {string} userName - The requesting users name / alias.
   * @param {integer} numberOfPlayers - The number of players required for the game (3 or 5).
   * @param {function} callback - Returns an object with the room creation results
   */
  socket.on(
    "createRoom",
    ({ room, user, userName, numberOfPlayers }, callback) => {
      if (rooms[room]) {
        console.log(`Room ${room} already exists.`);
        callback({
          success: false,
          message:
            "A room with this name already exists.  Please choose a different name."
        });
      } else {
        console.log(`Creating room ${room}`);
        rooms[room] = new mayi();
        gameData[room] = {
          timer: null,
          buyers: [],
          numberOfPlayers,
          timeout: null
        };
        socket.join(room);
        rooms[room].addPlayer(user, socket.id, userName);
        console.log(`Added player ${user} : ${userName} to ${room}`);
        callback({
          success: true,
          message: `Successfully created room ${room}.`
        });
      }
    }
  );

  /**
   *
   * joinRoom
   *
   * Handles the connection and reconnection to a provided game room.  On successful
   * request to join room - if the room has reached capacity - a "gameReady" emit
   * is executed to inform the client that the game is ready.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {string} userName - The requesting users name / alias.
   * @param {function} callback - Returns an object with the room connection results
   *
   */
  socket.on("joinRoom", ({ room, user, userName }, callback) => {
    const game = rooms[room];
    if (!game) {
      callback({
        success: false,
        message: `Unable to join room ${room}.  No such room exists.`
      });
    } else if (
      Object.keys(game.players).length >= gameData[room].numberOfPlayers
    ) {
      // if room is full check to see if any socketId's are empty
      // allow player to join as disconnected user
      const disconnectedPlayer = Object.keys(game.players).find(
        player => game.players[player].socketId === null
      );
      if (!disconnectedPlayer) {
        callback({
          success: false,
          message: `Unable to join room ${room}.  The maximum number of players has been reached.`
        });
      } else {
        socket.join(room);
        game.reconnect(disconnectedPlayer, user, socket.id);
        callback({
          success: true,
          message: `Successfully rejoined room ${room}.`
        });
        io.to(socket.id).emit("reconnectEstablished");
      }
    } else {
      socket.join(room);
      console.log(`${user} joined room ${room}`);
      console.log(`Added player ${user} : ${userName} to ${room}`);
      game.addPlayer(user, socket.id, userName);
      callback({
        success: true,
        message: `Successfully joined room ${room}.`
      });
      if (gameData[room].numberOfPlayers === Object.keys(game.players).length) {
        game.deal();
        io.in(room).emit("gameReady", "Game is Ready to start!");
      }
    }
  });

  /**
   *
   * snackBar
   *
   * SnackBar is a helper function that is called often.  It provides important
   * game play updates such as turns, buys, and melds.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {string} action - The type of action (BUY, MELD, TURN)
   */
  const snackBar = (room, user, action) => {
    io.in(room).emit("snackBar", {
      userID: user,
      name: rooms[room].players[user].name,
      action
    });
  };

  /**
   *
   * startRound
   *
   * The client emits a startRound message upon receiving a gameReady message.
   * startRound handles the initial game setup required to begin game play by emitting
   * a series of messages containing the required data.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   */
  socket.on("startRound", ({ room, user }) => {
    console.log("START ROUND");
    console.log(room, user);
    io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
    io.to(socket.id).emit("getOtherPlayers", getOtherPlayers(room, user));
    io.to(socket.id).emit("getCurrentRound", getCurrentRound(room));
    io.to(socket.id).emit("deck", getDeck(room));
    io.to(socket.id).emit("setTurn", getTurn(room));
    io.to(socket.id).emit("melds", getMelds(room));
    io.to(socket.id).emit("scores", getScores(room));
    snackBar(room, getTurn(room), "TURN");
  });

  /**
   *
   * reconnectToGame
   *
   * The client emits a reconnectToGame message upon receiving a reconnectEstablished message.
   * Similar to startRound recconectToGame send all requireed game play data but at any
   * particular point in the game.
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   */
  socket.on("reconnectToGame", ({ room, user }) => {
    io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
    io.to(socket.id).emit("getOtherPlayers", getOtherPlayers(room, user));
    io.to(socket.id).emit("getCurrentRound", getCurrentRound(room));
    io.to(socket.id).emit("deck", getDeck(room));
    io.to(socket.id).emit("melds", getMelds(room));
    io.to(socket.id).emit("scores", getScores(room));
  });

  /**
   *
   * leaveRoom
   *
   * The client emits a leaveRoom message only when it leaves a room it has just created
   * or joined that has not begun game play.  Delete the user from the game room, remove
   * the socketId from the room and delete the game room if applicable.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   */
  socket.on("leaveRoom", ({ room, user }, callback) => {
    delete rooms[room].players[user];
    if (Object.keys(rooms[room].players).length === 0) delete rooms[room];
    socket.leave(room);
    callback();
  });

  /**
   *
   * isGameOver
   *
   * isGameOver is emitted from the client after every round to check if - upon completeion
   * of the round - the game is over.  Returns the game status via its callback.
   *
   * @param {string} room - The room name used as the ID.
   * @param {function} callback - returns boolean value
   */
  socket.on("isGameOver", ({ room }, callback) => {
    if (rooms[room].round > 6) callback(true);
    callback(false);
  });

  /**
   *
   * getOtherPlayers
   *
   * Fetches all player data besides self.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   */
  socket.on("getOtherPlayers", ({ room, user }) => {
    io.to(socket.id).emit("getOtherPlayers", getOtherPlayers(room, user));
  });

  /**
   *
   * getMelds
   *
   * Fetches all melds for a given game round.
   *
   * @param {string} room - The room name used as the ID.
   */
  socket.on("getMelds", ({ room }) => {
    io.to(socket.id).emit("melds", getMelds(room));
  });

  /**
   *
   * drawCard
   *
   * Handles the drawing of a card from the deck into the requesting users hand.
   * Emits a message to update the users hand on the client.
   * Broadcasts a message to all other players in the room telling them the action
   * that just took place in order to invoke an update
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   */
  socket.on("drawCard", ({ room, user }) => {
    console.log(`${user} drew a card.`);
    rooms[room].draw(user);
    io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
    socket.broadcast.to(room).emit("userDrewACard");
  });

  /**
   *
   * discardCard
   *
   * Handles the entire process of discarding a card from a users hand to the discard pile.
   * Clears the timeout created to handle the discarding of a card in the event that the client
   * does not emit a discardCard message in the allowed time frame.  Removes the card from the
   * players hand and into the discard pile.  Emits messages for all needed game updates.
   * Checks to see if discarding the card resulted in a player having 0 cards - essentially winning
   * the round.  If so - alert client round is over and update scores otherwise increment turn.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {object} card - Card object to discard.
   */
  socket.on("discardCard", ({ room, user, card }) => {
    console.log(`${user} discarded a card.`);
    clearTimeout(gameData[room].timeout);
    gameData[room].timeout = null;
    gameData[room].timer = null;
    removeCardFromPlayer(room, user, card);
    io.in(room).emit("updateOpponentCards");
    io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
    io.in(room).emit("discardCard", { success: true });
    io.in(room).emit("deck", getDeck(room));
    if (rooms[room].players[user].hand.length === 0) {
      rooms[room].endRound();
      io.in(room).emit("scores", getScores(room));
      io.in(room).emit("roundFinished", rooms[room].players[user].name);
    } else {
      io.in(room).emit("setTurn", getTurn(room));
      snackBar(room, getTurn(room), "TURN");
    }
  });

  /**
   *
   * newMeld
   *
   * Attemps to create new meld(s) and alerts user of the status via the callback.
   * Upon successful meld creation emits are made with relevant updated game data.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {array} melds - Array of Meld objects
   * @param {function} callback - Returns the the success / failure of meld
   */
  socket.on("newMeld", ({ room, user, melds }, callback) => {
    const didCreateNewMeld = newMeld(room, user, melds);
    callback(didCreateNewMeld);
    if (didCreateNewMeld) {
      io.in(room).emit("updateOpponentCards");
      io.in(room).emit("melds", getMelds(room));
      io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
      snackBar(room, user, "MELD");
    }
  });

  /**
   *
   * getOpponentCards
   *
   * Emits message containing current player data for all opponents to requesting user.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   */
  socket.on("getOpponentCards", ({ room, user }) => {
    io.to(socket.id).emit("getOtherPlayers", getOtherPlayers(room, user));
  });

  /**
   *
   * handleDiscardCard
   *
   * Function that gets invoked by a timeout created at the end of each updateAfterBuy message.
   * This function allows the server to automatically discard a random card from a players hand
   * if they do NOT do so in the allowed time frame.  This function does not run and the timer
   * is canceled if the client sucessfully emits a discardCard message.  This allows the game to
   * continue if a user disconnects.  Function determines the current user and selects a random
   * card and discards it.  Nulls out the current time and timers.  Updates the room with
   * corresponding game data.
   *
   * @param {string} room - The room name used as the ID.
   */
  const handleDiscardCard = room => {
    gameData[room].timeout = null;
    gameData[room].timer = null;
    const game = rooms[room];
    const user = game.turnOrder[game.turn];
    const card =
      game.players[user].hand[
        Math.floor(Math.random() * Math.floor(game.players[user].hand.length))
      ];
    console.log(`${user} drew a card.`);
    removeCardFromPlayer(room, user, card);
    io.to(game.players[user].socketId).emit(
      "getMyPlayer",
      getMyPlayer(room, user)
    );
    io.in(room).emit("updateOpponentCards");
    io.in(room).emit("discardCard", { success: true });
    io.in(room).emit("deck", getDeck(room));
    io.in(room).emit("setTurn", getTurn(room));
    snackBar(room, getTurn(room), "TURN");
  };

  /**
   *
   * handleCardBuyProcess
   *
   * Function is called by a timeout set in buyProcess.  After the allowed time to make a
   * buy decision the function checks if any user requested to buy the card (stored in gameData)
   * and handles the buy request.  Clears the room timer. Emits messages notifiying players of
   * a sucessful buy or if there was no buy to continue game play.
   *
   * @param {string} room - The room name used as the ID.
   */
  const handleCardBuyProcess = room => {
    gameData[room].timer = null;
    let buyer = null;
    if (gameData[room].buyers.length) {
      buyer = rooms[room].determineBuy(gameData[room].buyers);
      if (buyer) {
        rooms[room].buy(buyer);
        snackBar(room, buyer, "BUY");
      }
    }
    gameData[room].buyers = [];
    io.to(room).emit("buyFinalized");
  };

  /**
   *
   * buyProcess
   *
   * Sets buy process timer if it is not set already and emits a timedEvent message
   * to requesting user with the allowed time to buy a card.  Sets timeout to handle
   * buy requests after allowed time.
   *
   * @param {string} room - The room name used as the ID.
   */
  socket.on("buyProcess", ({ room }) => {
    // set timer to 15 seconds from now
    if (!gameData[room].timer) {
      gameData[room].timer = Date.now() + 15000;
      setTimeout(handleCardBuyProcess, 15000, room);
    }
    io.to(socket.id).emit("timedEvent", {
      timer: gameData[room].timer,
      event: "BUY"
    });
  });

  /**
   *
   * buyCard
   *
   * Adds a user to the list of potential buyers for a particular discarded card.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   */
  socket.on("buyCard", ({ room, user }) => {
    console.log(`${user} is requesting to buy a card.`);
    gameData[room].buyers.push(user);
  });

  /**
   *
   * hasMeld
   *
   * Checks if a user has already submitted their round meld.  Used on the client side
   * to check if a playable can swap with or lay down cards on an existing melds.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {boolean} callback - Returns meld status of a player
   */
  socket.on("hasMeld", ({ room, user }, callback) => {
    callback(didPlayerMeld(room, user));
  });

  /**
   *
   * canSwapWithMeld
   *
   * Checks whether a meld is swappable.  A meld is swappable if three conditions are met
   * 1) contains a "2" wild card
   * 2) the meld is still valid after the swap
   * 3) the meld was NOT created by the user requesting the swap
   * Returns the whether or not the user may swap via callback.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {string} meldDropID - The ID of the meld to swap with.
   * @param {object} card - A card object to replace during the swap.
   * @param {boolean} callback - Returns result of the swap
   */
  socket.on("canSwapWithMeld", ({ room, user, meldDropID, card }, callback) => {
    meldDropID = parseInt(meldDropID);
    let currentMeld = rooms[room].melds.find(m => m.id === meldDropID);
    if (currentMeld.playerID !== user) {
      let cards = [...currentMeld.cards];
      let idx = cards.findIndex(c => c.order === 2);
      if (idx > -1) {
        cards.splice(idx, 1, card);
        if (rooms[room].isValidMeld(cards)) {
          callback(true);
          return;
        }
      }
    }
    callback(false);
  });

  /**
   *
   * swapWithMeld
   *
   * swaps a card with a "2" wild card currently in a meld and handles game data updates.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {string} meldDropID - The ID of the meld to swap with.
   * @param {object} card - A card object to replace during the swap.
   */
  socket.on("swapWithMeld", ({ room, user, meldDropID, card }) => {
    if (rooms[room].swapWithMeld(user, card, parseInt(meldDropID))) {
      io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
      io.to(room).emit("updateAfterMeldDropOrSwap");
    }
  });

  /**
   *
   * addToMeld
   *
   * Simply places a users card to an existing meld
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {string} meldDropID - The ID of the meld to swap with.
   * @param {object} card - A card object to replace during the swap.
   */
  socket.on("addToMeld", ({ room, user, meldDropID, card }) => {
    if (rooms[room].addToMeld(user, card, parseInt(meldDropID))) {
      io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
      io.to(room).emit("updateAfterMeldDropOrSwap");
    }
  });

  /**
   *
   * updateAfterBuy
   *
   * Called by client after every buy period in game play (preceding a users 50 second turn).
   * Updates all relevant game data.
   * sets a new timer and timeout to handle a players turn length.
   *
   * @param {string} room - The room name used as the ID.
   * @param {string} user - The requesting user ID.
   * @param {function} callback - returns acknowledgment of message
   */
  socket.on("updateAfterBuy", ({ room, user }, callback) => {
    io.to(socket.id).emit("getMyPlayer", getMyPlayer(room, user));
    io.to(socket.id).emit("getOtherPlayers", getOtherPlayers(room, user));
    io.to(socket.id).emit("deck", getDeck(room));
    callback(true);
    if (!gameData[room].timer) {
      gameData[room].timer = Date.now() + 50000;
      gameData[room].timeout = setTimeout(handleDiscardCard, 50000, room);
      io.in(room).emit("timedEvent", {
        timer: gameData[room].timer,
        event: "TURN"
      });
    }
  });

  /**
   *
   * disconnecting
   *
   * disconnecting is a built in feature that is emitted when a user is in the act of
   * disconnecting.  We use it to remove the id associate with a players profile in each
   * game room that the disconnecting user is in.  This allows the user to later reconnect
   * as the same user.
   *
   */
  socket.on("disconnecting", () => {
    const connectedRooms = Object.keys(socket.rooms).filter(
      room => room !== socket.id
    );
    connectedRooms.forEach(room => {
      for (let player in rooms[room].players) {
        if (rooms[room].players[player].socketId === socket.id) {
          rooms[room].disconnect(player);
        }
      }
    });
  });

  /**
   *
   * disconnect
   * logs disconnection.
   *
   */
  socket.on("disconnect", () => {
    console.log(socket.id + " disconnected ");
  });
});
