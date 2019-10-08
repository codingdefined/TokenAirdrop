const steem = require('steem');
const dsteem = require('dsteem');
const client = new dsteem.Client('https://api.steemit.com')

const fs = require("fs");
const SSC = require("sscjs");
const config = require("./config.js").config;

const ssc = new SSC('https://api.steem-engine.com/rpc');

var delegation_transactions = [];
loadDelegations(client, config.account);

function loadDelegations(client, account) {
  getTransactions(client, account, -1);
}

function getTransactions(client, account, start) {
  var last_trans = start;
	console.log('Loading history for delegators at transaction: ' + (start < 0 ? 'latest' : start));
  
  client.database.call('get_account_history', [account, start, (start < 0) ? 10000 : Math.min(start, 10000)]).then(function (result) {
        result.reverse();
		for(var i = 0; i < result.length; i++) {
			var trans = result[i];
        var op = trans[1].op;

        if(op[0] == 'delegate_vesting_shares' && op[1].delegatee == account)
            delegation_transactions.push({ id: trans[0], data: op[1] });
        last_trans = trans[0];
    }
		
    if(last_trans > 0 && last_trans != start)
      getTransactions(client, account, last_trans);
    else {
		if(last_trans > 0) {
			console.log('********* ALERT - Full account history not available from this node, not all delegators may have been loaded!! ********');
			console.log('********* Last available transaction was: ' + last_trans + ' ********');
		}
			
        processDelegations();
	}
  }, function(err) { console.log('Error loading account history for delegations: ' + err); });
}

async function processDelegations() {
  var delegations = [];
  delegation_transactions.reverse();
  for(var i = 0; i < delegation_transactions.length; i++) {
    var trans = delegation_transactions[i];
    var delegation = delegations.find(d => d.delegator == trans.data.delegator);

    if(delegation) {
      delegation.vesting_shares = trans.data.vesting_shares;
    } else {
      delegations.push({ delegator: trans.data.delegator, vesting_shares: trans.data.vesting_shares });
    }
  }

  delegation_transactions = [];

  let totalSPDelegation = 0;
  
  await client.database.call('get_dynamic_global_properties').then(function(result) {
      delegations.forEach(value => {
          value.SP = ( parseFloat(result.total_vesting_fund_steem) * parseFloat(value.vesting_shares) ) / parseFloat(result.total_vesting_shares);
          totalSPDelegation += value.SP;
      })
  });
  
  delegations.forEach(value => {
        let amountToSend = ((config.totalToken * value.SP) /  totalSPDelegation);
        value.AmountToSend = amountToSend.toFixed(2);
  });

  let filterDelegations = delegations.filter(function(element) {
    return element.AmountToSend > 0;
  });

  send(filterDelegations);
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}
  

function send(result){
    if (config.mode.toLowerCase() != "issue" && config.mode.toLowerCase() != "transfer"){
        callback("Please only use issue or transfer in the mode in config.")
        return;
    }
    asyncForEach(result, async element => {
        var sendJSON = {"contractName":"tokens","contractAction":config.mode.toLowerCase() ,"contractPayload":{"symbol": config.tokenSymbol,"to": element.delegator,"quantity": element.AmountToSend,"memo":"Test"}}
        await steem.broadcast.customJson(config.accountPrivateActiveKey, [config.accountName], null, "ssc-mainnet1", JSON.stringify(sendJSON), function(err, result) {
            if (!err){
                console.log(`Sent ${element.amountToSend} to ${element.author}.`)
            } else {
                console.log(`Error sending ${element.amountToSend} to ${element.author}.`)
            }
        });
        console.log(sendJSON);
        await sleep(3500);
    })
}

