/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function Node(id, stats) {
	this.speed = [0, 0];
	this.force = [0, 0];
	this.id = id;
	this.files = [];
	var reasons;
	this.linksWeight = {};
	this.linksAsync = {};
	Object.keys(stats.fileModules).forEach(function(file) {
		var modules = stats.fileModules[file];
		modules.forEach(function(module) {
			if(module.id == id) {
				if(this.files[this.files.length-1] != file)
					this.files.push(file);
				this.size = module.size;
				if(module.filename) this.name = module.filename;
				if(module.dirname) this.name = module.dirname;
				reasons = module.reasons;
			}
		}, this);
	}, this);
	if(reasons) reasons.forEach(function(reason) {
		var name;
		switch(reason.type) {
		case "main":
			this.main = true;
			return;
		case "context":
			name = reason.dirname || reason.filename;
			if(reason.async && !reason.dirname) this.linksAsync[name] = true;
			break;
		case "require":
			name = reason.filename;
			if(reason.async) this.linksAsync[name] = true;
			break;
		default:
			return;
		}
		if(!name) return;
		this.linksWeight[name] = (this.linksWeight[name] || 0) + 1;
	}, this);
	this.libaryIndex = Object.keys(this.linksWeight).length;
}

Node.prototype.resolveLinks = function(mapNameToNode) {
	this.links = Object.keys(this.linksWeight).map(function(name) {
		var node = mapNameToNode[name];
		if(node == this) return;
		return node;
	}).filter(function(i) { return !!i });
}

Node.prototype.propageLinks = function() {
	this.links.forEach(function(node2) {
		if(node2.links.indexOf(this) < 0)
			node2.links.push(this);
	}, this);
}

Node.prototype.applyForce = function(force, weight) {
	if(force) {
		this.force[0] += force[0] * weight;
		this.force[1] += force[1] * weight;
	} else {
		this.speed[0] += this.force[0];
		this.speed[1] += this.force[1];
		this.speed[0] *= 0.9;
		this.speed[1] *= 0.9;
		this.pos[0] += this.speed[0];
		this.pos[1] += this.speed[1];
		var d = this.speed[0]*this.speed[0] + this.speed[1]*this.speed[1];
		this.force[0] = 0;
		this.force[1] = 0;
		return d;
	}
}

Node.prototype.dist2 = function(node) {
	var dx = this.pos[0] - node.pos[0];
	var dy = this.pos[1] - node.pos[1];
	return dx*dx + dy*dy;
}

Node.prototype.dist = function(node) {
	var d = this.dist2(node);
	return Math.sqrt(d);
}

Node.prototype.vector = function(node, weight) {
	return [
		(node.pos[0] - this.pos[0]) * weight,
		(node.pos[1] - this.pos[1]) * weight
	];
}

module.exports = Node;