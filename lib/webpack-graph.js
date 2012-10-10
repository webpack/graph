/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

var Graph = require("./Graph");
var interactiveSource = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "interactive.js"), "utf-8");

module.exports = function webpackGraph(stats, options) {
	options = options || {};
	var svg = [];

	var MAX_STEPS = options.maxSteps || (options.interactive ? 0 : 5000);

	var graph = new Graph(options, stats);

	var movement, i = 0;
	if(MAX_STEPS > 0)
	do {
		i++;
		movement = graph.simulateStep();
		var progress = Math.max(0, 1 - movement / 1000);
		progress = Math.floor(progress * progress * 100);
		var progress2 = Math.floor(i * 100 / MAX_STEPS);
		process.stderr.write("\b \b\b\b\b" + Math.max(progress, progress2) + "%");
	} while((i < 10 || movement > 10) && i < MAX_STEPS);

	graph.normalizePositions();

	graph.writeSVG(svg);

	if(options.interactive) {
		var end = svg.pop();
		svg.push('<script type="text/ecmascript">');
		svg.push(xmlEscape(interactiveSource));
		svg.push(xmlEscape(";var graph = wpg.use(" + JSON.stringify(graph) + ")"));
		svg.push('</script>');
		svg.push(end);
	}

	if(!options.outputStream) return svg.join("");
}

function xmlEscape(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}