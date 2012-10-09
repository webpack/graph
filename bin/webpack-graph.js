#!/usr/bin/env node

/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var path = require("path");
var fs = require("fs");
var util = require("util");

var argv = require("optimist")
	.usage("webpack-graph " + require("../package.json").version + "\n" +
		"Usage: $0 [<input> [<output>]]")

	.string("context")
	.describe("context", "Shorten filenames according to this context")

	.demand(0)
	.argv;

var input = argv._[0] && path.resolve(argv._[0]);
var output = argv._[1] && path.resolve(argv._[1]);

var inputStream, outputStream;
if(input) {
	inputStream = fs.createReadStream(input, { encoding: "utf-8" });
} else {
	process.stdin.resume();
	inputStream = process.stdin;
}

if(output) {
	outputStream = fs.createWriteStream(output)
} else {
	outputStream = process.stdout;
}

var options = {};

if(argv.context) {
	options.nameShortener = require("webpack/lib/createFilenameShortener")(path.resolve(argv.context));
}

var data = [];
inputStream.on("data", data.push.bind(data));
inputStream.on("end", function() {
	data = data.join("");

	var webpackGraph = require("../lib/webpack-graph.js");
	options.outputStream = outputStream;
	var svg = webpackGraph(JSON.parse(data), options);

	if(svg) outputStream.write(svg, "utf-8");
	if(outputStream != process.stdout) outputStream.end();
});

