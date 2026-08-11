const currentBal = 10;
const wager = 3.5;
const win = true;
const multiplier = 1.8;
const winnings = wager * multiplier;
console.log("winnings:", winnings);
const newBal = currentBal - wager + winnings;
console.log("newBal:", newBal);
