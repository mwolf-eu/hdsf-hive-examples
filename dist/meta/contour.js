'use strict'

Hive.Type.contour = function (vis, sz, cfg) {
  let data = vis.getData();
  let inp = data.filter(d => d.name == cfg.in)[0];
  let out = data.filter(d => d.name == cfg.out)[0];

  let rk = {'bbox.w':sz.w, 'bbox.h':sz.h, 'translate.x':sz.x, 'translate.y':sz.y};
  let ck = [{key:'x', accDes:`{${cfg.x}}`}, {key:'y', accDes:`{${cfg.y}}`}];
  let sa = vis.tk.accessors.getScaledAccessors(ck, rk, inp.content);

  let x = sa.x().range([0,sz.w]); // update range
  let y = sa.y().range([sz.h,0]);

  // main methods
  let cdFcn = d3.contourDensity();
  let contourCfg = {x:d => x(d[x.field]), y:d => y(d[y.field]),
    size:[sz.w, sz.h], ...cfg.opts};

  // other methods
  Object.keys(contourCfg).forEach((m, i) => {
    cdFcn = cdFcn[m](contourCfg[m]);
  });

  // generate & format data
  out.content = cdFcn(inp.content).map((item, i) => {
      return {value:item.value, feature:item};
    });

  return out.content
}
