// Template infrastructure for guides

Hive.templatePlugins.push({
  init:function() {

    // primitive opts for this module
    let margins = {
      all:0,
      // right:0,
      // bottom:0,
      // left:0
    };

    let textAnchor = {
      margins:this.clone(margins)
    };

    // guide template opt
    let guide = {};
    let fontSize = 16;

    guide.title = {
      margins:this.clone(margins, {right:10}),
      textAnchor:this.clone(textAnchor, {margins:{top:fontSize, bottom:5}}), // text height
      attr:{'font-size':fontSize, 'font-family':'Roboto', 'font-style':'normal', 'font-weight':500},
      text:{format:d=>d, textAnchor:'lb'}
    };

    guide.container = {};

    guide.container.item = {
      label:{
        textAnchor:this.clone(textAnchor),
        attr:{'font-size':14, 'font-family':'Roboto', 'font-style':'normal'},
        text:{format:d=>d, textAnchor:'lm', yOffset:-2},
        rangeFontSize:10
      },
      margins:this.clone(margins, {all:2}),
      icon:{
        height:16,
        width:16
      },
      qty:4,
    };

    ['right','bottom'].forEach((dir, i) => {
      this.opt.basic.guide[dir] = {...this.opt.basic.guide[dir], ...guide};
    });
  },

  proto: {
    formatGuideID : function(o) {
      let fields = ['g', 't', 'c', 'i'].filter(f=>f in o); // guide, title, container, item
      let string = '';
      fields.forEach((f, i) => {
        if (f in o) string += `${i?'_':''}${f}-${o[f]}`;
      });
      return string;
    },

    // guideContainer : function(opt, gIdx) {
    //   let template = {id:this.formatGuideID({g:gIdx}), attr:{'min-width':0, 'flex-wrap':'wrap-wrap', 'flex-direction':'flex-direction-row'}, children:[]};
    //   Object.keys(opt.margins).forEach((dir, i) => {
    //     template.attr[`margin edge-${dir}`] =  opt.margins[dir];
    //   });
    //
    //   return template;
    // }

    guideTitle : function(opt, gIdx, tIdx) {

      let template = {id:this.formatGuideID({g:gIdx, t:tIdx}), attr:{'justify-content':'justify-center', 'align-items':'align-flex-start'},//width:0, height:guideHeight,
        children:[
          {id:'title', attr:{'justify-content':'justify-flex-end', 'align-items':'align-flex-start'}, children:[ //width:0, height:16,
            {id:'text', attr:{}}// width:0, height:0
          ]}
        ]};

      let node = template;
      Object.keys(opt.margins).forEach((dir, i) => {
        node.attr[`margin edge-${dir}`] = (node.attr[`margin edge-${dir}`]||0) + opt.margins[dir];
      });

      node = this.constructor.getCfgNode(template, 'text');
      Object.keys(opt.textAnchor.margins).forEach((dir, i) => {
        node.attr[`margin edge-${dir}`] = (node.attr[`margin edge-${dir}`]||0) + opt.textAnchor.margins[dir];
      });
      return template;
    },

    guideItemContainer : function(opt, gIdx, cIdx) {
      // let id = `guide${gIdx}ItemContainer${tIdx}`
      let template = {id:this.formatGuideID({g:gIdx, c:cIdx}), attr:{'flex-wrap':'wrap-wrap', 'flex-direction':'flex-direction-row', 'flex-shrink':1}, children:[]};
      Object.keys(opt.container.item.margins).forEach((dir, i) => {
        // template.attr[`margin edge-${dir}`] = opt.container.item.margins[dir];
      });
      return template
    },

    guideItem : function(opt, iIdx, sz) {
      // let id = `guide${gIdx}Container${cIdx}Item${iIdx}`

      let template = {id:this.formatGuideID({i:iIdx}), attr:{'flex-wrap':'wrap-no-wrap', 'flex-direction':'flex-direction-row', 'margin edge-all':2}, children:[
        {id:'icon', attr:{'justify-content':'justify-center', 'align-items':'align-center'}, children:[ //width:guideHeight, height:guideHeight,
          {id:'center', attr:{width:0, height:0}}
        ]},
        {id:'title', attr:{width:0, 'justify-content':'justify-center', 'align-items':'align-flex-start', 'margin edge-right':5}, children:[///*text width*/, height:guideHeight,
          {id:'text', attr:{width:0, height:0, 'justify-content':'justify-flex-end', 'align-items':'align-flex-start', 'margin edge-left':3}},
        ]},
      ]};

      Object.keys(opt.margins).forEach((dir, i) => {
        template.attr[`margin edge-${dir}`] =  template.attr[`margin edge-${dir}`]||0 + opt.margins[dir];
      });

      let node = this.constructor.getCfgNode(template, 'icon');
      node.attr.width = sz||opt.icon.width;
      node.attr.height = sz||opt.icon.height;

      node = this.constructor.getCfgNode(template, 'text');
      Object.keys(opt.label.textAnchor.margins).forEach((dir, i) => {
        node.attr[`margin edge-${dir}`] =  node.attr[`margin edge-${dir}`]||0 + opt.label.textAnchor.margins[dir];
      });
      return template;
    },

    guideRange : function(opt, w, h, tItem, margin, dir) {
      let id = 'range'; //this.formatGuideID({g:gIdx, c:cIdx})+'-range';

      let rotate = 0;
      let oDir = dir=='row'?'column':'row';
      let tickW = `${(100/tItem.length)*.15}%`, tickH = tickW;
      let optAttr = {};

      if (dir == 'row') {
        rotate = 90;
        tickH = "25%";
        optAttr = {"margin edge-bottom":margin.bottom};
      } else
        tickW = "25%";

      let ticks = tItem.map((d,i)=>{return{"id":`tick-${i}`,
        "attr":{"width":tickW, "height":tickH}
      }});

      let text = tItem.map((d,i)=>{return{"id":`text-${i}`,
        "attr":{"width":0, "height":0, ...optAttr}
      }});

      return {
        "id": id,
        "attr": {
          "flex-direction":"flex-direction-"+oDir,
          "flex-wrap": "wrap-wrap",
          "margin edge-left":margin.left,
          "margin edge-right":margin.right
        },
        "children": [
          {"id":"gradient", "opt":{"rotate":rotate}, children:ticks,
            "attr":{"width":w, "height":h, "flex-direction":"flex-direction-"+dir, 'align-items':'align-flex-end', 'justify-content':'justify-space-between'}},
          {"id":"labels", "opt":{"rotate":rotate}, children:text,
            "attr":{"flex-direction":"flex-direction-"+dir, 'align-items':'align-flex-end', 'justify-content':'justify-space-between'}},
          // {"id":"labels",   "attr":{"flex-direction":"flex-direction-"+dir, "width":labW, "height":labH}, "children":labels}
        ]
      }
    }
  }
});

