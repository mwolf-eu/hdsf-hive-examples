'use strict'

Hive.Type.sankey = function (vis, sz, cfg) {
  let dataCfg = vis.getData();
  let data = dataCfg.filter(d => d.name == cfg.in)[0].content;
  let nodes = dataCfg.filter(d => d.name == cfg.nodes)[0];
  let edges = dataCfg.filter(d => d.name == cfg.edges)[0];

  let sankey = d3.sankey();
  let sankeyCfg = {
    nodeId:d=>d.name, nodeAlign:d3.sankeyJustify, nodeWidth:15, nodePadding:10,
    extent:[[0,0], [sz.w, sz.h]], ...cfg.opts
  };
  Object.keys(sankeyCfg).forEach((m, i) => {
    sankey = sankey[m](sankeyCfg[m]);
  });

  let nodeNames = [... new Set(data.flatMap(d => [d.source, d.target]))].map(d => {return{name:d}});
  let out = sankey({
    nodes: nodeNames.map(d => Object.assign({}, d)),
    links: data.map(d => Object.assign({}, d))
  });


  out.nodes = out.nodes.map(d => {
      let width = d.x1 - d.x0;
      let height = -(d.y1 - d.y0);
      let x = d.x0;
      let y = (-sz.h + d.y1)+height;
      let midx = d.x0 + (width/2);
      let midy = y - (height/2);
      return{x, y, height, width, midx, midy, anchor:x<(sz.w/2)?'start':'end', name:d.name, value:d.value, data:d};
    })

  out.links = out.links.map(d => {
    return {sx:d.source.x1, sy:-sz.h+d.y0, tx:d.target.x0, ty:-sz.h+d.y1, width:d.width, name:d.source.name, value:d.value};
    })

  // generate & format data
  nodes.content = out.nodes;
  edges.content = out.links;
}
