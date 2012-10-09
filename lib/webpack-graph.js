/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var VERY_SMALL = 0.00001;

var COLORS = [];

for(var r = 0; r < 255; r+= 80) {
	for(var g = 0; g < 255; g+= 80) {
		for(var b = 0; b < 255; b+= 80) {
			if(r+g+b >= 100 && r+g+b <= 550)
				COLORS.push([r, g, b]);
		}
	}
}

var Node = require("./Node");

module.exports = function webpackGraph(stats, options) {
	options = options || {};

	var FORCE_INTER = 100000;
	var FORCE_HIT = 0.01;
	var FORCE_LINK = 0.001;
	var LINK_DISTANCE_PER = 20;
	var LINK_DISTANCE_BASE = 100;
	var LINK_DISTANCE_ASYNC = 500;
	var INITIAL_POS_X = options.initalX || 100;
	var INITIAL_POS_Y = options.initalY || 200;
	var MIN_DISTANCE = 30;
	var MAX_STEPS = options.maxSteps || 1000;
	var colors = [];
	colors.push.apply(colors, options.colors || COLORS);
	var nameShortener = options.nameShortener || function(a) { return a };

	var svg = [], svgModules = [], svgDependencies = [];

	if(options.outputStream) {
		svg = {
			push: function() {
				for(var i = 0; i < arguments.length; i++) {
					options.outputStream.write(arguments[i], "utf-8");
				}
			},
			join: function() {
				return;
			}
		}
	}

	var modules = {};
	var modulesList = [];

	for(var i = 0; i < stats.modulesCount; i++) {
		var node = new Node(i, stats);
		if(!node.name) {
			continue;
		}
		modules[node.name] = node;
		modulesList.push(node);
	}

	modulesList.forEach(function(node) {
		node.resolveLinks(modules);
	});
	modulesList.forEach(function(node) {
		node.propageLinks();
	});

	var layer = 1, position = 0;
	var queue = [modulesList[0], null];
	queue[0].pos = [0, 0];
	while(queue.length > 1) {
		var node = queue.shift();

		if(!node) {
			queue.push(null);
			layer++; position = 0;
			continue;
		}

		node.links.forEach(function(node2) {
			if(!node2.pos) {
				node2.pos = [(position++) * INITIAL_POS_X, layer * INITIAL_POS_Y];
				queue.push(node2);
			}
		});

	}

	var movement, i = 0;
	do {
		i++;
		movement = 0;
		modulesList.forEach(function(node) {
			modulesList.forEach(function(node2) {
				if(node === node2) return;
				var distance = node.dist(node2);
				if(distance < VERY_SMALL) {
					node.applyForce([0.5-Math.random(), 0.5-Math.random()], FORCE_HIT * MIN_DISTANCE);
				} else {
					var vector = node2.vector(node, 1/distance);
					if(distance < MIN_DISTANCE) {
						node.applyForce(vector, FORCE_HIT * (MIN_DISTANCE - distance));
					}
					node.applyForce(vector, FORCE_INTER/distance/distance);
				}
			});
			node.links.forEach(function(node2) {
				if(node === node2) return;
				var distance = node.dist(node2);
				var async = node.linksAsync[node2.name] || node2.linksAsync[node.name];
				var linkDistance = async ? LINK_DISTANCE_ASYNC : LINK_DISTANCE_BASE;
				var libaryIndex = (node.libaryIndex + node2.libaryIndex);
				if(distance < VERY_SMALL) {
					node.applyForce([0.5-Math.random(), 0.5-Math.random()], FORCE_LINK * linkDistance / libaryIndex / libaryIndex);
				} else {
					node.applyForce(node.vector(node2, 1/distance), FORCE_LINK * (distance - linkDistance) / libaryIndex / libaryIndex);
				}
			});
		});
		modulesList.forEach(function(node) {
			movement += node.applyForce();
		});
	} while((i < 10 || movement > 1) && i < MAX_STEPS);

	var min = [modulesList[0].pos[0], modulesList[0].pos[1]];
	var max = [modulesList[0].pos[0], modulesList[0].pos[1]];
	modulesList.forEach(function(node) {
		if(node.pos[0] < min[0]) min[0] = node.pos[0];
		if(node.pos[1] < min[1]) min[1] = node.pos[1];
		if(node.pos[0] > max[0]) max[0] = node.pos[0];
		if(node.pos[1] > max[1]) max[1] = node.pos[1];
	});
	min[0] -= 120;
	min[1] -= 120;
	max[0] += 120;
	max[1] += 120;
	var scale = Math.min(
		(options.width || 1680) / (max[0] - min[0]),
		(options.height || 1050) / (max[1] - min[1])
	);
	modulesList.forEach(function(node) {
		node.pos[0] -= min[0];
		node.pos[1] -= min[1];
		node.pos[0] *= scale;
		node.pos[1] *= scale;
	});

	var colorsMap = {};
	function getColor(chunks) {
		var name = chunks.join(" ");
		if(colorsMap[name]) return colorsMap[name];
		if(colors.length == 0) colors.push.apply(colors, options.colors || COLORS);
		return colorsMap[name] = colors.pop();
	}
	function colorName(color) {
		return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
	}


	svg.push('<?xml version="1.0" encoding="UTF-8"?>');
	svg.push('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" baseProfile="full" width="',(max[0]-min[0])*scale,'" height="',(max[1]-min[1])*scale,'">');
	modulesList.forEach(function(node, nodeidx) {
		svgModules.push('<circle id="module',nodeidx,'" cx="', node.pos[0], '" cy="', node.pos[1], '" r="',Math.max(30, Math.min(100, Math.sqrt(node.size)))*scale,'" ');
		svgModules.push('fill="',colorName(getColor(node.files)),'" stroke-width="1" onmouseover="a(',nodeidx,',',node.links.length,')" onmouseout="c()">');
		svgModules.push('<title>',nameShortener(node.name).split("!").join("\n\n")+'\n\nChunks:\n' + node.files.join("\n"),'</title></circle>');
		node.links.forEach(function(node2, linkidx) {
			var libaryIndex = (node.libaryIndex + node2.libaryIndex);
			var async = node.linksAsync[node2.name] || node2.linksAsync[node.name];
			var className = async ? "async " : ""
			if(node.linksWeight[node2.name])
				svg.push('<line class="',className,'" x1="',node.pos[0],'" y1="',node.pos[1],'" x2="',node2.pos[0],'" y2="',node2.pos[1],'" style="stroke-width:',1/libaryIndex,'"/>')
			if(node.linksWeight[node2.name] && node2.linksWeight[node.name])
				className += "reqdep";
			else if(node.linksWeight[node2.name])
				className += "dep";
			else if(node2.linksWeight[node.name])
				className += "req";
			svgDependencies.push('<line class="',className,'" id="module',nodeidx,'link',linkidx,'" x1="',node.pos[0],'" y1="',node.pos[1],'" x2="',node2.pos[0],'" y2="',node2.pos[1],'"/>')
		});
	});
	svgDependencies.forEach(function(i) {
		svg.push(i);
	});
	svgModules.forEach(function(i) {
		svg.push(i);
	});
	svg.push('<script type="text/ecmascript">');
	svg.push('function addHover(node) {');
	svg.push('node.setAttribute(&quot;class&quot;, node.getAttribute(&quot;class&quot;) + " hover")');
	svg.push('}');

	svg.push('function removeHover(node) {');
	svg.push('var className = node.getAttribute(&quot;class&quot;).split(" ");');
	svg.push('className.splice(className.indexOf(&quot;hover&quot;), 1);');
	svg.push('node.setAttribute(&quot;class&quot;, className.join(" "))');
	svg.push('}');

	svg.push('function a(node, links) {');
	svg.push('document.getElementById(&quot;module&quot; + node).setAttribute(&quot;class&quot;,&quot;hover&quot;);');
	svg.push('for(var i = 0; i &lt; links; i++) {');
	svg.push('var link = document.getElementById(&quot;module&quot; + node + &quot;link&quot; + i);\nif(link) addHover(link);');
	svg.push('}');
	svg.push('}');
	svg.push('function c() {');
	svg.push('var elements = Array.prototype.slice.call(document.getElementsByClassName(&quot;hover&quot;));');
	svg.push('for(var i = 0; i &lt; elements.length; i++) removeHover(elements[i]);');
	svg.push('}');
	svg.push('</script>');
	svg.push('<style type="text/css">');
	svg.push('line { stroke:black;}');
	svg.push('circle { stroke:black; stroke-width: 1}');
	svg.push('.dep, .req, .reqdep { stroke-width:0; }');
	svg.push('.async { stroke-dasharray: 4 4; }');
	svg.push('.reqdep.hover { stroke:#660; stroke-width: 3; }');
	svg.push('.req.hover { stroke:red; stroke-width: 3; }');
	svg.push('.dep.hover { stroke:green; stroke-width: 3; }');
	svg.push('circle.hover { stroke:blue; stroke-width: 1; }');
	svg.push('</style>');
	svg.push('</svg>');


	return svg.join("");
}