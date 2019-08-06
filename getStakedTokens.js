const SSC = require("sscjs");
const ssc = new SSC('https://api.steem-engine.com/rpc');
const fs = require("fs");

let uniqueAuthor = [];
let totalStake = 0;
let amountToSend = "0";
let accounToSkip = ['excel-lent','reality.curate','realityhubs','tykee','funny-ckole','iamtykee','knowledges'];
ssc.find('tokens', 'balances', { symbol: 'RHB' }, 1000, 0, [], (err, result) => {
  if(err)
    console.log(err);
  result.forEach((data) => {
    if(parseFloat(data.stake) > 0 && !accounToSkip.includes(data.account)) {
      totalStake += parseInt(data.stake);
      amountToSend = data.stake.toString();
      let author = data.account;
      uniqueAuthor.push({author, amountToSend });
    }
  });
  uniqueAuthor.forEach((data) => {
    data.amountToSend = ((data.amountToSend * 100000) / totalStake).toFixed(2).toString();
  })
  fs.writeFile('ToSend.txt', JSON.stringify(uniqueAuthor), (err) => {
    if (err) throw err;
    console.log('The file has been saved!');
  });
});