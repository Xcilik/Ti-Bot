class UnoGame {
	constructor(chatJid) {
		this.id = 'uno-' + Date.now();
		this.chat = chatJid;
		this.players = []; // Array of { id, name, cards: [] }
		this.deck = []; // Draw pile
		this.discardPile = []; // Discard pile
		this.currentTurn = 0; // Index of current player
		this.direction = 1; // 1 = forward, -1 = reverse
		this.state = 'WAITING'; // 'WAITING' or 'PLAYING'
		
		this.currentColor = ''; // Active color (red, blue, green, yellow)
		this.currentValue = -1; // Active card value (0-14)
		
		this.waitingForWild = false;
		this.waitingForWildPlayer = null;
		
		this.lastPlayTime = Date.now();
	}
	
	// Join lobby
	join(playerId, playerName) {
		if (this.state !== 'WAITING') return 'GAME_STARTED';
		if (this.players.some(p => p.id === playerId)) return 'ALREADY_JOINED';
		if (this.players.length >= 8) return 'ROOM_FULL';
		
		this.players.push({
			id: playerId,
			name: playerName,
			cards: []
		});
		this.lastPlayTime = Date.now();
		return 'SUCCESS';
	}
	
	// Leave lobby or active game
	leave(playerId) {
		const index = this.players.findIndex(p => p.id === playerId);
		if (index === -1) return 'NOT_IN_ROOM';
		
		const player = this.players[index];
		
		// If playing, return cards to the deck
		if (this.state === 'PLAYING') {
			this.deck.push(...player.cards);
			this.shuffle(this.deck);
		}
		
		this.players.splice(index, 1);
		
		if (this.players.length < 2 && this.state === 'PLAYING') {
			this.state = 'ENDED';
			return 'GAME_ENDED'; // Game must end
		}
		
		// Adjust turn pointer if player was removed
		if (this.state === 'PLAYING') {
			if (this.currentTurn >= this.players.length) {
				this.currentTurn = 0;
			} else if (this.currentTurn === index && this.direction === -1) {
				// Adjust for reverse direction if current turn index was deleted
				this.currentTurn = (index - 1 + this.players.length) % this.players.length;
			}
		}
		
		this.lastPlayTime = Date.now();
		return 'SUCCESS';
	}
	
	// Start the game
	start() {
		if (this.state !== 'WAITING') return 'GAME_STARTED';
		if (this.players.length < 2) return 'TOO_FEW_PLAYERS';
		
		this.deck = this.generateDeck();
		
		// Deal 7 cards to each player
		for (let i = 0; i < 7; i++) {
			for (const player of this.players) {
				player.cards.push(this.deck.pop());
			}
		}
		
		// Draw first card (must be a normal colored card 0-9)
		let firstCard;
		let searchIndex = this.deck.length - 1;
		while (searchIndex >= 0) {
			const card = this.deck[searchIndex];
			const match = card.match(/^([a-z]+)(\d+)$/i);
			if (match) {
				const color = match[1];
				const val = parseInt(match[2]);
				if (color !== 'wild' && val <= 9) {
					firstCard = card;
					this.deck.splice(searchIndex, 1);
					break;
				}
			}
			searchIndex--;
		}
		
		// Fallback in case we couldn't find a normal card
		if (!firstCard) {
			firstCard = 'red5';
		}
		
		this.discardPile.push(firstCard);
		const parsed = this.parseCard(firstCard);
		this.currentColor = parsed.color;
		this.currentValue = parsed.value;
		
		// Randomize starting player
		this.currentTurn = Math.floor(Math.random() * this.players.length);
		this.direction = 1;
		this.state = 'PLAYING';
		this.lastPlayTime = Date.now();
		return 'SUCCESS';
	}
	
	// Create and shuffle standard UNO deck
	generateDeck() {
		const deck = [];
		const colors = ['red', 'blue', 'green', 'yellow'];
		
		for (const color of colors) {
			// One 0 card
			deck.push(`${color}0`);
			
			// Two of each 1-9
			for (let i = 1; i <= 9; i++) {
				deck.push(`${color}${i}`);
				deck.push(`${color}${i}`);
			}
			
			// Two of Skip, Reverse, Draw 2
			for (let i = 10; i <= 12; i++) {
				deck.push(`${color}${i}`);
				deck.push(`${color}${i}`);
			}
		}
		
		// Four Wild, Four Wild Draw 4
		for (let i = 0; i < 4; i++) {
			deck.push(`wild13`);
			deck.push(`wild14`);
		}
		
		return this.shuffle(deck);
	}
	
	shuffle(deck) {
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
		return deck;
	}
	
	// Check if a card can be played
	canPlay(card) {
		const parsed = this.parseCard(card);
		if (parsed.color === 'wild') return true; // Wild cards always playable
		
		return parsed.color === this.currentColor || parsed.value === this.currentValue;
	}
	
	// Get current active player
	getCurrentPlayer() {
		return this.players[this.currentTurn];
	}
	
	// Play card
	play(playerId, card) {
		const player = this.getCurrentPlayer();
		if (player.id !== playerId) return 'NOT_YOUR_TURN';
		if (this.waitingForWild) return 'WAITING_FOR_COLOR';
		
		const cardIndex = player.cards.indexOf(card);
		if (cardIndex === -1) return 'NOT_IN_HAND';
		if (!this.canPlay(card)) return 'INVALID_CARD';
		
		// Remove from hand and add to discard pile
		player.cards.splice(cardIndex, 1);
		this.discardPile.push(card);
		this.lastPlayTime = Date.now();
		
		const parsed = this.parseCard(card);
		this.currentValue = parsed.value;
		
		// If Wild Card
		if (parsed.color === 'wild') {
			this.waitingForWild = true;
			this.waitingForWildPlayer = playerId;
			return 'CHOOSE_COLOR';
		}
		
		// Colored card
		this.currentColor = parsed.color;
		
		// Handle Action Effects
		if (parsed.value === 10) { // Skip
			this.nextTurn(2);
		} else if (parsed.value === 11) { // Reverse
			if (this.players.length === 2) {
				this.nextTurn(2); // In 2-player game, Reverse works like Skip
			} else {
				this.direction *= -1;
				this.nextTurn(1);
			}
		} else if (parsed.value === 12) { // Draw 2
			this.nextTurn(1);
			const nextPlayer = this.getCurrentPlayer();
			this.drawCardsForPlayer(nextPlayer, 2);
			this.nextTurn(1); // Skip the player who drew
		} else { // Normal card
			this.nextTurn(1);
		}
		
		return 'SUCCESS';
	}
	
	// Handle color choice for Wild cards
	setWildColor(playerId, chosenColor) {
		if (!this.waitingForWild || this.waitingForWildPlayer !== playerId) return 'NOT_AUTHORIZED';
		
		const validColors = ['red', 'blue', 'green', 'yellow'];
		if (!validColors.includes(chosenColor)) return 'INVALID_COLOR';
		
		this.currentColor = chosenColor;
		this.waitingForWild = false;
		this.waitingForWildPlayer = null;
		this.lastPlayTime = Date.now();
		
		// Apply wild card action effects
		if (this.currentValue === 14) { // Wild Draw 4
			this.nextTurn(1);
			const nextPlayer = this.getCurrentPlayer();
			this.drawCardsForPlayer(nextPlayer, 4);
			this.nextTurn(1); // Skip the player who drew
		} else { // Normal Wild
			this.nextTurn(1);
		}
		
		return 'SUCCESS';
	}
	
	// Draw card by player choice
	draw(playerId) {
		const player = this.getCurrentPlayer();
		if (player.id !== playerId) return { status: 'NOT_YOUR_TURN' };
		if (this.waitingForWild) return { status: 'WAITING_FOR_COLOR' };
		
		const card = this.drawCardsForPlayer(player, 1)[0];
		this.lastPlayTime = Date.now();
		
		// Draw passes turn automatically to keep WhatsApp game fast
		this.nextTurn(1);
		
		return { status: 'SUCCESS', card };
	}
	
	// Helper to draw N cards for a player
	drawCardsForPlayer(player, count) {
		const drawn = [];
		for (let i = 0; i < count; i++) {
			if (this.deck.length === 0) {
				// Reshuffle discard pile except top card
				const topCard = this.discardPile.pop();
				this.deck = this.shuffle(this.discardPile);
				this.discardPile = [topCard];
			}
			if (this.deck.length > 0) {
				const card = this.deck.pop();
				player.cards.push(card);
				drawn.push(card);
			}
		}
		return drawn;
	}
	
	// Move turn pointer
	nextTurn(steps = 1) {
		this.currentTurn = (this.currentTurn + steps * this.direction) % this.players.length;
		while (this.currentTurn < 0) {
			this.currentTurn = (this.currentTurn + this.players.length) % this.players.length;
		}
	}
	
	// Parse card JID-like string
	parseCard(card) {
		const match = card.match(/^([a-z]+)(\d+)$/i);
		if (!match) return { color: 'wild', value: 13 };
		return {
			color: match[1].toLowerCase(),
			value: parseInt(match[2])
		};
	}
	
	// Check if any player won
	checkWinner() {
		const winner = this.players.find(p => p.cards.length === 0);
		return winner ? winner : null;
	}
	
	// Format card for display (Indonesian text with Emojis)
	static formatCard(card) {
		if (!card) return 'Tidak ada';
		const match = card.match(/^([a-z]+)(\d+)$/i);
		if (!match) return card;
		
		const color = match[1].toLowerCase();
		const val = parseInt(match[2]);
		
		const CARD_NAMES = {
			0: '0', 1: '1', 2: '2', 3: '3', 4: '4',
			5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
			10: 'Skip 🚫',
			11: 'Reverse 🔁',
			12: 'Draw 2 ➕2',
			13: 'Wild 🌈',
			14: 'Wild Draw 4 🌈➕4'
		};

		const CARD_COLORS = {
			red: 'Merah 🔴',
			blue: 'Biru 🔵',
			green: 'Hijau 🟢',
			yellow: 'Kuning 🟡',
			wild: 'Spesial ✨'
		};
		
		const colorName = CARD_COLORS[color] || color;
		const valName = CARD_NAMES[val] || val;
		
		if (color === 'wild') {
			return valName;
		}
		return `${colorName} ${valName}`;
	}
	
	// Map card to its local media filename in src/media/uno/
	static getCardFileName(card) {
		if (!card) return 'empty.png';
		return card + '.png';
	}
}

export default UnoGame;
