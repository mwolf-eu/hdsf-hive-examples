import "./facet.js";

Hive.guide = class {
  constructor(handlers) {
    this.guideSAs = [];
    this.h = handlers;

    this.templates = this.h.getTemplates();
  }

  combineByDomain(sas, guideOpts) {
    let go = guideOpts.map((d,i)=>d.map(e=>{return{...e, idx:i}})).flat().flatMap(d=>{
      if (Array.isArray(d.key))
      return [{...d, key:d.key[0]}].concat(d.key.slice(1).map(k=>{return{...d, key:k}}))
      return d;
    });

    let callOrder = ['attr.stroke-dasharray', 'shape', 'size', 'attr.fill', 'attr.stroke'];

    let list =  d3.nest().key(k=>sas[k.key]().domain().sort())
    .key(k=>k.idx).rollup(d=>
      d.sort((a,b)=>callOrder.indexOf(a.key)-callOrder.indexOf(b.key))
    ).entries(go);

    list.forEach((l, i) => {
      l.call = Object.assign({}, ...l.values.flatMap(o=>o.value)); // merge all calls
      delete l.call.key;
      delete l.call.idx;
      delete l.call.field;
    });
    return list;
  }

  // GUIDES fill color, stroke color, dash, point: shape/size
  addAll(sas, guideOpts) {
    if (this.guideSAs.length) return; // only make guides once

    let guides = this.combineByDomain(sas, guideOpts); // combine guideOpts by domain

    // When making ranges w continuous domains the sa is sampled x times per
    // the specified qty.  Eg: If the qty = 4 and qtySamples = 3. The range
    // is sampled 12x for gradient stop colors.
    let qtySamples = 2;

    guides.forEach((g, i) => { // by domain

      let opt, dir, guideSize;  // set guide type
      if (g.call.frame.includes('guide-right')) {
        dir = 'column';
        opt = this.templates.opt.basic.guide.right;
        guideSize = opt.container.item.icon.height;
      }
      else {
        dir = 'row';
        opt = this.templates.opt.basic.guide.bottom;
        guideSize = opt.container.item.icon.width;
      }

      let gItemContainer = this.templates.guideItemContainer(opt, i, 0);
      let gicId = gItemContainer.id;
      let guideFrameObjs = [];
      guideFrameObjs.push(gItemContainer);

      let guideUnits = g.call.qty || opt.container.item.qty;

      let label = opt.container.item.label
      let iconLabelCfg = this.h.mergeDeep({name:'label', attr:label.attr, opt:{text:label.text}}, g.call.labelOpt||{});

      let continuousDomains =
      ["linear", "pow", "sqrt", "log", "time", "sequential", "quantize"];

      let gTitle;
      let guideDrawObjs = [];

      g.values.forEach((vs, j) => {  // guides -> values

        let localDrawObjs = [];
        let labelDrawObjs = [];

        if(j == 0){
          gTitle = this.templates.guideTitle(opt.title, i, j)
          guideFrameObjs.unshift(gTitle); // prepend
          let titleLabelCfg = this.h.mergeDeep({name:'label', frame:`${g.call.frame} > ${gTitle.id} text`,
            content:g.call.title, attr:opt.title.attr, opt:{text:opt.title.text}}, g.call.titleOpt||{});
          labelDrawObjs.push(titleLabelCfg);
        }

        vs.value.forEach((v, k) => { // values -> value

          let sa = sas[v.key];
          if (sas[v.key]().field==undefined) return; // all guide SAs must be scales
          this.guideSAs.push(sa());

          if (continuousDomains.includes(sa().cfg.type)) { // range scales
            // let sa = sas[keys[0]]; // Will this ever be > 1?

            if (v.key == 'attr.fill' || v.key == 'attr.stroke') { // add label add shape/color

              let text = d3.quantize(d3.scaleLinear().range(sa().domain()), guideUnits+1); // labels
              let grad = d3.quantize(d3.scaleLinear().range(sa().domain()), guideUnits*qtySamples)
              .map(d=> {return{'stop-color':sa({[sa().field]:d})}});

              // let gItem = this.templates.guideRange(i, j, guideSize, guideUnits, dir, 11); // labelFontSize ////!!!!
              let w = opt.container.item.icon.width;
              let h = opt.container.item.icon.height;
              if (dir=='row') w *= guideUnits;
              else h *= guideUnits;

              let margin = {right:0, bottom:0, left:0};
              if (dir == 'row') {
                text.forEach((t, i) => {
                  let rv = Hive.Text.format (t, iconLabelCfg);
                  if (i==0) margin.left = rv.bbox.w/2;
                  if (i==text.length-1) margin.right = rv.bbox.w/2;
                  margin.bottom = rv.bbox.h>margin.bottom ? rv.bbox.h:margin.bottom;
                });
              }

              let gItem = this.templates.guideRange(opt, w, h, text, margin, dir);
              gItemContainer.children.push(gItem);

              // gradient
              guideDrawObjs.push({name:'area', frame:gicId+' gradient', data:'_area-fill_', attr:{fill:grad}, x:'{_builtin-x_}', y0:'{_builtin-y_}', y1:0});

              // ticks
              let gradIDs = this.templates.constructor.getCfgNode(gItem, gItem.id+' gradient').children.map(d=>d.id);
              gradIDs.forEach((d, i) => {
                guideDrawObjs.push({name:'area', frame:d, data:'_area-fill_', attr:{fill:'white', opacity:.6}, x:'{_builtin-x_}', y0:'{_builtin-y_}', y1:0});
              });

              // labels
              let labIDs = this.templates.constructor.getCfgNode(gItem, gItem.id+' labels').children.map(d=>d.id);
              labIDs.forEach((d, i) => {
                let label = {frame:`${gItem.id} ${d}`, content:text[i], ...iconLabelCfg};
                label.attr['font-size'] = opt.container.item.label.rangeFontSize;
                if (dir=='row')
                label.opt.text.textAnchor ='tm';
                else
                label.opt.text.textAnchor ='lm';
                guideDrawObjs.push(label);
              });
            }

            if (v.key == 'size') { // size range
              let ticks = sa().ticks(guideUnits)
              let sizes = ticks.map(d => sa({[sa().field]:d}));
              guideSize = Math.sqrt(sizes.slice(-1)[0]);

              ticks.forEach((sz, k) => {
                let gItem = this.templates.guideItem(opt.container.item, k, Math.sqrt(sizes.slice(-1)));
                gItemContainer.children.push(gItem);

                let iconCfg = {name:'point', frame:`${gicId} > ${gItem.id} center`, data:'_guide-center_', size:sizes[k], x:0, y:0};
                if (! (g.call.shape in sas)) iconCfg.shape = g.call.shape; // if shape is an sa then use default
                guideDrawObjs.push(iconCfg);
                guideDrawObjs.push({frame:`${gicId} > ${gItem.id} text`, content:sz, ...iconLabelCfg});
              });
            }

          } else { // discrete domain scales
            sa().domain().sort().forEach((item,r) => { // domain in sa
              let val = sa({[sa().field]:item});

              if (j == 0 && k == 0) { // only make new items/labels for first set
                let gItem = this.templates.guideItem(opt.container.item, `${k}-${r}`);
                gItemContainer.children.push(gItem);
              }

              let nodeSel = `${gicId} > ${gItemContainer.children[r].id} `; // selector

              if (localDrawObjs.length < (sa().domain().length)) {
                switch (v.key) { // put drawable in first
                  case 'attr.stroke-dasharray':
                    localDrawObjs.push({name:'line', frame:`${nodeSel}icon`, data:'_guide-line_', attr:{'stroke-dasharray':val, 'stroke-width':3}, x:'{_builtin-x_}', y:'{_builtin-y_}'});
                    break;
                  case 'shape':
                    localDrawObjs.push({name:'point', frame:`${nodeSel}center`, data:'_guide-center_', attr:{}, size:10, shape:val, x:0, y:0});
                    break;
                  default:
                    let area = {name:'area', frame:`${nodeSel}icon`, data:'_area-fill_', attr:{"stroke-width":.7}, x:'{_builtin-x_}', y0:'{_builtin-y_}', y1:0};
                    if (v.key == 'attr.fill') area.attr.fill = val;
                    if (v.key == 'attr.stroke') area.attr.stroke = val;
                    localDrawObjs.push(area);
                }

                if (guideDrawObjs.length == 0) {
                  // if (r == 0){
                  //   gTitle = this.templates.guideTitle(opt.title, i, j)
                  //   guideFrameObjs.unshift(gTitle); // prepend
                  //   let titleLabelCfg = this.h.mergeDeep({name:'label', frame:`${g.call.frame} > ${gTitle.id} text`,
                  //     content:g.call.title, attr:opt.title.attr, opt:{text:opt.title.text}}, g.call.titleOpt||{});
                  //   labelDrawObjs.push(titleLabelCfg);
                  // }
                  labelDrawObjs.push({frame:`${nodeSel}text`, content:item, ...iconLabelCfg});
                }
              } else {
                let ldo = localDrawObjs[r];
                switch (v.key) {
                  case 'attr.fill':
                    ldo.attr.fill = val
                    break;
                  case 'attr.stroke':
                    ldo.attr.stroke = val;
                    break;
                  case 'size':
                    ldo.size = val;
                    break;
                }
              }
            });
          }
        });

        guideDrawObjs.push(...labelDrawObjs, ...localDrawObjs);
      });

      if (dir == 'column'){ // set layout watermarks
        gItemContainer.attr['flex-direction'] = "flex-direction-column";
        if ('itemsHeightMax' in g.call)
        gItemContainer.attr['max-height'] = g.call.itemsHeightMax;
      } else {
        if ('itemsWidthMax' in g.call)
        gItemContainer.attr['max-width'] = g.call.itemsWidthMax;
      }

      let frame = this.h.getFrame(g.call.frame);
      frame.children.push(...guideFrameObjs);
      this.h.drawPush(guideDrawObjs);

      // Within a guide item make all widths equal.
      // get largest content width
      let widths = guideDrawObjs.filter(d=>d.name=='label').map((item, i) => {
        let rv = Hive.Text.format (item.content, {...item.opt.text, attr:item.attr});
        return rv.bbox.w
      });
      let maxWidth = d3.max(widths);

      // set title width
      this.templates.constructor.getCfgNode(guideFrameObjs[0], `${gTitle.id} title`).attr.width = maxWidth;
      // set item container children width
      if(guideFrameObjs[1].children[0].id.endsWith('range')) {

      } else {
        guideFrameObjs[1].children.forEach(d =>
          d.children.filter(d=>d.id.endsWith('title'))[0].attr.width = maxWidth
        )
      }
    });

  }
}


