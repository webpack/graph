/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var Graph = require("./Graph");

exports.use = function(json) {
	var graph = new Graph({
		width: window.innerWidth,
		height: window.innerHeight
	}).load(json);

	exports.paused = false;
	exports.STEPS_PER_TICK = 1;

	graph.normalizePositions();
	graph.applyTo(document);

	setTimeout(function tick() {
		if(!exports.paused) {
			for(var i = 0; i < exports.STEPS_PER_TICK; i++)
				graph.simulateStep();
		} else if(exports.single) {
			exports.single = false;
			graph.simulateStep();
		}
		graph.normalizePositions();
		graph.applyTo(document);
		setTimeout(tick, 1);
	}, 100);
	return graph;
}

exports.Graph = Graph;