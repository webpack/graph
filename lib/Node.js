/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function Node(id) {
	this.speed = [0, 0];
	this.force = [0, 0];
	this.pos = [0, 0];
	this.id = id;
	this.files = [];
	this.linksWeight = {};
	this.linksAsync = {};
}

Node.WEIGHT_LIBARY_INDEX = 5;
Node.EXTRA_DETRACTION_FILES = 5;

Node.createFromStats = function(id, stats) {
	var node = new Node(id);
	var found = false;
	var reasons;
	Object.keys(stats.chunks).forEach(function(file) {
		var modules = stats.chunks[file].modules;
		modules.forEach(function(module) {
			if(module.id == id) {
				found = true;
				if(this.files[this.files.length-1] != file)
					this.files.push(file);
				this.size = module.size;
				if(module.dirname) this.name = module.dirname;
				else if(module.request) this.name = module.request;
				else if(module.filename) this.name = module.filename;
				else if(module.name) this.name = module.name;
				reasons = module.reasons;
				this.loaders = module.loaders;
			}
		}, this);
	}, node);
	if(!found) return null;
	if(reasons) reasons.forEach(function(reason) {
		var name;
		if(reason.type.indexOf("main") !== -1) {
			this.main = true;
			return;
		} else if(reason.type.indexOf("context") !== -1) {
			name = reason.module || reason.userRequest || reason.filename;
			if(reason.async && !reason.dirname) this.linksAsync[name] = true;
		} else if(reason.type.indexOf("require") !== -1) {
			name = reason.module || reason.filename;
			if(reason.async) this.linksAsync[name] = true;
		}
		if(!name) return;
		this.linksWeight[name] = (this.linksWeight[name] || 0) + 1;
	}, node);
	return node;
}

Node.createFromJSON = function(json) {
	var node = new Node(json.id);
	Object.keys(json).forEach(function(key) {
		this[key] = json[key];
	}, node);
	return node;
}

Node.prototype.toJSON = function() {
	return {
		id: this.id,
		pos: this.pos,
		speed: this.speed,
		files: this.files,
		size: this.size,
		linksAsyncResolved: this.linksAsyncResolved,
		linksWeightResolved: this.linksWeightResolved
	};
}

Node.prototype.resolveLinks = function(mapNameToNode) {
	if(!this.linksWeightResolved) {
		this.linksWeightResolved = {};
		this.links = Object.keys(this.linksWeight).map(function(name) {
			var node = mapNameToNode[name];
			this.linksWeightResolved[node.id] = this.linksWeight[name];
			if(node === this) return;
			return node;
		}, this).filter(function(i) { return !!i });
	} else {
		this.links = Object.keys(this.linksWeightResolved).map(function(id) {
			var node = mapNameToNode[id];
			if(node === this) return;
			return node;
		}, this).filter(function(i) { return !!i });
	}
	if(!this.linksAsyncResolved) {
		this.linksAsyncResolved = {};
		Object.keys(this.linksAsync).forEach(function(name) {
			var node = mapNameToNode[name];
			this.linksAsyncResolved[node.id] = this.linksAsync[name];
		}, this);
	}
}

Node.prototype.propageLinks = function() {
	this.links.forEach(function(node2) {
		if(node2.links.indexOf(this) < 0)
			node2.links.push(this);
	}, this);
}

Node.prototype.prepare = function() {
	this.libaryIndex = Object.keys(this.linksWeightResolved).length / this.links.length;
}

Node.prototype.applyForce = function(force, weight) {
	if(force) {
		this.force[0] += force[0] * weight;
		this.force[1] += force[1] * weight;
	} else {
		this.speed[0] *= 0.8;
		this.speed[1] *= 0.8;
		this.speed[0] += this.force[0];
		this.speed[1] += this.force[1];
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

Node.prototype.getStrongness = function(node) {
	var direction = this.dependOn(node);
	var connectionIndex = 2 / (
		direction ? (
			1/this.libaryIndex + node.libaryIndex
		) : (
			this.libaryIndex + 1/node.libaryIndex)
		);
	var libaryIndex = 1 / Math.max(this.libaryIndex * Math.sqrt(this.links.length), node.libaryIndex * Math.sqrt(node.links.length));
	var value = (connectionIndex + libaryIndex * Node.WEIGHT_LIBARY_INDEX) / (1 + Node.WEIGHT_LIBARY_INDEX);
	return value * value;
}

Node.prototype.getDetraction = function(node) {
	var connections = Math.max(1/(this.libaryIndex+1), this.libaryIndex) + Math.max(1/(node.libaryIndex+1), node.libaryIndex) + 1;
	var extraDetraction = 0;
	if(this.files.join() != node.files.join())
		extraDetraction = Node.EXTRA_DETRACTION_FILES;
	return Math.sqrt(connections) + extraDetraction;
}

Node.prototype.dependOn = function(node) {
	return !!this.linksWeightResolved[node.id];
}

Node.prototype.asyncLink = function(node) {
	return !!this.linksAsyncResolved[node.id];
}

module.exports = Node;