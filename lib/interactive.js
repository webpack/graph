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

	var draggingNode = null;
	var draggingPos = null;

	graph.modulesList.forEach(function(node, idx) {
		var el = document.getElementById("module"+idx);
		el.addEventListener("mousedown", mouseDownHandler.bind(null, node));
	});
	document.addEventListener("mousemove", mouseMoveHandler);
	document.addEventListener("mouseup", mouseUpHandler);

	function mouseDownHandler(node, event) {
		draggingNode = node;
		mouseMoveHandler(event);
	}
	function mouseMoveHandler(event) {
		if(!draggingNode) return;
		var x = event.clientX, y = event.clientY;
		x -= graph.MODULE_MAX_R;
		y -= graph.MODULE_MAX_R;
		x /= graph.scale;
		y /= graph.scale;
		draggingPos = [x, y];
		draggingNode.pos[0] = draggingPos[0];
		draggingNode.pos[1] = draggingPos[1];
	}
	function mouseUpHandler() {
		draggingNode = null;
	}

	setTimeout(function tick() {
		if(!exports.paused) {
			for(var i = 0; i < exports.STEPS_PER_TICK; i++) {
				graph.simulateStep();
				if(draggingNode) {
					draggingNode.pos[0] = draggingPos[0];
					draggingNode.pos[1] = draggingPos[1];
				}
			}
		} else if(exports.single) {
			exports.single = false;
			graph.simulateStep();
		}
		if(!draggingNode)
			graph.normalizePositions();
		graph.applyTo(document);
		setTimeout(tick, 1);
	}, 100);
	return graph;
}

exports.Graph = Graph;