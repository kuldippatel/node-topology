/**
 * Created by kpatel on 10/29/17.
 */

var loadConfig = function(node){
    var path = './config/' + String(node) + '.json';
    var config = require(path);
    return config;
}

var getAdjList = function(name) {
    var queue = [name]
    while(queue.length > 0){
        var curr = queue.shift();
        console.log('Processing node =>  ' + curr);
        var node = loadConfig(curr);
        visitedNodes.push(curr);
        for(i = 0; i < node.peers.length; ++i){
            var p = loadConfig(node.peers[i].name)
            var node_x, node_y;
            if(node.name < p.name){
                node_x = node.name;
                node_y = p.name;
            }else{
                node_x = p.name;
                node_y = node.name;
            }
            var edge = node_x + '-' + node_y;
            if(adjList.indexOf(edge)<0){
                adjList.push(edge);
            }

            if(visitedNodes.indexOf(p.name)>=0){
                continue;
            }
            queue.push(p.name);
        }
    }
}

var args = process.argv.slice(2);
var config = loadConfig(args[0])
//console.log(config);
var adjList = []
var visitedNodes = []

getAdjList(args[0]);
console.log('-----FINAL TOPOLOGY-----')
console.log(adjList.sort());
