const suits = ["Clubs", "Diamonds", "Hearts", "Spades"];
const ranks = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K"
];

const values = new Map([
  ["A", 1],
  ["2", 20],
  ["3", 3],
  ["4", 4],
  ["5", 5],
  ["6", 6],
  ["7", 7],
  ["8", 8],
  ["9", 9],
  ["10", 10],
  ["J", 10],
  ["Q", 10],
  ["K", 10]
]);

const order = new Map([
  ["A", 1],
  ["2", 2],
  ["3", 3],
  ["4", 4],
  ["5", 5],
  ["6", 6],
  ["7", 7],
  ["8", 8],
  ["9", 9],
  ["10", 10],
  ["J", 11],
  ["Q", 12],
  ["K", 13]
]);

/** Class representing a playing card. */
class Card {
  /**
   *
   * Create a card.
   * @param {string} rank - The rank of the card.
   * @param {string} suit - The suit of the card.
   * @param {number} value - The numeric value of the card.
   * @param {number} order - The order value of a card.
   *
   */
  constructor(id, rank, suit, value, order = null) {
    this.id = id;
    this.rank = rank;
    this.suit = suit;
    this.value = value;
    this.order = order;
  }
}

/** Class representing a deck of playing card. */
class Deck {
  /**
   *
   * Create a Deck of Cards.
   * @param {array} suits - The available suits.
   * @param {array} ranks - Availble ranks for a card.
   * @param {map} values - The value of a given rank.
   * @param {number} decks - The number of decks (default = 1).
   * @param {boolean} shuffle - Shuffle the deck.
   *
   */
  constructor(suits, ranks, values, decks = 1, shuffle = true) {
    this.deck = [];
    this.discarded = [];
    let counter = 1;
    for (let s of suits) {
      for (let r of ranks) {
        for (let i = 0; i < decks; i++, counter++) {
          this.deck.push(new Card(counter, r, s, values.get(r), order.get(r)));
        }
      }
    }
    if (shuffle) this.shuffle();
  }

  /**
   *
   * discardCard
   * Places a card into the discarded pile.
   * @param {Card} card - card object.
   *
   */
  discardCard(card) {
    this.discarded.push(card);
  }

  /**
   *
   * shuffle
   * Shuffles a Deck of Card Objects.
   *
   */
  shuffle() {
    for (let card in this.deck) {
      let randomCard = Math.floor(Math.random() * this.deck.length);
      [this.deck[card], this.deck[randomCard]] = [
        this.deck[randomCard],
        this.deck[card]
      ];
    }
  }

  /**
   *
   * reDeck
   * Places discarded cards back into the deck and shuffles them.
   *
   */
  reDeck() {
    this.deck = [...this.deck, ...this.discarded];
    this.discarded = [];
    this.shuffle();
  }

  /**
   *
   * Removes and returns the first card from the deck.
   *
   */
  drawCard() {
    return this.deck.shift();
  }
}

/** Description of each rounds meld requirements */
const melds = [
  {
    id: 1,
    name: "Two Threes",
    sets: 2,
    length: 3,
    description: "2 sets of 3 cards where each card has the same value."
  },
  {
    id: 2,
    name: "One Four",
    sets: 1,
    length: 4,
    description: "1 set of 4 cards where each card has the same value."
  },
  {
    id: 3,
    name: "Two Fours",
    sets: 2,
    length: 4,
    description: "2 sets of 4 cards where each card has the same value."
  },
  {
    id: 4,
    name: "One Five",
    sets: 1,
    length: 5,
    description: "1 set of 5 cards where each card has the same value."
  },
  {
    id: 5,
    name: "One Six",
    sets: 1,
    length: 6,
    description: "1 set of 6 cards where each card has the same value."
  },
  {
    id: 6,
    name: "Two Fives",
    sets: 2,
    length: 5,
    description: "2 sets of 5 cards where each card has the same value."
  }
];

