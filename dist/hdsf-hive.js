(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.mod = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
Hive.Accessors = class {

  /**
  * Initialize locals
  *
  * @param object Functions from core
  * @return none
  */
  constructor(handlers) {
    this.h = handlers;
    this.generated = {accessors:{}}; // generated accessors
  }

  /**
  * Creates a scale for each accessor object in cfg and adds it to the scaleDict obj.
  * Since any accessor can be used in any frame, the range is deferred until the plugin runs.
  *
  * @param object The accessor cfg
  * @return none
  */
  entry (cfg) {
    let builtins ={ // used for builtin data
      "_builtin-x_":{field:'x', domain:[0,100], type:'linear', range:'width'},
      "_builtin-y_":{field:'y', domain:[0,100], type:'linear', range:'-height'}
    }
    this.cfg = {...builtins, ...cfg};
    this.scaleDict = {};
    this.dynMethods = ['domain', 'range']; // methods whose args can be uniq for each draw

    Object.keys(this.cfg).forEach((d, i) => {
      let c = this.cfg[d];
      let type = c.type.charAt(0).toUpperCase() + c.type.slice(1);

      this.scaleDict[d] = d3[`scale${type}`]();

      // set opts
      let methods = Object.keys(this.scaleDict[d]);
      methods.forEach((item, i) => {
        // set variable ranges or domains later
        if (this.dynMethods.includes(item) && !Array.isArray(c[item])) return;
        if (item in c) this.scaleDict[d][item](c[item]);
      });

      this.scaleDict[d].cfg = this.cfg[d];
      this.scaleDict[d].field = 'field' in c?c.field:d;
    });
  }

  /**
  * Parse the accessor section, resolve the scales with the local frame sizes,
  * and return the set of functions for all plugin config fields requested.
  *
  * @param object Draw attribute and accessor pairs
  * @param object Bbox stats
  * @param array  Draw data
  * @return An object containing the accessor functions
  */
  getScaledAccessors(keyPairs, relKeys, data) {
    let saDict = {}; // finalized scaled accessors
    let continuousDomains =
    ["linear", "pow", "sqrt", "log", "time", "sequential", "quantize"];

    let dynSetter = {
      domain:(domain, relKeys, sa) => {
        // set special keys here
        // if domain does not exist & special type of scale then do extents
      },
      range:(range, relKeys, sa) => {
        sa.range([0,1]);
        let rBeg = sa.bandwidth?sa.bandwidth()/2:0; // band scale? offset range begin

        if(range == "width")
          return [relKeys['bbox.w']*rBeg, relKeys['bbox.w'] + relKeys['bbox.w']*rBeg];

        if(range == "height")
          return [- rBeg * relKeys['bbox.h'], relKeys['bbox.h'] - (relKeys['bbox.h'] * rBeg)];

        if(range == "-height")
          return [rBeg * relKeys['bbox.h'], - relKeys['bbox.h'] + (relKeys['bbox.h'] * rBeg)];

        if(range == "circleRadians")
          return [0,Math.PI*2];
      }
    }

    // complexKeys.forEach((k) => {
    //   let accDes = getScaledAccessorCfgName(k, cfg); // set sa designator
    //   if (accDes == undefined) return;  // bail if not defined
    keyPairs.forEach((kp) => {
      let k = kp.key;
      let accDes = kp.accDes;

      if (typeof accDes == 'string') {

        function createSA(accDes) {
          if (accDes in this.cfg) {
            let sa = this.scaleDict[accDes]; // set scaled accessor
            let c = sa.cfg;

            // Resolve draw cfg context specific domains & ranges
            this.dynMethods.forEach((item, i) => {
              if(item in c && typeof c[item] == 'string')
              sa[item]( dynSetter[item](c[item], relKeys, sa) );
              if((! (item in c)) && continuousDomains.includes(sa.cfg.type) && item == 'domain') { // auto extent
                let ext = d3.extent(data, d=>d[sa.field]);
                this.warnExtent(sa.field, ext);
                c.domain = ext;  // UNSET THIS IF DATA CHANGES
                sa[item](ext);
              }
            });

            let preF = (d) => d; // ready pre scaler filter
            if ('preFilter' in this.cfg[accDes])
            preF = this.cfg[accDes].preFilter

            let postF = (d) => d; // ready post scaler filter
            if ('postFilter' in this.cfg[accDes])
            postF = (d,i,data) => {return this.cfg[accDes].postFilter(d,i,data)}

            return (d,i) => {
              if (d == undefined) return sa;
              let val = d[sa.field];
              if (val == undefined && 'data' in d)
              val = d.data[sa.field];
              return postF(sa(preF(val,i)), i, d);
            } // is scaled object accessor
          } else {
            this.h.error("No scaled accessor named:", accDes);
          }
        }

      // } else { // is a string of some sort
        // if (typeof(accDes) == 'string') {

          let val, sa, col; // val literal, scaled accessor, data col
          function adParse(a) {
            a.replace(/^[^\{\}\[\]]+|(\{[\w\-]+\})|(\[\w+\])/g,
              d=>{
                  if(/^[^\{\}\[\]]+$/.test(d)) val=d; // no diacritical marks == value
                  if(/\{[\w\-]+\}/.test(d)) sa=d.slice(1,-1);  // {x} == scaled accessor
                  if(/\[\w+\]/.test(d)) col=d.slice(1,-1); // [x] == data field
              }
            )
          }

          adParse(accDes);

          // might have to include "" enclosure for literals to include []{}
          if(val && !sa && !col) { // got literal value
            saDict[k] = d => val;
            return;
          }

          if(!val && sa && !col) { // got scaled accessor
            saDict[k] = createSA.bind(this)(sa);
            return;
          }

          if(!val && !sa && col){ // got field
            saDict[k] = d => d[col];
            return;
          }

          if(val && sa && !col) { // got value & scaled accessor
            saDict[k] = d => this.scaleDict[sa](val);
            return;
          }

          // BUG: Having the current function will be a problem on zoom / rotate / etc
          if(!val && sa && col) { // got field and GENERATED scaled accessor
            saDict[k] = this.generated.accessors[sa].bind({field:col});   // is pre-calc col name
            return;
          }

          // // column
          // if (/^\[[\w-]*\]/g.test(accDes)) {
          //   saDict[k] = d => {
          //     if (!d) return {name:'getField'}
          //     let val = d[accDes.slice(1,-1)];
          //     if (val == 'undefined') val = d.data[accDes.slice(1,-1)];
          //     return val   // is pre-calc col name
          //   }
          //   return;
          // }
          //
          // // column by accessor
          // if (/^\[.+\]/g.test(accDes)) {  // BUG: Having the current function will be a problem on zoom / rotate / etc
          //   let args = accDes.slice(1,-1).split(',');
          //   let context = {field:args[1]};
          //   saDict[k] = this.generated.accessors[args[0]].bind(context);   // is pre-calc col name
          //   return;
          // }
          //
          // // value by accessor
          // if (/\(.+\,.+\)/g.test(accDes)) { // bind accessor to specific domain value
          //   let args = accDes.slice(1,-1).split(',');
          //   saDict[k] = d => this.scaleDict[args[0]](args[1]);
          //   return;
          // }
          //
          // // string value
          // if (/\([\w-]*\)/g.test(accDes)) {
          //   saDict[k] = d => accDes;    // is string constant
          //   return
          // }

          this.h.error("Malformed scaled accessor:", accDes);
          return;
        // }
      }

      if (typeof(accDes) == 'object')
        saDict[k] = d => accDes;        // is object

      if (! isNaN(accDes))
        saDict[k] = d => accDes;        // is number constant

      if (typeof(accDes) == 'function')
        saDict[k] = d => accDes;        // is fcn
    });

    return saDict;
  }

  /**
  * Return a scale.
  *
  * @param object Scale key
  * @return A scale
  */
  getScale(n) {
    return this.scaleDict[n];
  }

  /**
  * Print a warning if an extent is derived at run-time.
  *
  * @param object Scale key
  * @param object Derived extent
  * @return none
  */
  warnExtent(field, ext) {
    this.h.warn(`Speed-up! Set the "${field}" domain to: ${JSON.stringify(ext)}!`)
  }

  // OLD_getScaledAccessors(relKeys, complexKeys, cfg, data) {
  //   let sd = this.scaleDict
  //   let accessorDict = {};
  //
  //
  //   complexKeys.forEach((k) => {
  //     if (! k in cfg) return; // bail if not defined
  //     let accDes = cfg;
  //     k.split('.').forEach((param, i) => {
  //       if (accDes == undefined) return;
  //       accDes = accDes[param];
  //     });
  //
  //     if (accDes in this.cfg && 'domain' in this.cfg[accDes])  // late binding of domain
  //       sd[accDes].domain(this.cfg[accDes].domain);
  //
  //     // let accDes = cfg[k];    // accessor designator == scales section key, string, number, function constant, or data col name
  //     if (typeof accDes == 'string') {
  //       if (accDes in this.cfg) {
  //
  //         if (! this.cfg[accDes].domain) {   // calc extents  TODO should be cached
  //           let l = data.map(d => parseFloat(d[accDes]));
  //           l = l.filter(d => !isNaN(d));
  //           let e = d3.extent(l);
  //           this.log('Auto domain:', e[0], e[1]);
  //           sd[accDes] = sd[accDes].domain(e);
  //         }
  //
  //         // set range
  //         if (sd[accDes].range) { // some don't have it.
  //           let range = this.cfg[accDes].range // define correct range
  //           sd[accDes].range([0,1]);
  //           let rBeg = sd[accDes].bandwidth?sd[accDes].bandwidth()/2:0; // band scale? offset range begin
  //
  //           if(Array.isArray(range))
  //             sd[accDes] = sd[accDes].range(range)
  //
  //           if(range == "width")
  //             sd[accDes] = sd[accDes].range([relKeys['bbox.w']*rBeg, relKeys['bbox.w'] + relKeys['bbox.w']*rBeg]);
  //
  //           if(range == "height")
  //             sd[accDes] = sd[accDes].range([- rBeg * relKeys['bbox.h'], relKeys['bbox.h'] - (relKeys['bbox.h'] * rBeg)]);
  //
  //           if(range == "-height")
  //             sd[accDes] = sd[accDes].range([rBeg * relKeys['bbox.h'], - relKeys['bbox.h'] + (relKeys['bbox.h'] * rBeg)]);
  //
  //           if(range == "circleRadians"){
  //             sd[accDes] = sd[accDes].range([0,Math.PI*2])
  //           }
  //
  //         }
  //
  //         let s = sd[accDes] // ready scale function
  //
  //         let fieldCfg = this.cfg[accDes].field;
  //         let field = fieldCfg!=undefined?fieldCfg:accDes
  //
  //         let preF = (d) => d; // ready pre scaler filter
  //         if ('preFilter' in this.cfg[accDes])
  //           preF = this.cfg[accDes].preFilter
  //
  //         let postF = (d) => d; // ready post scaler filter
  //         if ('postFilter' in this.cfg[accDes])
  //           postF = (d,i,data) => {return this.cfg[accDes].postFilter(d,i,data)}
  //
  //         accessorDict[k] = (d,i) => {
  //           if (d == undefined) return s;
  //           let val = d[field];
  //           if (val == undefined && 'data' in d)
  //             val = d.data[field];
  //           return postF(s(preF(val,i)), i, d);
  //         } // is scaled object accessor
  //       } else { // is a string of some sort
  //
  //         if (/^\[[\w-]*\]/g.test(accDes)) {
  //           accessorDict[k] = d => {
  //             if (!d) return {name:'getField'}
  //             return d[accDes.slice(1,-1)]   // is pre-calc col name
  //           }
  //           return
  //         }
  //
  //         if (/getGeneratedAccessor\(.+\)/g.test(accDes)) {  // BUG: Having the current function will be a problem on zoom / rotate / etc
  //           let args = accDes.slice(21,-1).split(',');
  //           let context = {field:args[1]};
  //           accessorDict[k] = this.generated.accessors[args[0]].bind(context);   // is pre-calc col name
  //           return;
  //         }
  //
  //         if (/bindAccessor\(.+\)/g.test(accDes)) { // bind accessor to specific domain value
  //           let args = accDes.slice(13,-1).split(',');
  //           // find the accessor obj and field
  //           let accessor = args[0];
  //           let field = accessor;
  //           let sao = this.cfg[accessor];
  //           if ('field' in sao) {
  //             field = sao.field;
  //           }
  //           // get the scaler and derive the value
  //           let sa = this.getScaledAccessors(relKeys, ['sakey'], {['sakey']:accessor}, null)
  //           let val = sa['sakey']({[field]:args[1]});
  //           accessorDict[k] = d => val;
  //           return;
  //         }
  //
  //         accessorDict[k] = d => accDes;    // is string constant
  //       }
  //     }
  //
  //     if (typeof(accDes) == 'object') {
  //       accessorDict[k] = d => accDes;        // is object
  //     }
  //
  //     if (! isNaN(accDes)) {
  //       accessorDict[k] = d => accDes;        // is number constant
  //     }
  //
  //     if (typeof(accDes) == 'function') {
  //       accessorDict[k] = d => accDes; // is fcn
  //     }
  //
  //   });
  //
  //   return accessorDict;
  // }

  /**
  * Dynamically creates an accessor.  Used currently only for maps.
  *
  * @param object The accessor
  * @param string The accessor key
  * @return none
  */
  // store a dyanamically created accessor
  generateAccessor(f, name) {
    this.generated.accessors[name] = f;
  }

  // setRange(sa) {
  //   sa[name].range([0,1]);
  //   let rBeg = sa[name].bandwidth?sa[name].bandwidth()/2:0; // range begin
  //   sa[name] = sa[name].range([qty*rBeg, qty + qty*rBeg])
  // }

  /**
  * Get defaults for the config accessor section
  *
  * @param object The incomplete user specified accessor cfg
  * @return a complete accessor cfg
  */
  resolveCfg(v) {

    let cfg = {type:"linear", range:"-height"};

    let keys = Object.keys(v);
    keys.forEach((k, i) => {
      let c = JSON.parse(JSON.stringify(cfg));
      v[k] = this.h.mergeDeep(c, v[k]);
    });

    return v;
  }
}

},{}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.lib = void 0;

require("./object.js");

require("./element.js");

require("./accessors.js");

require("./data.js");

require("./templates.js");

require("./meta/guide-templates.js");

require("./frame.js");

require("./draw.js");

