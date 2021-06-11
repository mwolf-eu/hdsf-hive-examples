// sun/star burst csv to obj wrangler
"use strict";

Hive.Type.heirarchical = class {

  /**
  * Create a data structure heirarchical charts
  *
  * @param Array Data objects
  * @param string The ID to sort on
  * @param string The parent element
  * @param string The field to sort on
  * @param string Name of the root element
  * @return data structure
  */
  static convert(data, id, pf, val, rootName){
    let rkids = []
    data.forEach((item, i) => {
      if (item[pf] == null) rkids.push(item); // is a parent
      else { // should be sorted if efficiency isn't great
        let p = data.filter(d => d[id]== item[pf])[0];
        if(! p.children) p.children = [];
        p.children.push(item);
      }
    });

    let root = {id: rootName, children:rkids}

    let partition = d3.partition().size([1000, 1000])
      .padding(1)(d3.hierarchy(root)
        .sum(d => d[val])
        .sort((a, b) => b.height - a.height || b.value - a.value))

    let desc = partition.descendants().map(d => {
      let rv = {...d.data, x:d.y0, b:d.x0, x0:d.x0, x1:d.x1, y0:d.y0, y1:d.y1, xdif:d.x1-d.x0, ydif:d.y1-d.y0};
      rv['lx'] = rv.x + (rv.ydif/2); // rectangle label xy
      rv['ly'] = rv.b + (rv.xdif/2);

      let ymid = rv.y0>1?(rv.ydif/2):0;
      let xmid = ((rv.x1-rv.x0)/2)
      let rs = d3.scaleLinear().domain([0,1000]).range([0,Math.PI*2]); // radian scaler

      rv['lrx'] = ((rv.y0 + ymid) * Math.sin(rs(rv.x0 + xmid))); // rotation labels xy
      rv['lry'] = ((rv.y0 + ymid) * Math.cos(rs(rv.x0 + xmid)));
      rv['depth'] = d.depth;
      rv['height'] = d.height;
      rv['value'] = d.value;
      delete rv['children'];

      return rv;
    })
    return desc;
  }
}
