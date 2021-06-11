globalThis.Hive = globalThis.Hive||{};
Hive.Layout = Hive.Layout||{};

Hive.facet = class {

  getFacetTemplate(pre, dir){
    return {
      "id": `${pre}-facet`, "attr": {
        "flex-wrap": "wrap-no-wrap", "flex-direction": `flex-direction-${dir}`,
        "flex-grow":1, "flex-shrink":1
      }, children:[]
    }
  }

  getFacetItemContainerTemplate(pre, idx, dir){
    return {
      "id": `${pre}-container-${idx}`, "attr": {
        "flex-wrap": "wrap-no-wrap", "flex-direction": `flex-direction-${dir}`,
        "flex-grow":1, "flex-shrink":1
      }
    }
  }

  getFacetItemTemplate(pre, dir, qty){
    let t = {
      "id": `${pre}-item`, "attr": { "flex-direction": `flex-direction-${dir}`,
        "flex-grow":1, "flex-shrink":1
      }
    }

    let templates = Array(qty).fill().map((d,i) => {
      let item = JSON.parse(JSON.stringify(t));
      item.id = item.id + "-" + i;
      return item;
    })

    return templates;
  }

  static facetChartTemplate(cfg) {
    return Hive.templates.chart(cfg);
  }

  static getAxes(ctxt) {
    let rv = {'top':{}, 'right':{}, 'bottom':{}, 'left':{}};

    Object.keys(rv).forEach((item, i) => {
      let dim = 'height';
      let num = ctxt.numY;
      if (item == 'top' || item == 'bottom') {
        dim = 'width';
        num = ctxt.numX;
      }

      rv[item].nodes = Array(num).fill().map((d,i) => {
        return {"id":`facet-axis-container-${item}-${i}`, "attr":{[dim]:`${100/num}%`}, children:[
          {"id":`facet-axis-${item}-${i}`, "attr":{height:"100%"}}
        ]}
      })

      rv[item].ids = rv[item].nodes.map(d => d.children[0].id);
    });

    return rv;
  }

  // Adds left and bottom axes
  // TODO. Add cfg for top/right
  static addDefaultAxes(nodes, ctxt, cfg) {
    if (ctxt.init) { // if first call
      let rv = Hive.facet.getAxes(ctxt);
      // add children to left and bottom
      let leftAxis = Hive.templates.getCfgNode(nodes, 'chart left axis');
      let bottomAxis = Hive.templates.getCfgNode(nodes, 'chart bottom axis');
      // let chartBottomAxisContainer = Hive.templates.getCfgNode(nodes, 'chart bottom-container');
      // chartBottomAxisContainer.attr.padding = [];

      leftAxis.children = rv.left.nodes.map(d=> {
        // d.attr.padding = [['edge-bottom', 5], ['edge-top', cfg.marginFrame+cfg.marginView+cfg.titleFontSize]];
        d.attr['padding edge-bottom'] = 5;
        d.attr['padding edge-top'] = cfg.marginFrame+cfg.marginView+cfg.titleFontSize;
        return d;
      });

      bottomAxis.children = rv.bottom.nodes.map(d=> {
        // d.attr.padding = [['edge-left', 5], ['edge-right', cfg.marginView]];
        d.attr['padding edge-left'] = 5;
        d.attr['padding edge-right'] = cfg.marginView;
        return d;
      });

      return rv;
    }
  }

  sort(data, vars, sortHandlers) {
    if (!vars || !vars.length) return {data:data, len:data.length}; // nothing to do

    let keys=[];
    let nest=d3.nest();
    let d = [];

    vars.forEach((v, i) => {
      keys[i] = d3.set(data, d=>d[v]).values();
      if (sortHandlers && sortHandlers[i]) keys[i]=sortHandlers[i](keys[i]);
      nest = nest.key(k => k[v]);
    });

    nest = nest.object(data);
    // Cartesian Product
    let cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
    let combos = cartesian(...keys);

    combos.forEach((item, i) => {
      let buf = nest;
      if(!Array.isArray(item)) item = [item];
      item.forEach(k => buf=buf[k]);
      d.push(buf);
    });

    return {data:d, len:keys[0].length}
  }

  flexFormat(cfg) {
    let defs = {
      data:[],
      direction:'row',
      prefix:'',
      wrap:true,
      dataHandler:d=>d,
      viewHandler:d=>d,
    }

    let c = Hive.Visualization.mergeDeep(defs, cfg);
    let stage0 = c.data;

    let len = (c.wrap && !c.len)?Math.ceil(Math.sqrt(stage0.length))
      :d3.min([parseInt(c.len),stage0.length]);

    let wrangled;
    let idx = 0;
    let counter = k => parseInt(idx++/len);
    let revDir = {row:'column', column:'row'};

    wrangled = d3.nest().key(counter
    ).rollup(d => d).object(stage0);


    let keys = Object.keys(wrangled);
    let maxKeys = keys.length;//d3.max(keys, k => wrangled[k].length);
    let root = this.getFacetTemplate(c.prefix, c.direction);
    if (c.wrap) root.attr['flex-wrap'] = 'wrap-wrap';

    keys.forEach((k, i) => {
      let container = this.getFacetItemContainerTemplate(root.id, i, c.direction);
      if (c.wrap) {
        container.attr.width =  c.direction=='row'?'100%':`${100/maxKeys}%`;
        container.attr.height = c.direction=='row'?`${100/maxKeys}%`:'100%';
      }
      root.children.push(container);
      // change percent to fraction
      let items = this.getFacetItemTemplate(container.id, c.direction, len);
      container.children = items;

      items.forEach((f, j) => {
        let isRow = (c.direction=='row');
        c.dataHandler(f, wrangled[k][j], {init:(k==0 && j==0), x:isRow?j:i, y:isRow?i:j, numX:isRow?len:maxKeys, numY:isRow?maxKeys:len});
      });
    });


    return(root);
  }
}
