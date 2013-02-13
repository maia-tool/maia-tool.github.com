/*
 *  Dracula Graph Layout and Drawing Framework 0.0.3alpha
 *  (c) 2010 Philipp Strathausen <strathausen@gmail.com>, http://strathausen.eu
 *  Contributions by Jake Stothard <stothardj@gmail.com>.
 *
 *  based on the Graph JavaScript framework, version 0.0.1
 *  (c) 2006 Aslak Hellesoy <aslak.hellesoy@gmail.com>
 *  (c) 2006 Dave Hoover <dave.hoover@gmail.com>
 *
 *  Ported from Graph::Layouter::Spring in
 *    http://search.cpan.org/~pasky/Graph-Layderer-0.02/
 *  The algorithm is based on a spring-style layouter of a Java-based social
 *  network tracker PieSpy written by Paul Mutton <paul@jibble.org>.
 *
 *  This code is freely distributable under the MIT license. Commercial use is
 *  hereby granted without any cost or restriction.
 *
 *  Links:
 *
 *  Graph Dracula JavaScript Framework:
 *      http://graphdracula.net
 *
 /*--------------------------------------------------------------------------*/

/*
 * Edge Factory
 */
var AbstractEdge = function() {}

AbstractEdge.prototype = {};
var EdgeFactory = function() {
    this.template = new AbstractEdge();
    this.template.style = new Object();
    this.template.style.directed = false;
    this.template.weight = 1;
    };
EdgeFactory.prototype = {
  build: function(source, target) {
    var e = jQuery.extend(true, {}, this.template);
    e.source = source;
    e.target = target;
    return e;
  }
};

/*
 * Graph
 */
var Graph = function() {
    this.nodes = {};
    this.edges = [];
    this.snapshots = []; // previous graph states TODO to be implemented
    this.edgeFactory = new EdgeFactory();
    };
Graph.prototype = {
/*
     * add a node
     * @id          the node's ID (string or number)
     * @content     (optional, dictionary) can contain any information that is
     *              being interpreted by the layout algorithm or the graph
     *              representation
     */
  addNode: function(id, content) { /* testing if node is already existing in the graph */
    if (this.nodes[id] == undefined) {
      this.nodes[id] = new Graph.Node(id, content);
    }
    return this.nodes[id];
  },

  addEdge: function(source, target, style) {
    var s = this.addNode(source);
    var t = this.addNode(target);
    var edge = this.edgeFactory.build(s, t);
    jQuery.extend(edge.style, style);
    s.edges.push(edge);
    this.edges.push(edge);
    // NOTE: Even directed edges are added to both nodes.
    t.edges.push(edge);
  },

/* TODO to be implemented
     * Preserve a copy of the graph state (nodes, positions, ...)
     * @comment     a comment describing the state
     */
  snapShot: function(comment) {
/* FIXME
        var graph = new Graph();
        graph.nodes = jQuery.extend(true, {}, this.nodes);
        graph.edges = jQuery.extend(true, {}, this.edges);
        this.snapshots.push({comment: comment, graph: graph});
        */
  },
  removeNode: function(id) {
    delete this.nodes[id];
    for (var i = 0; i < this.edges.length; i++) {
      if (this.edges[i].source.id == id || this.edges[i].target.id == id) {
        this.edges.splice(i, 1);
        i--;
      }
    }
  }
};
_.extend(Graph.prototype, Backbone.Events);

/*
 * Node
 */
Graph.Node = function(id, node) {
  node = node || {};
  node.id = id;
  node.edges = [];
  return node;
};
Graph.Node.prototype = {};

/*
 * Renderer base class
 */
Graph.Renderer = {};

/*
 * Renderer implementation using RaphaelJS
 */
Graph.Renderer.Raphael = function(element, graph, width, height) {
  this.element = document.getElementById(element);
  this.graph = graph;

  this.width = width || 400;
  this.height = height || 400;
  this.radius = 40; /* max dimension of a node */

  this.r = Raphael(element, this.width, this.height);

  this.draw();
};

