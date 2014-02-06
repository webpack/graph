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

function Graph(options, stats) {

	if(!options) options = {};
	this.options = options;

	this.FORCE_INTER = 2;
	this.FORCE_HIT = 0.1;
	this.FORCE_LINK = 0.02;
	this.LINK_DISTANCE_EXTRA = 300;
	this.LINK_DISTANCE_BASE = 300;
	this.LINK_DISTANCE_ASYNC = 500;
	this.MODULE_SCALE = 2;
	this.MODULE_MIN_R = 5;
	this.MODULE_MAX_R = 20;
	this.INITIAL_POS_X = options.initalX || 600;
	this.INITIAL_POS_Y = options.initalY || 7000;
	this.MIN_DISTANCE = 400;
	this.colors = options.colors || COLORS;
	this.nameShortener = options.nameShortener || function(a) { return a };


	if(stats) this.init(stats);
}
Graph.Node = Node;

Graph.prototype.getColor = function(chunks, from, map) {
	var colors = from;
	var colorsMap = map;
	var name = chunks.join(" ");
	if(colorsMap[name]) return colorsMap[name];
	if(colors.length == 0) colors.push.apply(colors, options.colors || COLORS);
	return colorsMap[name] = colors.pop();
}

Graph.prototype._colorName = function(color) {
	return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
}

Graph.prototype.init = function(stats) {

	var modulesList = this.modulesList = [];

	for(var i = 0; i < stats.modules.length; i++) {
		var node = Node.createFromStats(i, stats);
		if(!node) {
			continue;
		}
		modulesList.push(node);
	}

	this._prepareNodes();
	this._prepareMaps();

	this.resetPositions();
}

Graph.prototype._prepareNodes = function() {

	var modulesList = this.modulesList;
	var modules = {};
	modulesList.forEach(function(node) {
		modules[node.name || node.id] = node;
	});

	modulesList.forEach(function(node) {
		node.resolveLinks(modules);
	});
	modulesList.forEach(function(node) {
		node.propageLinks();
	});
	modulesList.forEach(function(node) {
		node.prepare();
	});

}

Graph.prototype.resetPositions = function() {

	var modulesList = this.modulesList;

	modulesList.forEach(function(node) {
		node.speed = [0, 0];
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
				node2.pos = [(position++) * this.INITIAL_POS_X, layer * this.INITIAL_POS_Y];
				queue.push(node2);
			}
		}, this);
	}

}

Graph.prototype._prepareMaps = function() {

	var detractionMap = this.detractionMap = {};
	var strongnessMap = this.strongnessMap = {};

	var modulesList = this.modulesList;
	modulesList.forEach(function(node) {
		var currentDetraction = detractionMap[node.id] = {};
		var currentStrongness = strongnessMap[node.id] = {};
		modulesList.forEach(function(node2) {
			if(node === node2) return;
			currentDetraction[node2.id] = node.getDetraction(node2);
		});
		node.links.forEach(function(node2) {
			currentStrongness[node2.id] = node.getStrongness(node2);
		});
	});

}

Graph.prototype.load = function(json) {

	this.colorsMap = json.colorsMap;
	this.scale = json.scale;
	this.modulesList = json.modulesList.map(Node.createFromJSON);

	this._prepareNodes();
	this._prepareMaps();

	return this;
}

Graph.prototype.toJSON = function() {
	return {
		scale: this.scale,
		modulesList: this.modulesList
	}
}

Graph.prototype.simulateStep = function() {
	var movement = 0;
	var modulesList = this.modulesList;
	modulesList.forEach(function(node) {
		modulesList.forEach(function(node2) {
			if(node === node2) return;
			var distance = node.dist(node2);
			var detraction = this.detractionMap[node.id][node2.id];
			if(distance < VERY_SMALL) {
				node.applyForce([0.5-Math.random(), 0.5-Math.random()], this.FORCE_HIT * this.MIN_DISTANCE);
			} else {
				var vector = node2.vector(node, 1/distance);
				var overMin = (this.MIN_DISTANCE - distance);
				if(distance < this.MIN_DISTANCE) {
					node.applyForce(vector, this.FORCE_HIT * overMin);
				}
				node.applyForce(vector, this.FORCE_INTER*this.MIN_DISTANCE*this.MIN_DISTANCE/distance/distance * detraction);
			}
		}, this);
		node.links.forEach(function(node2) {
			if(node === node2) return;
			var distance = node.dist(node2);
			var async = node.asyncLink(node2) || node2.asyncLink(node);
			var linkDistance = async ? this.LINK_DISTANCE_ASYNC : this.LINK_DISTANCE_BASE;
			var strongness = this.strongnessMap[node.id][node2.id];
			linkDistance += this.LINK_DISTANCE_EXTRA / strongness;
			if(distance < VERY_SMALL) {
				node.applyForce([0.5-Math.random(), 0.5-Math.random()], this.FORCE_LINK * linkDistance * strongness);
			} else {
				node.applyForce(node.vector(node2, 1/distance), this.FORCE_LINK * (distance - linkDistance) * strongness);
			}
		}, this);
	}, this);
	modulesList.forEach(function(node) {
		movement += node.applyForce();
	});
	return movement;
}

