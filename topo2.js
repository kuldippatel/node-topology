/*
 Node network topology
 */

var loadConfig = function(node){
	var path = './config/' + String(node) + '.json';
	var config = require(path);
	return config;
}


var printTopoLogyAfterCleaning = function(adjList) {
	var tokens = adjList.split(',');
	var result = [];
	for (key in tokens) {
		if (tokens[key] == '') {
			continue;
		}
		var nodes = tokens[key].split('-');
		var isDuplicate = false;
		for(i in result){
			var nodesRes = result[i].split('-');
			if(( nodes[0]==nodesRes[0] && nodes[1]==nodesRes[1]) || ( nodes[0]==nodesRes[1] && nodes[1]==nodesRes[0])){
				isDuplicate = true;
			}
		}
		if(isDuplicate){
			continue;
		}
		if(nodes[0] < nodes[1]){
			result.push(tokens[key]);
		}else {
			result.push(nodes[1] + '-' + nodes[0]);
		}

	}
	console.log('##### TOPOLOGY SO FAR  #####');
	console.log(result.sort());
}

var processData = function(socket, data){
	console.log('Processing data from: ' + socket.name + '\t' + data);
	var tokens = data.split(':');
	if(tokens[0] == 'REGISTER-NAME'){
		socket.name = tokens[1];
		peerSockets[socket.id] = socket;
		printPeers(peerSockets);
		socket.write('ACK:NAME-NOTED' + endChar)
	}else if(tokens[0] == 'ACK'){
		var msg = 'GET-TOPOLOGY:' + config.name + endChar;
		topologySignalsSentTo[socket.name] = msg;
		socket.write(msg);
	}else if(tokens[0] == 'OK'){
		console.log('OK, DO NOTHING FOR signal from ' + socket.name);
	}else if(tokens[0] == 'GET-TOPOLOGY') {
		var isForwarded = false;
		var nodesSoFar = tokens[1].split(',');
		if(nodesSoFar[0]!=lastSignalRecvdFrom){
				//Clean previous signals/lists
				console.log('Cleaned\n\n\n\n');
				topologySignalsSentTo = {};
				topologySignalsRcvdFrom = {};
				peersSignalsSentTo = {};
				peersSignalsRcvdFrom = {};
		}
		topologySignalsRcvdFrom[socket.name] = data;
		lastSignalRecvdFrom = nodesSoFar[0];
		for (key in peerSockets) {
			var isFound = false;
			// Do not send it to any node where this signal has passed through
			if(nodesSoFar.indexOf(peerSockets[key].name)>=0){
				continue;
			}
			// Don't send it get topology to the ones we received from
			if (Object.keys(topologySignalsRcvdFrom).indexOf(peerSockets[key].name) >=0) {
				continue;
			}
			// Don't send it get topology to the ones we already sent
			if (Object.keys(topologySignalsSentTo).indexOf(peerSockets[key].name) >=0) {
				continue;
			}

			var msg = data + ',' + config.name + endChar;
			peerSockets[key].write(msg);
			topologySignalsSentTo[peerSockets[key].name] = msg;
			isForwarded = true;
			console.log('FWD to ' +  peerSockets[key].name + ' => ' + msg )
		}
		if (isForwarded == false) {
			var peersList = '';
			for (key in peerSockets) {
				peersList += config.name + '-' + peerSockets[key].name + ','
			}
			var msg = 'PEERS-LIST:' + tokens[1] + ',' + config.name + ':' + peersList + endChar;
			console.log('Replying to: ' + socket.name + ' with => ' + msg);
			socket.write(msg);
		}else{
			socket.write('OK:DO NOTHING' + endChar);
		}
	}else if(tokens[0] == 'PEERS-LIST') {
		var nodesSoFar = tokens[1].split(',');
		peersSignalsRcvdFrom[socket.name] = tokens[2];
		totalSent = Object.keys(topologySignalsSentTo).length;
		totalReceived = Object.keys(peersSignalsRcvdFrom).length;

		console.log('TOTAL SENT: ' + totalSent);
		console.log('TOTAL RECVD: ' + totalReceived);
		if(totalReceived == totalSent){
			var peersList = '';
			//append peers list
			for(key in peersSignalsRcvdFrom){
				peersList += peersSignalsRcvdFrom[key] + ','
			}

			//If it is originated by me then compile
			if(tokens[1].split(',')[0]==config.name){
				printTopoLogyAfterCleaning(peersList);
			}else {//Else pass it back
				var prevNode = '';
				for(index in nodesSoFar){
					if(nodesSoFar[index] == config.name){
						break;//If your own node found in list, break
					}
					prevNode = nodesSoFar[index];
				}

				peersList += config.name + '-' + prevNode + ',';

				for (key in peerSockets) {
					if (peerSockets[key].name == prevNode) {
						var msg = 'PEERS-LIST:' + tokens[1] + ':' + peersList + endChar;
						peerSockets[key].write(msg);
						console.log('FWD => ' +  peerSockets[key].name + ' ' +  msg)
						break;//Reply to sender when all neighbors responded and break
					}
				}
			}
		}
		socket.write('OK:DO NOTHING' + endChar);
	}else {
		console.log('unknown command signal');
		socket.write('OK:DO NOTHING' + endChar);
	}
}