Graph.Renderer.Raphael.prototype = {
  translate: function(point) {
    return [(point[0] - this.graph.layoutMinX) * this.factorX + this.radius, (point[1] - this.graph.layoutMinY) * this.factorY + this.radius];
  },

  translateReverse: function(point) {
    return [(point[0] - this.radius) / this.factorX + this.graph.layoutMinX, (point[1] - this.radius) / this.factorY + this.graph.layoutMinY]
  },

  rotate: function(point, length, angle) {
    var dx = length * Math.cos(angle);
    var dy = length * Math.sin(angle);
    return [point[0] + dx, point[1] + dy];
  },

  draw: function() {
    this.factorX = (this.width - 2 * this.radius) / (this.graph.layoutMaxX - this.graph.layoutMinX);
    this.factorY = (this.height - 2 * this.radius) / (this.graph.layoutMaxY - this.graph.layoutMinY);

    for (var key in this.graph.nodes) {
      if (this.graph.nodes.hasOwnProperty(key)) {
        this.drawNode(this.graph.nodes[key]);
      }
    }
    for (var i = 0; i < this.graph.edges.length; i++) {
      this.drawEdge(this.graph.edges[i]);
    }
  },

  drawNode: function(node) {
    var self = this;

    var point = this.translate([node.layoutPosX, node.layoutPosY]);
    node.point = point;

    /* if node has already been drawn, move the nodes */
    if (node.shape) {
      var oBBox = node.shape.getBBox();
      var opoint = {
        x: oBBox.x + oBBox.width / 2,
        y: oBBox.y + oBBox.height / 2
      };
      node.shape.translate(Math.round(point[0] - opoint.x), Math.round(point[1] - opoint.y));
      this.r.safari();
      return node;
    } /* else, draw new nodes */

    /* Create a new set for all shapes related to this node. */
    var r = this.r;
    var shape = r.set();
    shape.node = node;

    var color = node.color || Raphael.getColor();
    var ellipse = r.ellipse(0, 0, 40, 25).attr({
      fill: color,
      stroke: color,
      "stroke-width": 2,
      cursor: 'move'
    }); /* set DOM node ID */
    ellipse.node.id = node.label || node.id;
    ellipse.set = shape;
    shape.ellipse = ellipse;
    shape.push(ellipse);
    ellipse.attr({
      "fill-opacity": .6
    });

    /* render ellipse */
    var text = r.text(0, 0, node.label || node.id).attr({
      cursor: 'move'
    });
    text.set = shape;
    shape.push(text);

    /* Add terminals */
    var bbox = ellipse.getBBox();
    var positions = [{
      x: bbox.x + bbox.width / 2,
      y: bbox.y
    }, {
      x: bbox.x + bbox.width,
      y: bbox.y + bbox.height / 2
    }, {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height
    }, {
      x: bbox.x,
      y: bbox.y + bbox.height / 2
    }, ];
    var terminals = r.set();
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var terminal = r.ellipse(pos.x, pos.y, 5, 5).attr({
        fill: '#555',
        "fill-opacity": 0,
        "stroke-width": 0
      });
      terminal.set = shape;
      terminals.push(terminal);
    }
    shape.push(terminals);

    /* Add hover animation for terminals */
    shape.mouseover(function() {
      terminals.animate({
        "fill-opacity": 1
      }, 200);
    });
    shape.mouseout(function() {
      terminals.animate({
        "fill-opacity": 0
      }, 200);
    });

    /* Add dragging */
    var dragSet = r.set().push(ellipse).push(text);
    dragSet.mousedown(function(event) {
      var el = $(self.element),
          cx = event.clientX,
          cy = event.clientY,
          graph = self.graph;

      function moveNode(event) {
        var dx = Math.round(event.clientX - cx),
            dy = Math.round(event.clientY - cy);

        shape.translate(dx, dy);

        cx += dx;
        cy += dy;

        for (var i = 0; i < graph.edges.length; i++) {
          graph.edges[i].connection && graph.edges[i].connection.draw();
        }
      }

      function mousemove(event) {
        moveNode(event);

        event.preventDefault();
        return false;
      }

      function mouseup(event) {
        el.unbind('mousemove', mousemove);
        el.unbind('mouseup', mouseup);

        moveNode(event);

        /* Recompute point */
        var bbox = shape.getBBox();
        point = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
        var layoutPoint = self.translateReverse(point);

        self.graph.trigger('movenode', {
          id: node.id,
          x: layoutPoint[0],
          y: layoutPoint[1],
          node: node
        });
      }

      el.bind('mousemove', mousemove);
      el.bind('mouseup', mouseup);

      event.preventDefault();
      return false;
    });

    /* Add connecting */
    terminals.mousedown(function(event) {
      var el = $(self.element),
          cx = event.clientX,
          cy = event.clientY,
          bbox = r.getElementByPoint(cx, cy).getBBox(),
          sx = bbox.x + bbox.height / 2,
          sy = bbox.y + bbox.width / 2,
          edge = null;

      function updateEdge(event) {
        if (edge) {
          edge.remove();
        }

        var x = event.clientX - cx + sx,
            y = event.clientY - cy + sy;

        edge = self.r.connection(ellipse, {
          x: x,
          y: y,
          width: 1,
          height: 1
        });
      }

      function mousemove(event) {
        updateEdge(event);

        event.preventDefault();
        return false;
      }

      function mouseup(event) {
        if (edge) {
          edge.remove();
        }

        el.unbind('mousemove', mousemove);
        el.unbind('mouseup', mouseup);

        var end = r.getElementByPoint(event.clientX, event.clientY);
        if (end && end.set && end.set.node) {
          var endNode = end.set.node;
          self.graph.trigger('createedge', {
            fromNode: node,
            toNode: endNode,
            fromId: node.id,
            toId: endNode.id
          });
          //self.r.connection(shape, end.set);
        }
      }

      el.bind('mousemove', mousemove);
      el.bind('mouseup', mouseup);

      updateEdge(event);

      event.preventDefault();
      return false;
    });

    shape.translate(Math.round(point[0] - (bbox.x + bbox.width / 2)), Math.round(point[1] - (bbox.y + bbox.height / 2)))

    node.shape = shape;
  },
  drawEdge: function(edge) {
    var self = this;

    /* if this edge already exists the other way around and is undirected */
    if (edge.backedge) return;

    /* if edge already has been drawn, only refresh the edge */
    if (!edge.connection) {
      edge.style && edge.style.callback && edge.style.callback(edge); // TODO move this somewhere else
      edge.connection = this.r.connection(edge.source.shape.ellipse, edge.target.shape.ellipse, edge.style);
      return;
    }
    edge.connection.draw();

    if (edge.connection.label && edge.style.editable) {
      edge.connection.label.click(function() {
        var bbox = edge.connection.label.getBBox(),
            el = $(self.element),
            parent = $(el).offsetParent(),
            position = $(el).position();

        console.log(position);

        var input = $('<input type="text" />').css({
          'position': 'absolute',
          'top': (position.top + bbox.y) + 'px',
          'left': (position.left + bbox.x) + 'px'
        }).val(edge.style.label || '').appendTo(parent).focus();

        input.blur(function() {
          var newLabel = input.val();
          if (newLabel != edge.style.label) {
            console.log(edge);
            self.graph.trigger('changeedgelabel', {
              fromNode: edge.source,
              toNode: edge.target,
              fromId: edge.source.id,
              toId: edge.source.id,
              edge: edge.style,
              label: newLabel
            });
          }

          input.remove();
        });
      });
    }

    function bindScissors(edge, scissors) {
      scissors.mouseover(function() {
        scissors.animate({
          "opacity": 1
        }, 200);
      });
      scissors.mouseout(function() {
        scissors.animate({
          "opacity": 0
        }, 200);
      });
      scissors.click(function() {
        self.graph.trigger('destroyedge', {
          fromNode: edge.source,
          toNode: edge.target,
          fromId: edge.source.id,
          toId: edge.source.id,
          edge: edge.style
        });
      });
    }
    edge.connection.scissors1 && bindScissors(edge, edge.connection.scissors1);
    edge.connection.scissors2 && bindScissors(edge, edge.connection.scissors2);
  }
};
Graph.Layout = {};
Graph.Layout.Spring = function(graph) {
  this.graph = graph;
  this.iterations = 500;
  this.maxRepulsiveForceDistance = 6;
  this.k = 2;
  this.c = 0.01;
  this.maxVertexMovement = 0.5;
  this.layout();
};
Graph.Layout.Spring.prototype = {
  layout: function() {
    this.layoutPrepare();
    for (var i = 0; i < this.iterations; i++) {
      this.layoutIteration();
    }
    this.layoutCalcBounds();
  },

  layoutPrepare: function() {
    for (i in this.graph.nodes) {
      var node = this.graph.nodes[i];
      node.layoutPosX = 0;
      node.layoutPosY = 0;
      node.layoutForceX = 0;
      node.layoutForceY = 0;
    }

  },

  layoutCalcBounds: function() {
    var minx = Infinity,
        maxx = -Infinity,
        miny = Infinity,
        maxy = -Infinity;

    for (i in this.graph.nodes) {
      var x = this.graph.nodes[i].layoutPosX;
      var y = this.graph.nodes[i].layoutPosY;

      if (x > maxx) maxx = x;
      if (x < minx) minx = x;
      if (y > maxy) maxy = y;
      if (y < miny) miny = y;
    }

    this.graph.layoutMinX = minx;
    this.graph.layoutMaxX = maxx;
    this.graph.layoutMinY = miny;
    this.graph.layoutMaxY = maxy;
  },

  layoutIteration: function() {
    // Forces on nodes due to node-node repulsions
    var prev = new Array();
    for (var c in this.graph.nodes) {
      var node1 = this.graph.nodes[c];
      for (var d in prev) {
        var node2 = this.graph.nodes[prev[d]];
        this.layoutRepulsive(node1, node2);

      }
      prev.push(c);
    }

    // Forces on nodes due to edge attractions
    for (var i = 0; i < this.graph.edges.length; i++) {
      var edge = this.graph.edges[i];
      this.layoutAttractive(edge);
    }

    // Move by the given force
    for (i in this.graph.nodes) {
      var node = this.graph.nodes[i];
      var xmove = this.c * node.layoutForceX;
      var ymove = this.c * node.layoutForceY;

      var max = this.maxVertexMovement;
      if (xmove > max) xmove = max;
      if (xmove < -max) xmove = -max;
      if (ymove > max) ymove = max;
      if (ymove < -max) ymove = -max;

      node.layoutPosX += xmove;
      node.layoutPosY += ymove;
      node.layoutForceX = 0;
      node.layoutForceY = 0;
    }
  },

  layoutRepulsive: function(node1, node2) {
    if (typeof node1 == 'undefined' || typeof node2 == 'undefined') return;
    var dx = node2.layoutPosX - node1.layoutPosX;
    var dy = node2.layoutPosY - node1.layoutPosY;
    var d2 = dx * dx + dy * dy;
    if (d2 < 0.01) {
      dx = 0.1 * Math.random() + 0.1;
      dy = 0.1 * Math.random() + 0.1;
      var d2 = dx * dx + dy * dy;
    }
    var d = Math.sqrt(d2);
    if (d < this.maxRepulsiveForceDistance) {
      var repulsiveForce = this.k * this.k / d;
      node2.layoutForceX += repulsiveForce * dx / d;
      node2.layoutForceY += repulsiveForce * dy / d;
      node1.layoutForceX -= repulsiveForce * dx / d;
      node1.layoutForceY -= repulsiveForce * dy / d;
    }
  },

  layoutAttractive: function(edge) {
    var node1 = edge.source;
    var node2 = edge.target;

    var dx = node2.layoutPosX - node1.layoutPosX;
    var dy = node2.layoutPosY - node1.layoutPosY;
    var d2 = dx * dx + dy * dy;
    if (d2 < 0.01) {
      dx = 0.1 * Math.random() + 0.1;
      dy = 0.1 * Math.random() + 0.1;
      var d2 = dx * dx + dy * dy;
    }
    var d = Math.sqrt(d2);
    if (d > this.maxRepulsiveForceDistance) {
      d = this.maxRepulsiveForceDistance;
      d2 = d * d;
    }
    var attractiveForce = (d2 - this.k * this.k) / this.k;
    if (edge.attraction == undefined) edge.attraction = 1;
    attractiveForce *= Math.log(edge.attraction) * 0.5 + 1;

    node2.layoutForceX -= attractiveForce * dx / d;
    node2.layoutForceY -= attractiveForce * dy / d;
    node1.layoutForceX += attractiveForce * dx / d;
    node1.layoutForceY += attractiveForce * dy / d;
  }
};

