# webpack-graph

It visualize your dependency tree as svg image.

Provide it with webpack stats (as JSON) for version > 0.7.

You can generate them by calling webpack with `--json`.

## Command Line

`webpack-graph [<stats.json> [<output.svg>]]`

If you don't provide the files as parameters `webpack-graph` will read them from `stdin` or write it to `stdout`.

`--context <path>` - Shorten filenames according to this context

`--width <number>` - The max width of the output svg

`--height <number>` - The max height of the output svg

`--steps <number>` - Limit the simulation steps

`--interactive` - Emit simulation code to browser

## Resulting Image

* Circles are modules/contexts
 * The size visualize the file size.
 * The color visualize the chunks in which the module is emitted.
* Connections are dependencies
 * webpack-graph try to guess libaries and connect them with thin lines
 * Dashed lines visualize async requires.
* Hover modules/contexts to display more info
 * Tooltip display module name and loaders
 * Tooltip display chunks
 * Green lines display requires *from* other modules/contexts
 * Red lines display requires *to* other modules/contexts
 * Brown lines display requires *to* and *from* other modules/contexts

### Example

![webpack-graph](http://webpack.github.com/graph/example/webpackBrowsertest.svg)

[Interactive version](http://webpack.github.com/graph/example/webpackBrowsertestInteractive.svg)

See more examples in webpack examples