// TODO make dynamic import
// export let code = {Hive};
// let Hive = globalThis.Hive;
let lib = {
  Hive
};
exports.lib = lib;
Hive.Visualization = class extends Hive.Object {
  /**
  * Main entry point for drawing a chart/graph.
  *
  * @param object The whole config object.
  * @return none
  */
  constructor(...args) {
    super(args);
    this.tk = {}; // toolkit of other classes

    this.fontPromises = [];
    this.templates = new Hive.templates();

    if (args[0]) {
      this.graph(...args);
    }

    return this;
  }
  /**
  * Print a warning if an extent is derived at run-time.
  *
  * @param object Scale key
  * @param object Derived extent
  * @return none
  */


  setTemplate(t, c) {
    this.v = {
      frames: this.templates[t](c ? c : {})
    };
    return this;
  }
  /**
  * Create a visualization.
  *
  * @param object Vis config
  * @param object Font preloads
  * @return none
  */


  graph(cfg, fonts) {
    let prekit = ["element", "data", "frames", "accessors"];
    let toolkit = ["logLevel", ...prekit, "draw"];

    if (arguments[1] && Array.isArray(arguments[1])) {
      // wait on fonts
      arguments[1].forEach((f, i) => {
        let font = new FontFace(...f);
        this.fontPromises.push(font.load());
      });
    }

    this.v = { ...(this.v || {}),
      ...cfg
    };
    if (!this.v.name) this.v.name = this.uuidv4(); // this.v.name = "g" + this.utf8ToHex(JSON.stringify({graphid:this.uuidv4()}))
    // set root defaults

    this.v = this.resolveCfg(this.v); // class services

    let handlers = {
      mergeDeep: Hive.Object.mergeDeep,
      log: function (a) {
        this.log(...arguments);
      }.bind(this),
      warn: function (a) {
        this.warn(...arguments);
      }.bind(this),
      error: function (a) {
        this.error(...arguments);
      }.bind(this),
      getGraphID: this.getGraphID.bind(this),
      getSize: function () {
        return this.tk.element.renderer.getTargetSize();
      }.bind(this),
      // get size of svg
      frames: function () {
        this.tk.frames.entry(this.v.frames);
      }.bind(this),
      draw: function () {
        this.tk.draw.draw(this.v.draw);
      }.bind(this),
      getData: function (a) {
        return this.tk.data.getData(...arguments);
      }.bind(this),
      getFrame: this.getFrame.bind(this),
      resolveFrame: d => this.tk.frames.resolveNode.bind(this.tk.frames)(d),
      getScaledAccessors: function (a) {
        return this.tk.accessors.getScaledAccessors.bind(this.tk.accessors)(...arguments);
      }.bind(this),
      generateAccessor: function (a) {
        return this.tk.accessors.generateAccessor(...arguments);
      }.bind(this),
      drawPush: function (a) {
        return this.tk.draw.push(...arguments);
      }.bind(this),
      render: d => this.tk.element.render.bind(this.tk.element)(d),
      getTextWidth: d => this.tk.element.getTextWidth(d),
      eventRegister: function (a) {
        this.tk.element.eventRegister(...arguments);
      }.bind(this),
      sendStateChange: this.sendStateChange.bind(this),
      // getScale:(function (a){return this.tk.accessors.getScale(...arguments)}).bind(this)
      getTemplates: d => this.templates // getFixups:d=>this.templates.getFixups(),
      // setFixups:d=>this.templates.setFixups(d),

    };
    prekit.forEach((item, i) => {
      this.tk[item] = new Hive[item[0].toUpperCase() + item.slice(1)](handlers, this.v[item]);
      this.v[item] = this.tk[item].resolveCfg(this.v[item]);
    });
    let modPaths = []; // dyn load code

    if (this.v.element.popup.enabled && !Hive.popup) modPaths.push('./popup.js');
    if (this.v.element.renderer.name == 'svg' && !Hive.Renderer.svg) modPaths.push('./renderers/svg.js');
    if (this.v.element.renderer.name == 'paperjs' && !Hive.Renderer.paperjs) modPaths.push('./renderers/paperjs.js');
    if (this.v.element.renderer.name == 'three' && !Hive.Renderer.three) modPaths.push('./renderers/three.js'); // force area and text for guides

    let modPlugin = this.v.draw.map(d => {
      if (!Hive.Plugins[d.name]) return `./plugins/${d.name}.js`;
    }).filter(d => d);
    let guidePlugins = ['line', 'area', 'label'].map(d => {
      if (!Hive.Plugins[d]) return `./plugins/${d}.js`;
    }).filter(d => d);
    let pluginPaths = [...new Set([...modPlugin, ...guidePlugins])];
    if (!Hive.Plugins) Hive.Plugins = {}; // load plugins.  run bootstrap.

    let promises = [...modPaths, ...pluginPaths].map(d => import(d));
    this.bootstrap(toolkit, promises, handlers);
  }
  /**
  * Call the user supplied state change handler
  *
  * @param object Variable args.  The first is always the state enum.
  * @return none
  */


  sendStateChange(...args) {
    if (this.v.onStateChange) this.v.onStateChange(...args);
  }
  /**
  * Set a scaled accessor.
  *
  * @param object Accessor key
  * @param object Accessor config
  * @return none
  */


  setAccessor(key, value) {
    // TODO: Don't resolve whole cfg every time
    this.v.accessors[key] = value;
    this.tk.accessors.resolveCfg(this.v.accessors);
  }
  /**
  * Return the graph id.
  *
  * @return graph id
  */


  getGraphID() {
    return this.v.name;
  }
  /**
  * Returns the resources allocated by a call to the constructor
  *
  * @return none
  */


  destroy() {
    this.tk.element.destroy();
    this.tk.frames.destroy();
  }
  /**
  * Get all opts (defaults). Currently only used for templates
  *
  * @return opts object
  */


  getOpts() {
    return {
      templates: this.templates.opt
    };
  }
  /**
  * Set opts.
  *
  * @param object An object to merge into the defaults
  * @return none
  */


  setOpts(o) {
    if ('templates' in o) Hive.Visualization.mergeDeep(this.templates.opt, o.templates);
  }
  /**
  * Get renderer instantiation.
  *
  * @return renderer instantiation
  */


  getRenderer() {
    return this.tk.element.renderer;
  }
  /**
  * Get data object
  *
  * @return data config
  */


  getData() {
    return this.tk.data.cfg;
  }
  /**
  * Get data config
  *
  * @return config data section
  */


  getDataCfg() {
    return this.v.data;
  }
  /**
  * Get accessor config
  *
  * @return accessor config section
  */


  getAccessorCfg() {
    return this.v.accessors;
  }
  /**
  * Get all scales
  *
  * @return scales object
  */


  getScales() {
    return this.tk.accessors.scaleDict;
  }
  /**
  * Get draw config
  *
  * @return draw config section
  */


  getDrawCfg() {
    return this.v.draw;
  }
  /**
  * Get accessors from a draw directive
  *
  * @param object Draw directive index
  * @return accessors
  */


  getAccessor(num) {
    return this.tk.draw.pluginState.sa[num];
  }
  /**
  * Get a template node from config
  *
  * @param object node selector
  * @return node
  */


  getFrame(f) {
    return Hive.templates.getCfgNode(this.v.frames, f);
  }
  /**
  * Get draw config
  *
  * @return draw config section
  */


  getDraw() {
    return this.v.draw;
  }
  /**
  * Set draw config
  * @param array draw directives
  *
  * @return none
  */


  setDraw(d) {
    this.v.draw = d;
  }
  /**
  * Get defaults for the config root
  *
  * @param object The incomplete user specified cfg
  * @return a complete root cfg
  */


  resolveCfg(v) {
    let cfg = {
      logLevel: "warn",
      name: 'graph-',
      element: {},
      accessors: {},
      frames: {},
      data: [],
      draw: []
    };
    v = Hive.Object.mergeDeep(cfg, v);
    return v;
  }
  /**
  * Checks that all imports are finished, then starts the config parsing
  *
  * @param object Keys of objects in the config
  * @param object Array of promises
  * @param object Utility Functions
  * @return none
  */


  async bootstrap(keys, promises, handlers) {
    try {
      let fontRv = await Promise.all(this.fontPromises);
      fontRv.forEach((f, i) => {
        if (f.status == 'loaded') document.fonts.add(f); // add font to document
      });
      await Promise.all(promises.concat(this.tk.data.promises)); // should be allSettled?
      // Load plugins late as promises could create new draw entries
      // let modPaths = this.v.draw.map(d => {if (!Hive.Plugins[d.name]) return `./plugins/${d.name}.js`}).filter(d=>d);
      // let drawPaths = [...new Set(modPaths)];
      // let drawPromises = drawPaths.map(d => import(d));
      // await Promise.all(drawPromises);
    } catch (e) {
      console.error(e);
    } // draw init follows plugin loading


    this.tk.draw = new Hive.Draw(handlers);
    this.v.draw = this.tk.draw.resolveCfg(this.v.draw);
    keys.forEach((item, i) => {
      // run all entry points
      if (typeof this.v[item] == "object") this.tk[item].entry(this.v[item]);
    });
    this.tk.element.getElement()._visualization = this;
    this.sendStateChange('PARSE_CFG_END', this);
  }

  redraw() {
    this.tk.element.resize();
  } // TEST BEFORE ENABLING
  // /**
  // * Returns the current config
  // *
  // * @return the config
  // */
  // getConfig() {
  //   return this.v;
  // }
  //
  // /**
  // * Sets a new configuration
  // *
  // * @param object The new cfg
  // * @return none
  // */
  // setConfig(cfg) {
  //   this.v = cfg;
  //   this.accessors(cfg.accessors);
  //   this.rendererObj.redraw();
  // }
  // /**
  // * Merge data into an existing config
  // * This assumes unique id's which don't conflict
  // *
  // * @param object The new cfg
  // * @param boolean If the new config should trigger a redraw
  // * @return none
  // */
  // // merge accessors, frames, data, draw
  // // assumes unique id's don't conflict
  // mergeConfig(newCfg, update=true) {
  //   let mergeObjs = ['accessors','frames','data','draw'];
  //   mergeObjs.forEach((o, i) => {
  //     if (! newCfg[o]) return;
  //     if (Array.isArray(this.v[o]))
  //       this.v[o] = [...this.v[o], ...newCfg[o]];
  //     else
  //       this.v[o] = {...this.v[o], ...newCfg[o]};
  //   });
  //
  //   this.v = this.resolveCfg(this.v);
  //
  //   this.accessors(this.v.accessors);
  //   if(update)
  //     this.rendererObj.redraw();
  // }

  /**
  * Looks at a scaled accesor range and
  * returns a gradient object
  *
  * @param object Scaled accessor key
  * @param boolean Visualization config
  * @return a gradient object
  */


  static genGradientFromSA(sa, cfg) {
    if (!cfg) cfg = this.v;
    let range = cfg.accessors[sa];
    if (range) range = range.range;else {
      this.warn('No scaled accesor key:', sa);
      return;
    }
    return range.map(d => {
      return {
        'stop-color': d
      };
    });
  }
  /**
  * Download an SVG
  *
  * @return none
  */


  export() {
    this.tk.element.export();
  }

};

},{"./accessors.js":1,"./data.js":3,"./draw.js":4,"./element.js":5,"./frame.js":6,"./meta/guide-templates.js":8,"./object.js":10,"./templates.js":27}],3:[function(require,module,exports){
Hive.Data = class {

  /**
  * Initialize locals
  *
  * @param object Functions from core
  * @param object Data config section
  * @return none
  */
  constructor(h, cfg) {
    this.h = h;

    this.cfg = cfg;
    this.promises = [];
    cfg.forEach((item, i) => {
      if (typeof item.url == 'string') {
        let type = item.url.split('.').pop().toLowerCase();
        if (['csv', 'tsv'].includes(type)){
          this.promises.push(d3[type](item.url)
            .then( function(d){
              item.content = d;
              if (item.handler) item.content = item.handler(d);
            })
          );
        } else {
          this.h.error('No loader for file type:', type);
        }
      }
    });
  }

  /**
  * Parses the data array.  This is a stub for future addons which may include:
  * Getting data from urls
  * Verification and wrangling callbacks
  *
  * @param object The relevant data array object
  * @return none
  */
  entry (cfg) {
    // promises are made in constructor
  }

  /**
  * Returns the dataset promises, if any.
  *
  * @return dataset promises
  */
  getPromises() {
    return this.promises;
  }

  /**
  * Gets a data object for a plugin
  *
  * @param object The plugin cfg
  * @return a data array
  */
  getData(drawCfg) {
    let data;
    if (drawCfg.data && typeof drawCfg.data == 'string') {
      // Built-in datas
      // if (drawCfg.data == '_guide-line_')
      switch(drawCfg.data) {
        case '_guide-center_':
          data = [{}];
          break;
        case '_zero_':
          data = [{x:0, y:0}];
          break;
        case '_guide-line_':
          data = [{x:0, y:50}, {x:100, y:50}];
          break;
        // case '_guide-line-end25-column_': // for column guide
        //   data = [{x:75, y:50}, {x:100, y:50}];
        //   break;
        // case '_guide-line-end25-row_':
        //   data = [{x:50, y:25}, {x:50, y:0}];
        //   break;
        case '_area-fill_':
          data = [{x:0, y:100}, {x:100, y:100}];
          break;
        default:
          data = this.cfg.filter(d => drawCfg.data==d.name)[0].content;
      }
    } else
      data = this.cfg[0].content;

    return data
  }

  /**
  * Get defaults for the config data section
  *
  * @param object The incomplete user specified data cfg
  * @return a complete data cfg
  */
  resolveCfg(v) {
    let cfg = {"name":"data-0"};
    v = v.map((data, i) => {
        let lcfg = JSON.parse(JSON.stringify(cfg));
        return this.h.mergeDeep(lcfg, data)
      });
    return v;
  }
}

},{}],4:[function(require,module,exports){
"use strict";

require("./meta/guide.js");

Hive.Draw = class {
  /**
  * Initialize locals
  *
  * @param object Functions from core
  * @return none
  */
  constructor(handlers) {
    this.h = handlers;
    this.generated = {};
  }
  /**
  * Entry stub
  *
  * @return none
  */


  entry() {}

  /**
  * Sets up and calls each plugin listed in the draw array, adds result to svg.
  *
  * @param object The draw subsection of the config
  * @return none
  */
  draw(cfg) {
    this.cfg = cfg;
    this.pluginState = {
      curIdx: 0,
      layer: [],
      svg: null,
      sa: []
    };
    let eSize = this.h.getSize();
    let attr = {
      'width': eSize.w,
      'height': eSize.h,
      xmlns: "http://www.w3.org/2000/svg"
    };
    let svg = this.createElement(attr, 'svg', null); // call each draw object

    let handlers = {
      // wrap:this.wrap.bind(this),
      text: this.text,
      getDrawWidth: this.getDrawWidth.bind(this),
      getObjPath: this.getObjPath,
      configGen: this.configGen.bind(this),
      configElement: this.configElement.bind(this),
      configElements: this.configElements.bind(this),
      createElement: this.createElement,
      // resolveFrame:this.h.resolveFrame,
      generateAccessor: this.h.generateAccessor,
      log: this.h.log,
      warn: this.h.warn,
      error: this.h.error
    };

    for (let i = 0, item = cfg[i]; i < cfg.length; item = cfg[++i]) {
      this.pluginState.curIdx = i;
      this.layer = this.pluginState.layer[i];
      let id = this.formatID({
        g: this.h.getGraphID(),
        n: cfg[i].name,
        d: i
      });
      let g = this.createElement({
        id
      }, 'g', null);
      let frame = cfg[i].frame;
      let layer = {
        handler: Hive.Plugins[item.name],
        g: g,
        template: {
          calls: []
        }
      };
      let genID = this.genID(id); // svg id generator

      layer.genID = () => genID.next().value; // attach


      if (!layer.handler) {
        this.h.warn('No handler for plugin:', item.name);
        return;
      }

      layer.rk = this.h.resolveFrame(frame); // always get relative keys

      function getObjPaths(o, root) {
        let p = [];
        Object.keys(o || {}).forEach((k, i) => {
          if (typeof o[k] == 'object' && !Array.isArray(o[k])) p = p.concat(getObjPaths(o[k], `${root ? root + '.' : ''}${k}`));else p.push(`${root ? root + '.' : ''}${k}`);
        });
        return p;
      }

      layer.d = this.h.getData(cfg[i]);
      let attrPath = getObjPaths(cfg[i].attr, 'attr').filter(a => (a.match(/\./g) || []).length == 1);
      let oPaths = [...attrPath, ...getObjPaths(cfg[i].opt, 'opt')];
      if (layer.handler.genAccessors) oPaths = oPaths.concat(layer.handler.genAccessors.bind(layer.handler)(handlers));
      let saKeys = oPaths.map(d => {
        return {
          key: d,
          accDes: this.getScaledAccessorKey(d.replace(/[()]/g, ''), cfg[i])
        };
      }).filter(d => d.accDes || !isNaN(d.accDes));
      layer.sa = this.h.getScaledAccessors(saKeys, layer.rk, layer.d);
      this.pluginState.sa[i] = layer.sa; // store for guides

      layer.handler.draw(item, handlers, layer); // template upstreaming - first run only
      // possible args cmd, target array, attr

      let runOp = (cmd, n, d, callee) => {
        if (!cmd.op || cmd.op == 'set') {
          this.h.log('set', n.id, cmd.attr, d[1]);
          n.attr[cmd.attr] = d[1];
        }

        if (cmd.op == 'add') {
          let val = (n.attr[cmd.attr] || 0) + d[1];
          this.h.log(cmd.op, n.id, cmd.attr, val, 'cur', n.attr[cmd.attr]);
          n.attr[cmd.attr] = val;
        }

        if (cmd.op == 'subCur') {
          let val = callee.attr[cmd.srcAttr] || 0;
          this.h.log(cmd.op, n.id, cmd.srcAttr, 'cur', val, cmd.dstAttr);
          n.attr[cmd.dstAttr] = (n.attr[cmd.dstAttr] || 0) - val;
        }
      };

      let nodeCfg = this.h.getFrame(cfg[i].frame);

      if (!this.guide && nodeCfg && nodeCfg.handlers) {
        // node has cmds
        layer.template.calls.forEach(d => {
          // for all cmds to call
          if (d[0] in nodeCfg.handlers) {
            // if node supports command
            let cmds = nodeCfg.handlers[d[0]];
            cmds.forEach((cmd, i) => {
              // make all changes
              if (!cmd.nodes) runOp(cmd, nodeCfg, d);else {
                cmd.nodes.forEach((n, i) => {
                  if (n.endsWith('*')) {
                    // do all children
                    let children = this.h.getFrame(n.slice(0, -1)).children;
                    children.forEach((c, i) => {
                      runOp(cmd, c, d, nodeCfg);
                    });
                  } else {
                    runOp(cmd, this.h.getFrame(n), d, nodeCfg);
                  }
                });
              }
            });
          }
        });
      }

      let relKeys = layer.rk; // bbox clip outline

      let cpAttr = {
        id: this.formatID({
          g: this.h.getGraphID(),
          n: 'clip',
          d: i
        })
      };
      let cp = this.createElement(cpAttr, 'clipPath', g);
      let rectAttr = {
        fill: 'none',
        width: relKeys["bbox.w"],
        height: relKeys["bbox.h"],
        transform: `translate(0, -${relKeys["bbox.h"]})`
      };
      this.createElement(rectAttr, 'rect', cp);
      if (this.getObjPath(item, 'opt.clip')) g.setAttribute('clip-path', `url(#${cpAttr.id})`);
      let t = `translate(${relKeys["translate.x"]}, ${relKeys["translate.y"]})`; // view has -y so if we dont rotate into place later move it down now

      if (relKeys["rotate"] % 180 == 0) t += ` translate(0, ${relKeys["bbox.h"]})`;
      let r = `rotate(${relKeys["rotate"] % 180}) rotate(${relKeys["rotate"] >= 180 ? 180 : 0} ${relKeys["bbox.w"] / 2},${-relKeys["bbox.h"] / 2})`; // ${relKeys["bbox.w"]/2},${-relKeys["bbox.h"]/2})

      g.setAttribute('transform', `${t} ${r}`); // ${s}
      // g.setAttribute('data-data', `${relKeys["bbox.w"]} ${relKeys["bbox.h"]} ${relKeys["translate.x"]} ${relKeys["translate.y"]}`);

      svg.appendChild(g); // append groups
    }

    this.h.sendStateChange('DRAW_END'); // Guides

    if (Hive.guide && !this.guide) {
      let handlers = {
        // getScale:this.h.getScale,
        getFrame: this.h.getFrame,
        drawPush: this.h.drawPush,
        getTemplates: this.h.getTemplates,
        mergeDeep: this.h.mergeDeep
      };
      this.guide = new Hive.guide(handlers);
      let guideOpts = cfg.map((d, i) => (d.guide || []).map(e => {
        let keys = Array.isArray(e.key) ? e.key : [e.key];
        let rv = { ...e,
          field: keys.map((k, i) => this.getScaledAccessorKey(k, d))
        };
        if (cfg[i].name == 'point' && 'shape' in cfg[i]) rv.shape = cfg[i].shape;
        return rv;
      }));
      let saKeys = guideOpts.flatMap(d => d.flatMap(e => {
        return e.field.flatMap((f, i) => {
          let keys = Array.isArray(e.key) ? e.key : [e.key];
          return {
            key: keys[i],
            accDes: f
          };
        });
      }));
      let sas = this.h.getScaledAccessors(saKeys);
      this.guide.addAll(sas, guideOpts);
      this.h.frames(); // Guide bboxes calculated. Now redraw.

      return;
    }

    this.generated.svg = svg;
    this.h.render(svg);
  }
  /**
  * Get the SVG generated by draw directives
  *
  * @return SVG
  */


  getSVG() {
    return this.generated.svg;
  }
  /**
  * Try to get a path in an object.
  *
  * @param object Input object
  * @param object Path
  * @return A child object or undefined
  */


  getObjPath(obj, path) {
    // belongs in Object.js
    let keys = path.split('.');
    let o = obj;

    for (let idx = 0; idx < keys.length; idx++) {
      o = o[keys[idx]];
      if (o == undefined) return o;
    }

    return o;
  }
  /**
  * Get the scaled accessor key from a draw attribute
  *
  * @param object Input path
  * @param object Visualization config
  * @return Scaled accessor name
  */


  getScaledAccessorKey(k, cfg) {
    let accDes = cfg;
    k.split('.').forEach((param, i) => {
      if (accDes == undefined) return;
      accDes = accDes[param];
    });
    return accDes;
  }
  /**
  * Configures generators objects used in the plugins to work with
  * scaled accessors
  *
  * @param object Generator
  * @param object Configuration
  * @param object layer state (see draw loop)
  * @param object Visualization config
  * @return Scaled accessor name
  */


  configGen(gen, cfg, layerState, row) {
    let genMethods = Object.keys(gen);
    let cfgMethods = Object.keys(cfg).filter(d => d in gen && typeof gen[d] == 'function' || d.startsWith && d.startsWith('d3.') || !genMethods.length);
    cfgMethods.forEach((item, i) => {
      if (typeof cfg[item] == 'object' && !Array.isArray(cfg[item])) {
        if (item.startsWith('d3.')) {
          let m = new Function(`return ${item}()`)(); // genVal(item, true); // init sub generator

          this.configGen(m, cfg[item], layerState); // cfg sub generator

          gen.arg = m;
          gen(m); // add to parent generator
        } else {
          this.configGen(gen[item], cfg[item], layerState);
        }
      } else if (item in layerState.sa) {
        // BUG: deep cfgGen fails. Eg: projection['d3.mercator'].center:scaled-accesssor
        gen[item](layerState.sa[item]); // pass the accessor
      } else if (`(${item})` in layerState.sa) gen[item](layerState.sa[`(${item})`](row)); // or resolve it
      else gen[item](cfg[item]); // (genVal(cfg[item]));

    });
    return gen;
  }
  /**
  * Configures single HTML elements in the plugins
  *
  * @param object Draw directive config
  * @return Object including the attributes and element
  */


  configElement(cfg) {
    let id = cfg.layerState.genID();
    let attr = {
      id: id.str
    };
    if (cfg.d) attr.d = cfg.d;
    let cfgAttr = Object.keys(cfg.cfg.attr || {}).filter(a => typeof cfg.cfg.attr[a] != 'object' || Array.isArray(cfg.cfg.attr[a]));
    cfgAttr.forEach((a, i) => {
      // adapt here for scss
      attr[a] = cfg.layerState.sa['attr.' + a](cfg.data);

      if (Array.isArray(attr[a])) {
        // is gradient color def
        let group = cfg.layerState.g;
        let gType = this.getObjPath(cfg.cfg, `opt.gradient-type-${a}`);
        let args = [0, 0, 0, -cfg.layerState.rk['bbox.h']]; // default vertical

        if (gType == 'linear') {
          // get start and end from path
          let path = cfg.d.split(/([\d\.-]+)/).map(d => parseFloat(d)).filter(d => d);
          args = [...path.slice(0, 2), ...path.slice(-2)];
        }

        attr[a] = this.parseCfgColor(attr[a], `${attr.id}_c-${a}`, group, ...args);
      }
    });
    let e = this.createElement(attr, cfg.target, cfg.layerState.g); // don't register events on first pass

    if (this.guide) {
      let ev = this.getObjPath(cfg.cfg, `opt.ev`);
      let title = this.getObjPath(cfg.cfg, `opt.title`) || 'Values';
      if (ev) this.h.eventRegister(attr.id, cfg.layerState.g.id, ev, {
        popup: {
          attr: attr,
          idx: id.idx,
          title: title,
          data: cfg.layerState.d
        }
      });
    }

    return {
      attr,
      e
    };
  }
  /**
  * Configures nested HTML elements in the plugins Eg: Axis
  * only basic config w/o scaled accessors etc.
  *
  * @param object Draw directive config
  * @return Object including the attributes and element
  */


  configElements(cfg) {
    let sel = [];
    let cfgAttr = Object.keys(cfg.cfg.attr || {}).filter(a => typeof cfg.cfg.attr[a] == 'object' && !Array.isArray(cfg.cfg.attr[a]));
    cfgAttr.forEach(s => {
      Object.keys(cfg.cfg.attr[s]).forEach(a => {
        sel.push([s, [a, cfg.cfg.attr[s][a]]]);
      });
    });
    sel.forEach((item, i) => {
      cfg.target.selectAll(item[0]).attr(...item[1]);
    }); // TODO: Give nicer element specific names?

    cfg.target.selectAll('*').attr('id', d => cfg.layerState.genID().str);
  } // parse the attributes and selectors
  // applyAttr(cfg) {
  //   let id = cfg.layerState.genID();
  //   let attr = cfg.target?{id:id.str, d:cfg.d}:{};
  //   let sel = [];
  //   cfg.extraAttr = cfg.extraAttr||{};
  //   cfg.cfg.attr = cfg.cfg.attr||{};
  //
  //   Object.keys({...cfg.extraAttr, ...cfg.cfg.attr}).forEach((a, i) => { // adapt here for scss
  //     let attribute = a in cfg.extraAttr? cfg.extraAttr[a] : cfg.layerState.sa['attr.'+a](cfg.data);
  //     if (Array.isArray(attribute)) { // is gradient color def
  //       let group =  cfg.layerState.g;
  //       let gType = this.getObjPath(cfg.cfg, `opt.gradient-type-${a}`);
  //       let args = [0,0,0,-cfg.layerState.rk['bbox.h']] // default vertical
  //       if (gType == 'linear') { // get start and end from path
  //         let path = cfg.d.split(/(\d+)/).map(d=>parseFloat(d)).filter(d=>d);
  //         args = [...path.slice(0, 2), ...path.slice(-2)]
  //       }
  //       attribute = this.parseCfgColor(attribute, `${group.id}_c-${a}`, group, ...args);
  //     }
  //     if (a.includes(' ')) {
  //       let s = a.split(/ (?=[^ ]*$)/i); // split selector/attr
  //       s[1] = [s[1], attribute];
  //       sel.push(s);
  //     } else
  //       attr[a] = attribute;
  //   });
  //
  //   if (typeof cfg.target == 'string') { // if single element
  //     this.createElement(attr, cfg.target, cfg.layerState.g);
  //
  //     // don't register events on first pass
  //     if (this.guide)
  //       this.h.eventRegister(attr.id, cfg.layerState.g.id, cfg.ev,
  //         {popup:{attr:attr, idx:id.idx, title:cfg.title, data:cfg.layerState.d}});
  //   } else {  // if several elements Eg: axis
  //     Object.keys(attr).forEach((a, i) => {
  //       d3.select(cfg.target).select('*').attr(attr, attr[a]);
  //     });
  //     sel.forEach((item, i) => {
  //       d3.select(cfg.target).selectAll(item[0]).attr(...item[1]);
  //     });
  //   }
  //
  //   return {attr, sel};
  // }

  /**
  * Creates and/or configs an SVG element
  *
  * @param object list of attr-val pairs
  * @param string element type
  * @param element The element (usually a <g>) where the new element is appended
  * @return The child element
  */


  createElement(attr, e, parent) {
    let child;
    if (e instanceof SVGElement) child = e;else child = document.createElementNS('http://www.w3.org/2000/svg', e);
    Object.keys(attr).forEach((item, i) => {
      child.setAttribute(item, attr[item]);
    });
    if (parent) parent.appendChild(child);
    return child;
  }
  /**
  * Parses an string encoded object
  *
  * @param object the object
  * @return a parsed object
  */


  getID(e) {
    let id = e.getAttribute('id');
    return JSON.parse(`{${id.replaceAll('.', ':').replaceAll('_', ',').replace(/[a-z]\w*/g, d => '"' + d + '"')}}`);
  }
  /**
  * Creates an id string which is HTML-safe and encodes a single level object
  *
  * @param object the object to encode
  * @return string encoded object
  */


  formatID(o) {
    let fields = ['g', 'n', 'd', 'i', 'a']; // graphID, plugin name, draw index, plugin index, alt point index

    let string = '';
    fields.forEach((f, i) => {
      if (f in o) string += `${i ? '_' : ''}${f}-${o[f]}`;
    }); // TODO add utf8ToHex-ed userdata?

    return string;
  }
  /**
  * Sets an object id with an encoded string
  *
  * @param object the object with the dest id
  * @param object the object to encode
  * @return none
  */


  setID(e, o) {
    e.setAttribute('id', this.formatID(o));
  }
  /**
  * An monotonically increasing id generator
  *
  * @param object string prefix
  * @return none
  */


  *genID(s) {
    let idx = 0;

    while (true) yield {
      str: s + `_i-${idx}`,
      idx: idx++
    };
  } // /**
  //   * Cuts a text element vertically.
  //   * Yes. Tspan should do this.  No Paperjs does not support it.
  //   *
  //   * @param {Object} cfg.text Selected text elements
  //   * @param {string} cfg.width Max width
  //   * @param {string} cfg.fFamily Font family
  //   * @param {string} cfg.fSize Font size
  //   * @param {string} cfg.move How to move the text
  //   */
  //  wrap(text, width, fFamily, fSize, move) {
  //    let wFcn = this.h.getTextWidth.bind(this.rendererObj);
  //    text.each(function() {
  //      let texts = [];
  //      var text = d3.select(this),
  //          words = text.text().split(/\s+/).reverse(),
  //          word,
  //          line = [],
  //          lineNumber = 0,
  //          lineHeight = 1.1,
  //          y = text.attr("y"),
  //          dy = parseFloat(text.attr("dy"))
  //      let subText = text.text(null).clone();
  //
  //      let origDy = subText.node().getAttribute('dy');
  //      origDy = origDy.includes('em')?fSize*parseFloat(origDy):0;
  //
  //      subText.node().getAttribute('dy')
  //      subText.attr('dy', 0 + origDy);
  //      texts.push(subText);
  //      let idx = 1;
  //      while (word = words.pop()) {
  //        line.push(word);
  //        let delta = subText.attr('font-size')// dy;
  //        subText.text(line.join(" "));
  //        // if (subText.node().innerText.length > width && line.length > 1) { // .getComputedTextLength()
  //        if (wFcn(subText.node().innerHTML, fFamily, fSize) > width && line.length > 1) { // .getComputedTextLength()
  //          line.pop();
  //          subText.text(line.join(" "));
  //          line = [word];
  //          subText = subText.clone().text(word).attr('dy', (a,b,c) => `${(delta*idx) + origDy}`); // .attr("dy", ++lineNumber * lineHeight + dy + "em")
  //          texts.push(subText);
  //          idx++;
  //        }
  //      }
  //      // move the text based on orientation
  //      if (move == "top"){
  //        texts.forEach((item, i) => {
  //          item.attr('transform', (d,e,f) => {
  //            let tf = f[0].getAttribute('transform');
  //            tf = tf==null?'':(tf+' ');
  //            return `${tf}translate(0 ${-fSize*(idx-1)})`;
  //          });
  //        });
  //      }
  //    });
  //  }

  /**
  * Adds new draw directives
  *
  * @param object the additional config
  * @return none
  */


  push(newCfg) {
    let guideDrawObjs = this.resolveCfg(newCfg);
    this.cfg.push(...guideDrawObjs);
  }
  /**
  * Get allowable width for an element based on axis bandwidth.
  *
  * @param object The x scaled accessor
  * @param number If <= 1, == the percent of the bandwidth. If > 1, == the px width.
  * @return the width in px
  */


  getDrawWidth(s, v) {
    if (v > 1) return v;
    let bw;
    if (s.bandwidth) bw = s.bandwidth();else {
      this.h.warn('Axis bandwidth missing or zero.  Are you using the right scale? Using default: 10px');
      bw = 10;
    }
    return bw * v;
  }
  /**
  * Parse the complex color (gradient) attributes
  *
  * @param object The color attribute
  * @param string The unique plugin id
  * @param string The plugin element group
  * @param string The x1 stop color
  * @param string The y1 stop color
  * @param string The x2 stop color
  * @param string The y2 stop color
  * @return URL to the gradient definition
  */
  // allow for linear gradients


  parseCfgColor(color, uuid, group, x1, y1, x2, y2) {
    if (typeof color != 'object') return color;else {
      let defs = this.createElement({}, 'defs', group);
      let attr = {
        id: uuid,
        x1: x1 == undefined ? '0%' : x1,
        y1: y1 == undefined ? '0%' : y1,
        x2: x2 == undefined ? '0%' : x2,
        y2: y2 == undefined ? '100%' : y2
      };
      if (x1 != undefined) attr.gradientUnits = "userSpaceOnUse"; // for point to point gradients. Eg: not horiz/vert

      let grad = this.createElement(attr, 'linearGradient', defs);
      color.forEach((item, i) => {
        attr = {
          'stop-color': item['stop-color'],
          offset: item.offset || 1 / (color.length - 1) * i
        };
        this.createElement(attr, 'stop', grad);
      });
      return `url(#${uuid})`;
    }
  } // Text manager in the form of a d3 generator
  // text() {
  //   let cfg = {};
  //   let rotateVal = 0;
  //   let parentVal = undefined;
  //
  //   let create = function(d) {
  //     let xoff = cfg.offsetX(d), yoff = cfg.offsetY(d), ta = 'middle';
  //     if (cfg.offset(d)) {  // override w auto offset
  //       xoff = 0;
  //       yoff = 0;
  //       if (rotateVal == 0) {
  //         yoff = cfg.offset(d);
  //       }
  //       if (rotateVal == 90) {
  //         xoff = cfg.offset(d);
  //         ta = 'start';
  //       }
  //       if (rotateVal == 180) {
  //         xoff = -cfg.offset(d);
  //       }
  //       if (rotateVal == 270) {
  //         yoff = -cfg.offset(d);
  //         ta = 'end';
  //       }
  //     }
  //
  //     let attr={
  //       x:cfg.x(d)+xoff,
  //       y:cfg.y(d)+yoff,
  //       'text-anchor':ta,
  //     };
  //     if (rotateVal) attr.transform = `rotate(${rotateVal} ${cfg.x(d)+xoff} ${cfg.y(d)+yoff})`;
  //
  //     let element = cfg.h.createElement(attr, 'text', parentVal);
  //     let ctv = cfg.content(d);
  //     if (typeof ctv == 'function') ctv = ctv(d);
  //     element.textContent = cfg.format()(ctv);
  //
  //     return element;
  //   }
  //
  //   let gen = function(d){
  //     return create(d);
  //   }
  //
  //   let methods = ['x', 'y', 'content', 'format', 'offset', 'offsetX', 'offsetY', 'parent', 'h'];
  //   methods.forEach((item, i) => {
  //     cfg[item] = d => d;
  //     gen[item] = function(d){
  //       if (d) {
  //         cfg[item] = d;
  //         return this;
  //       } else return cfg[item];
  //     }
  //   });
  //
  //   cfg.h = {};
  //   cfg.offset = d => 0;
  //   cfg.offsetX = d => 0;
  //   cfg.offsetY = d => 0;
  //   cfg.content = d => '';
  //   cfg.format = d => (e=>e);
  //
  //   gen.rotate = function(d){
  //     if (!isNaN(d)) {
  //       rotateVal = d;
  //       return this;
  //     } else return rotateVal;
  //   }
  //
  //   return(gen);
  // }

  /**
  * Get defaults for the config draw section
  *
  * @param object The incomplete user specified draw cfg
  * @return a complete draw cfg
  */


  resolveCfg(v) {
    v.forEach((item, i) => {
      let pluginHandler = Hive.Plugins[item.name];

      if (!pluginHandler) {
        this.h.warn('No config for plugin:', item.name);
        return;
      }

      v[i] = this.h.mergeDeep(pluginHandler.getDefaults(item), item);
    });
    return v;
  }

};

},{"./meta/guide.js":9}],5:[function(require,module,exports){
/**
 *  Drawable element base class
 *  Integrates: configuration, Resize debouncing, import export for all renderers
 */
"use strict";

var _pubsubJs = _interopRequireDefault(require("pubsub-js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

Hive.Element = class {
  /**
  * Initialize locals
  *
  * @param object Functions from core
  * @return none
  */
  constructor(handlers) {
    this.h = handlers;
    this.events = [];
    if (!Hive.Renderer) Hive.Renderer = {};
  }
  /**
  * Get defaults for the config frames section
  *
  * @param object The incomplete user specified cfg
  * @return a complete frames cfg
  */


  entry(cfg) {
    this.cfg = cfg;
    let drawableElement;
    this.container = document.querySelector(cfg.selector);
    this.container.style.position = 'relative'; // style node

    if (cfg.style) Object.keys(cfg.style).forEach((item, i) => {
      this.container.style[item] = cfg.style[item];
    }); // attrs node

    if (cfg.attrs) Object.keys(cfg.attrs).forEach((item, i) => {
      this.container[item] = cfg.attrs[item];
    });

    if (cfg.renderer.name == 'paperjs') {
      this.renderer = new Hive.Renderer.paperjs(this.container, cfg);
    }

    if (cfg.renderer.name == 'svg') {
      this.drawableObject = this.container;
      this.renderer = new Hive.Renderer.svg(this.container, cfg);
    } // if (cfg.renderer.name == 'threesvg') {
    //   this.drawableObject = this.container;
    //   this.renderer = new Hive.Renderer.threesvg(this.container, cfg);
    // }


    if (cfg.renderer.name == 'three') {
      this.drawableObject = this.container;
      this.renderer = new Hive.Renderer.three(this.container, cfg, this.h.sendStateChange);
    }

    this.renderer.messagePub = this.messagePub;
    this.renderer.setRendererSize(this.container.clientWidth, this.container.clientHeight);
    let ts = this.renderer.getTargetSize();
    this.viewBox = [0, 0, ts.w, ts.h];
    this.elSize = {
      w: 500,
      h: 500
    };

    if (cfg.renderer.name != 'three') {
      if (cfg.zoom) {
        // wheel handler
        this.container.addEventListener("wheel", function (event) {
          let sz = this.container.getBoundingClientRect();
          let delta = Math.sign(event.deltaY);
          let vb = this.viewBox;
          vb[2] += delta * (sz.width * .1);
          vb[3] += delta * (sz.height * .1); // sanity check sizes

          if (vb[2] < sz.width * .1) vb[2] = sz.width * .1;
          if (vb[2] > sz.width) vb[2] = sz.width;
          if (vb[3] < sz.height * .1) vb[3] = sz.height * .1;
          if (vb[3] > sz.height) vb[3] = sz.height;
          this.renderer.setViewBox(vb);
          event.preventDefault(); // don't scroll when in div
        }.bind(this), false);
      }

      if (cfg.drag) {
        // drag handler
        var dragHandler = d3.drag(event).on("drag", function () {
          let sz = this.container.getBoundingClientRect();
          let vb = this.viewBox;
          vb[0] -= d3.event.dx * (vb[2] / sz.width);
          vb[1] -= d3.event.dy * (vb[3] / sz.height);
          this.renderer.setViewBox(vb);
        }.bind(this));
        dragHandler(d3.select(this.container));
      }
    }

    this.rdb = this.resizeDebounce.bind(this);
    window.addEventListener('resize', this.rdb, true);
    let handlers = {
      getElementPosition: function (a) {
        return this.getPosition(...arguments);
      }.bind(this.renderer)
    };

    if (cfg.popup.enabled) {
      this.popup = new Hive.popup(handlers, cfg.selector, this.events, cfg.popup);
    }
  }
  /**
  * Debouncer for resize events.  Prevents event flooding.
  *
  * @return none
  */


  resizeDebounce() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(this.resize.bind(this), 10);
  }
  /**
  * Resize handler for the HTML element.
  *
  * @return none
  */


  resize() {
    let tsz = this.renderer.getTargetSize();
    this.viewBox[2] = tsz.w;
    this.viewBox[3] = tsz.h;
    this.renderer.setRendererSize(this.container.clientWidth, this.container.clientHeight); // dom resize and svg redraw are orthogonal when renderer == three

    if (this.cfg.renderer.name != 'three') this.h.frames(); // rerun frames & draw
  }
  /**
  * Registers an event for an element.
  *
  * @param string The element id
  * @param string The group the element is in
  * @param object The event cfg object
  * @param boolean The popup cfg object
  * @return none
  */


  eventRegister(id, gid, ev, altcfg) {
    if (!ev) return;
    if (!ev.group) ev.group = this.h.getGraphID() + ' default';
    let p = {},
        item = {
      elId: id,
      groupId: gid,
      ev: ev
    };
    if (this.cfg.popup.enabled) p = this.popup.register(altcfg.popup);
    this.events.push({ ...item,
      ...p
    });
  }
  /**
  * Gets the element that is drawn to. Currently either canvas or svg.
  *
  * @return HTML element
  */


  getElement() {
    return this.renderer.drawableElement;
  }
  /**
  * Subscribe to a message.
  *
  * @param object varargs
  * @return none
  */


  messageSub(d) {
    _pubsubJs.default.subscribe(...arguments);
  }
  /**
  * Publish to a message.
  *
  * @param object varargs
  * @return none
  */


  messagePub(d) {
    _pubsubJs.default.publish(...arguments);
  }
  /**
  * Render an svg
  *
  * @param object SVG element
  * @return none
  */


  render(svg) {
    // call renderer w result
    svg.setAttribute('viewBox', this.viewBox.join(' '));
    console.log(svg);

    if (Hive.Renderer[this.cfg.renderer.name]) {
      let pubsubMsgs = this.renderer.render(svg, this.events);

      if (this.cfg.popup.enabled) {
        pubsubMsgs = [...new Set(pubsubMsgs)];
        pubsubMsgs.forEach((item, i) => {
          // subscribe to any groups in cfg
          this.messageSub(item, this.popup.pubsubHandler.bind(this.popup));
        });
      }
    } else {
      this.error('No renderer for:', this.cfg.renderer);
    }

    this.events = [];
  } // Deprocated


  getTextWidth(text) {
    return this.renderer.getTextWidth.bind(this.renderer)(text);
  }
  /**
  * Get positioning information for an element.
  *
  * @param string group id
  * @param string element id
  * @param boolean If alt points should be used
  * @return position information
  */


  getElementPosition(gid, eid, alt) {
    return this.renderer.getPosition.bind(this.renderer)(gid, eid, alt);
  }
  /**
  * Returns the resources allocated by a call to the constructor
  *
  * @return none
  */


  destroy() {
    window.removeEventListener('resize', this.rdb, true);
    let instance = document.querySelector(this.cfg.selector + " > div");
    if (this.popup && this.popup.PopupElement && this.popup.PopupElement._tippy) instance._tippy.destroy(); // TODO: make plugin destroy method

    if (this.renderer.destroy) this.renderer.destroy(); // if (this.renderer.dispose)
    //   this.renderer.dispose();
  }
  /**
  * Get defaults for the config frames section
  *
  * @param object The incomplete user specified cfg
  * @return a complete frames cfg
  */


  resolveCfg(v) {
    let cfg = {
      selector: "#visualization",
      exportName: "visualization",
      style: {
        width: '70vw',
        height: '60vh'
      },
      attrs: {},
      zoom: false,
      drag: false,
      popup: {
        enabled: true
      },
      renderer: {
        name: 'svg',
        hidpi: false
      }
    };
    v = this.h.mergeDeep(cfg, v);
    return v;
  }
  /**
  * download a single svg
  *
  * @param object The svg element
  * @param string The svg name
  * @return a complete frames cfg
  */


  exportSvg(svgEl, name) {
    svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    var svgData = svgEl.outerHTML;
    var preface = '<?xml version="1.0" standalone="no"?>\r\n';
    var svgBlob = new Blob([preface, svgData], {
      type: "image/svg+xml;charset=utf-8"
    });
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = name;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
  /**
  * Create a single svg for all objects in a container
  *
  * @return none
  */


  export() {
    let name = this.cfg.exportName ? this.cfg.exportName : "vis";
    let composite;

    if (this.renderer.exportSVG) {
      // engine specific
      let svg = this.renderer.exportSVG(name);
      composite = d3.select(svg);
    } else {
      // generic output
      let content = [];
      d3.selectAll(`${this.cfg.selector} > *`).each(function (e) {
        if (this._visualization) content.push(this._visualization.tk.draw.getSVG());
      });
      composite = d3.create('svg').attr('viewBox', content[0].getAttribute('viewBox'));
      content.forEach((item, i) => {
        let nodes = d3.select(item).selectAll(':scope > clippath, :scope > g').clone(true).nodes(); // toplevel children

        nodes.forEach((e, i) => {
          composite.append(d => e);
        });
      });
    }

    this.h.log('Export:', composite.node()); // download it

    this.exportSvg(composite.node(), name + '.svg');
  }

};

},{"pubsub-js":29}],6:[function(require,module,exports){
"use strict";

require("./templates.js");

Hive.Frames = class {
  /**
  * Initialize locals
  *
  * @param object Functions from core
  * @param object frame configuration
  * @param object precalculated template information (optional)
  * @return none
  */
  constructor(handlers, cfg, calculated) {
    this.h = handlers;

    if (calculated) {
      this.data = calculated.data;
      this.entry(...calculated.redraw);
    } else {
      this.nodes; // import.meta not working somehow so hack it.

      let path = d3.select('script[src$="/hdsf-hive.js"]').attr('src').split('/');
      path.pop();
      path = path.join('/');
      this.flex = new Worker(path + '/flexWorker.js'); // flex
    }

    let calls = {
      nodeResized: this.updateNodeData.bind(this),
      // individual
      nodesResized: this.updateNodes.bind(this) // all

    };
    this.flex.addEventListener('message', function (e) {
      calls[e.data[0]](...e.data[1]);
    }.bind(this), false);
  }
  /**
  * Gets size, layout information and starts a draw.
  * Since any accessor can be used in any frame, the range is deferred until the plugin runs.
  *
  * @param object The accessor cfg
  * @return none
  */


  entry(cfg) {
    let container = this.h.getSize();
    this.flex.postMessage(['resize', [cfg, this.nodes, container.w, container.h]]);
    console.log(cfg);
  }
  /**
  * Flex handler callback when a node geometry changes.
  *
  * @param object Frame id
  * @param object frame dataset
  * @param object user information
  * @return none
  */


  updateNodeData(id, d, u) {
    this.h.sendStateChange('FRAME_CHANGED', id, d, u);
  }
  /**
  * Flex handler callback when a full layout is calculated.
  *
  * @param object Node objects w geometry, etc.
  * @param object Array of node order
  * @return none
  */


  updateNodes(nodes, nodeOrder) {
    this.nodes = nodes;
    this.h.draw();
  }
  /**
  * Kill the layout worker
  *
  * @return none
  */


  destroy() {
    this.flex.terminate();
  }
  /**
  * Get a node geometry
  *
  * @param string node selector
  * @return node
  */


  resolveNode(sel) {
    let n = this.getNode(sel);
    if (!n) this.h.error("Bad selector: ", sel);
    let opt = n.cfg.opt || {};
    let layout = n.layout;
    let isPerp = opt.rotate % 180 == 90; // perpendicular

    return {
      'bbox.w': isPerp ? layout.h : layout.w,
      'bbox.h': isPerp ? layout.w : layout.h,
      'translate.x': layout.x,
      'translate.y': layout.y,
      rotate: opt.rotate || 0,
      mirror: opt.mirror || false,
      crop: opt.crop || false
    };
  }
  /**
  * Get a node config
  *
  * @param string node selector
  * @return node
  */


  getNode(sel) {
    // Clean up the selector
    // supports: " " == nested, ">" == direct child
    let s = sel.trim();
    s = s.replace(/ *> */g, '>'); // normalize space + gt combos

    s = s.replace(/ /g, ' [ \\-\\w]*'); // support nested regex

    s = s.replace(/>/g, ' '); // support direct child

    let rootName = Object.keys(this.nodes)[0].split(' ')[0]; // if (!(s.split(' ')[0] == rootName))
    //   s = ' '+s; // put a space in front if not root

    s = s.split(' ')[0] == rootName ? '^' + s : ' ' + s; // if root put caret else space

    let n = Object.keys(this.nodes).filter(d => RegExp(s + '$').test(d));
    if (n.length > 1) this.h.warn('Multiple matches for selector:', sel, '\nUsing [0]');
    if (n.length == 0) this.h.error('No matches for selector:', sel);
    return this.nodes[n];
  }
  /**
  * Get defaults for the config frames section
  *
  * @param object The incomplete user specified cfg
  * @return a complete frames cfg
  */


  resolveCfg(v) {
    if (typeof v == 'string') v = this.constructor[v]();

    if (Object.keys(v).length == 0) {
      let vis = new Hive.Visualization();
      v = vis.templates.chart();
    }

    return v;
  }

};

},{"./templates.js":27}],7:[function(require,module,exports){
"use strict";

// globalThis.Hive = globalThis.Hive||{};

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

  // static facetChartTemplate(vis, cfg) {
  //   return vis.templates.chart(cfg);
  // }

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
      let bottomAxis = Hive.templates.getCfgNode(nodes, 'chart > bottom >  axis');
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

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
"use strict";

require("./facet.js");

Hive.guide = class {
  constructor(handlers) {
    this.guideSAs = [];
    this.h = handlers;
    this.templates = this.h.getTemplates();
  }

  combineByDomain(sas, guideOpts) {
    let go = guideOpts.map((d, i) => d.map(e => {
      return { ...e,
        idx: i
      };
    })).flat().flatMap(d => {
      if (Array.isArray(d.key)) return [{ ...d,
        key: d.key[0]
      }].concat(d.key.slice(1).map(k => {
        return { ...d,
          key: k
        };
      }));
      return d;
    });
    let callOrder = ['attr.stroke-dasharray', 'shape', 'size', 'attr.fill', 'attr.stroke'];
    let list = d3.nest().key(k => sas[k.key]().domain().sort()).key(k => k.idx).rollup(d => d.sort((a, b) => callOrder.indexOf(a.key) - callOrder.indexOf(b.key))).entries(go);
    list.forEach((l, i) => {
      l.call = Object.assign({}, ...l.values.flatMap(o => o.value)); // merge all calls

      delete l.call.key;
      delete l.call.idx;
      delete l.call.field;
    });
    return list;
  } // GUIDES fill color, stroke color, dash, point: shape/size


  addAll(sas, guideOpts) {
    if (this.guideSAs.length) return; // only make guides once

    let guides = this.combineByDomain(sas, guideOpts); // combine guideOpts by domain
    // When making ranges w continuous domains the sa is sampled x times per
    // the specified qty.  Eg: If the qty = 4 and qtySamples = 3. The range
    // is sampled 12x for gradient stop colors.

    let qtySamples = 2;
    guides.forEach((g, i) => {
      // by domain
      let opt, dir, guideSize; // set guide type

      if (g.call.frame.includes('guide-right')) {
        dir = 'column';
        opt = this.templates.opt.basic.guide.right;
        guideSize = opt.container.item.icon.height;
      } else {
        dir = 'row';
        opt = this.templates.opt.basic.guide.bottom;
        guideSize = opt.container.item.icon.width;
      }

      let gItemContainer = this.templates.guideItemContainer(opt, i, 0);
      let gicId = gItemContainer.id;
      let guideFrameObjs = [];
      guideFrameObjs.push(gItemContainer);
      let guideUnits = g.call.qty || opt.container.item.qty;
      let label = opt.container.item.label;
      let iconLabelCfg = this.h.mergeDeep({
        name: 'label',
        attr: label.attr,
        opt: {
          text: label.text
        }
      }, g.call.labelOpt || {});
      let continuousDomains = ["linear", "pow", "sqrt", "log", "time", "sequential", "quantize"];
      let gTitle;
      let guideDrawObjs = [];
      g.values.forEach((vs, j) => {
        // guides -> values
        let localDrawObjs = [];
        let labelDrawObjs = [];

        if (j == 0) {
          gTitle = this.templates.guideTitle(opt.title, i, j);
          guideFrameObjs.unshift(gTitle); // prepend

          let titleLabelCfg = this.h.mergeDeep({
            name: 'label',
            frame: `${g.call.frame} > ${gTitle.id} text`,
            content: g.call.title,
            attr: opt.title.attr,
            opt: {
              text: opt.title.text
            }
          }, g.call.titleOpt || {});
          labelDrawObjs.push(titleLabelCfg);
        }

        vs.value.forEach((v, k) => {
          // values -> value
          let sa = sas[v.key];
          if (sas[v.key]().field == undefined) return; // all guide SAs must be scales

          this.guideSAs.push(sa());

          if (continuousDomains.includes(sa().cfg.type)) {
            // range scales
            // let sa = sas[keys[0]]; // Will this ever be > 1?
            if (v.key == 'attr.fill' || v.key == 'attr.stroke') {
              // add label add shape/color
              let text = d3.quantize(d3.scaleLinear().range(sa().domain()), guideUnits + 1); // labels

              let grad = d3.quantize(d3.scaleLinear().range(sa().domain()), guideUnits * qtySamples).map(d => {
                return {
                  'stop-color': sa({
                    [sa().field]: d
                  })
                };
              }); // let gItem = this.templates.guideRange(i, j, guideSize, guideUnits, dir, 11); // labelFontSize ////!!!!

              let w = opt.container.item.icon.width;
              let h = opt.container.item.icon.height;
              if (dir == 'row') w *= guideUnits;else h *= guideUnits;
              let margin = {
                right: 0,
                bottom: 0,
                left: 0
              };

              if (dir == 'row') {
                text.forEach((t, i) => {
                  let rv = Hive.Text.format(t, iconLabelCfg);
                  if (i == 0) margin.left = rv.bbox.w / 2;
                  if (i == text.length - 1) margin.right = rv.bbox.w / 2;
                  margin.bottom = rv.bbox.h > margin.bottom ? rv.bbox.h : margin.bottom;
                });
              }

              let gItem = this.templates.guideRange(opt, w, h, text, margin, dir);
              gItemContainer.children.push(gItem); // gradient

              guideDrawObjs.push({
                name: 'area',
                frame: gicId + ' gradient',
                data: '_area-fill_',
                attr: {
                  fill: grad
                },
                x: '{_builtin-x_}',
                y0: '{_builtin-y_}',
                y1: 0
              }); // ticks

              let gradIDs = this.templates.constructor.getCfgNode(gItem, gItem.id + ' gradient').children.map(d => d.id);
              gradIDs.forEach((d, i) => {
                guideDrawObjs.push({
                  name: 'area',
                  frame: d,
                  data: '_area-fill_',
                  attr: {
                    fill: 'white',
                    opacity: .6
                  },
                  x: '{_builtin-x_}',
                  y0: '{_builtin-y_}',
                  y1: 0
                });
              }); // labels

              let labIDs = this.templates.constructor.getCfgNode(gItem, gItem.id + ' labels').children.map(d => d.id);
              labIDs.forEach((d, i) => {
                let label = {
                  frame: `${gItem.id} ${d}`,
                  content: text[i],
                  ...iconLabelCfg
                };
                label.attr['font-size'] = opt.container.item.label.rangeFontSize;
                if (dir == 'row') label.opt.text.textAnchor = 'tm';else label.opt.text.textAnchor = 'lm';
                guideDrawObjs.push(label);
              });
            }

            if (v.key == 'size') {
              // size range
              let ticks = sa().ticks(guideUnits);
              let sizes = ticks.map(d => sa({
                [sa().field]: d
              }));
              guideSize = Math.sqrt(sizes.slice(-1)[0]);
              ticks.forEach((sz, k) => {
                let gItem = this.templates.guideItem(opt.container.item, k, Math.sqrt(sizes.slice(-1)));
                gItemContainer.children.push(gItem);
                let iconCfg = {
                  name: 'point',
                  frame: `${gicId} > ${gItem.id} center`,
                  data: '_guide-center_',
                  size: sizes[k],
                  x: 0,
                  y: 0
                };
                if (!(g.call.shape in sas)) iconCfg.shape = g.call.shape; // if shape is an sa then use default

                guideDrawObjs.push(iconCfg);
                guideDrawObjs.push({
                  frame: `${gicId} > ${gItem.id} text`,
                  content: sz,
                  ...iconLabelCfg
                });
              });
            }
          } else {
            // discrete domain scales
            sa().domain().sort().forEach((item, r) => {
              // domain in sa
              let val = sa({
                [sa().field]: item
              });

              if (j == 0 && k == 0) {
                // only make new items/labels for first set
                let gItem = this.templates.guideItem(opt.container.item, `${k}-${r}`);
                gItemContainer.children.push(gItem);
              }

              let nodeSel = `${gicId} > ${gItemContainer.children[r].id} `; // selector

              if (localDrawObjs.length < sa().domain().length) {
                switch (v.key) {
                  // put drawable in first
                  case 'attr.stroke-dasharray':
                    localDrawObjs.push({
                      name: 'line',
                      frame: `${nodeSel}icon`,
                      data: '_guide-line_',
                      attr: {
                        'stroke-dasharray': val,
                        'stroke-width': 3
                      },
                      x: '{_builtin-x_}',
                      y: '{_builtin-y_}'
                    });
                    break;

                  case 'shape':
                    localDrawObjs.push({
                      name: 'point',
                      frame: `${nodeSel}center`,
                      data: '_guide-center_',
                      attr: {},
                      size: 10,
                      shape: val,
                      x: 0,
                      y: 0
                    });
                    break;

                  default:
                    let area = {
                      name: 'area',
                      frame: `${nodeSel}icon`,
                      data: '_area-fill_',
                      attr: {
                        "stroke-width": .7
                      },
                      x: '{_builtin-x_}',
                      y0: '{_builtin-y_}',
                      y1: 0
                    };
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
                  labelDrawObjs.push({
                    frame: `${nodeSel}text`,
                    content: item,
                    ...iconLabelCfg
                  });
                }
              } else {
                let ldo = localDrawObjs[r];

                switch (v.key) {
                  case 'attr.fill':
                    ldo.attr.fill = val;
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

      if (dir == 'column') {
        // set layout watermarks
        gItemContainer.attr['flex-direction'] = "flex-direction-column";
        if ('itemsHeightMax' in g.call) gItemContainer.attr['max-height'] = g.call.itemsHeightMax;
      } else {
        if ('itemsWidthMax' in g.call) gItemContainer.attr['max-width'] = g.call.itemsWidthMax;
      }

      let frame = this.h.getFrame(g.call.frame);
      frame.children.push(...guideFrameObjs);
      this.h.drawPush(guideDrawObjs); // Within a guide item make all widths equal.
      // get largest content width

      let widths = guideDrawObjs.filter(d => d.name == 'label').map((item, i) => {
        let rv = Hive.Text.format(item.content, { ...item.opt.text,
          attr: item.attr
        });
        return rv.bbox.w;
      });
      let maxWidth = d3.max(widths); // set title width

      this.templates.constructor.getCfgNode(guideFrameObjs[0], `${gTitle.id} title`).attr.width = maxWidth; // set item container children width

      if (guideFrameObjs[1].children[0].id.endsWith('range')) {} else {
        guideFrameObjs[1].children.forEach(d => d.children.filter(d => d.id.endsWith('title'))[0].attr.width = maxWidth);
      }
    });
  }

}; // USEFUL LATER
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

},{"./facet.js":7}],10:[function(require,module,exports){
(function (global){(function (){
"use strict"; // node or frontend

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Hive = void 0;
(global || globalThis).Hive = globalThis.Hive || {
  Type: {},
  templatePlugins: [],
  Plugins: {},
  Renderer: {}
};
let Hive = globalThis.Hive;
exports.Hive = Hive;
Hive.Object = class {
  /**
  * Initialize locals
  *
  * @return none
  */
  constructor() {
    Hive.systemOpts = {}; // Hive.setOpt = function (path, val) {
    //   path.opt = val
    // }
    //
    // Hive.getOpt = function (path) {
    //   return path.opt
    // }
  }
  /**
   * Writes text to console pending config log level
   *
   * @param unknown Items to print
   * @return none
   */


  log(...msg) {
    let txt = msg.join(' ');
    if (this.v == undefined || this.v.logLevel == 'log') console.log(txt);
  }
  /**
   * Writes text to console pending config log level
   *
   * @param unknown Items to print
   * @return none
   */


  warn(...msg) {
    let txt = msg.join(' ');
    if (this.v == undefined || this.v.logLevel == 'warn' || this.v.logLevel == 'log') console.warn(txt);
  }
  /**
   * Writes text to console pending config log level
   *
   * @param unknown Items to print
   * @return none
   */


  error(...msg) {
    let txt = msg.join(' ');
    if (this.v == undefined || this.v.logLevel == 'error' || this.v.logLevel == 'warn' || this.v.logLevel == 'log') console.error(txt);
  }
  /**
  * Returns an RFC4122 version 4 compliant but not cryptographically secure UUID
  *
  * @return UUID
  */


  uuidv4() {
    // let mask = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; // TRUE UUIDv4
    let mask = 'xxxxxxx'; // smaller than uuidv4 and probably statistically workable

    return mask.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0,
          v = c == 'x' ? r : r & 0x3 | 0x8;
      return v.toString(16);
    });
  }
  /**
   * converts chars to hex codes
   *
   * @param string string object
   * @return string of hex
   */


  utf8ToHex(str) {
    return Array.from(str).map(c => c.charCodeAt(0) < 128 ? c.charCodeAt(0).toString(16) : encodeURIComponent(c).replace(/\%/g, '').toLowerCase()).join('');
  }
  /**
   * converts hex to a string
   *
   * @param string hex string
   * @return decoded string
   */


  hexToUtf8(hex) {
    return decodeURIComponent('%' + hex.match(/.{1,2}/g).join('%'));
  }
  /**
   * Deep merge two objects.   WARNING DOES NOT MERGE ARRAYS - OVERWRITES ONLY
   * @param target
   * @param ...sources
   */


  static mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    let isObject = d => d && typeof d === 'object' && !Array.isArray(d);

    if (isObject(target) && isObject(source)) {
      for (const key in source) {
        if (isObject(source[key])) {
          if (!target[key]) Object.assign(target, {
            [key]: {}
          });
          this.mergeDeep(target[key], source[key]);
        } else {
          Object.assign(target, {
            [key]: source[key]
          });
        }
      }
    }

    return this.mergeDeep(target, ...sources);
  }

};

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],11:[function(require,module,exports){
"use strict";

Hive.Plugins.arc = class {

  static genAccessors() {
    let dFcn = d3.arc();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => d!='centroid')
                        .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    ls.d.forEach((item, j) => {

      let dFcn = h.configGen(d3.arc(), cfg, ls, item);

      let c = {
        d:dFcn(item),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);

      let centroid = dFcn.centroid(item);
      let attr = { // create alt points for popup
        'id':rv.attr.id + '-alt',
        'r':0,
        'fill-opacity':0,
        'stroke-opacity':0,
        cx:centroid[0],
        cy:centroid[1]
      };
      h.createElement(attr, 'circle', ls.g);

    });
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'basic center-view', attr:{
            fill:"orange", stroke:"rgb(0,0,0)", 'stroke-width':0
          }
        }
  }
}

},{}],12:[function(require,module,exports){
"use strict";

Hive.Plugins.area = class {

  static genAccessors() {
    let dFcn = d3.area()
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function')
                        .map(d => d=='curve'?`(${d})`:d);
    return methods.concat('x1');
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    if (!(Array.isArray(ls.d[0]))) ls.d = [ls.d];

    ls.d.forEach((item, j) => {
      let dFcn = h.configGen(d3.area(), cfg, ls, item[0]); // configure shape generator

      let c = {
        d:dFcn(item),
        data:item[0],
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);
    });

  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', attr:{
            fill:"#e9bcb733", stroke:"rgb(0,0,0)", 'stroke-width':0
          }
        }
  }
}

},{}],13:[function(require,module,exports){
"use strict";

Hive.Plugins.axis = class {

  static genAccessors() {
    // let dFcn = d3.axisTop();
    // let methods = Object.keys(dFcn) // resolve curve before passing to gen
    //                     .filter(d => typeof dFcn[d]() == 'function')
    return ['(scale)'];
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {
    let scale = ls.sa['(scale)'];
    let bw = scale().bandwidth?scale().bandwidth()/2:0;  // scaled are offset for some reason
    let gc = h.getObjPath(cfg, 'opt.gridColor');
    let orientation = h.getObjPath(cfg, 'opt.orientation')

    let cvt = {
      top:    {anchor:'bm', justify:'center', name:'axisTop', xlate:`translate(${-bw}, 0)`},
      bottom: {anchor:'tm', justify:'center', name:'axisBottom', xlate:`translate(${-bw}, ${-ls.rk['bbox.h']})`},
      left:   {anchor:'mr', justify:'right', name:'axisLeft', xlate:`translate(${ls.rk['bbox.w']}, ${-bw})`},
      right:  {anchor:'ml', justify:'left', name:'axisRight', xlate:`translate(0, ${-bw})`},
    }
    let info = cvt[orientation];

    let axisGen = h.configGen(d3[info.name](), cfg, ls);

    if (gc)
      axisGen.tickFormat('').tickSize(['top','bottom'].includes(orientation)?ls.rk['bbox.h']:ls.rk['bbox.w']);

    let group = d3.select(ls.g);
    group.call(axisGen);

    let c = {
      cfg:cfg,
      layerState:ls,
      target:group
    };
    let rv = h.configElements(c);

    if (gc) {
      group.selectAll('.tick > line').attr('stroke', gc);
      group.selectAll('path').remove();
    }

    // let ttw = h.getObjPath(cfg, 'opt.textWrap');
    // if (scale().bandwidth && ttw) {
    //   ttw = ttw=='auto'?(scale().bandwidth())*.9:ttw;
    //   let family  = group.select(".tick text").attr('font-size');
    //   let size = group.select(".tick text").attr('font-size');
    //   group.selectAll(".tick text")
    //     .call(h.wrap, ttw, family, size, orientation);
    // }
    //
    // let r = h.getObjPath(cfg, 'opt.rotateText');
    // if (r) {
    //   let text = group.selectAll('text');
    //   text.attr('transform',`rotate(${r})`);
    //   // let fs = text.attr('font-size');
    //   // text.attr('transform',`rotate(${r} 0,${(fs*1.5)})`);
    // }

    // translate to bbox
    group.selectAll('g, path')
      .attr('transform', (d,i,e)=>{
        let x = e[i].getAttribute('transform');
        return (x?(x + " "):"") + info.xlate;
      });

    let bandwidth = ls.sa['(scale)']().bandwidth;
    let text = h.getObjPath(cfg, 'opt.text');
    if (text) {
      let maxTxtH = 0;
      let szDim = ['top', 'bottom'].includes(orientation)?'h':'w';
      group.selectAll('text').each(function (d){
        let rv = Hive.Text.replace(this, {vh:ls.rk['bbox.h'], vw:ls.rk['bbox.w'], bw:bandwidth?bandwidth():10,
                    text:{textAnchor:info.anchor, justify:info.justify, ...text}});
        maxTxtH = maxTxtH>rv[szDim]?maxTxtH:rv[szDim];
      });
      let maxH = axisGen.tickSize() + axisGen.tickPadding() + maxTxtH;
      ls.template.calls.push(['setAxisSz', maxH]);
    }
  }


  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults(cfg) {
    let def = {
      gridFrame:'chart center-container > view', opt:{orientation:'bottom', rotateText:0, textWrap:'auto'},
      attr:{
        '.tick > text':{'fill':'#333', 'font-family':"Roboto", 'font-size':10, 'font-style':"normal"},
        '.tick > line':{'stroke-width':1, color:"rgb(0,0,0)"},
        '.domain':{'stroke-width':1, stroke:"rgb(0,0,0)"}
      }
      // ticks:{font:{color:'#333', family:"Roboto", size:10, style:"normal"}, stroke:{width:1, color:"rgb(0,0,0)"}, padding:8, },
      // dbar:{stroke:{width:1, color:"rgb(0,0,0)"}}
    }

    if (cfg.frame)
      return def;

    if (cfg.opt && cfg.opt.gridColor)
      return {...def, frame:'chart center-container > view'};

    if (cfg.opt && cfg.opt.orientation)
      return {...def, frame:`chart ${cfg.opt.orientation} > axis`};
    else
      return {...def, frame:`chart bottom > axis`};
  }
}

},{}],14:[function(require,module,exports){
"use strict";

Hive.Plugins.binhex = class {

  static genAccessors() {
    let dFcn = d3.hexbin();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    let binhexData = [];
    let bhGen = h.configGen(d3.hexbin(), cfg, ls);

    let maxX = ls.sa.x().range()[1];
    let maxY = ls.sa.y().range()[1];
    bhGen.extent([[0,0], [maxX, maxY]]);

    bhGen(ls.d).forEach((item, j) => {
      ls.d = binhexData;
      let data = {qty:item.length-2}
      binhexData.push(data);

      let c = {
        d:bhGen.hexagon(),
        data:data,
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);
      rv.e.setAttribute('transform', `translate(${item.x} ${item.y})`)
    });
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', radius:10, attr:{
            color:"fill", stroke:"rgb(0,0,0)", 'stroke-width':.5
          },
          opt:{clip:true}
        }
  }

}

},{}],15:[function(require,module,exports){
"use strict";

Hive.Plugins.boxplot = class {
  static genAccessors(h) {
    let dFcn = this.boxplot();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  static boxplot () {
    let cfg = {};

    let gen = function(d){

      let w = cfg.h.getDrawWidth(cfg.ls.sa.x(), cfg.width());
      let nw = cfg.h.getDrawWidth(cfg.ls.sa.x(), cfg.notchWidth());
      let wl = cfg.h.getDrawWidth(cfg.ls.sa.x(), cfg.whiskerLen());

      let getPath = (x,y,min,max,lower,upper,notchLower,notchUpper,w,wl,nl) =>
        `M${x} ${max} L${x} ${upper}
         L${x+(w/2)} ${upper} L${x+(w/2)} ${notchUpper}
         L${x+(nl/2)} ${y} L${x-(nl/2)} ${y}
         L${x-(w/2)} ${notchUpper} L${x-(w/2)} ${upper}
         L${x} ${upper}
         M${x} ${min} L${x} ${lower}
         L${x+(w/2)} ${lower} L${x+(w/2)} ${notchLower}
         L${x+(nl/2)} ${y} L${x-(nl/2)} ${y}
         L${x-(w/2)} ${notchLower} L${x-(w/2)} ${lower}
         L${x} ${lower}
         M${x-(wl/2)} ${max} L${x+(wl/2)} ${max}
         M${x-(wl/2)} ${min} L${x+(wl/2)} ${min}`;

      return getPath(cfg.x(d), cfg.y(d), cfg.min(d), cfg.max(d), cfg.lower(d), cfg.upper(d),
                      cfg.notchLower(d), cfg.notchUpper(d), w, wl, nw);
    }

    let methods = ['x','y', 'min', 'max', 'lower', 'upper', 'notchLower', 'notchUpper',
                    'width', 'notchWidth', 'whiskerLen', 'h', 'ls'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;
      gen[item] = function(d){
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      }
    });

    cfg.h = null;
    cfg.ls = null;

    return(gen);
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    ls.d.forEach((item, j) => {
      let dFcn = h.configGen(this.boxplot().h(h).ls(ls), cfg, ls, item);
      let c = {
        d:dFcn(item),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);
    });
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', whiskerLen:.3, width:.3, notchWidth:.25,
          attr:{fill:'white', opacity:.5, stroke:'black', 'stroke-width':2}
        }
  }

}

},{}],16:[function(require,module,exports){
"use strict";

Hive.Plugins.errorbar = class {
  static genAccessors(h) {
    let dFcn = this.errorbar();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  static errorbar () {
    let cfg = {};

    let gen = function(d){

      let wl = cfg.h.getDrawWidth(cfg.ls.sa.x(), cfg.whiskerLen());

      let getPath = (x, y0, y1, wl) =>
        `M${x} ${y1} L${x} ${y0}
          M${x-(wl/2)} ${y1} L${x+(wl/2)} ${y1}
          M${x-(wl/2)} ${y0} L${x+(wl/2)} ${y0}`;

      return getPath(cfg.x(d), cfg.y0(d), cfg.y1(d), wl);
    }

    let methods = ['x', 'y0', 'y1', 'whiskerLen', 'h', 'ls'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;
      gen[item] = function(d){
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      }
    });

    cfg.h = null;
    cfg.ls = null;

    return(gen);
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    ls.d.forEach((item, j) => {
      let dFcn = h.configGen(this.errorbar().h(h).ls(ls), cfg, ls, item);
      let c = {
        d:dFcn(item),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);
    });
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', whiskerLen:.3, y0:0, y1:0,
          attr:{stroke:'black', 'stroke-width':1}
        }
  }

}

},{}],17:[function(require,module,exports){
"use strict";

Hive.Plugins.geopath = class {

  // static genAccessors() {
  //   let dFcn = d3.geoPath()
  //   return Object.keys(dFcn).filter(d => typeof dFcn[d]() == 'function');
  // }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {
    let projection;

    var dFcn = h.configGen(d3.geoPath(), cfg, ls); // configure shape generator
    if (dFcn.projection()) {
      projection = dFcn.projection.arg;
      projection.translate([ls.rk["bbox.w"]/2, -ls.rk["bbox.h"]/2]);
    }

    ls.d.forEach((item, i) => {

      let c = {
        d:dFcn(item.feature),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path',
      };

      let rv = h.configElement(c);
      // Geopaths w a projection create paths in the correct cartesian quadrant
      // (+x,-y).  Without however they don't (+x,+y). Hence, translation.
      if (!dFcn.projection())
        rv.e.setAttribute('transform', `translate(0, -${ls.rk["bbox.h"]})`)

      if (cfg.centroid) {
        attr = { // create alt points for popup
          'id':rv.attr.id + '-alt',
          'r':0,
          'fill-opacity':0,
          'stroke-opacity':0,
          cx:projection(item[cfg.centroid])[0],
          cy:projection(item[cfg.centroid])[1]
        };
        h.createElement(attr, 'circle', ls.g);
      }
    });

    function getLon(d) {
      d = d[this.field];
      return projection([d, 0])[0];
    };

    function getLat(d) {
      d = d[this.field];
      return projection([0, d])[1];
    };

    let latVal = h.getObjPath(cfg, 'opt.generate.latitude');
    if (typeof latVal == 'string')
      h.generateAccessor(getLat, latVal);

    let lonVal = h.getObjPath(cfg, 'opt.generate.longitude');
    if (typeof lonVal == 'string')
      h.generateAccessor(getLon, lonVal);
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults(cfg) {
    return {frame:'chart center-container > view', feature:'[feature]', attr:{
      stroke:"black", 'stroke-width':3
    }, opt:{clip:false}
        // projectionOpts:{center:[-73.9679163, 40.7495461], scale:100000}
    };
  }
}

},{}],18:[function(require,module,exports){
"use strict";

require("../text.js");

Hive.Plugins.label = class {
  static genAccessors(h) {
    let dFcn = this.text();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
    .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  static text() {
    let cfg = {};
    let parentVal = undefined;

    let create = function (d) {
      let attr = {
        x: cfg.x(d),
        y: cfg.y(d)
      };
      let element = cfg.h.createElement(attr, 'text', parentVal);
      element.textContent = cfg.content(d);
      return element;
    };

    let gen = function (d) {
      return create(d);
    };

    let methods = ['x', 'y', 'content', 'parent', 'h'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;

      gen[item] = function (d) {
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      };
    });
    cfg.h = {};

    cfg.content = d => '';

    return gen;
  }
  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */


  static draw(cfg, h, ls) {
    ls.d.forEach((item, j) => {
      let txtFcn = this.text().h(h).parent(ls.g);
      h.configGen(txtFcn, cfg, ls, item);
      let c = {
        data: item,
        cfg: cfg,
        layerState: ls,
        target: txtFcn(item)
      };
      let rv = h.configElement(c);
      let bandwidth = ls.sa.x.bandwidth;
      let text = h.getObjPath(cfg, 'opt.text');
      let textSA = {}; // hold those props in text that are scaled accessors

      ['textAnchor', 'pad', 'rotate'].forEach((prop, i) => {
        if (prop in (text || {})) textSA[prop] = ls.sa[`opt.text.${prop}`](item);
      });
      let txtrv;
      if (text) txtrv = Hive.Text.replace(rv.e, {
        vh: ls.rk['bbox.h'],
        vw: ls.rk['bbox.w'],
        bw: bandwidth ? bandwidth() : 10,
        text: { ...text,
          ...textSA
        }
      });
      if (text) // set-up template feedback handlers
        ls.template.calls.push(['setTextHeight', txtrv.h]); // h.template(frame, name, value);

      rv.e.setAttribute('class', 'plugin-label'); // THREE uses this to selectively not apply rotation
    });
  }
  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */


  static getDefaults(cfg) {
    let frame = 'chart center-container > view'; // normal label

    if (!('x' in cfg)) frame = 'basic > left-container > title > text'; // title

    return {
      frame: frame,
      data: '_zero_',
      x: 0,
      y: 0,
      content: "Lorem ipsum",
      attr: {
        fill: "#333333",
        'font-family': "Roboto",
        'font-size': 14,
        'font-style': "normal"
      }
    };
  }

};

},{"../text.js":28}],19:[function(require,module,exports){
"use strict";

Hive.Plugins.line = class {

  static genAccessors() {
    let dFcn = d3.line()
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function')
                        .map(d => d=='curve'?`(${d})`:d);
    return methods;
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw (cfg, h, ls) {

    if (!(Array.isArray(ls.d[0]))) ls.d = [ls.d];

    ls.d.forEach((item, j) => {
      let dFcn = h.configGen(d3.line(), cfg, ls, item[0]); // configure shape generator

      let c = {
        d:dFcn(item),
        data:item[0],
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);
    });

    // var dFcn = d3.line();
    // ['x', 'y', 'defined'].forEach((k, i) => { // assign accessors
    //   if (ls.sa[k])
    //     dFcn = dFcn[k](ls.sa[k]);
    //   else
    //     if (cfg[k]) dFcn = dFcn[k](cfg[k]);  // eg  .defined()
    // });

    // marker-end not supported in paperjs
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/marker-end
    // d3.select(g).append("defs").append("marker")
    //     .attr("id", "triangle")
    //     .attr("refX", 1) /*must be smarter way to calculate shift*/
    //     .attr("refY", 5)
    //     .attr("markerUnits", "strokeWidth")
    //     .attr("markerWidth", 10)
    //     .attr("markerHeight", 10)
    //     .attr("orient", "auto")
    //     .append("path")
    //         .attr("d", "M 0 0 L 10 5 L 0 10 z")
    //         .attr('fill', 'red');

    // let data = ls.d;
    // if (!(Array.isArray(data[0]))) data = [data];
    //
    // data.forEach((item, j) => {
    //
    //   dFcn.curve(ls.sa.curve(item[0]));
    //   let attr = {
    //     // "marker-end":"url(#triangle)",
    //     'id':`${ls.g.id}-${cfg.id}-${j}`,
    //     "d":dFcn(item),
    //     'fill':'none',
    //     ...h.parseCfgStroke(ls.sa, item[0], cfg.stroke)
    //   }
    //   attr.stroke = h.parseCfgColor(attr.stroke, `${ls.g.id}-${cfg.id}-0-gradient`, ls.g, 0, 0, 0, -ls.rk['bbox.h']);
    //
    //   h.createElement(attr, 'path', ls.g);
    // });
  }

  // static getOpts() {
  //   return {
  //     d:true,
  //     sa:['x', 'y', 'stroke.color', 'stroke.alpha', 'stroke.dash', 'curve']
  //   };
  // }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', attr:{fill:'none',
            'fill-opacity':0, stroke:"rgb(0,0,0)", 'stroke-width':1
          }
        }
  }
}

},{}],20:[function(require,module,exports){
"use strict";

Hive.Plugins.link = class {
  static genAccessors(h) {
    let dFcn = this.link();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
    .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  static link() {
    let cfg = {};

    let gen = function (d) {
      let sx = cfg.sx(d);
      let sy = cfg.sy(d);
      let tx = cfg.tx(d);
      let ty = cfg.ty(d);
      let orientation = cfg.orientation;

      if (cfg.orientation == 'auto') {
        orientation = 'linkVertical';
        let dx = sx - tx;
        let dy = sy - ty;
        if (Math.abs(dx) > Math.abs(dy)) // mostly horiz
          orientation = 'linkHorizontal';
      } // why did d3 bundle the coords unlike all other generators?


      let path = d3[orientation]().source(d => [sx, sy]).target(d => [tx, ty])(d);
      return path;
    }; // both h/v have same methods


    let methods = ['sx', 'sy', 'tx', 'ty', 'orientation'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;

      gen[item] = function (d) {
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      };
    });
    cfg.orientation = 'auto';
    return gen;
  }
  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */


  static draw(cfg, h, ls) {
    let dFcn = h.configGen(this.link(), cfg, ls);
    ls.d.forEach((item, i) => {
      let c = {
        d: dFcn(item),
        data: item,
        cfg: cfg,
        layerState: ls,
        target: 'path'
      };
      let rv = h.configElement(c);
    });
  }
  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */


  static getDefaults() {
    return {
      frame: 'basic center-view',
      orientation: 'auto',
      attr: {
        'fill': 'none',
        'fill-opacity': 0,
        'stroke-width': 1
      }
    };
  }

}; // export {edge as "Hive.Plugins.edge"}

},{}],21:[function(require,module,exports){
"use strict";

Hive.Plugins.node = class {
  static genAccessors(h) {
    let dFcn = this.node();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  static node () {
    let cfg = {};
    let imgDict = {};

    let gen = function(d){

      if (!(cfg.sym(d) in imgDict)){
        var request = new XMLHttpRequest();
          request.open('GET', cfg.path(d)+cfg.sym(d)+'.svg', false);  // `false` makes the request synchronous
          request.send(null);
          imgDict[cfg.sym(d)] = request.status===200?request.responseXML.rootElement:null;
      }

      let locGrp;
      if (imgDict[cfg.sym(d)] != null){

        let e = imgDict[cfg.sym(d)].cloneNode(true);

        let vb = e.getAttribute("viewBox").split(' ');
        let vw = vb[2];
        let vh = vb[3];

        // Importing svgs within svgs yields inconsistent results.
        // So, create a new group and append transformed children of svg.
        let attr = {
          transform:`translate(${cfg.x(d)-(cfg.size(d)/2)} ${cfg.y(d)-(cfg.size(d)/2)}) scale(${cfg.size(d)/vw})`,
        };
        locGrp = cfg.h.createElement(attr, 'g', cfg.ls.g);
        locGrp.append(...e.childNodes);
      }

      return locGrp;
    }

    let methods = ['x', 'y', 'size', 'path', 'sym', 'h', 'ls'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;
      gen[item] = function(d){
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      }
    });

    return(gen);
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    let element = h.configGen(this.node().h(h).ls(ls), cfg, ls);

    ls.d.forEach((item, j) => {
      let c = {
        data:item,
        cfg:cfg,
        layerState:ls,
        target:element(item)
      };

      let rv = h.configElement(c);
      d3.select(ls.g).selectAll('*').attr('data-svgid',rv.attr.id) // for popups
    });
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {frame:'basic center-view', y:0, size:'15', path:'/nopath/', sym:'noimg'}
  }
}

},{}],22:[function(require,module,exports){
"use strict";

Hive.Plugins.point = class {
  static genAccessors(h) {
    let dFcn = this.point();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d] == 'function' && typeof dFcn[d]() == 'function');
    return methods.concat('x', 'y');
  }

  static point () {
    let cfg={};

    let gen = function(d){
      let syms;

      let s = cfg.shape(d);
      if (typeof(s) == 'string') // received string name instead
        syms = gen.symbolStack[gen.symbolNames.indexOf(s)];
      else
        syms = gen.symbolStack[s];

      syms = syms.map(s => {
        if (d3[`symbol${s}`])
          return d3[`symbol${s}`]; // from d3
        else
          return gen.extra[s]; // extra from below
      });

      let path = syms.map(t => d3.symbol().size(cfg.size(d)).type(t)(d)).join(' ');
      return path;
    }

    let methods = ['shape', 'size'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;
      gen[item] = function(d){
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      }
    });

    (this.initSymbolLocals).bind(gen)();

    return(gen);
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    ls.d.forEach((item, j) => {

      let dFcn = h.configGen(this.point(), cfg, ls, item);
      let c = {
        d:dFcn(item),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path',
      };

      let rv = h.configElement(c);
      let x = ls.sa.x(item) + (cfg.jitter?h.getDrawWidth(ls.sa.x(),Math.random()*cfg.jitter):0);
      rv.e.setAttribute('transform', `translate(${x} ${ls.sa.y(item)})`);

      // let type;
      // sym.forEach((s, i) => { // create composite symbols
      //
      //   if (d3[`symbol${s}`])
      //     type = d3[`symbol${s}`]; // from d3
      //   else {
      //     type = extra[s]; // extra from above
      //   }
      //
      //   var symbolGenerator = d3.symbol()
      //     .type(type)
      //     .size(ls.sa.size(item)**2);
      //
      //   let id = `${ls.g.id}-${cfg.id}-${j}`
      //   let attr = {
      //     'id':id,
      //     "d":symbolGenerator(),
      //     "transform":`translate(${x} ${y})`,
      //     "fill":ls.sa.color(item),
      //     ...h.parseCfgFill(ls.sa, item),
      //     ...h.parseCfgStroke(ls.sa, item, cfg.stroke)
      //   };
      //
      //   h.eventRegister(id, ls.g.id, cfg.ev, {popup:{attr:attr, idx:j, title:cfg.title, data:ls.d}});
      //   h.createElement(attr, 'path', ls.g);
      // });

    });
  }

  // static getOpts() {
  //   return {
  //     d:true,
  //     sa:['x', 'y', 'size', 'shape', 'color', 'alpha', 'stroke.color', 'stroke.alpha']
  //   };
  // }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          y:0, size:'25', shape:0, frame:'chart center-container > view', attr:{
            fill:"black", stroke:"black", 'stroke-width':1
          }
        }
  }



  static initSymbolLocals() {
    this.symbolNames = [
      'square open',
      'circle open',
      'triangle open',
      'plus',
      'cross',
      'diamond open',
      'triangle down open',
      'square cross',
      'asterisk',
      'diamond plus',
      'circle plus',
      'star',
      'box plus',
      'circle cross',
      'square triangle',
      'square',
      'circle',
      'triangle',
      'diamond',
      'circle',
      'bullet',
      'circle filled',
      'square filled',
      'diamond filled',
      'triangle filled',
    ]

    // GGPLOT: Square Circle Diamond TriangleDn Triangle Plus Times
    // https://ggplot2.tidyverse.org/articles/ggplot2-specs.html?q=points#point
    this.symbolStack = [ // 25 base points
      ['Square'],
      ['Circle'],
      ['Triangle'],
      ['Plus'],
      ['Times'],
      ['diamondSquare'],
      ['TriangleDn'],
      ['Square', 'Times'],
      ['Plus', 'Times'],
      ['diamondSquare', 'Plus'],
      ['Circle', 'Plus'],
      ['Star'], //['TriangleDn', 'Triangle'],
      ['Square', 'Plus'],
      ['Circle', 'Plus'],
      ['Square', 'Triangle'],
      ['Square'],
      ['Circle'],
      ['Triangle'],
      ['diamondSquare'],
      ['Circle'],
      ['Circle'],
      ['Circle'],
      ['Square'],
      ['diamondSquare'],
      ['Triangle'],
    ];

    // more symbols
    let sqrt3 = Math.sqrt(3);
    this.extra = {
      diamondSquare: {
        draw: function(context, size) {
          var w = Math.sqrt(size);
          var d = w / 2 * Math.sqrt(2);

          context.moveTo(0, -d);
          context.lineTo(d, 0);
          context.lineTo(0, d);
          context.lineTo(-d, 0);
          context.closePath();
        }
      },
      triangleDn: {
        draw: function(context, size) {
          var y = -Math.sqrt(size / (sqrt3 * 3));
          context.moveTo(0, -y * 2);
          context.lineTo(-sqrt3 * y, y);
          context.lineTo(sqrt3 * y, y);
          context.closePath();
        }
      },
      Times: {
        draw: function(context, size) {
          var w = Math.sqrt(size);
          var d = w / 2 * Math.sqrt(2);

          context.moveTo(d, d);
          context.lineTo(-d, -d);
          context.moveTo(-d,d);
          context.lineTo(d,-d);
        }
      },
      Plus: {
        draw: function(context, size) {
          var w = Math.sqrt(size);
          var d = w / 2 * Math.sqrt(2);

          context.moveTo(d, 0);
          context.lineTo(-d, 0);
          context.moveTo(0,d);
          context.lineTo(0,-d);
        }
      }
    }
  }
}

},{}],23:[function(require,module,exports){
"use strict";

Hive.Plugins.rectangle = class {

  static genAccessors(h) {
    let dFcn = this.rectangle();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function');
    return methods.concat('rotate');
  }

  static rectangle () {
    let cfg = {};

    let shapeFcn = [
      (x, y, w, v) => `M ${x}, ${v} L${x-(w/2)} ${v} L${x-(w/2)} ${y} L${x+(w/2)} ${y} L${x+(w/2)} ${v} L${x} ${v} Z`,
      (x, y, w, v) => `M ${x}, ${y} L${x+w} ${y} L${x+w} ${y-v} L${x} ${y-v} L${x} ${y} Z`,
    ];

    let gen = function(d){
      if (cfg.widthIsFraction)
        return shapeFcn[cfg.shape(d)](cfg.x(d), cfg.y(d), cfg.h.getDrawWidth(cfg.ls.sa.x(), cfg.width()), cfg.v(d));
      else
        return shapeFcn[cfg.shape(d)](cfg.x(d), cfg.y(d), cfg.ls.sa.width(d), cfg.v(d));
    }

    let methods = ['x','y', 'v', 'width', 'widthIsFraction', 'shape', 'h', 'ls'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;
      gen[item] = function(d){
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      }
    });

    cfg.h = null;
    cfg.ls = null;
    cfg.widthIsFraction = false;

    return(gen);
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {
    ls.d.forEach((item, j) => {

      let dFcn = h.configGen(this.rectangle().h(h).ls(ls), cfg, ls, item);
      if (typeof cfg.width == 'number')
        dFcn.widthIsFraction(true);

      let c = {
        d:dFcn(item),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);

      if (h.getObjPath(cfg, 'opt.rotateOrigin') == 'xy') {
        rv.e.setAttribute('transform', `rotate(${ls.sa.rotate(item)},${ls.sa.x(item)},${ls.sa.y(item)})`);
      } else {
        rv.e.setAttribute('transform', `rotate(${ls.sa.rotate(item)},0,0)`);
      }

      let attr = { // create alt points for popup
        'id':rv.attr.id + '-alt',
        'r':0,
        'opacity':0,
        'stroke-opacity':0,
        cx:ls.sa.x(item),
        cy:ls.sa.y(item)
      };
      h.createElement(attr, 'circle', ls.g);
    });

  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', v:0, width:.3, shape:0, rotate:0, attr:{
            fill:"orange", stroke:'black', 'stroke-width':0
          }
        }
  }
}

},{}],24:[function(require,module,exports){
"use strict";

Hive.Plugins.tbar = class {
  static genAccessors(h) {
    let dFcn = this.tbar();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function');
    return methods;
  }

  static tbar () {
    let cfg={};

    let gen = function(d){
      let rx = cfg.x(d); // resolve all values
      let ry = cfg.y(d);
      let rw = cfg.h.getDrawWidth(cfg.ls.sa.x(), cfg.width());
      let rv = cfg.v(d);
      return `M${rx} ${ry} L${rx} ${rv} M${rx-(rw/2)} ${ry} L${rx+(rw/2)} ${ry} Z`
    }

    let methods = ['x','y', 'v', 'width', 'h', 'ls'];
    methods.forEach((item, i) => {
      cfg[item] = d => d;
      gen[item] = function(d){
        if (d) {
          cfg[item] = d;
          return this;
        } else return cfg[item];
      }
    });

    cfg.h = null;
    cfg.ls = null;

    return(gen);
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {

    ls.d.forEach((item, j) => {

      let dFcn = h.configGen(this.tbar().h(h).ls(ls), cfg, ls, item);
      let c = {
        d:dFcn(item),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path'
      };
      let rv = h.configElement(c);
    });
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', v:0, width:.3, attr:{stroke:'black', 'stroke-width':1}
        }
  }

}

},{}],25:[function(require,module,exports){
"use strict";

Hive.Plugins.violin = class {

  static violin() {
    let dFcn = d3.area();
    let band = d => 0;
    let bandwidth = d => 10;

    let gen = function(d){
      return dFcn(d);
    }

    // inherit all methods
    let methods = Object.keys(dFcn);
    methods.forEach((m, i) => {
      gen[m] = function(d){
        dFcn[m](d);
        return(this);
      }
    });

    gen.area_x = dFcn.x;

    // redefine x
    gen.x = function(d){
      if (d) {
        dFcn.x0((e) => ( (bandwidth(d(e))/2) + band(e)));
        dFcn.x1((e) => (-(bandwidth(d(e))/2) + band(e)));

        return this;
      } else return([dFcn.x0(),dFcn.x1()]);
    }

    gen.band = function(d){
      if (d) {
        band = d;
        return this;
      } else return band;
    }

    gen.bandwidth = function(d){
      if (d) {
        bandwidth = d;
        return this;
      } else return bandwidth;
    }

    return(gen);
  }


  static genAccessors(h) {
    let dFcn = this.violin();
    let methods = Object.keys(dFcn) // resolve curve before passing to gen
                        .filter(d => typeof dFcn[d]() == 'function')
                        .map(d => d=='curve'?`(${d})`:d);
    return methods.concat('x');
  }

  /**
  * Appends elements to the provided group
  *
  * @param object The plugin configuration
  * @param object The group element to attach to
  * @param object Relative sizing keys for this frame
  * @param object The visualization Object
  * @return none
  */
  static draw(cfg, h, ls) {
    if (!(Array.isArray(ls.d[0]))) ls.d = [ls.d];

    let dFcn = h.configGen(this.violin(), cfg, ls);
    dFcn.bandwidth(d=>h.getDrawWidth(ls.sa.band(), d)); // violin width

    ls.d.forEach((item, j) => {
      let c = {
        d:dFcn(item),
        data:item,
        cfg:cfg,
        layerState:ls,
        target:'path',
      };

      let rv = h.configElement(c);
    });
  }

  /**
  * Gets the defaults for this plugin
  *
  * @return An object with the defaults
  */
  static getDefaults() {
    return {
          frame:'chart center-container > view', attr:{fill:"rgb(0,0,0)", 'stroke-width':0}
        }
  }

}

},{}],26:[function(require,module,exports){
"use strict";

Hive.Renderer.svg = class {

  /**
  * Sets up the container & renderer
  *
  * @param object The container element
  * @param object The element config
  * @return a complete draw cfg
  */
  constructor(element, cfg) {
    this.element = element;
    this.eCfg = cfg;
    this.drawableElement = {};

    // let parentBBox = this.element.getBoundingClientRect();
    // this.w = parentBBox.width;
    // this.h = parentBBox.height;
    // this.w = cfg.sizing.width;
    // this.h = cfg.sizing.height;
  }

  /**
  * Render a given svg with associated events
  *
  * @param object SVG to render
  * @param object Events list
  * @return The groups to subscribe to
  */
  render(svg, events) {
    let prevSvg = document.querySelector(`${this.eCfg.selector} svg`);
    if (prevSvg) prevSvg.remove();

    svg._visualization = this.drawableElement._visualization;
    this.drawableElement = svg;
    d3.select(svg).selectAll('path').attr('vector-effect', 'non-scaling-stroke'); // for zoom

    svg.style.top = '0px';
    svg.style.left = '0px';
    svg.style.position = 'absolute';
    this.element.append(svg)  // this.v.element.selector

    return this.attachEvents(svg, events);;
  }

  /**
  * Attach events to various elements
  *
  * @param object Group of Elements
  * @param object Events list
  * @return The groups to subscribe to
  */
  attachEvents(group, events) {
    let evTypes = ['onClick','onMouseEnter','onMouseLeave'];
    let eventSubscriptions = [];

    events.forEach((e, i) => {
      let item = d3.select(`${this.eCfg.selector} > svg > #${e.groupId} > #${e.elId}`);

      evTypes.forEach((evt, i) => {
        if (!(e.ev[evt])) return; // if the element event cfg does not include eventtype
        if (e.ev.group)
          eventSubscriptions.push(e.ev.group);

        let d3event = evt.substring(2).toLowerCase();
        item.on(d3event, () => {         // init handler
          if (e.ev.group)
            this.messagePub(e.ev.group, {type:evt, e:e});
          if (e.ev[evt].element)
            this.on(item, evt, e.ev[evt].element); // paperjs .getFillColor does not work, so provide it.
          if (e.ev[evt].handler)
            e.ev[evt].handler(item, evt);
        });
      });

      if (item.on('mouseenter') && !(item.on('mouseleave'))){  // if enter was set, do leave
        item.on('mouseleave', () => {
          this.on(item, 'onMouseLeave', {})
          this.messagePub(e.ev.group, {type:'onMouseLeave', e:e});
        });
      }
    });

    return eventSubscriptions;
  }

  /**
  * element event handler
  *
  * @param object The element
  * @param object Events cfg object
  * @param object Events data object
  * @return none
  */
  on(el, ev, evData) {

    if (ev == 'onClick'){
      el.attr('data-clicked', !el.attr('data-clicked'));

      if (evData.color){
        if (el.attr('data-clicked') == true) {
          el.style('fill', evData.color);
        } else {
          el.style('fill', '');
        }
      }

      if (evData.opacity){
        if (el.attr('data-clicked') == true) {
        el.style('opacity', evData.opacity);
        } else {
          el.style('opacity', '');
        }
      }

      if (evData.scale){
        if (el.attr('data-clicked') == true) {
          el.style('transform', el.style('transform') + ` scale(${evData.scale})`);
        } else {
          el.style('transform', '');
        }
      }
    }

    if (ev == 'onMouseLeave' || el.attr('data-mouseEnter')){
      if (el.attr('data-mouseEnter'))  {
        el.attr('data-mouseEnter', false);
        el.style('fill', '');
        el.style('opacity', '');
        el.style('transform', '');
      }
    }

    if (ev == 'onMouseEnter'){
      el.attr('data-mouseEnter', true);
      if (evData.color){
        el.style('fill', evData.color);  // paper can't handle rgb(x,y,z)
      }
      if (evData.opacity){
        el.style('opacity', evData.opacity);  // paper can't handle %
      }
      if (evData.scale){
        el.style('transform', el.style('transform') + ` scale(${evData.scale})`);
      }
    }
  }

  /**
  * set relative position of object by group and element id
  *
  * @param string The group id
  * @param string The element id
  * @param boolean Whether or not to find the alternative positions
  * @return the element location
  */
  getPosition(gid, eid, findAlt){
    let container = document.querySelector(`${this.eCfg.selector} > svg`).getBoundingClientRect();
    let e = document.querySelector(`${this.eCfg.selector} > svg > #${gid} > #${eid}`).getBoundingClientRect();
    if (findAlt){
      let eAlt = document.querySelector(`${this.eCfg.selector} > svg > #${gid} > #${eid}-alt`)
      if (eAlt) eAlt = eAlt.getBoundingClientRect();
      if (eAlt) e = eAlt;
    }
    return {left:(e.left-container.left)+(e.width/2), top:(e.top-container.top)+(e.height/2)};
  }

  /**
  * set viewbox for panning/zooming
  *
  * @param array Viewbox settings
  * @param object The element
  * @param boolean Whether or not to find the alternative positions
  * @return none
  */
  setViewBox(vb){
    this.drawableElement.setAttribute('viewBox', vb.join(' '));
  }

  /**
  * Gets length of rendered text
  *
  * @param string Text to use
  * @param string Font family name
  * @param number point size
  * @return Text length in px
  */
  getTextWidth(text, font, size)  {
    let e = d3.select(this.element)
      .append('svg').attr('id', 'textMeasureContainer')
      .append('text').attr('font-family', font).attr('font-size', size).text(text);
    let len = e.node().getComputedTextLength();
    d3.select(this.element).select('#textMeasureContainer').remove();

    return len;
  }

  getTargetSize() {
    return {w:this.element.clientWidth, h:this.element.clientHeight};
  }

  // set renderer related sizes
  setRendererSize(w,h) {

  }

  /**
  * Gets current of drawable
  *
  * @return Drawable width / height
  */
  // getSize(){
  //   return {w:this.w, h:this.h}
  // }

  /**
  * Re-rendering function
  *
  * @param object The element cfg
  * @param object The Visualization object
  * @return none
  */
  // resize(w, h) {
  //   // let w = cfg.sizing.width;
  //   // let h = cfg.sizing.height;
  //   //
  //   // if (cfg.sizing.keepAspect) {
  //   //   let parentBBox = this.element.getBoundingClientRect();
  //   //   // let parentBBox = this.drawableElement.parentElement.getBoundingClientRect();
  //   //   let calcW = parentBBox.height * (w/h);
  //   //   let calcH = parentBBox.width * (h/w);
  //   //
  //   //   if (calcW > parentBBox.width) {
  //   //     w = parentBBox.width;
  //   //     h = calcH;
  //   //   } else {
  //   //     w = calcW
  //   //     h = parentBBox.height;
  //   //   }
  //   // }
  //   //
  //   // this.w = w;
  //   // this.h = h;
  //
  //   // if (vis && cfg.sizing.keepAspect) {
  //   //   vis.frames(vis.v.frames); // recalc frame sizes
  //   //   vis.draw(vis.v.draw);  // redraw
  //   // }
  //
  //   // let parentBBox = this.element.getBoundingClientRect();
  //   // this.w = parentBBox.width;
  //   // this.h = parentBBox.height;
  //
  //   // let size = vis.getSize();
  //   // this.w = size.w;
  //   // this.h = size.h;
  //
  //   this.w = w;
  //   this.h = h;
  //
  //   // if (vis)  {
  //   //   vis.tk.frames.entry(vis.v.frames); // recalc frame sizes
  //   // }
  // }
}

},{}],27:[function(require,module,exports){
"use strict";

/*
*  Templates are html flex-line templates to control layout of graphical elements.
*  The flex worker which resolves the config into x/y/h/w/etc. is running in another
*  thread.  As with html flex, there is a root node which contains nested children
*  ad-nauseum. In addition to flex properties, this implementation contains per-
*  node opt, and handlers.
*
*  Opt contains user attached data which it delivers in a callback whenever a specific
*  node resizes.
*
*  Handlers contains directives on how to RELATIVELY modify the template when a property
*  changes.  Eg: Account for a shift in title centering when the left axis grows.  While
*  it makes the overall template more cumbersome, it elides the need for two flex
*  reflows per viewport change. Eg: Reflow to get the width of the left axis, apply
*  it the title left margin, and reflow again.
*/

Hive.templates = class {

  /**
  * Initialize locals and template opts
  *
  * @return none
  */
  constructor() {

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

    let axis = {
      enabled:true,
      height:'100%',
      width:'100%',
      margins:this.clone(margins),
      textAnchor:this.clone(textAnchor, {margins:{}})
    };

    let guide = {
      enabled:true,
      margins:this.clone(margins)
    }

    // main opts for this module
    this.opt = {
      prefix:'',
      viewData:{},

      basic:{
        title:{textAnchor:this.clone(textAnchor, {margins:{top:16,bottom:4}})},
        margins:this.clone(margins),
        padding:{all:5},
        guide:{
          right:this.clone(guide, {margins:{left:2}}),
          bottom:this.clone(guide, {margins:{top:2}})
        }
      },

      chart:{
        axis:{
          top:this.clone(axis, {enabled:false, height:30, textAnchor:{margins:{top:10}}, margins:{bottom:10}}),
          right:this.clone(axis, {enabled:false, width:30, textAnchor:{margins:{left:10}}, margins:{left:10}}),
          bottom:this.clone(axis, {height:30, textAnchor:{margins:{top:10}}, margins:{top:10}}),
          left:this.clone(axis, {width:30, textAnchor:{margins:{left:10}}, margins:{right:10}}),
          // left:this.clone(axis, {width:0, textAnchor:{margins:{left:10}}, margins:{right:10}})
        }
      }
    };

    Hive.templatePlugins.forEach((item, i) => { // add plugins
      Object.assign(this.__proto__, item.proto);
      item.init.bind(this)();
    });
  }

  /**
  * Clone & mask a template object
  *
  * @param object existing object
  * @param object new object to merge into existing
  * @return merged object
  */
  clone (branch, layer) {
    let obj = JSON.parse(JSON.stringify(branch));
    return Hive.Object.mergeDeep(obj, layer);
  }

  /**
  * Get node from a template config
  *
  * @param object template object
  * @param object node selector
  * @return config node
  */
  static getCfgNode(cfg, sel) {
    let byID = [];
    let getIDs  = function(cfg, pid) {
      let id = (pid?pid+' ':'')+cfg.id
      byID.push({id:id, node:cfg})
      if (cfg.children)
      cfg.children.forEach(d => {
        getIDs(d, id)
      });
      return byID;
    }

    let ids = getIDs(cfg);
    let s = sel.trim();
    s = s.replace(/ *> */g, '>');
    s = s.replace(/ /g, ' [ \\-\\w]*');
    s = s.replace(/>/g, ' ');
    // if (!(s.split(' ')[0] == cfg.id)) s = ' '+s; // put a space in front if not root
    s = s.split(' ')[0]==cfg.id ? '^'+s : ' '+s; // if root put caret else space


    let n = ids.filter(d => RegExp(s+'$').test(d.id));
    if (n.length > 1) console.warn('Multiple matches for selector:', sel, '\nUsing [0]');
    if (n.length == 0) console.error('No matches for selector:', sel);
    return n[0].node;

    //
    // path.split(' ').forEach(p => {
    //   cfg = cfg.children.filter(d => d.id == p)[0];
    // });
    // return cfg;
  }

  /**
  * Get options
  *
  * @param object template config
  * @return cloned template config
  */
  resolveOpt (cfg) {
    let c = this.clone(this.opt, cfg||{});
    if (c.prefix.length && !c.prefix.endsWith('-')) c.prefix += '-';
    return  c;
  }


  /**
  * Get basic template with right & bottom guides
  *
  * @param object template config options
  * @return template
  */
  basic(cfg) {
    let o = this.resolveOpt(cfg);
    let c = o.basic

    let rightGuideTopMargin = (c.title.textAnchor.margins.top||0) + (c.title.textAnchor.margins.bottom||0);
    let template = {
      "id": o.prefix+"basic", "attr": {
        "flex-wrap": "wrap-no-wrap", "flex-direction": "flex-direction-row", "flex-shrink":1, "flex-grow":1}, "children": [
          {"id": "left-container", "attr":{"flex-direction": "flex-direction-column","flex-shrink":1, "flex-grow":1}, "children":[
            {"id": "title", "attr":{"padding edge-left":0, "padding edge-right":0}, "children":[
              {"id": "text", handlers:{setTextHeight:[
                {op:'subCur', nodes:[`${o.prefix}basic > guide-right`], srcAttr:"margin edge-top", dstAttr:"padding edge-top"},
                {attr:"margin edge-top"},
                {op:'add', nodes:[`${o.prefix}basic > guide-right`], attr:"padding edge-top"}
              ]}, "attr":{"margin edge-top":c.title.textAnchor.margins.top, "margin edge-bottom":c.title.textAnchor.margins.bottom, "align-self":"align-center", "height":1, "width":1}},
            ]},
            {"id": "center-view", "attr":{"flex-shrink":1, "flex-grow":1}, opt:o.viewData, "children":[]},
            {"id": "guide-bottom", "attr":{"padding edge-left":0, "padding edge-right":0, "margin edge-top":c.guide.bottom.margins.top||0, "flex-wrap":"wrap-wrap", "flex-direction":"flex-direction-row"}, children:[]}
          ]},
          {"id": "guide-right", "attr":{"padding edge-top":rightGuideTopMargin, "margin edge-left":c.guide.right.margins.left||0, "height":"100%"}, "children":[]}
        ]
      }

      Object.keys(c.padding).forEach((p, i) => {
        template.attr[`padding edge-${p}`] = c.padding[p];
      });

      Object.keys(c.guide).forEach((g, i) => {
        if (!c.guide[g].enabled){
          let node = this.constructor.getCfgNode(template, 'guide-'+g);
          node.attr = {};
        }
      });

      return template;
    }

    /**
    * Get template with quadrants
    * This is often used for polar charts where the top right quadrant selector
    * & origin is used and the chart spans clockwise into the -x,-y domains.
    *
    * @param object template config options
    * @return template
    */
    quadrants(cfg) {
      let o = this.resolveOpt(cfg);
      let c = o.chart;

      let template = this.basic(c);

      this.constructor.getCfgNode(template, 'center-view').attr["flex-wrap"]="wrap-wrap";
      this.constructor.getCfgNode(template, 'center-view').attr["flex-direction"]="flex-direction-row";

      let children = [
        {"id": "q0", "attr": {"height":"50%", "width":"50%"}},
        {"id": "q1", "attr": {"height":"50%", "width":"50%"}},
        {"id": "q2", "attr": {"height":"50%", "width":"50%"}},
        {"id": "q3", "attr": {"height":"50%", "width":"50%"}}
      ];

      this.constructor.getCfgNode(template, 'center-view').children = children;
      return template;
    }

    /**
    * Get chart template with axes, & axes labels
    * This is often used for polar charts where the top right quadrant selector
    * & origin is used and the chart spans clockwise into the -x,-y domains.
    *
    * @param object template config options
    * @return template
    */
    chart(cfg) {
      let o = this.resolveOpt(cfg);
      let c = o.chart;

      let axisSize = {};
      Object.keys(c.axis).forEach((axis, i) => {
        let a = c.axis[axis];
        if (!a.enabled) {
          axisSize[axis]=0;
          return;
        }

        if (["top","bottom"].includes(axis))
        axisSize[axis] = a.height + (a.margins.top||0) + (a.margins.top||0) + (a.textAnchor.margins.top||0) + (a.textAnchor.margins.bottom||0);
        else
        axisSize[axis] = a.width + (a.margins.left||0) + (a.margins.right||0) + (a.textAnchor.margins.left||0) + (a.textAnchor.margins.right||0);
      });

      let parentTemplate = this.basic({...cfg, viewData:{}});

      let template = {
        "id": o.prefix+"chart", "attr": {"flex-wrap": "wrap-no-wrap", "flex-direction": "flex-direction-column", "flex-shrink":1, "flex-grow":1}, "children": [
          {"id":"top", "attr": {"flex-wrap": "wrap-no-wrap", "flex-direction": "flex-direction-column", "margin edge-left":axisSize.left, "margin edge-right":axisSize.right}, "children": [
            // {"id":"top", "attr":{"width":"100%", "flex-direction": "flex-direction-column",
            // "flex-shrink":1, "flex-grow":1}, "children": [
            {"id":"text", handlers:{setTextHeight:[{attr:"margin edge-top"}]}, "attr":{"align-self":"align-center"}},
            {"id":"axis", "attr":{"flex-direction": "flex-direction-row"}, children:[]}
            // ]},
          ]},
          {"id":"center-container", "attr": {"flex-wrap": "wrap-no-wrap", "flex-direction": "flex-direction-row", "flex-shrink":1, "flex-grow":1}, "children": [

            {"id":"left", "attr":{"flex-direction": "flex-direction-row"}, "children": [
              {"id":"text",
              handlers:{setTextHeight:[
                {op:'subCur', nodes:[o.prefix+'chart top', o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], srcAttr:'margin edge-left', dstAttr:"margin edge-left"},
                {attr:"margin edge-left"},
                {op:'add', nodes:[o.prefix+`chart top`, o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], attr:"margin edge-left"}
              ]
            }, "attr":{"align-self":"align-center"}},
            {"id":"axis",
            handlers:{setAxisSz:[
              {op:'subCur', nodes:[o.prefix+'chart top', o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], srcAttr:'width', dstAttr:"margin edge-left"},
              {attr:"width"},
              {op:'add', nodes:[o.prefix+'chart top', o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], attr:"margin edge-left"}
            ]
          }, "attr":{"flex-direction": "flex-direction-column"}, children:[]}
        ]},

        {"id":"view", "attr":{"flex-shrink":1, "flex-grow":1}, opt:o.viewData},

        {"id":"right", "attr":{"flex-direction": "flex-direction-row"}, "children": [
          {"id":"axis", handlers:{setAxisSz:[
            {op:'subCur', nodes:[o.prefix+'chart top', o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], srcAttr:'width', dstAttr:"margin edge-right"},
            {attr:"width"},
            {op:'add', nodes:[o.prefix+'chart top', o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], attr:"margin edge-right"}
          ]}, "attr":{"flex-direction": "flex-direction-column"}, children:[]},
          {"id":"text", handlers:{setTextHeight:[
            {op:'subCur', nodes:[o.prefix+'chart top', o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], srcAttr:'margin edge-right', dstAttr:"margin edge-right"},
            {attr:"margin edge-right"},
            {op:'add', nodes:[o.prefix+'chart top', o.prefix+'chart > bottom', o.prefix+'basic > left-container > title'], attr:"margin edge-right"}
          ]}, "attr":{"align-self":"align-center"}}
        ]}
      ]},
      {"id":"bottom", "attr": {"flex-wrap": "wrap-no-wrap", "flex-direction": "flex-direction-column", "margin edge-left":axisSize.left, "margin edge-right":axisSize.right},"children": [
        // {"id":"bottom", "attr":{"flex-direction": "flex-direction-column", "flex-shrink":1, "flex-grow":1}, "children": [
        {"id":"axis", handlers:{setAxisSz:[{attr:"height"}]}, "attr":{"flex-direction": "flex-direction-row"}, children:[]},
        {"id":"text", handlers:{setTextHeight:[{attr:"margin edge-top"}]}, "attr":{"align-self":"align-center"}}
        // ]},
      ]}
      // {"id":"bottom-container", "attr": {"flex-wrap": "wrap-no-wrap", "flex-direction": "flex-direction-row", "padding edge-left":axisSize.left, "padding edge-right":axisSize.right},"children": [
      //   {"id":"bottom", "attr":{"flex-direction": "flex-direction-column", "flex-shrink":1, "flex-grow":1}, "children": [
      //     {"id":"axis", handlers:{setAxisSz:[{attr:"height"}]}, "attr":{"flex-direction": "flex-direction-row"}, children:[]},
      //     {"id":"text", handlers:{setTextHeight:[{attr:"margin edge-top"}]}, "attr":{"align-self":"align-center"}}
      //   ]},
      // ]}
    ]};

    // basic title
    let node = this.constructor.getCfgNode(parentTemplate, `${o.prefix}basic > left-container > title`);
    ['left', 'right'].forEach((e, i) => {
      node.attr[`margin edge-${e}`] = axisSize[e];
    });

    // layout
    Object.keys(c.axis).forEach((a, i) => {
      if (c.axis[a].enabled) { // config axis
        let node = this.constructor.getCfgNode(template, `${a} axis`);
        node.attr.width = c.axis[a].width;
        node.attr.height = c.axis[a].height;
        Object.keys(c.axis[a].margins).forEach((m, i) => {
          node.attr[`margin edge-${m}`] = node.attr[`margin edge-${m}`]||0 + c.axis[a].margins[m];
        });

        node = this.constructor.getCfgNode(template, `${a} text`);
        Object.keys(c.axis[a].textAnchor.margins).forEach((m, i) => {
          node.attr[`margin edge-${m}`] = (node.attr[`margin edge-${m}`]||0) + c.axis[a].textAnchor.margins[m];
        });
      } else { // delete axis
        let node = this.constructor.getCfgNode(template, `${a}`)
        node.attr = {}; // DELETE ATTR INSTEAD
        node.children = [];
      }
    });

    this.constructor.getCfgNode(parentTemplate, 'center-view').children = [template];
    return parentTemplate;
  }

}

},{}],28:[function(require,module,exports){
Hive.Text = class Text {

  /**
  * Convert dashes and underbars to camel-case
  *
  * @param string snake string
  * @return camel string
  */
  static snakeToCamel (str) {
    return str.replace(/([-_][a-z])/g,
      (group) => group.toUpperCase()
                    .replace('-', '')
                    .replace('_', '')
                  );
  }

  /**
  * Attach a block of text to an anchor point and set position modifiers
  *
  * @param object Text lines and their metrics
  * @param number Max width of all lines
  * @param number height of a single line
  * @param object text formatting config
  * @return none
  */
  static reposition(lines, w, sh, cfg) { // set the abs position of text
    let xOff = 0, yOff = 0;
    let h = sh * lines.length;

    switch(cfg.textAnchor) {
      // case 'tl':  // Top Left is the default case
      // break;

      case 'tm':
      case 'mt':
      xOff = -w/2;
      yOff = sh;
      break;

      case 'tr':
      case 'rt':
      xOff = -w;
      yOff = sh;
      break;

      case 'ml':
      case 'lm':
      yOff = sh-(h/2);
      break;

      case 'mm':
      xOff = -w/2;
      yOff = sh-(h/2);
      break;

      case 'mr':
      case 'rm':
      xOff = -w;
      yOff = sh-(h/2);
      break;

      case 'bl':
      case 'lb':
      yOff = -h + sh;
      break;

      case 'bm':
      case 'mb':
      xOff = -w/2;
      yOff = -h + sh;
      break;

      case 'br':
      case 'rb':
      xOff = -w;
      yOff = -h + sh;
      break;
    }

    // add padding
    if (cfg.textAnchor[0] == 'l' || cfg.textAnchor == 'ml') xOff += cfg.pad; // left
    if (cfg.textAnchor[0] == 'r' || cfg.textAnchor == 'mr') xOff -= cfg.pad; // right
    if (cfg.textAnchor[0] == 't' || cfg.textAnchor == 'mt') yOff += cfg.pad; // top
    if (cfg.textAnchor[0] == 'b' || cfg.textAnchor == 'mb') yOff -= cfg.pad; // bottom

    lines.forEach((l, i) => {
      let justOff = 0;
      let xDelta = w - l.measure.width;
      if (cfg.justify == 'center') justOff = xDelta/2;
      if (cfg.justify == 'right') justOff = xDelta;

      l.position.x += cfg.x + xOff + justOff;
      l.position.y += cfg.y + yOff + cfg.lineSpacing + cfg.yOffset;
    });
  }

  /**
  * Truncates text and adds ... to the end.
  *
  * @param object line of text
  * @param number line width
  * @param object line attributes
  * @return none
  */
  static ellipseize (line, w, attr) {
    let lineWidth = measureText([line.text + '...'], attr)[0].width;

    while(line.text.length && lineWidth > w) {
      line.text = line.text.slice(0,-1);
      lineWidth = measureText([line.text + '...'], attr)[0].width;
    }

    line.text += '...';
    line.measure.width = lineWidth;
  }

  // NOTE:  HTML/SVG fonts are not introspectable. "yOffset" exists because fonts may
  // have ascenders/descenders that go higher/lower respectively than a font's X-height.
  // Eg: You style a font to be 14px, draw an X and the bounding box height for the char
  // will be > 14px.  What's worse is you can't query the font for the delta AND the
  // asc/dec ratio can CHANGE as you scale the font.
  // tldr: SVG text vertical centering is unlikely w/o manual tweaking.

  // ALL font-* attrs that affect size must be applied to the text element directly
  // as window.getComputedStyle() will not work if the SVG never hits the DOM.

  /**
  * Formats input text
  *
  * @param string text
  * @param number text configuration
  * @return text object with metrics
  */
  static format (content, cfg) {
    let defs = {
      x:0,
      y:0,
      height:100,
      width:300,
      attr:{},
      lineSpacing:0,
      textAnchor:'tm',
      pad:0,
      yOffset:0,
      justify:'left',
      ellipseize:true,
      rotate:0,
      format:d=>d
    };
    cfg = {...defs, ...cfg};
    content = String(cfg.format(content));

    let attr = {};
    Object.keys(cfg.attr).filter(d => d.startsWith('font-')).map(d => attr[this.snakeToCamel(d)] = cfg.attr[d]);

    let rv = layoutText(content, {maxWidth:cfg.width, maxLines: 9999}, attr, {'lineSpacing':cfg.lineSpacing});
    let rvLen = rv[0].lines.length;

    let singleHeight = rv[0].lines[0].measure.height;
    let lines = rv[0].lines.slice(0, parseInt(cfg.height / singleHeight));
    let maxWidth = lines.map(d => d.measure.width).reduce((a, b)=>Math.max(a, b));
    if (maxWidth > cfg.width) maxWidth = cfg.width;

    if (cfg.ellipseize && rvLen > lines.length) {  // ellipseize
      let last = lines.length-1;
      this.ellipseize(lines[last], maxWidth, attr);
    }

    this.reposition(lines, maxWidth, singleHeight, cfg);

    var e = document.createElementNS("http://www.w3.org/2000/svg", "g");
    // e.setAttribute('transform', `rotate(${cfg.rotate} ${cfg.x},${cfg.y})`)

    let strAttr = (' '+JSON.stringify(cfg.attr)).replace(/[{}]/g, '').replaceAll(':', '=').replaceAll(',',' ')
                                                          .replaceAll('"=', '=').replaceAll(' "',' ');

    lines.forEach((item, i) => {
      e.innerHTML += `<text x=${item.position.x} y=${item.position.y} ${strAttr} text-anchor="start" transform="rotate(${cfg.rotate} ${cfg.x},${cfg.y})">${item.text.replace('&nbsp;', ' ')}</text>`;
    });
    e.innerHTML = e.innerHTML.replaceAll('&nbsp;', ' ');

    return ({maxWidth, lines, e, bbox:{w:rv[0].width, h:singleHeight*lines.length}});
  }

  /**
  * Formats the text of an SVG.  Removes existing text, inserts new formatted text.
  *
  * @param object HTML text element
  * @param number text configuration
  * @return formatted text metrics
  */
  static replace(e, cfg) {
    // resolve w/h units
    ['height', 'width'].forEach((param, i) => {
      let p = cfg.text[param];
      // vis width/height, axis bandwidth, (largest) guide icon height/width
      ['vw','vh','bw','iw','ih'].forEach((unit, i) => {
        if (p && typeof p == 'string' && p.endsWith(unit))
          cfg.text[param] = (parseInt(p)/100) * cfg[unit];
      });
    });
    let content = e.innerHTML;
    let format = cfg.text.format?cfg.text.format:d=>d;
    if(!format(content).length) return {h:0,w:0};
    // if(cfg.text.format && !cfg.text.format(content).length) return {h:0,w:0};

    let id = e.getAttribute('id');
    let x = e.getAttribute('x');
    let y = e.getAttribute('y');
    // let textAnchor = e.getAttribute('text-anchor');
    let rotate;
    (e.getAttribute('transform')||'').replace(/rotate\([\d ]+\)/, d=>rotate=parseFloat(d.slice(7)));

    let def = {x:+x, y:+y};
    // if (textAnchor) def.textAnchor = textAnchor;
    if (rotate) def.rotate = rotate;

    let attr = {};
    [...e.attributes].filter(d=>d.name.startsWith('font-')||d.name=='fill').forEach((a, i) => {
      attr[a.name] = a.nodeValue;
    });

    cfg = {...def, ...cfg.text, attr};

    let rv = this.format(content, cfg);
    rv.e.setAttribute('id', id);

    e.parentElement.append(rv.e);
    e.remove();

    return rv.bbox;
  }
}

},{}],29:[function(require,module,exports){
/**
 * Copyright (c) 2010,2011,2012,2013,2014 Morgan Roderick http://roderick.dk
 * License: MIT - http://mrgnrdrck.mit-license.org
 *
 * https://github.com/mroderick/PubSubJS
 */

(function (root, factory){
    'use strict';

    var PubSub = {};
    root.PubSub = PubSub;
    factory(PubSub);
    // CommonJS and Node.js module support
    if (typeof exports === 'object'){
        if (module !== undefined && module.exports) {
            exports = module.exports = PubSub; // Node.js specific `module.exports`
        }
        exports.PubSub = PubSub; // CommonJS module 1.1.1 spec
        module.exports = exports = PubSub; // CommonJS
    }
    // AMD support
    /* eslint-disable no-undef */
    else if (typeof define === 'function' && define.amd){
        define(function() { return PubSub; });
        /* eslint-enable no-undef */
    }

}(( typeof window === 'object' && window ) || this, function (PubSub){
    'use strict';

    var messages = {},
        lastUid = -1,
        ALL_SUBSCRIBING_MSG = '*';

    function hasKeys(obj){
        var key;

        for (key in obj){
            if ( Object.prototype.hasOwnProperty.call(obj, key) ){
                return true;
            }
        }
        return false;
    }

    /**
     * Returns a function that throws the passed exception, for use as argument for setTimeout
     * @alias throwException
     * @function
     * @param { Object } ex An Error object
     */
    function throwException( ex ){
        return function reThrowException(){
            throw ex;
        };
    }

    function callSubscriberWithDelayedExceptions( subscriber, message, data ){
        try {
            subscriber( message, data );
        } catch( ex ){
            setTimeout( throwException( ex ), 0);
        }
    }

    function callSubscriberWithImmediateExceptions( subscriber, message, data ){
        subscriber( message, data );
    }

    function deliverMessage( originalMessage, matchedMessage, data, immediateExceptions ){
        var subscribers = messages[matchedMessage],
            callSubscriber = immediateExceptions ? callSubscriberWithImmediateExceptions : callSubscriberWithDelayedExceptions,
            s;

        if ( !Object.prototype.hasOwnProperty.call( messages, matchedMessage ) ) {
            return;
        }

        for (s in subscribers){
            if ( Object.prototype.hasOwnProperty.call(subscribers, s)){
                callSubscriber( subscribers[s], originalMessage, data );
            }
        }
    }

    function createDeliveryFunction( message, data, immediateExceptions ){
        return function deliverNamespaced(){
            var topic = String( message ),
                position = topic.lastIndexOf( '.' );

            // deliver the message as it is now
            deliverMessage(message, message, data, immediateExceptions);

            // trim the hierarchy and deliver message to each level
            while( position !== -1 ){
                topic = topic.substr( 0, position );
                position = topic.lastIndexOf('.');
                deliverMessage( message, topic, data, immediateExceptions );
            }

            deliverMessage(message, ALL_SUBSCRIBING_MSG, data, immediateExceptions);
        };
    }

    function hasDirectSubscribersFor( message ) {
        var topic = String( message ),
            found = Boolean(Object.prototype.hasOwnProperty.call( messages, topic ) && hasKeys(messages[topic]));

        return found;
    }

    function messageHasSubscribers( message ){
        var topic = String( message ),
            found = hasDirectSubscribersFor(topic) || hasDirectSubscribersFor(ALL_SUBSCRIBING_MSG),
            position = topic.lastIndexOf( '.' );

        while ( !found && position !== -1 ){
            topic = topic.substr( 0, position );
            position = topic.lastIndexOf( '.' );
            found = hasDirectSubscribersFor(topic);
        }

        return found;
    }

    function publish( message, data, sync, immediateExceptions ){
        message = (typeof message === 'symbol') ? message.toString() : message;

        var deliver = createDeliveryFunction( message, data, immediateExceptions ),
            hasSubscribers = messageHasSubscribers( message );

        if ( !hasSubscribers ){
            return false;
        }

        if ( sync === true ){
            deliver();
        } else {
            setTimeout( deliver, 0 );
        }
        return true;
    }

    /**
     * Publishes the message, passing the data to it's subscribers
     * @function
     * @alias publish
     * @param { String } message The message to publish
     * @param {} data The data to pass to subscribers
     * @return { Boolean }
     */
    PubSub.publish = function( message, data ){
        return publish( message, data, false, PubSub.immediateExceptions );
    };

    /**
     * Publishes the message synchronously, passing the data to it's subscribers
     * @function
     * @alias publishSync
     * @param { String } message The message to publish
     * @param {} data The data to pass to subscribers
     * @return { Boolean }
     */
    PubSub.publishSync = function( message, data ){
        return publish( message, data, true, PubSub.immediateExceptions );
    };

    /**
     * Subscribes the passed function to the passed message. Every returned token is unique and should be stored if you need to unsubscribe
     * @function
     * @alias subscribe
     * @param { String } message The message to subscribe to
     * @param { Function } func The function to call when a new message is published
     * @return { String }
     */
    PubSub.subscribe = function( message, func ){
        if ( typeof func !== 'function'){
            return false;
        }

        message = (typeof message === 'symbol') ? message.toString() : message;

        // message is not registered yet
        if ( !Object.prototype.hasOwnProperty.call( messages, message ) ){
            messages[message] = {};
        }

        // forcing token as String, to allow for future expansions without breaking usage
        // and allow for easy use as key names for the 'messages' object
        var token = 'uid_' + String(++lastUid);
        messages[message][token] = func;

        // return token for unsubscribing
        return token;
    };

    PubSub.subscribeAll = function( func ){
        return PubSub.subscribe(ALL_SUBSCRIBING_MSG, func);
    };

    /**
     * Subscribes the passed function to the passed message once
     * @function
     * @alias subscribeOnce
     * @param { String } message The message to subscribe to
     * @param { Function } func The function to call when a new message is published
     * @return { PubSub }
     */
    PubSub.subscribeOnce = function( message, func ){
        var token = PubSub.subscribe( message, function(){
            // before func apply, unsubscribe message
            PubSub.unsubscribe( token );
            func.apply( this, arguments );
        });
        return PubSub;
    };

    /**
     * Clears all subscriptions
     * @function
     * @public
     * @alias clearAllSubscriptions
     */
    PubSub.clearAllSubscriptions = function clearAllSubscriptions(){
        messages = {};
    };

    /**
     * Clear subscriptions by the topic
     * @function
     * @public
     * @alias clearAllSubscriptions
     * @return { int }
     */
    PubSub.clearSubscriptions = function clearSubscriptions(topic){
        var m;
        for (m in messages){
            if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0){
                delete messages[m];
            }
        }
    };

    /**
       Count subscriptions by the topic
     * @function
     * @public
     * @alias countSubscriptions
     * @return { Array }
    */
    PubSub.countSubscriptions = function countSubscriptions(topic){
        var m;
        // eslint-disable-next-line no-unused-vars
        var token;
        var count = 0;
        for (m in messages) {
            if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0) {
                for (token in messages[m]) {
                    count++;
                }
                break;
            }
        }
        return count;
    };


    /**
       Gets subscriptions by the topic
     * @function
     * @public
     * @alias getSubscriptions
    */
    PubSub.getSubscriptions = function getSubscriptions(topic){
        var m;
        var list = [];
        for (m in messages){
            if (Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0){
                list.push(m);
            }
        }
        return list;
    };

    /**
     * Removes subscriptions
     *
     * - When passed a token, removes a specific subscription.
     *
	 * - When passed a function, removes all subscriptions for that function
     *
	 * - When passed a topic, removes all subscriptions for that topic (hierarchy)
     * @function
     * @public
     * @alias subscribeOnce
     * @param { String | Function } value A token, function or topic to unsubscribe from
     * @example // Unsubscribing with a token
     * var token = PubSub.subscribe('mytopic', myFunc);
     * PubSub.unsubscribe(token);
     * @example // Unsubscribing with a function
     * PubSub.unsubscribe(myFunc);
     * @example // Unsubscribing from a topic
     * PubSub.unsubscribe('mytopic');
     */
    PubSub.unsubscribe = function(value){
        var descendantTopicExists = function(topic) {
                var m;
                for ( m in messages ){
                    if ( Object.prototype.hasOwnProperty.call(messages, m) && m.indexOf(topic) === 0 ){
                        // a descendant of the topic exists:
                        return true;
                    }
                }

                return false;
            },
            isTopic    = typeof value === 'string' && ( Object.prototype.hasOwnProperty.call(messages, value) || descendantTopicExists(value) ),
            isToken    = !isTopic && typeof value === 'string',
            isFunction = typeof value === 'function',
            result = false,
            m, message, t;

        if (isTopic){
            PubSub.clearSubscriptions(value);
            return;
        }

        for ( m in messages ){
            if ( Object.prototype.hasOwnProperty.call( messages, m ) ){
                message = messages[m];

                if ( isToken && message[value] ){
                    delete message[value];
                    result = value;
                    // tokens are unique, so we can just stop here
                    break;
                }

                if (isFunction) {
                    for ( t in message ){
                        if (Object.prototype.hasOwnProperty.call(message, t) && message[t] === value){
                            delete message[t];
                            result = true;
                        }
                    }
                }
            }
        }

        return result;
    };
}));

},{}]},{},[2,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26])(26)
});
