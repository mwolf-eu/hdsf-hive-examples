/**
 *  Copyright (c) 2017, Helikar Lab.
 *  All rights reserved.
 *
 *  This source code is licensed under the GPLv3 License.
 *  Author: Renato Fabbri
 */
H.Namespace.set(H, 'ccnetvis.hierarchical');
H.ccnetvis.hierarchical = function() {

const ccNetViz_utils = H.ccnetvis.core_utils.Utils

class Hierarchical {
  // this layout should handle any digraph
  constructor(nodes, edges, layout_options) {
    this._nodes = nodes;
    this._edges = edges;
    let defaults = {
      margin: 0.05,
      direction: 'left-right', // other options: right-left, top-down, bottom-up
      roots: 'auto', // other options: user-defined (in the graph define isroot = true); "no-in-degree"; "auto"
    };
    ccNetViz_utils.extend(defaults, layout_options);
    this._options = defaults;
  }

  makeLayers(nodes, layer) {
    if (nodes.length > 1) {
      const stepy = 1 / (nodes.length - 1);
      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].visited = true;
        nodes[i].layer = layer; // makes x afterwards
        nodes[i].fy = i * stepy;
      }
    } else {
      nodes[0].visited = true;
      nodes[0].layer = layer; // makes x afterwards
      nodes[0].fy = 0.5;
    }
    let next_layer = [];
    for (let i = 0; i < nodes.length; i++) {
      let neighbors = nodes[i].parents.concat(nodes[i].children);
      for (let j = 0; j < neighbors.length; j++) {
        if (
          neighbors[j].visited == false &&
          !next_layer.includes(neighbors[j])
        ) {
          next_layer.push(neighbors[j]);
        }
      }
    }
    if (next_layer.length == 0) {
      return layer;
    } else {
      return this.makeLayers(next_layer, layer + 1);
    }
  }

  apply() {
    // left-right tree by default, let user choose
    // top-down, bottom-top, right-left in subsequent versions
    // hierarchical layouts for trees (acyclic graphs) are
    // implemented separately for now
    let nodes = this._nodes;
    nodes.forEach(function(n, i) {
      n.parents = [];
      n.children = [];
      n.visited = false;
    });
    this._edges.forEach(function(e, i) {
      //e.source.children.push(e.target);
      //e.target.parents.push(e.source);
    });
    // find the roots:
    // nodes defined by the user as roots OR
    // nodes with in-degree == 0 OR
    // nodes with greatest in-degree (or degree if undirected graph)
    let roots = findRoots_(nodes, this._options.roots);
    // number of layers and max number of nodes in each layer
    // has to be found by making the layout
    // there are two approaches to finding the nodes in each layer:
    // 1) each layer has all the neighbors of the nodes in the previous layer
    // 2) follow links and then place non visited nodes on the layer of neighbors OR
    // this layout implements the first of these approaches.
    console.log(roots)
    const depth = this.makeLayers(roots, 1);
    // each layer of tree x = [0+alpha,1-alpha]
    const stepx = 1 / (depth - 1);
    // posx = marginx + stepx*(depth-1)
    for (let i = 0; i < this._nodes.length; ++i) {
      // this._nodes[i].x = stepx * (this._nodes[i].layer - 1);
      console.log(stepx * (this._nodes[i].layer - 1))
      this._nodes[i].fx = stepx * (this._nodes[i].layer - 1);
    }
    return this._options;
  }
}

function findRoots_(nodes, root_option) {
  // find the roots:
  // nodes defined by the user as roots OR
  // nodes with in-degree == 0 OR
  // nodes with greatest in-degree (or degree if undirected graph)
  let roots = [];
  if (root_option == 'user-defined' || root_option == 'auto') {
    console.log('running auto')
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].isroot == true) {
        // has to be on the json file of the graph
        console.log(nodes[i])
        roots.push(nodes[i]);
      }
    }
  }
  if (
    root_option == 'no-in-degree' ||
    (root_option == 'auto' && roots.length == 0)
  ) {
    if (roots.length == 0) {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].parents.length == 0) {
          roots.push(nodes[i]);
        }
      }
    }
  }
  if (root_option == 'degree' || (root_option == 'auto' && roots.length == 0)) {
    // calculate max out-degree
    let max_outdegree = 0;
    nodes.forEach(function(node) {
      if (node.children.length > max_outdegree) {
        max_outdegree = node.children.length;
      }
    });
    // choose vertices with greatest out-degree
    nodes.forEach(function(node) {
      if (node.children.length == max_outdegree) {
        roots.push(node);
      }
    });
  }

  return roots;
}

return {
  Hierarchical : Hierarchical
}

}();