/** Class representing a single meld. */
class Meld {
  /**
   *
   * Create a meld object
   * @param {number} id - The id of the meld.
   * @param {array} cards - Array of card objects to use to create meld.
   * @param {string} player - They player id to associate the meld to.
   *
   */
  constructor(id, cards, player = null) {
    /**
     * determine if the meld is a set of cards or a run / straight
     * in some cases when utilizing multiple wild cards it can be EITHER
     * if it satisfy either requirements throw an invalid meld error
     */
    const run = Meld.isRun([...cards]) ? "RUN" : false;
    const set = Meld.isSet([...cards]) ? "SET" : false;
    if (!run && !set) throw new Error("Invalid Meld");
    this.id = id;
    this.cards = cards;
    this.type = run && set ? "EITHER" : run || set;
    this.playerID = player ? player.id : null;
  }

  /**
   *
   * addCard
   * Adds a card to the calling meld instance.  Attemps to make a new meld with the
   * additional card.  If it succeeds the meld is valid and the card can be added to
   * the original meld.
   *
   * @param {Card} card - card object.
   * @return {boolean} whether the card was added or not.
   *
   */
  addCard(card) {
    let newCards = [...this.cards, card];
    try {
      const m = new Meld(null, newCards);
      this.cards.push(card);
      this.cards.sort((a, b) => a.order - b.order);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   *
   * swap
   * Swaps a card with a wildcard (2) in the meld. Can only swap with a card
   * that keeps the meld valid.
   *
   * @param {Card} meldCard - card object.
   * @param {Card} playerCard - card object.
   * @return {boolean} returns true if the swap was succesful, false otherwise.
   *
   */
  swap(meldCard, playerCard) {
    // create a new meld with the replacement card
    // if the meld is valid we can replace the original meld meldCard with playerCard and return true
    let testMeld = [playerCard];
    for (let card of this.cards)
      if (card.id !== meldCard.id) testMeld.push(card);
    try {
      const m = new Meld(null, testMeld);
      // if m was created without error we can swap the cards
      for (let i = 0; i < this.cards.length; i++) {
        if (this.cards[i].id === meldCard.id) {
          this.cards.splice(i, 1, playerCard);
          break;
        }
      }
      this.cards.sort((a, b) => a.order - b.order);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   *
   * isSet
   * checks whether a meld is a valid set.  A valid set is a group of 3+ cards
   * with the order (ex. [A,A,A], [4,4,4,4,4]) regardless of suit.  A 2 card
   * is a wild card and can take the place of any card.
   *
   * @param {array} cards - Array of card object.
   * @return {boolean} return true if the meld is a valid set, false otherwise.
   *
   */
  static isSet(cards) {
    let val = 0;
    for (let card of cards) {
      // cards with value 2 are wild cards and can complete any set
      if (card.order === 2) continue;
      // if we haven't set a value for val - set it
      // val becomes the card we are looking for to verify the set
      if (!val) val = card.order;
      // all cards without a value of 2 must be equal - return false if this is not the case
      else if (val !== card.order) return false;
    }
    // return true if we the set is verified
    return true;
  }

  /**
   *
   * isRun
   * Checks whether a meld is a valid run.  A valid run or straight is a group of 3+ cards
   * with the same suit that where cards have consecutive rank values.
   *
   * @param {array} cards - Array of card object.
   * @return {boolean} return true if the meld is a valid set, false otherwise.
   *
   */
  static isRun(cards) {
    // count the number of 2's / wild cards
    cards.sort((a, b) => a.order - b.order);
    const wildCards = [];
    for (let i = cards.length - 1; i >= 0; i--) {
      if (cards[i].order === 2) wildCards.push(...cards.splice(i, 1));
    }
    // make sure all cards in the straight are the same suit
    for (let i = 1; i < cards.length; i++)
      if (cards[i - 1].suit !== cards[i].suit) return false;
    let val = 0;
    let i = 1;
    if (cards.length) val = cards[0].order + 1;
    while (i < cards.length) {
      if (cards[i].order !== val && !wildCards.length) return false;
      if (cards[i].order !== val && wildCards.length)
        cards.splice(i, 0, wildCards.pop());
      i++;
      val++;
    }
    if (wildCards.length) cards.push(...wildCards);
    return true;
  }
}

/** Class representing a Player */
class Player {
  /**
   *
   * Create a Player object
   * A player object holds the userId generated on the client, the current socketId from
   * socketIO, name or alias set on the client, the number of available buys, current points,
   * and the players hand.
   *
   * @param {string} id - The id of the player.
   * @param {string} sockerId - The current socket id of the player
   * @param {string} name - The username / alias of the player.
   *
   */
  constructor(id, socketId, name = "guest") {
    this.id = id;
    this.socketId = socketId;
    this.name = name;
    this.buys = 6;
    this.points = 0;
    this.hand = [];
  }

  /**
   *
   * addCard
   * adds card to players hand.
   * @param {Card} card - Card object.
   *
   */
  addCard(card) {
    this.hand.push(card);
  }

  /**
   *
   * removeCard
   * removes card from a players hand
   * @param {Card} card - Card object.
   *
   */
  removeCard(card) {
    for (let i = 0; i < this.hand.length; i++)
      if (this.hand[i].id === card.id) this.hand.splice(i, 1);
  }

  /**
   *
   * setSocketId
   * set / change the socket id for a player
   * @param {string} sid - socket id.
   *
   */
  setSocketId(sid = null) {
    this.socketId = sid;
  }

  /**
   *
   * setPlayerId
   * set / change the player id for a player
   * @param {string} pid - socket id.
   *
   */
  setPlayerId(pid = null) {
    this.id = pid;
  }
}

/** Class representing a MayI Game */
class MayI {
  /**
   * Create a MayI Game object
   */
  constructor() {
    this.players = {}; /** all game players */
    this.connectedPlayerCount = 0; /** number of active connections */
    this.deck = null; /** deck object for the game */
    this.round = 1; /** current game roundMeld */
    this.turn = 0; /** current turn */
    this.turnOrder = []; /** the turn order of the game */
    this.melds = []; /** all active melds for the current round */
  }

  /**
   *
   * disconnect
   * Called when a connection to a player is lost and cannot be reestablished.
   * sets the socket Id of the disconnected player to null and decrements number
   * of connected players.
   * @param {string} player - player id
   *
   */
  disconnect(player) {
    this.players[player].setSocketId();
    this.connectedPlayerCount--;
  }

  /**
   *
   * reconnect
   * Called when a player reconnects to an active game after losing connection.
   * Sets new pid and sid, updates the new player object and deletes the old player.
   * updates the turnOrder id's and any meld id to associate it with the newly connected player
   * @param {string} player - current player id
   * @param {string} pid - new player id
   * @param {string} sid - new socket id
   */
  reconnect(player, pid, sid) {
    this.players[player].setPlayerId(pid);
    this.players[player].setSocketId(sid);
    this.connectedPlayerCount++;
    this.players[pid] = this.players[player];
    delete this.players[player];
    this.turnOrder[this.turnOrder.indexOf(player)] = pid;
    // replace ID for any meld placed by previous connection
    this.melds.forEach(meld => {
      if (meld.playerID === player) meld.playerID = pid;
    });
  }

  /**
   *
   * incrementTurn
   * Changes the turn variable to the next player in turn order.
   *
   */
  incrementTurn() {
    const numberOfPlayers = Object.keys(this.players).length;
    if (this.turn === numberOfPlayers - 1) this.turn = 0;
    else this.turn += 1;
  }

  /**
   *
   * addPlayer
   * Adds a new player to the game.
   * @param {string} id - player id
   * @param {string} socketId - socket id
   * @param {string} name - player name / alias
   *
   */
  addPlayer(id, socketId, name) {
    if (!this.players[id]) {
      this.players[id] = new Player(id, socketId, name);
      this.turnOrder.push(id);
      this.connectedPlayerCount++;
    }
  }

  /**
   *
   * deal
   * Deals 11 cards to each player in the game.  Discards one card into the discard pile.
   *
   */
  deal() {
    this.deck = new Deck(suits, ranks, values, 2, true);
    for (let i = 0; i < 11; i++) {
      for (let player in this.players) {
        this.players[player].hand.push(this.deck.drawCard());
      }
    }
    this.deck.discardCard(this.deck.drawCard()); // discard first card
  }

  /**
   *
   * draw
   * Removes a card from the deck and places it into the players hand.
   * @param {string} player - player id
   * @param {string} qty - number of cards to draw
   *
   */
  draw(player, qty = 1) {
    for (let i = 0; i < qty; i++)
      this.players[player].hand.push(this.deck.drawCard());
  }

  /**
   *
   * discard
   * Discard a card from a players hand.  Allows a player whos turn it is to
   * discard a card.  Increments "turn" once a player has successfully discarded a card.
   *
   * @param {string} player - player id
   * @param {Card} card - card object to discard
   * @return {boolean} returns true on successful completion
   *
   */
  discard(player, card) {
    if (this.turnOrder[this.turn] !== player) return;
    for (let i = 0; i < this.players[player].hand.length; i++)
      if (this.players[player].hand[i].id === card.id)
        this.players[player].hand.splice(i, 1);
    this.deck.discardCard(card);
    if (!this.players[player].hand.length !== 0) this.incrementTurn();
    return true;
  }

  /**
   *
   * endRound
   * Adds points to each players profile based on the value of each card in their hand
   * then clears their hand.  Increment round.  Clear current melds.  Deal next hand if
   * round is not great than 6.
   *
   */
  endRound() {
    for (let id in this.players) {
      for (let card of this.players[id].hand) {
        this.players[id].points += card.value;
      }
      this.players[id].hand = [];
    }
    this.round++;
    this.melds = [];
    if (this.round <= 6) this.deal();
  }

  /**
   *
   * determineBuy
   * From a provided list of potential buyers of a card this function determines
   * which player has first dibbs on the card.  A player who discarded the card
   * is not eligble to buy.
   *
   * @param {array} allPlayers - list of player Id's
   * @return {boolean} returns the player who has the greatest right to buy, false if none
   *
   */
  determineBuy(allPlayers) {
    const buyOrder = this.turnOrder
      .slice(this.turn, this.turnOrder.length)
      .concat(this.turnOrder.slice(0, this.turn));
    let length =
      this.deck.discarded.length === 1 ? buyOrder.length : buyOrder.length - 1;
    for (let i = 0; i < length; i++) {
      let player = buyOrder[i];
      if (allPlayers.includes(player) && this.players[player].buys > 0)
        return player;
    }
    return false;
  }

  /**
   *
   * buy
   * Buy a recently discarded card. Players must have one or more buys left.
   * Decrement number of buys.  Add discarded card to players hand. Draw an extra card
   * because of the buy.
   *
   * @param {string} player - player id
   *
   */
  buy(player) {
    if (this.players[player].buys === 0) return false;
    this.players[player].buys -= 1;
    this.players[player].hand.push(this.deck.discarded.pop());
    this.draw(player, 1);
  }

  /**
   *
   * meld
   * Attempts to create a meld. Check if meld(s) are valid - if not return false.
   * If the player has not already met the meld requirements for the round this
   * meld must meet the those requirements.  If they have met the initial meld the
   * player can meld any valid meld. A player must not meld cards resulting in an
   * empty hand.
   *
   * @param {string} player - player id
   * @param {array} newMelds - An array of arrays of Card objects
   * @return {boolean} returns true on successful meld
   *
   */
  meld(player, newMelds) {
    try {
      // for each meld attempt to create a meld object and save them in an array m
      let m = [];
      let sum = 0;
      for (let i = 0; i < newMelds.length; i++) {
        sum += newMelds[i].length;
        m.push(
          new Meld(this.melds.length + i, newMelds[i], this.players[player])
        );
      }
      // check if melding will result in the player having 0 cards
      if (sum === this.players[player].hand.length) return false;
      // check to see if player already had their initial meld
      // if a player doesn't have their meld the current meld must match
      // the round meld requirements
      if (!this.hasMeld(player)) {
        let roundMeld = melds[this.round - 1];
        // check if current array of melds is equal to the desired number of melds for the round
        if (m.length !== roundMeld.sets) return false;
        // for each meld check if the length of the meld at least equal to the desired for the round
        for (let n of m) {
          if (n.cards.length < roundMeld.length || n.type === "RUN") {
            return false;
          }
        }
      }
      // remove cards from the players hand
      for (let meld of newMelds) {
        for (let card of meld) {
          for (let i = 0; i < this.players[player].hand.length; i++)
            if (this.players[player].hand[i].id === card.id)
              this.players[player].hand.splice(i, 1);
        }
      }
      // add melds to round meld
      this.melds.push(...m);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   *
   * isValidMeld
   * Checks if a provided set of cards can create a valid meld.
   * @param {array} cards - An array of card objects.
   * @return {boolean} return true if valid, false otherwise.
   *
   */
  isValidMeld(cards) {
    try {
      let isValid = new Meld(-1, cards, null);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   *
   * swapWithMeld
   * Swap a card in a players hand with a wild card on a meld.  If a player
   * has a card that replaces a "2" in a meld the player can swap their card
   * for the "2" at long as the meld remains valid.  The player must have
   * already melded.  Players cannot swap with their own meld.
   *
   * @param {string} player - player id
   * @param {Card} playerCard - card object
   * @param {number} meldId - id of meld to swap with
   * @return {boolean} returns true if swap is successful, false otherwise
   *
   */
  swapWithMeld(player, playerCard, meldID) {
    // if a player does not have his meld he cannot swap cards with any meld
    if (!this.hasMeld(player)) return false;
    // swap card
    let meld = this.melds.find(m => m.id === meldID);
    let meldCard = meld.cards.find(card => card.order === 2);
    // if the swap was successful remove playerCard from players hand
    // and add the meldCard to players hand
    if (!meld.swap(meldCard, playerCard)) return false;

    for (let i = 0; i < this.players[player].hand.length; i++) {
      if (this.players[player].hand[i].id === playerCard.id) {
        this.players[player].hand.splice(i, 1, meldCard);
        break;
      }
    }
    return true;
  }

  /**
   *
   * hasMeld
   * check if the player has their meld.
   *
   * @param {string} playerID - player id
   * @return {boolean} returns true if player has meld, false otherwise
   *
   */
  hasMeld(playerID) {
    for (let meld of this.melds) if (meld.playerID === playerID) return true;
    return false;
  }

  /**
   *
   * addToMeld
   * Add a card to a meld.  Player must have already melded and must be left
   * with at least one card in their hand.
   *
   * @param {string} player - player id
   * @param {Card} card - card object
   * @param {number} meldId - id of meld to swap with
   * @return {boolean} returns true if successful, false otherwise
   */
  addToMeld(player, card, meldID) {
    let meld = this.melds.find(m => m.id === meldID);
    let x = meld.addCard(card);
    if (this.players[player].hand.length > 1 && x) {
      this.players[player].removeCard(card);
      return true;
    }
    return false;
  }

  /**
   *
   * calculatePoints
   * Calculates points for all players at the end of a round and adds them to the
   * players profile.
   *
   */
  calculatePoints() {
    for (let player of this.players) {
      let pts = 0;
      for (let card of this.players[player].hand) pts += card.value;
      this.players[player].points += pts;
    }
  }
}

module.exports = MayI;
