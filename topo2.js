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
		result.push(tokens[key]);
	}
	console.log('##### TOPOLOGY SO FAR  #####');
	console.log(result);
}

var processData = function(socket, data){
	console.log('Processing data =>' + data);
	var tokens = data.split(':');
	if(tokens[0] == 'REGISTER-NAME'){
		socket.name = tokens[1];
		peerSockets[socket.id] = socket;
		printPeers(peerSockets);
		socket.write('ACK:NAME-NOTED')
	}else if(tokens[0] == 'ACK'){
		var msg = 'GET-TOPOLOGY:' + config.name;
		topologySignalsSentTo[socket.name] = msg;
		socket.write(msg);
	}else if(tokens[0] == 'GET-TOPOLOGY') {
		topologySignalsRcvdFrom[socket.name] = data;
		var isForwarded = false;
		var nodesSoFar = tokens[1].split(',');
		for (key in peerSockets) {
			var isFound = false;
			// Do not send it to any node where this signal has passed through
			for (index in nodesSoFar) {
				if (nodesSoFar[index] == peerSockets[key].name) {
					isFound = true;
					break;
				}
			}
			// Don't send it get topology to the ones we received from
			for (index in topologySignalsRcvdFrom) {
				if (topologySignalsRcvdFrom[index] == peerSockets[key].name) {
					isFound = true;
					break;
				}
			}
			if (isFound) {
				continue;
			}
			var msg = data + ',' + config.name;
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
			var msg = 'PEERS-LIST:' + tokens[1] + ',' + config.name + ':' + peersList;
			console.log(msg);
			socket.write(msg);
		}
	}else if(tokens[0] == 'PEERS-LIST') {
				var nodesSoFar = tokens[1].split(',');
				peersSignalsRcvdFrom[socket.name] = tokens[2];
				totalSent = Object.keys(topologySignalsSentTo).length;
				totalReceived = Object.keys(peersSignalsRcvdFrom).length;

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
								var msg = 'PEERS-LIST:' + tokens[1] + ':' + peersList;
								peerSockets[key].write(msg);
								console.log('FWD=> ' +  peerSockets[key].name + ' ' +  msg)
								break;//Reply to sender when all neighbors responded and break
							}
						}
					}
				}
		}else {
		console.log('unknown command signal');
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

	console.log('Connecting to: ' + node.name);
	var clientSocket = new net.Socket();
	clientSocket.connect(node.port, node.ip, function () {
		console.log('Connected to:' + node.name);
		clientSocket.setNoDelay(true)
		addToPeerSockets(clientSocket, node.name);
		clientSocket.write('REGISTER-NAME:' + config.name );
		//clientSocket.write('GET-TOPOLOGY:' + config.name );
	});

	clientSocket.on('data', function (data) {
		//console.log('\nReceived: ' + data);
		processData(clientSocket, String(data));
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

for(i = 0; i < peers.length; ++i){
	connectToPeers(peers[i]);
}


var server = net.createServer(function(serverSocket) {
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
		processData(serverSocket, String(data));

})
	//clientSocket.destroy(); // kill clientSocket after server's response}	
});

console.log('-----NODE ' + config.name + ' is UP -----');
server.listen(config.port, config.ip);