var printPeers = function (peerSockets) {
	console.log('----MY PEERS LIST---');
	//for(i = 0 ; i < peerSockets.length; ++i){
	for(key in peerSockets){
		console.log(key + ' : ' + peerSockets[key].name);
	}
	console.log('----END---');
}

var addToPeerSockets = function (socket, name) {
	socket.id = Math.floor(Math.random()*1000);
	socket.name = name;
	peerSockets[socket.id] = socket;
	printPeers(peerSockets);
}

var removeFromPeerSockets = function (socket) {
	delete peerSockets[socket.id];
	printPeers(peerSockets)
}


var connectToPeers = function (node) {
	var buffer = '';
	console.log('Connecting to: ' + node.name);
	var clientSocket = new net.Socket();
	clientSocket.connect(node.port, node.ip, function () {
		console.log('Connected to:' + node.name);
		clientSocket.setNoDelay(true)
		addToPeerSockets(clientSocket, node.name);
		clientSocket.write('REGISTER-NAME:' + config.name + endChar );
		//clientSocket.write('GET-TOPOLOGY:' + config.name );
	});

	clientSocket.on('data', function (data) {
		//console.log('\nReceived: ' + data);
		var strData = String(data);
		//console.log('\nstrData c:' + strData);
		for(k in strData){
			if(strData[k]!=endChar){
				buffer += strData[k];
			}else{
				processData(clientSocket, buffer);
				buffer = '';
			}
		}
	});

	clientSocket.on('close', function () {
		console.log('Connection closed with: ' + node.name);
		removeFromPeerSockets(clientSocket);
	});

	clientSocket.on('error', function (ex) {
		console.log('My neighbor is not up yet: ' + node.name);
	});
}

var net = require('net');
//var utils = require('./utils.js')

var lastSignalRecvdFrom = '';
var peerSockets = {};
var topologySignalsSentTo = {};
var topologySignalsRcvdFrom = {};
var peersSignalsSentTo = {};
var peersSignalsRcvdFrom = {};
var wasPeerListPassedOn = false;
var args = process.argv.slice(2);
var config = loadConfig(args[0]);
//console.log(config);
console.log('STARTING THE NODE => ' + config.name);
var peers  = config.peers
var endChar = '.';

for(i = 0; i < peers.length; ++i){
	connectToPeers(peers[i]);
}


var server = net.createServer(function(serverSocket) {
	var buffer=''
	console.log('New node is connected\n');
	serverSocket.setNoDelay(true)
	addToPeerSockets(serverSocket, 'NO-NAME-YET');

	// On Close
	serverSocket.on('close', function() {
		// disconnected
		console.log('disconnected');
		removeFromPeerSockets(serverSocket)
	});

	// On data
	serverSocket.on('data', function(data) {
		//console.log('\nServer Socket Received: ' + data);
		var strData = String(data);
		//console.log('\nstrData:' + strData);
		for(k in strData){
			if(strData[k]!=endChar){
				buffer += strData[k];
			}else{
				processData(serverSocket, buffer);
				buffer = '';
			}
		}
	})
	//clientSocket.destroy(); // kill clientSocket after server's response}	
});

console.log('-----NODE ' + config.name + ' is UP -----');
server.listen(config.port, config.ip);