// USEFUL LATER
// let getNodeSize = function(node){
//   let measures = {padding:{}, margin:{}};
//   let dir = ['top', 'right', 'bottom', 'left'];
//   let mKeys = Object.keys(measures);
//   let attrKeys = Object.keys(node.attr);
//
//   attrKeys.forEach((a, i) => {
//     let split = a.split(/[- ]/);
//     if (split.length != 3) return;
//     let type = split[0];
//     let v = split.pop();
//
//     if (mKeys.includes(type) && dir.concat('all').includes(v) && !isNaN(node.attr[a])) {
//       measures[type][v] = measures[type][v]||0;
//       measures[type][v] += node.attr[a];
//     }
//   });
//
//   mKeys.forEach((m, i) => { // default to all or 0
//     let key = measures[m];
//     dir.forEach((d, i) => {
//       if (key[d] == undefined) {
//         if (key.all) key[d] = key.all;
//         else key[d] = 0;
//       }
//     });
//   });
//
//   measures.total = {
//     h : measures.padding.top + measures.padding.bottom +
//     measures.margin.top + measures.margin.bottom + (+node.attr.height||0),
//     w : measures.padding.left + measures.padding.right +
//     measures.margin.left + measures.margin.right + (+node.attr.width||0)
//   };
//   return measures;
// }
