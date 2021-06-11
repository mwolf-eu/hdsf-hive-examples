"use strict";

// force layout core

Hive.Type.graph = class {

  /**
  * Create an ELK graph
  *
  * @param Array Nodes
  * @param Array Edges
  * @param string Layout name
  * @return
  */
  static std_to_elk_graph( nodes, edges, layout ) {

    let gelk = new Object();

    gelk.id = "root";
    gelk.layoutOptions = { 'elk.algorithm': layout };  // [ 'box', 'disco', 'force', 'layered', 'mrtree', 'radial', 'random', 'stress' ].
    // gelk.logging = true;
    // gelk.measureExecutionTime = true;
    gelk.children = nodes;
    gelk.edges = edges.map((d,i) => {return {id:i, sources:[d.source], targets:[d.target]}});

    return gelk
  }

  /**
  * Set node locations
  *
  * @param Array Nodes
  * @param Array Edges
  * @param Object The force configuration
  * @return
  */
  static transform( nodes, edges, cfg){
    // convert/verify format (GML)
    // attrs: id, source, target, sx, sy, fx, fy, tx, ty are sacrosanct.
    // if the raw data contains any of the above, it should be wrangled
    // out before processing here.
    // function transformData(){
    let n = nodes;
    if (!('id' in n[0])) {
      n = nodes.map(d=> {
        if (!('id' in d)) d.id = d[cfg.id_field];
        if (cfg.type == 'elk') {
          if (!('height' in d)) {
            if ('height_field' in cfg) d.height = d[cfg.height_field];
            else d.height = 30;
          }
          if (!('width' in d)) {
            if ('width_field' in cfg) d.height = d[cfg.height_field];
            else d.width = 30;
          }
        }
        if (cfg.type == 'graphvis') {
          if ('size_field' in cfg) d.size = d[cfg.size_field];
          else d.size = 30;
        }
        return d;
      });
    }

    let e = edges;
    if (!('source' in e[0]) || !('target' in e[0])) {
      e = edges.map((d,i)=> {
        if (!('id' in d)) d.id = i;
        if (!('source' in d)) d.source = d[cfg.source_field];
        if (!('target' in d)) d.target = d[cfg.target_field];
        return d;
      });
    }

    // ELK
    if (cfg.type == 'elk') {
      return Hive.Type.graph.std_to_elk_graph(n, e, cfg.subtype);
    }

    // CCNETVIS
    if (cfg.type == 'ccnetvis') {
      let opts = {
        grid:{
          margin: 0.05,
          direction: 'left-right',
        },
        hive:{
          starting_angle: Math.PI / 2,
          radius: 0.05, // internal radious without nodes
          margin: 0.05,
          direction: 'left-right',
          nlines: 5
        },
        circular:{
          starting_angle: Math.PI / 2,
          ordering: 'topological',
        },
        versinus:{
          margin: 0.05,
          direction: 'left-right',
          hubs: 0.1, // fraction of hubs
          intermediary: 0.2, // fraction of intermediary
          method: 'fixed_fractions', // or "erdos_sectioning"
        }
      };

      let capSubType = cfg.subtype.charAt(0).toUpperCase() + cfg.subtype.slice(1);
      let g = new H.ccnetvis[cfg.subtype][capSubType](n, e, opts[cfg.subtype]);
      g.apply();
      return g;
    }

    // GRAPHVIS
    if (cfg.type == 'graphvis') {
      let optsDefault = {
        engine:cfg.subtype,
        format:"json",
        ratio:"auto",
      }

      let opts = {
        circo:{
          ...optsDefault,
          mindist:1.0,
        },
        dot:{
          ...optsDefault,
          nodesep:3,
          ranksep:3,
        },
        neato:{
          ...optsDefault,
        },
        twopi:{
          ...optsDefault,
          ranksep:3,
        }
      }

      return {n:n, e:e, c:opts[cfg.subtype]}
    }
  }


  /**
  * Get node position information
  *
  * @param Object Force configuration
  * @param Array Node/Edge Data
  * @return layout positions
  */
  static position(cfg, data) {

    if (cfg.type == 'elk'){
      let layout = H.Graphs.Elk.positions(data);
      layout.then(function(result) {
        return result;
      })
      return layout
    }

    if (cfg.type == 'ccnetvis'){
      return H.Graphs.Ccnet.positions(data);
    }

    if (cfg.type == 'graphvis'){
      let layout = H.Graphs.GraphViz.positions(data.n, data.e, data.c)
      layout.then(function(result) {
        return result;
      });
      return layout;
    }
  }

  /**
  * Get extents for fx/fy
  *
  * @param Array Node data
  * @return Extent array
  */
  static extents(nodes) {
    return {x:d3.extent(nodes, d=>d.fx), y:d3.extent(nodes, d=>d.fy)}
  }
}