Graph.prototype.normalizePositions = function() {
	var modulesList = this.modulesList;
	var min = [modulesList[0].pos[0], modulesList[0].pos[1]];
	var max = [modulesList[0].pos[0], modulesList[0].pos[1]];
	modulesList.forEach(function(node) {
		if(node.pos[0] < min[0]) min[0] = node.pos[0];
		if(node.pos[1] < min[1]) min[1] = node.pos[1];
		if(node.pos[0] > max[0]) max[0] = node.pos[0];
		if(node.pos[1] > max[1]) max[1] = node.pos[1];
	});
	var scale = this.scale = Math.min(
		((this.options.width || 1920) - this.MODULE_MAX_R*2) / (max[0] - min[0]),
		((this.options.height || 1080) - this.MODULE_MAX_R*2) / (max[1] - min[1])
	);
	modulesList.forEach(function(node) {
		node.pos[0] -= min[0];
		node.pos[1] -= min[1];
	});
	this.width = max[0] - min[0];
	this.height = max[1] - min[1];
}

Graph.prototype.writeSVG = function(svg) {
	var svgModules = [], svgDependencies = [];
	var modulesList = this.modulesList;

	var scale = this.scale;

	svg.push('<?xml version="1.0" encoding="UTF-8"?>');
	svg.push('<svg xmlns="http://www.w3.org/2000/svg" id="wpgraph" version="1.1" baseProfile="full" width="',this.width*scale+this.MODULE_MAX_R*2,'" height="',this.height*scale+this.MODULE_MAX_R*2,'">');
	svg.push('<style type="text/css">');
	svg.push('line { stroke:black;}');
	svg.push('circle { stroke:black; stroke-width: 2}');
	svg.push('circle.main { stroke:#F00; stroke-width: 3}');
	svg.push('.dep, .req, .reqdep { stroke-width:0; }');
	svg.push('.async { stroke-dasharray: 4 4; stroke-linecap: round}');
	svg.push('.reqdep.hover { stroke:#660; stroke-width: 3; }');
	svg.push('.req.hover { stroke:red; stroke-width: 3; }');
	svg.push('.dep.hover { stroke:green; stroke-width: 3; }');
	svg.push('circle.hover { stroke:blue; stroke-width: 2; }');
	svg.push('</style>');
	var colors = [this.colors.slice(0), this.colors.slice(0), this.colors.slice(0)];
	var colorsMaps = [{}, {}, {}];
	modulesList.forEach(function(node, nodeidx) {
		var color = [];
		color.push(this.getColor(node.files, colors[0], colorsMaps[0]));;
		color.push(this.getColor(node.loaders || [], colors[1], colorsMaps[1]));
		var match = /(?:web|node)_modules[\\\/]([^\\\/]+)(?:[\\\/])[^!]*?$/.exec(node.name);
		match = match ? [match[1]] : [];
		color.push(this.getColor(match, colors[2], colorsMaps[2]));
		var screenPos = [
			node.pos[0]*scale + this.MODULE_MAX_R,
			node.pos[1]*scale + this.MODULE_MAX_R
		]
		svgModules.push('<circle id="module',nodeidx,'" class="module',node.main?" main":"",'" cx="', screenPos[0], '" cy="', screenPos[1], '" r="',Math.max(this.MODULE_MIN_R, Math.min(this.MODULE_MAX_R, Math.sqrt(node.size)*this.MODULE_SCALE*scale)),'" ');
		svgModules.push('fill="',this._colorName(color[this.options.colorByModule ? 2 : this.options.colorByLoaders ? 1 : 0]),'" ');
		svgModules.push('fill0="',this._colorName(color[0]),'" ');
		svgModules.push('fill1="',this._colorName(color[1]),'" ');
		svgModules.push('fill2="',this._colorName(color[2]),'" ');
		svgModules.push('onmouseover="a(',nodeidx,',',node.links.length,')" onmouseout="c()">');
		svgModules.push('<title>',this.nameShortener(node.name).split("!").join("\n\n")+'\n\nChunks:\n' + node.files.join("\n"));
		svgModules.push('</title></circle>');
		node.links.forEach(function(node2, linkidx) {
			var startNode = node, endNode = node2;
			if(node2.id < node.id) {
				startNode = node2;
				endNode = node;
			}
			startNode = [
				startNode.pos[0]*scale + this.MODULE_MAX_R,
				startNode.pos[1]*scale + this.MODULE_MAX_R
			];
			endNode = [
				endNode.pos[0]*scale + this.MODULE_MAX_R,
				endNode.pos[1]*scale + this.MODULE_MAX_R
			];
			var strongness = this.strongnessMap[node.id][node2.id];
			var async = node.asyncLink(node2) || node2.asyncLink(node);
			var className = async ? "async " : ""
			if(node.dependOn(node2))
				svg.push('<line class="',className,'" id="module',nodeidx,'line',linkidx,'" x1="',startNode[0],'" y1="',startNode[1],'" x2="',endNode[0],'" y2="',endNode[1],'" style="stroke-width:',Math.min(strongness, 5),'"/>')
			if(node.dependOn(node2) && node2.dependOn(node))
				className += "reqdep";
			else if(node.dependOn(node2))
				className += "dep";
			else if(node2.dependOn(node)) {
				className += "req";
			}
			svgDependencies.push('<line class="',className,'" id="module',nodeidx,'link',linkidx,'" x1="',startNode[0],'" y1="',startNode[1],'" x2="',endNode[0],'" y2="',endNode[1],'"/>')
		}, this);
	}, this);
	svgDependencies.forEach(function(i) {
		svg.push(i);
	});
	svgModules.forEach(function(i) {
		svg.push(i);
	});

	if(this.options.colorSwitch) {
		svg.push('<rect x="5" y="5" width="20" height="20" onmouseover="setColors(0);" style="fill:rgb(0,0,255)"/>');
		svg.push('<rect x="35" y="5" width="20" height="20" onmouseover="setColors(1);" style="fill:rgb(0,255,0)"/>');
		svg.push('<rect x="65" y="5" width="20" height="20" onmouseover="setColors(2);" style="fill:rgb(255,0,0)"/>');
	}

	svg.push('<script type="text/ecmascript">');
	svg.push('function addHover(node) {');
	svg.push('node.setAttribute(&quot;class&quot;, node.getAttribute(&quot;class&quot;) + " hover")');
	svg.push('}');

	svg.push('function removeHover(node) {');
	svg.push('var className = node.getAttribute(&quot;class&quot;).split(" ");');
	svg.push('className.splice(className.indexOf(&quot;hover&quot;), 1);');
	svg.push('node.setAttribute(&quot;class&quot;, className.join(" "))');
	svg.push('}');

	svg.push('function setColor(node, number) {');
	svg.push('var fill = node.getAttribute(&quot;fill&quot;+number);');
	svg.push('node.setAttribute(&quot;fill&quot;, fill)');
	svg.push('}');

	svg.push('function setColors(number) {');
	svg.push('var elements = document.getElementsByClassName(&quot;module&quot;);');
	svg.push('for(var i = 0; i &lt; elements.length; i++) setColor(elements[i], number);');
	svg.push('}');

	svg.push('function a(node, links) {');
	svg.push('addHover(document.getElementById(&quot;module&quot; + node));');
	svg.push('for(var i = 0; i &lt; links; i++) {');
	svg.push('var link = document.getElementById(&quot;module&quot; + node + &quot;link&quot; + i);\nif(link) addHover(link);');
	svg.push('}');
	svg.push('}');
	svg.push('function c() {');
	svg.push('var elements = Array.prototype.slice.call(document.getElementsByClassName(&quot;hover&quot;));');
	svg.push('for(var i = 0; i &lt; elements.length; i++) removeHover(elements[i]);');
	svg.push('}');
	svg.push('</script>');
	svg.push('</svg>');
}