// gguideRange : function(gIdx, cIdx, guideSize, qty, dir, fontSize) {
//   let textPad = this.opt.basic.guide[dir=='row'?'bottom':'right'].container.item.label.textAnchor.margins[dir=='row'?'top':'left'] || 0;
//   let id = this.formatGuideID({g:gIdx, c:cIdx})+'-range';
//   let h = guideSize+textPad;
//   let w = guideSize*qty;
//   let rotate = 90;
//
//   // for row
//   let gradW = "100%";
//   let gradH = guideSize
//   let labW = "100%";
//   let labH = textPad;
//
//   let tickAttr = "height";
//   let edge = 'right';
//   let margin = 100/qty;
//
//   if (dir == 'column') {
//     h = guideSize*qty;
//     w = guideSize+textPad;
//
//     gradW = guideSize;
//     gradH = "100%";
//     labW = textPad;
//     labH = "100%";
//     tickAttr="width";
//     edge="bottom";
//     rotate = 0;
//   }
//
//   let ticks = Array(qty+1).fill().map((d,i) => {
//     let proto = {
//       "id": id+"-tick-"+i,
//       "attr": {
//         ["margin edge-"+edge]: i==qty?0:guideSize,
//         "width":0,
//         "height": 0
//       }
//     }
//     proto.attr[tickAttr] = guideSize;
//     return proto;
//   });
//
//   let labels = Array(qty+1).fill().map((d,i) => {
//     let proto = { "id": id+"-tickLabel-"+i , "attr": {"width":0}};
//     let attrs = {
//       row:{"margin edge-right":i==qty?0:guideSize},
//       column:{"margin edge-left":textPad,"margin edge-bottom":guideSize-(fontSize/1.8), "height": fontSize/2
//     } //"margin edge-bottom":guideSize-(fontSize/1.8), "height": fontSize/2
//     }
//     proto.attr = {...proto.attr, ...attrs[dir]}
//     return proto;
//   });
//
//   return {
//     "id": id,
//     "attr": {
//       "flex-wrap": "wrap-wrap",
//       "height": h,
//       "width": w
//     },
//     "children": [
//       {"id":id+"-gradient", "attr":{"flex-direction":"flex-direction-"+dir, "width":gradW, "height":gradH}, "children":ticks, "opt":{"rotate":rotate}},
//       {"id":id+"-labels",   "attr":{"flex-direction":"flex-direction-"+dir, "width":labW, "height":labH}, "children":labels}
//     ]
//   }
// }