Graph.Layout.Ordered = function(graph, order) {
  this.graph = graph;
  this.order = order;
  this.layout();
};
Graph.Layout.Ordered.prototype = {
  layout: function() {
    this.layoutPrepare();
    this.layoutCalcBounds();
  },

  layoutPrepare: function(order) {
    for (i in this.graph.nodes) {
      var node = this.graph.nodes[i];
      node.layoutPosX = 0;
      node.layoutPosY = 0;
    }
    var counter = 0;
    for (i in this.order) {
      var node = this.order[i];
      node.layoutPosX = counter;
      node.layoutPosY = Math.random();
      counter++;
    }
  },

  layoutCalcBounds: function() {
    var minx = Infinity,
        maxx = -Infinity,
        miny = Infinity,
        maxy = -Infinity;

    for (i in this.graph.nodes) {
      var x = this.graph.nodes[i].layoutPosX;
      var y = this.graph.nodes[i].layoutPosY;

      if (x > maxx) maxx = x;
      if (x < minx) minx = x;
      if (y > maxy) maxy = y;
      if (y < miny) miny = y;
    }

    this.graph.layoutMinX = minx;
    this.graph.layoutMaxX = maxx;

    this.graph.layoutMinY = miny;
    this.graph.layoutMaxY = maxy;
  }
};

/*
 * usefull JavaScript extensions,
 */

function log(a) {
  console.log && console.log(a);
}

/* For IE */
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function(fun /*, thisp*/ ) {
    var len = this.length;
    if (typeof fun != "function") throw new TypeError();

    var thisp = arguments[1];
    for (var i = 0; i < len; i++) {
      if (i in this) fun.call(thisp, this[i], i, this);
    }
  };
}