Graph.prototype.applyTo = function(document) {
	var modulesList = this.modulesList;
	var scale = this.scale;
	var wpgraph = document.getElementById("wpgraph");
	wpgraph.setAttribute("width", "" + (this.width*scale + this.MODULE_MAX_R*2));
	wpgraph.setAttribute("height", "" + (this.height*scale + this.MODULE_MAX_R*2));
	modulesList.forEach(function(node, nodeidx) {
		var screenPos = [
			node.pos[0]*scale + this.MODULE_MAX_R,
			node.pos[1]*scale + this.MODULE_MAX_R
		]
		var el = document.getElementById("module" + nodeidx);
		el.setAttribute("r", "" + Math.max(this.MODULE_MIN_R, Math.min(this.MODULE_MAX_R, Math.sqrt(node.size)*this.MODULE_SCALE*scale)));
		el.setAttribute("cx", "" + screenPos[0]);
		el.setAttribute("cy", "" + screenPos[1]);
		node.links.forEach(function(node2, linkidx) {
			var elements = [
				document.getElementById("module" + nodeidx + "line" + linkidx),
				document.getElementById("module" + nodeidx + "link" + linkidx)];
			elements.forEach(function(el) {
				if(!el) return;
				el.setAttribute("x1", "" + screenPos[0]);
				el.setAttribute("y1", "" + screenPos[1]);
				el.setAttribute("x2", "" + (node2.pos[0]*scale + this.MODULE_MAX_R));
				el.setAttribute("y2", "" + (node2.pos[1]*scale + this.MODULE_MAX_R));
			}, this);
		}, this);
	}, this);
}

module.exports = Graph;