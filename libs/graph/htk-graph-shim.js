H = {
  Array:{},
  Assert:{},
  Obj:{},
  Opts:{},
  Coerce:{},
}

// H.Namespace.set(H, 'Array.for_each');
H.Array.for_each = function(arr, callback, thisObj) {
  if (arr == null) {
    return;
  }
  var i = -1,
    len = arr.length;
  while (++i < len) {
    // we iterate over sparse items since there is no way to make it
    // work properly on IE 7-8. see #64
    if (callback.call(thisObj, arr[i], i, arr) === false) {
      break;
    }
  }
};
/**
 */
H.Assert.is_array = function(value) {
  return Array.isArray(value);
};
/** 
 *  @fileOverview Regression functions.
 *
 *  @author       UNITED NATIONS
 *  @author       BTA-AVT
 *
 *  @requires     ml.js
 * 
 */

"use strict";

H.Obj.has_own = function(obj, prop){
        return Object.prototype.hasOwnProperty.call(obj, prop);
}
/**
 *  @fileOverview Regression functions.
 *
 *  @author       UNITED NATIONS
 *  @author       BTA-AVT
 *
 *  @requires     none
 *
 */

"use strict";

H.Obj.for_in = (function() {
  const hasOwn = H.Obj.has_own;

  var _hasDontEnumBug, _dontEnums;

  function checkDontEnum() {
    _dontEnums = [
      "toString",
      "toLocaleString",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "constructor"
    ];

    _hasDontEnumBug = true;

    for (var key in { toString: null }) {
      _hasDontEnumBug = false;
    }
  }

  /**
   * Similar to Array/forEach but works over object properties and fixes Don't
   * Enum bug on IE.
   * based on: http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
   */
  var exec = function(obj, fn, thisObj) {
    var key,
      i = 0;
    // no need to check if argument is a real object that way we can use
    // it for arrays, functions, date, etc.

    //post-pone check till needed
    if (_hasDontEnumBug == null) checkDontEnum();

    for (key in obj) {
      if (run(fn, obj, key, thisObj) === false) {
        break;
      }
    }

    if (_hasDontEnumBug) {
      var ctor = obj.constructor,
        isProto = !!ctor && obj === ctor.prototype;

      while ((key = _dontEnums[i++])) {
        // For constructor, if it is a prototype object the constructor
        // is always non-enumerable unless defined otherwise (and
        // enumerated above).  For non-prototype objects, it will have
        // to be defined on this object, since it cannot be defined on
        // any prototype objects.
        //
        // For other [[DontEnum]] properties, check if the value is
        // different than Object prototype value.
        if (
          (key !== "constructor" || (!isProto && hasOwn(obj, key))) &&
          obj[key] !== Object.prototype[key]
        ) {
          if (run(fn, obj, key, thisObj) === false) {
            break;
          }
        }
      }
    }
  };

  function run(fn, obj, key, thisObj) {
    return fn.call(thisObj, obj[key], key, obj);
  }

  return {
    exec: exec
  };
})();
"use strict";

/**
 * Similar to Array/forEach but works over object properties and fixes Don't
 * Enum bug on IE.
 * based on: http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
 */
H.Obj.for_own = function(obj, fn, thisObj) {
  const forIn = H.Obj.for_in.exec;
  const hasOwn = H.Obj.has_own;

  forIn(obj, function(val, key) {
    if (hasOwn(obj, key)) {
      return fn.call(thisObj, obj[key], key, obj);
    }
  });
};
/**
 *  @fileOverview Regression functions.
 *
 *  @author       UNITED NATIONS
 *  @author       BTA-AVT
 *
 *  @requires     ml.js
 *
 */

"use strict";

H.Obj.deep_match = function(target, pattern) {
  
  const isArray = H.Assert.is_array;
  const forOwn = H.Obj.for_own;
  const deepMatch = H.Obj.deep_match;

  function containsMatch(array, pattern) {
    var i = -1,
      length = array.length;
    while (++i < length) {
      if (deepMatch(array[i], pattern)) {
        return true;
      }
    }

    return false;
  }

  function matchArray(target, pattern) {
    var i = -1,
      patternLength = pattern.length;
    while (++i < patternLength) {
      if (!containsMatch(target, pattern[i])) {
        return false;
      }
    }

    return true;
  }

  function matchObject(target, pattern) {
    var result = true;
    forOwn(pattern, function(val, key) {
      if (!deepMatch(target[key], val)) {
        // Return false to break out of forOwn early
        return (result = false);
      }
    });

    return result;
  }

  /**
   * Recursively check if the objects match.
   */
    if (target && typeof target === "object") {
      if (isArray(target) && isArray(pattern)) {
        return matchArray(target, pattern);
      } else {
        return matchObject(target, pattern);
      }
    } else {
      return target === pattern;
    };


};
"use strict";

H.Namespace = function() {

    const forEach = H.Array.for_each;
    const deepMatch = H.Obj.deep_match;
    /**
     * Create nested object if non-existent
     */
    var set = function (obj, path){
        
        // Make sure it has not already been added.
        if(get(obj, path)) {
            throw new Error( path + ': has already been added to global namespace' );
        }
        
        if (!path) return obj;
        forEach(path.split('.'), function(key){
            if (!obj[key]) {
                obj[key] = {};
            }
            obj = obj[key];
        });
        // console.log('Namespace: ' + path + ' has been added.')
        
        return obj;
    }

    /**
     * Check if namespace exists
     */
    var get = function (obj, path){
        let check = deepMatch(obj, { path })
        return check
    }

    /**
     * Check if functions are calling namespace
     * to help identify un-used functions
     */
    var callers = function (obj){
        console.log("Caller is running")
        
    }

    /**
     * Report full namespace
     */
    var report = function(obj) {
        let result = obj;
        return result;
    }
    
    return {
        set: set,
        get : get,
        callers: callers,
        report : report
    };

}();/**
 * 
 * @fileOverview Defaults class to store all defaults across Harvest
 *
 * @author       UNITED NATIONS
 * @author       BTA-AVT
 *
 * @requires     H.Namespace
 * @requires     H.color
 *
 * @example
 * Defaults can be accessed directly through the property group 
 * i.e. Defaults.line will return an object of all line related 
 * defaults.
 * All properties can be returned as a single object through 
 * Defaults.defaults
 * 
 * A Defaults instance allows for override values to be provided 
 * & included and for the defaults returned object to be filtered 
 * to only contain selected properties
 *
 * @param {Array} spec.props - Array of strings describing the required 
 * default properties to be returned (default is all defaults).
 * 
 * @param {Object} spec.overrides - Additional key / value pairs to 
 * override original defaults or be included in returned results.
 * 
 * @returns {Class} Instance of Defaults Class
 * 
 * @returns {Object} All or selected default values
 *
 */

'use strict'

H.Namespace.set(H, 'Defaults')

H.Defaults = class {

    constructor(spec){
        this.props = spec.props || this.constructor.props
        this.overrides = spec.overrides || {}
        this.report_duplicates()
    }

    ////////////////////////////////////////////////////////////
    ////////////////////// DEFAULTS VALUES /////////////////////
    ////////////////////////////////////////////////////////////

    static get general(){
        return {
            font: 'Roboto'
        }
    }

    static get color(){
        return {
            fill_color:'#26A69A',
            stroke_color:'#333333',
            categorical_colors: ['#333333','#26A69A','#AE017E']
        }
    }

    static get line(){
        return {
            ...this.shape_base('line'),
            ...{
                line_style:'solid',
                show_line_label:false
            }
        }
    }

    static get point(){
        return {
            ...this.shape_base('point'),
            ...{
                point_size:5,
                point_material:'matcap',
                point_shape:'rectangle',
                point_texture:'Cream',
                show_point_label:false
            }
        }
    }

    static get bar(){
        return {
            ...this.shape_base('bar'),
            ...{
                show_bar_label:false,
                bar_padding:5
            }
        }
    }

    static get area(){
        return {
            ...this.shape_base('area'),
            ...{
                show_area_label:false
            }
        }
    }

    static get layout(){
        return {
            margin_top: 60,
            margin_right: 85,
            margin_bottom: 65,
            margin_left: 85,
            top_axis: true,
            right_axis: true,
            bottom_axis: true,
            left_axis: true,
            show_export: true,
            export_file: "view.svg",
            publish_emitter: null,
            subscribe_emitter: null,
            fit: true,
            x_sort: 'none',
            y_sort: 'none',
            background_color:"#FFFFFF",
            show_title:true,
            show_label:true,
            show_legend:false,
            show_axis: true,
        }
    }

    static get edge(){
        return{
            edge_opacity:0.5,
            edge_stroke_color:'#AAAAAA',
            edge_stroke_style:'solid',
            edge_style:'bezier',
            edge_fill_color:'#CCCCCC',
            edge_label_offset:50,
            edge_stroke_weight:1.0,
            show_edge_label:false
        }
    }

    static get treemap(){
        return {
            treemap_layout: 'equi_rectangular',
            tile:'d3.treemapSquarify'
        }
    }

    static get symbol(){
        return {
        symbol_path:'assets/symbols/',
        symbol_type:'svg'
        }
    }

    static get label(){
        return{
            short_label:false,
            label_background_color:'#FFFFFF',
            label_stroke_color:'#000000',
            label_font_color:'#000000',
            label_filter:10,
            label_format:'decimal'
        }
    }

    static get three(){
        return {
            camera:'perspective',
            controls:'orbit'
        }
    }

    static get table(){
        return{
            row_size:136,
            cell_size:17
        }
    }

    static get pie(){
        return {
            pie_color:"#26A69A",
            pie_stroke_color:'#FFFFFF'
        }
    }

    static get legend(){
        return {
            show_legend:false,
            legend_tip:["yone_field", "ytwo_field"]
        }
    }

    static get radial(){
        return {}
    }

    static get axis(){
        return {
            x_axis_label_format:'decimal',
            x_axis_ticks:4,
            x_axis_title:'x_axis_title',
            x_domain_map:'',
            y_axis_label_format:'abbreviate',
            y_axis_ticks:8,
            y_axis_title:'y_axis_title',
            y_domain_map:'',
            show_baseline:true,
            axis_orientation: 'left',
        }
    }

    static get axis_linear(){
        return {
            y_one_axis_label_format:'currency',
            y_two_axis_label_format:'decimal',
            x_one_axis_label_format:'decimal',
            x_two_axis_label_format:'currency',
            split_axis:false,
            show_top_axis_label:false,
            show_right_axis_label:false,
            show_left_axis_label:false,
            show_bottom_axis_label:false,
            show_x_grid:false,
            show_y_grid:false,
            show_grid:false, // duplicate?
            rotate_left_label:0,
            rotate_right_label:0,
            rotate_bottom_label:0,
            rotate_top_label:0,
            grid_color:'#BBBBBB',
            bottom_label_short:false,
            top_label_short:false,
            left_label_short:false,
            right_label_short:false
        }
    }

    static get axis_radial(){
        return {

        }
    }

    // Function to add default values that are repeated for different shapes (i.e. line, area, bar etc.)
    static shape_base(shape){
        let base = {
            show:true,
            fill: true,
            stroke: false,
            opacity: 1.0,
            rotate: 0,
            highlight: true,
            stroke_color: this.color.stroke_color,
            fill_color: this.color.categorical_colors[0],
            stroke_weight: 2,
            fill_opacity: 0.5,
            stroke_opacity: 1,
            highlight_stroke_color: this.color.stroke_color,
            highlight_fill_color: this.color.categorical_colors[1],
            outlier_fill_color: this.color.categorical_colors[2],
            outlier_stroke_color: this.color.stroke_color
        }

        let named_base = {}

        for (let key in base){
            let propName = key == 'show' ? key + '_' + shape : shape + '_' + key
            named_base[propName] = base[key]
        }

        return named_base
    }

    ////////////////////////////////////////////////////////////
    ////////////////////// STATIC PROPERTIES ///////////////////
    ////////////////////////////////////////////////////////////

    static get naming_conventions(){

        return {
            //layout type
            bar: 'layout.bar',
            line: 'layout.line',
            area: 'layout.area',
            arc: 'layout.arc',
            graph: 'layout.graph',
            tree: 'layout.tree',
            table: 'layout.table',
            map: 'layout.map',

            //coordinate system
            c: 'coords.cartesian',
            r: 'coords.radial',
            p: 'coords.polar',
            
            //orientation
            v: 'orientation.vertical',
            h: 'orientation.horizontal',
            a: 'orientation.angle',
            ts: 'orientation.top_down',
            lr: 'orientation.left_right',
            rl: 'orientation.right_left',
            bu: 'orientation.bottom_up',
        
            //field mapping
            x: 'field_mapping.x_axis',
            y: 'field_mapping.y_axis',
            z: 'field_mapping.z_axis',
        
            m: 'measure',
        
            gs: 'series.group',
            ss: 'series.single',
        
            //type mapping
            n: 'type.number',
            s: 'type.string',
            d: 'type.date',

            //axis data type
            xn: 'x_axis.number',
            xs: 'x_axis.string',
            xd: 'x_axis.date',
            yn: 'y_axis.number',
            ys: 'y_axis.string',
            yd: 'y_axis.date'
        }
    }

    static get props(){
        return ['general', 'color', 'line', 'point', 'area', 'bar', 'layout', 'edge', 'treemap', 'symbol', 'label', 'three', 'table', 'pie', 'legend', 'radial','axis', 'axis_linear', 'axis_radial']
    }

    ////////////////////////////////////////////////////////////
    ////////////////////// RETURN VALUES ///////////////////////
    ////////////////////////////////////////////////////////////

    static get defaults(){
        /** @returns {Object} All defaults excluding any additional override values. */

        let res = {}
        for (let prop of this.props){
            for (let key in this[prop]){
                res[key] = this[prop][key]
            }
        }
        return res
    }

    get defaults(){
        /** @returns {Object} Selected defaults excluding any additional override values. */

        let res = {}
        for (let prop of this.props){
            for (let key in this.constructor[prop]){
                res[key] = this.constructor[prop][key]
            }
        }

        return res
    }

    get vspec(){
        return {...this.defaults, ...this.overrides}
    }

    report_duplicates(){

        let duplicates = []
        let newProperites = []
        for (let prop in this.overrides){
            if (this.defaults.hasOwnProperty(prop) && this.overrides[prop] == this.defaults[prop]){
                duplicates.push(prop)
            } else if (!this.defaults.hasOwnProperty(prop)){
                newProperites.push(prop)
            }
        }

        if (duplicates.length > 0 || newProperites.length > 0){
            console.log("--- Message for Layout Developers ---")

            if (newProperites.length > 0){
                console.log("There are no defaults stored for " + JSON.stringify(newProperites) + ".")
                console.log("This may be an indication of inconsistencies in vspec property names.")
            }

            if (duplicates.length > 0){
                console.log("The layout vspec override values " + JSON.stringify(duplicates) + " are the same as the existing default values.")
                console.log("Please consider removing these from the layout specification.")
            }

        }

    }

}/**
 * 
 * @fileOverview Defaults class to store all defaults across Harvest
 *
 * @author       UNITED NATIONS
 * @author       BTA-AVT
 *
 * @requires     H.Namespace
 * @requires     H.color
 *
 * @example
 * Defaults can be accessed directly through the property group 
 * i.e. Defaults.line will return an object of all line related 
 * defaults.
 * All properties can be returned as a single object through 
 * Defaults.defaults
 * 
 * A Defaults instance allows for override values to be provided 
 * & included and for the defaults returned object to be filtered 
 * to only contain selected properties
 *
 * @param {Array} spec.props - Array of strings describing the required 
 * default properties to be returned (default is all defaults).
 * 
 * @param {Object} spec.overrides - Additional key / value pairs to 
 * override original defaults or be included in returned results.
 * 
 * @returns {Class} Instance of Defaults Class
 * 
 * @returns {Object} All or selected default values
 *
 */

'use strict'

H.Defaults.Layouts = class extends H.Defaults {

    constructor(spec){
        super(spec)
        this._vspec = spec.vspec || {}
        this._fmap = spec.fmap || {}
        this._data = spec.data || {}
        this._name = spec.name || "view"
        this.report_features()
    }

    static get layout_overrides(){
        return {
        }
    }

    static get fmap_defaults(){
        return ['series', 'measure', 'color', 'value', 'label', 'x', 'y', 'xone', 'xtwo']
    }

    get vspec(){
        let defs = {
            width: document.getElementById(this._vspec.el).clientWidth,
            height: document.getElementById(this._vspec.el).clientHeight,
            export_file: this._name + '.svg'
        }

        let combined = {...this.defaults, ...defs, ...this.layout_overrides, ...this.overrides, ...this._vspec}

        let helpers = {}

        helpers.margin = {
            top: combined.margin_top,
            right: combined.margin_right,
            bottom: combined.margin_bottom,
            left: combined.margin_left,
        }

        helpers.tw = Math.max(combined.width, 800);
        helpers.th = Math.max(combined.height, 200);

        helpers.w = helpers.tw - helpers.margin.left - helpers.margin.right;
        helpers.h = helpers.th - helpers.margin.top - helpers.margin.bottom;
        helpers.center_point = {
            x: helpers.w/2, 
            y: helpers.h/2
        }
        helpers.inner_radius = Math.min(helpers.w, helpers.h)/4,
        helpers.outer_radius = Math.min(helpers.w, helpers.h)/2
 
        return {...combined, ...helpers}
    }

    set vspec(v){
        this._vspec = v
    }

    get fmap(){
        return this._fmap
    }

    set fmap(f){
        this._fmap = f
    }

    get data(){
        let res = []
        for (let i in this._data){
            let d = this._data[i]
            let obj = {}
            for (let key in this.fmap){
                if (d.hasOwnProperty(this.fmap[key])){
                    obj[key] = d[this.fmap[key]]
                }
            }
            res.push(obj)
        }

        return res
    }

    set data(d){
        this._data = d
    }

    report_features(){

        if (this._name != 'view'){
            let features = this._name.split('_')
            console.log("*** Feature Development ***")
            console.log('The following features have been detected in the layout ' + this._name + '.')
            for (let feature of features){
                if (this.constructor.naming_conventions.hasOwnProperty(feature)) console.log(this.constructor.naming_conventions[feature])
            }
            console.log('More automatic defaults will be coming soon using this information.')

        }

    }
    
}/**
 *
 * @param {*} value - value to test
 * @returns {boolean} boolean indicating whether value is an array
 */
H.Assert.is_not_undef = function(value) {
  return typeof value != "undefined";
};
/**
     * Transforms graph data set to cytoscape json format
     *
     * @param {*} nodes
     * @param {*} links
     * @example
     * const elk_graph = {
     *   id: "root",
     *   layoutOptions: { 'elk.algorithm': 'layered' },
     *   logging: true,
     *   measureExecutionTime: true,
     *   children: [
     *       { id: "n1", label: 'contributions', width: 30, height: 30 },
     *       { id: "n2", label: 'funds management', width: 30, height: 30 },
     *       { id: "n3", label: 'cash management', width: 30, height: 30 },
     *       { id: "n4", label: 'vacancy management', width: 30, height: 30 },
     *       { id: "n5", label: 'Scenario', width: 30, height: 30 }
     *   ],
     *   edges: [
     *       { id: "e1", sources: [ "n1" ], targets: [ "n2" ] },
     *       { id: "e2", sources: [ "n2" ], targets: [ "n3" ] },
     *       { id: "e3", sources: [ "n2" ], targets: [ "n4" ] },
     *       { id: "e4", sources: [ "n3" ], targets: [ "n5" ] },
     *       { id: "e5", sources: [ "n4" ], targets: [ "n5" ] }
     *   ]
    }
    */
   H.std_to_elk_graph = function ( nodes, edges, layout ) {

    let gelk = new Object();
        
        gelk.id = "root";
        gelk.layoutOptions = { 'elk.algorithm': layout };  // [ 'box', 'disco', 'force', 'layered', 'mrtree', 'radial', 'random', 'stress' ].
        // gelk.logging = true;
        // gelk.measureExecutionTime = true;
        gelk.children = [];
        gelk.edges = [];

        // Iterators for node transform
        nodes.forEach(function(v) {
            // console.log("Node " + v);
            // console.log(stnd_graph.node(v));
            v.id = v['id'].replace(/\./g,'-');
            v.label = v['label'];
            v.color = v['color'];
            v.size = v['size'];
            v.symbol = v['symbol'];
            v.height = 30;
            v.width = 30;
            gelk.children.push(v)

        });

        // Iterators for edge transform
        edges.forEach(function(e, i) {
            // console.log("Edge " + e.v + " -> " + e.w );
            // console.log(stnd_graph.edge(e));
            let dedges = new Object();
            // Mandatory Properties for All Edges
            dedges.id = e['id'];
            dedges.sources = [e['source'].replace(/\./g,'-')];
            dedges.targets = [e['target'].replace(/\./g,'-')];

            if ( H.Assert.is_not_undef(e.type)) {
                dedges.type = e.type;
            } else {
                dedges.type = "Edge";
            }
            
            gelk.edges.push(dedges);

        });
    return gelk
}/*
 * Copyright (c) 2010 Matthew A. Taylor
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
H.Store = H.Store || {};
H.Store = function() {

var REGEX_DOT_G = /\./g,
    BSLASH_DOT = '\.',
    REGEX_STAR_G = /\*/g,
    ID_LENGTH = 16,
    // static export
    JSDS,
    // private props
    randoms = [],
    // private functions
    storeIt,
    update,
    mergeArraysIntoSet,
    arrayContains,
    arrayRemoveItem,
    fire,
    listenerApplies,
    removeListener,
    getCompleteKey,
    pullOutKeys,
    toRegex,
    valueMatchesKeyString,
    clone,
    getValue,
    getRandomId,
    generateRandomId;

/*************************/
/* The JSDataStore Class */
/*************************/

function JSDataStore(id) {
    // data stores
    this._s = {};
    // event listeners
    this._l = {};
    this.id = id;
}

JSDataStore.prototype = {

    /**
     * Stores data
     *
     * key {String}: the key to be used to store the data. The same key can be used to retrieve
     *               the data
     * val {Object}: Any value to be stored in the store
     * opts {Object} (optional): options to be used when storing data:
     *                          'update': if true, values already existing within objects and
     *                                    arrays will not be clobbered
     * returns {Object}: The last value stored within specified key or undefined
     *
     * (fires 'store' event)
     */
    set: function(key, val, opts /*optional*/) {
        var result;
        opts = opts || { update: false };
        fire.call(this, 'set', {
            key: key,
            value: val,
            id: this.id,
            when: 'before',
            args: Array.prototype.slice.call(arguments, 0, arguments.length)
        });
        result = storeIt(this._s, key, opts, val);
        fire.call(this, 'set', {
            key: key,
            value: val,
            id: this.id,
            when: 'after',
            result: this.get(key, {quiet: true})
        });
        return result;
    },

    /**
     * Gets data back out of store
     *
     * key {String}: the key of the data you want back
     * returns {Object}: the data or undefined if key doesn't exist
     *
     * (fires 'get' event)
     */
    get: function(key) {
        var s = this._s, keys, i=0, j=0, opts, result, splitKeys,
            args = Array.prototype.slice.call(arguments, 0, arguments.length);

        opts = args[args.length-1];
        if (typeof opts === 'string') {
            opts = {};
        } else {
            args.pop();
        }

        if (! opts.quiet) {
            fire.call(this, 'get', {
                key: key,
                when: 'before',
                args: args
            });
        }

        if (args.length === 1 && key.indexOf(BSLASH_DOT) < 0) {
            result = s[key];
        } else {
            if (args.length > 1) {
                keys = [];
                for (i=0; i<args.length; i++) {
                    if (args[i].indexOf(BSLASH_DOT) > -1) {
                        splitKeys = args[i].split(BSLASH_DOT);
                        for (j=0; j<splitKeys.length; j++) {
                            keys.push(splitKeys[j]);
                        }
                    } else {
                        keys.push(args[i]);
                    }
                }
            } else if (key.indexOf(BSLASH_DOT) > -1) {
                keys = key.split(BSLASH_DOT);
            }

            result = getValue(s, keys);
        }

        if (! opts.quiet) {
            fire.call(this, 'get', {
                key:key,
                value: result,
                when: 'after',
                result: result
            });
        }
        return result;
    },

    /**
     * Checks if key already exists in store
     *
     * key {String}: the key of the data you want back
     * returns {Boolean}: false if undefined (key does not exist)
     *
     * (fires 'get' event)
     */
    has: function(key) {
        return H.Assert.is_not_undef(this.get(key))
    },

    /**
     * Adds a listener to this store. The listener will be executed when an event of
     * the specified type is emitted and all the conditions defined in the parameters
     * are met.
     *
     * type {String}: the type of event to listen for ('set', 'get', 'clear', etc.)
     * options {object}: an object that contains one or more of the following configurations:
     *                  'callback': the function to be executed
     *                  'scope': the scope object for the callback execution
     *                  'key': the storage key to listen for. If specified only stores into this key will
     *                          cause callback to be executed
     *                  'when': 'before' or 'after' (default is 'after')
     */
    on: function(type, opts) {
        var me = this,
            cbid = getRandomId(),
            key = opts.key,
            fn = opts.callback,
            scope = opts.scope || this,
            when = opts.when || 'after';
        if (!this._l[type]) {
            this._l[type] = [];
        }
        this._l[type].push({id: cbid, callback:fn, scope:scope, key: key, when: when});
        return {
            id: cbid,
            remove: function() {
                removeListener(me._l[type], cbid);
            }
        };
    },

    before: function(type, key, cb, scpe) {
        var callback = cb, scope = scpe;
        // key is optional
        if (typeof key === 'function') {
            callback = key;
            scope = cb;
            key = undefined;
        }
        return this.on(type, {
            callback: callback,
            key: key,
            when: 'before',
            scope: scope
        });
    },

    after: function(type, key, cb, scpe) {
        var callback = cb, scope = scpe;
        // key is optional
        if (typeof key === 'function') {
            callback = key;
            scope = cb;
            key = undefined;
        }
        return this.on(type, {
            callback: callback,
            key: key,
            when: 'after',
            scope: scope
        });
    },

    /**
     * Removes all data from store
     *
     * (fires 'clear' event)
     */
    clear: function() {
        this._s = {};
        fire.call(this, 'clear');
    },

    /**
     * Removes all internal references to this data store. Note that to entirely release
     * store object for garbage collection, you must also set any local references to the
     * store to null!
     *
     * (fires 'remove' and 'clear' events)
     */
    remove: function() {
        var ltype, optsArray, opts, i;
        this.clear();
        delete JSDS._stores[this.id];
        arrayRemoveItem(randoms, this.id);
        fire.call(this, 'remove');
    }
};

/*************************/
/* Global JSDS namespace */
/*************************/

JSDS = {

    _stores: {},

    /**
     * Create a new data store object. If no id is specified, a random id will be
     * generated.
     *
     * id {String} (optional): to identify this store for events and later retrieval
     */
    create: function(id) {

        id = id || getRandomId();

        if (this._stores[id]) {
            throw new Error('Cannot overwrite existing data store "' + id + '"!');
        }

        this._stores[id] = new JSDataStore(id);

        return this._stores[id];
    },

    /**
     * Retrieves an existing data store object by id
     *
     * id {String}: the id of the store to retrieve
     * returns {JSDataStore} the data store
     */
    get: function(id) {
        return this._stores[id];
    },

    /**
     * Removes all data stores objects. Specifically, each JSDataStore object's remove()
     * method is called, and all local references to each are deleted.
     */
    clear: function() {
        var storeId;
        for (storeId in this._stores) {
            if (this._stores.hasOwnProperty(storeId)) {
                this._stores[storeId].remove();
                delete this._stores[storeId];
            }
        }
        this._stores = {};
    },

    /**
     * Returns a count of the existing data stores in memory
     */
    count: function() {
        var cnt = 0, p;
        for (p in this._stores) {
            if (this._stores.hasOwnProperty(p)) {
                cnt++;
            }
        }
        return cnt;
    },

    /**
     * Returns a list of ids [String] for all data store obects in memory
     */
    ids: function() {
        var id, ids = [];
        for (id in this._stores) {
            if (this._stores.hasOwnProperty(id)) {
                ids.push(id);
            }
        }
        return ids;
    }
};

/*****************/
/* PRIVATE STUFF */
/*****************/

// recursive store function
storeIt = function(store, key, opts, val, oldVal /*optional*/) {
    var result, keys, oldKey;
    if (key.indexOf(BSLASH_DOT) >= 0) {
        keys = key.split('.');
        oldVal = store[keys[0]] ? clone(store[keys[0]]) : undefined;
        oldKey = keys.shift();
        if (store[oldKey] === undefined) {
            store[oldKey] = {};
        }
        return storeIt(store[oldKey], keys.join('.'), opts, val, oldVal);
    }
    result = oldVal ? oldVal[key] : store[key];
    // if this is an update, and there is an old value to update
    if (opts.update) {
        update(store, val, key);
    }
    // if not an update, just overwrite the old value
    else {
        store[key] = val;
    }
    return result;
};

// recursive update function used to overwrite values within the store without
// clobbering properties of objects
update = function(store, val, key) {
    var vprop;
    if (typeof val !== 'object' || val instanceof Array) {
        if (store[key] && val instanceof Array) {
            mergeArraysIntoSet(store[key], val);
        } else {
            store[key] = val;
        }
    } else {
        for (vprop in val) {
            if (val.hasOwnProperty(vprop)) {
                if (!store[key]) {
                    store[key] = {};
                }
                if (store[key].hasOwnProperty(vprop)) {
                    update(store[key], val[vprop], vprop);
                } else {
                    store[key][vprop] = val[vprop];
                }
            }
        }
    }
};

// merge two arrays without duplicate values
mergeArraysIntoSet = function(lhs, rhs) {
    var i=0;
    for (; i<rhs.length; i++) {
        if (!arrayContains(lhs, rhs[i])) {
            lhs.push(rhs[i]);
        }
    }
};

// internal utility function
arrayContains = function(arr, val, comparator /* optional */) {
    var i=0;
    comparator = comparator || function(lhs, rhs) {
        return lhs === rhs;
    };
    for (;i<arr.length;i++) {
        if (comparator(arr[i], val)) {
            return true;
        }
    }
    return false;
};

arrayRemoveItem = function(arr, item) {
    var i, needle;
    for (i = 0; i< arr.length; i++) {
        if (arr[i] === item) {
            needle = i;
            break;
        }
    }
    if (needle) {
        arr.splice(needle, 1);
    }
};

// fire an event of 'type' with included arguments to be passed to listeners functions
// WARNING: this function must be invoked as fire.call(scope, type, args) because it uses 'this'.
// The reason is so this function is not publicly exposed on JSDS instances
fire = function(type, fireOptions) {
    var i, opts, scope, listeners, pulledKeys,
        listeners = this._l[type] || [];

    fireOptions = fireOptions || {};

    if (listeners.length) {
        for (i=0; i<listeners.length; i++) {
            opts = listeners[i];
            if (listenerApplies.call(this, opts, fireOptions)) {
                scope = opts.scope || this;
                if (opts.key && fireOptions) {
                    if (opts.key.indexOf('*') >= 0) {
                        pulledKeys = pullOutKeys(fireOptions.value);
                        fireOptions.value = {};
                        fireOptions.value.key = fireOptions.key + pulledKeys;
                        fireOptions.value.value = getValue(this._s, fireOptions.value.key.split('.'));
                    } else {
                        fireOptions.value = getValue(this._s, opts.key.split('.'));
                    }
                }
                if (fireOptions.args) {
                    opts.callback.apply(scope, fireOptions.args);
                } else if (fireOptions.result) {
                    opts.callback.call(scope, fireOptions.result);
                } else {
                    opts.callback.call(scope, fireOptions.result);
                }
            }
        }
    }
};

// WARNING: this function must be invoked as listenerApplies.call(scope, listener, crit) because it uses 'this'.
// The reason is so this function is not publicly exposed on JSDS instances
listenerApplies = function(listener, crit) {
    var result = false, last, sub, k, replacedKey, breakout = false;
    if (listener.when && crit.when) {
        if (listener.when !== crit.when) {
            return false;
        }
    }
    if (!listener.key || !crit) {
        return true;
    }
    if (!crit.key || crit.key.match(toRegex('\\b' + listener.key + '\\b'))) {
        return true;
    }
    last = crit.key.length;
    while (!breakout) {
        sub = crit.key.substr(0, last);
        last = sub.lastIndexOf(BSLASH_DOT);
        if (last < 0) {
            k = sub;
            breakout = true;
        } else {
            k = sub.substr(0, last);
        }
        if (listener.key.indexOf('*') === 0) {
            return valueMatchesKeyString(crit.value, listener.key.replace(/\*/, crit.key).substr(crit.key.length + 1));
        } else if (listener.key.indexOf('*') > 0) {
            replacedKey = getCompleteKey(crit);
            return toRegex(replacedKey).match(listener.key);
        }
        return valueMatchesKeyString(crit.value, listener.key.substr(crit.key.length+1));
    }
    return result;
};

removeListener = function(listeners, id) {
    var i, l, needle;
    for (i=0; i < listeners.length; i++) {
        l = listeners[i];
        if (l.id && l.id === id) {
            needle = i;
            break;
        }
    }
    if (typeof needle !== 'undefined') {
        listeners.splice(needle, 1);
    }
};

getCompleteKey = function(o) {
    var val = o.value, key = o.key;
    return key + pullOutKeys(val);
};

pullOutKeys = function(v) {
    var p, res = '';
    for (p in v) {
        if (v.hasOwnProperty(p)) {
            res += '.' + p;
            if (typeof v[p] === 'object' && !(v[p] instanceof Array)) {
                res += pullOutKeys(v[p]);
            }
        }
    }
    return res;
};

toRegex = function(s) {
    return s
        .replace(REGEX_DOT_G, '\\.')
        .replace(REGEX_STAR_G, '\.*');
};

valueMatchesKeyString = function(val, key) {
    var p, i=0, keys = key.split('.');
    for (p in val) {
        if (val.hasOwnProperty(p)) {
            if (keys[i] === '*' || p === keys[i]) {
                if ((typeof val[p] === 'object') && !(val[p] instanceof Array)) {
                    return valueMatchesKeyString(val[p], keys.slice(i+1).join('.'));
                } else {
                    return true;
                }
            }
        }
        i++;
    }
    return false;
};

// used to copy branches within the store. Object and array friendly
clone = function(val) {
    var newObj, i, prop;
    if (val instanceof Array) {
        newObj = [];
        for (i=0; i<val.length; i++) {
            newObj[i] = clone(val[i]);
        }
    } else if (typeof val === 'object'){
        newObj = {};
        for (prop in val) {
            if (val.hasOwnProperty(prop)) {
                newObj[prop] = clone(val[prop]);
            }
        }
    } else {
        return val;
    }
    return newObj;
};

// returns a value from a store given an array of keys that is meant to describe depth
// within the storage tree
getValue = function(store, keys) {
    var key = keys.shift(), endKey, arrResult, p,
        keysClone;
    if (key === '*') {
        arrResult = [];
        for (p in store) {
            if (store.hasOwnProperty(p)) {
                keysClone = clone(keys);
                arrResult.push(getValue(store[p], keysClone));
            }
        }
        return arrResult;
    }
    if (keys[0] && store[key] && (store[key][keys[0]] || keys[0] === '*')) {
        return getValue(store[key], keys);
    } else {
        if (keys.length) {
            endKey = keys[0];
        } else {
            endKey = key;
        }
        return store[endKey];
    }
};

generateRandomId = function(length) {
    var text = "", i,
        possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for(i = 0; i < length; i++ ) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

getRandomId = function() {
    var id = generateRandomId(ID_LENGTH);
    // no duplicate ids allowed
    while (arrayContains(randoms, id)) {
        id = generateRandomId(ID_LENGTH);
    }
    randoms.push(id);
    return id;
};

return {
    JSDS : JSDS
}

}();
H.Namespace.set(H, 'Graphs.Elk');
H.Graphs.Elk = function() 
{
    // RUN LAYOUT TO GENERATE COORDINATES
    /**
     * Private function to
     * RUN LAYOUT TO GENERATE COORDINATES
     *
     * @param {*} cyto_data - graph data in cytoscape format
     * @param {*} vspec - layouter properties
     * @param {*} layout_opts - default or user set; unique to each layout
     * 
     * @returns
     */
    var positions = function( elk_graph ) {

      let pNodes = [];
      let pEdges = [];
      let pGraph = {
          nodes: pNodes,
          edges: pEdges
      }

      let sNodes
      if ( H.Store.JSDS.get('nodes') ) {
            console.log('deleting previous store')
            const sid = H.Store.JSDS.get('nodes')
            sid.remove()
        }
      sNodes = H.Store.JSDS.create('nodes');

      elk_graph.children.forEach(function (row) {

            sNodes.set(
                row['id'],
                row,
                { update: true })
        })

      const elk = new ELK();

      return elk.layout(elk_graph)
        .then(function(g) {
            return nodePositions(g)
        }).then(function(e) {
            return edgePositions(e)
        }).then(function(res) {
            return pGraph;
      });

      function nodePositions(g) {
          let elk_nodes = g.children;
          let elk_edges = g.edges;
          
          let n = 0;
          let nlen = elk_nodes.length;
          for ( n; n < nlen; n++ ) {
              
              let id = elk_nodes[n].id;
              let nx = elk_nodes[n].x;
              let ny = elk_nodes[n].y;

              if (sNodes.has(id)) {
                // Merge to store
                sNodes.set( 
                id, 
                { fx: nx, fy: ny }, 
                { update: true } )
                
                // Collect result
                pNodes.push(sNodes.get(id))
              }
          }
          return elk_edges      
      }

      function edgePositions(edges) {
        let elk_edges = edges;
        let e = 0;
        let len = elk_edges.length;
        for ( e; e < len; e++ ) {

            let edge = new Object();
            edge.id = elk_edges[e].id;
            edge.source = elk_edges[e].sources[0];
            edge.target = elk_edges[e].targets[0];
            edge.type = elk_edges[e].type;

            // Position matcher
            let s = elk_edges[e].sources[0];
            let s_coords = sNodes.get(s)
            
            let t = elk_edges[e].targets[0];
            let t_coords = sNodes.get(t)
            
            edge.sx = s_coords.fx;
            edge.sy = s_coords.fy;
            edge.tx = t_coords.fx;
            edge.ty = t_coords.fy;

            pEdges.push(edge);
        }
        
        // Wipe store
        const store = H.Store.JSDS.get('nodes')
        store.remove();
        sNodes.length = 0;
        sNodes = null;
        return pGraph
      }
    }

    return {
        positions: positions
    };

}();


H.Namespace.set(H, 'Graphs.Ccnet');
H.Graphs.Ccnet = function() 
{
    // RUN LAYOUT TO GENERATE COORDINATES
    /**
     * Private function to
     * RUN LAYOUT TO GENERATE COORDINATES
     *
     * @param {*} cyto_data - graph data in cytoscape format
     * @param {*} vspec - layouter properties
     * @param {*} layout_opts - default or user set; unique to each layout
     * 
     * @returns
     */
    var positions = function( ccnet_graph ) {

      let pEdges = [];
      let pGraph = {
          nodes: ccnet_graph._nodes,
          edges: pEdges
      }

      let sNodes;
      if ( H.Store.JSDS.get('nodes') ) {
            console.log('deleting previous store')
            const sid = H.Store.JSDS.get('nodes')
            sid.remove()
        }
      sNodes = H.Store.JSDS.create('nodes');

      ccnet_graph._nodes.forEach(function (row) {

        sNodes.set(
            row['id'],
            row,
            { update: true })
        })

      edgePositions(ccnet_graph._edges);
      
      function edgePositions(edges) {
        
        let ccnet_edges = edges;
        let e = 0;
        let len = ccnet_edges.length;
        for ( e; e < len; e++ ) {

            let edge = new Object();
            edge.id = ccnet_edges[e].id;
            edge.source = ccnet_edges[e].source;
            edge.target = ccnet_edges[e].target;
            edge.type = ccnet_edges[e].type;

            // Position matcher
            let s = ccnet_edges[e].source;
            let s_coords = sNodes.get(s)
            
            let t = ccnet_edges[e].target;
            let t_coords = sNodes.get(t)
            
            edge.sx = s_coords.fx;
            edge.sy = s_coords.fy;
            edge.tx = t_coords.fx;
            edge.ty = t_coords.fy;

            pEdges.push(edge);
        }
        // Wipe store
        const store = H.Store.JSDS.get('nodes')
        store.remove();
        sNodes.length = 0;
        sNodes = null;
      }

      return pGraph
      
    }

    return {
        positions: positions
    };

}();/** 
 *  @fileOverview Create graph and tree structures.
 *
 *  @author       UNITED NATIONS
 *  @author       BTA-AVT
 *
 *  @requires     d3.js
 * 
 */

"use strict";
H.Namespace.set(H, 'Structures_Complex');
H.Structures_Complex = function() {

    /**
     * Generic Adjacency List
     *
     * @param {*} nodes
     * @param {*} links
     */
    var adjacency_list = function( nodes, edges ) {
        
        const adj_list = H.adjacency_list( nodes, edges );
        return adj_list;
        
    };

    /**
     * Generic Tree Structure
     *
     * @param {*} nodes
     * @param {*} links
     */
    var standard_tree = function( ) {

    
    };

     /**
     * Generic Graph Structure based on graphlib
     *
     * @param {Collection} nodes
     * @param {Collection} edges
     * @param {Object} nmap - { id_field: "", label_field: "" }
     * @param {Object} emap - { source_field: "", target_field: "" }
     * @param {Object} opts - { source_field: "", target_field: "" }
     */
    var standard_graph = function( nodes, edges, opts ) {

        // Array test
        if (!H.Assert.is_array(nodes))
        throw new Error( 'nodes is not an array' );

        // Object test
        if (!H.Assert.is_object(nodes[0]))
        throw new Error( 'nodes does not have valid object' );

        // Has objects in array test
        if (!nodes.length > 0)
        throw new Error( 'nodes input appears empty' );

        // Array test
        if (!H.Assert.is_array(edges))
        throw new Error( 'edges is not an array' );

        // Object test
        if (!H.Assert.is_object(edges[0]))
        throw new Error( 'edges does not have valid object' );

        // Has objects in array test
        if (!edges.length > 0)
        throw new Error( 'edges input appears empty' );

        console.log('Creating standard graph');

        const stnd_graph = H.standard_graph( nodes, edges, opts );
        return stnd_graph;
    
    };

    /*
    // To generate node files from edges
        let nfmap = {
            id_field: 'id',
            label_field: 'label',
            color_field: 'COLOR',
            size_field: 'edge_level',
            type_field: 'ENTITY',
            source_field: 'source',
            target_field: 'target',
        }
        let node_file = H.Structures_Complex.graph_from_edges(h_color_categorical, nfmap);
        
        var node_headers = {
          id: 'id',
          label: "label",
          color: "color",
          size: 'size',
          type: 'type'
        };
        H.Output.export_csv(node_headers, node_file, 'node-File.csv' );
    */
    var graph_from_edges = function(edges, fmap) {

        let snodes = [];
        let tnodes = [];

        edges.forEach(function(e) {

            let sattribs = new Object();
            sattribs.id = e[fmap.source_field]
            sattribs.label = e[fmap.source_field]

            let tattribs = new Object();
            tattribs.id = e[fmap.target_field]
            tattribs.label = e[fmap.target_field]

            if (H.Assert.is_not_undef(e[fmap.color_field])) {
                sattribs.color = e[fmap.color_field]
                tattribs.color = e[fmap.color_field]
            } else {
                sattribs.color = '#666666';
                tattribs.color = '#666666';
            }
            
            if (H.Assert.is_not_undef(e[fmap.size_field])) {
                sattribs.size = e[fmap.size_field];
                tattribs.size = e[fmap.size_field];
            } else {
                sattribs.size = 5;
                tattribs.size = 5;
            }

            if (H.Assert.is_not_undef(e[fmap.type_field])) {
                sattribs.type = e[fmap.type_field];
                tattribs.type = e[fmap.type_field];
            }

            snodes.push( sattribs )
            tnodes.push( tattribs )
        })

        let nodes = snodes.concat(tnodes);

        // Deduplicate by id
        console.log(nodes.length)
        const result = nodes.reduce((acc, current) => {
            const x = acc.find(item => item.id === current.id);
            if (!x) {
              return acc.concat([current]);
            } else {
              return acc;
            }
          }, []);
        console.log(result.length)
        return result;
    }

    /**
     * Triple store as graph with edge and predicate attribute
     * ref https://github.com/webr3/rdf.js
     *
     * @param {*} collection
     * @param {String} subject_field
     * @param {String} predicate_field
     * @param {String} object_field
     * @returns {standard_graph}
     */
    var triple_store = function( collection, subject_field, predicate_field, object_field ) {
        
        const triple = H.triple_store( collection, subject_field, predicate_field, object_field );
        return triple;

    }

    return {
        adjacency_list : adjacency_list,
        standard_tree: standard_tree,
        standard_graph: standard_graph,
        graph_from_edges : graph_from_edges,
        triple_store : triple_store
    };
    
}();/**
 * Graph store required for centrality, cluster, path finding and other graphic specific operations.
 * 
 * @param {*} nodes
 * @param {*} edges
 * @param {*} fmap
 * @param {*} opts
 */
H.standard_graph = function(nodes, edges, opts) {
  
  // Mandatory Field Mappings  
  // directed
  // compound
  // multigraph
  if (opts === undefined) {
    opts = new Object({ directed: true, compound: true, multigraph: true });
  }

  const stnd_graph = new H.Structure.graph.Graph(opts);
  stnd_graph.setGraph({});
  stnd_graph.setDefaultNodeLabel(function() {
    return {};
  });
  stnd_graph.setDefaultEdgeLabel(function() {
    return {};
  });

  // Map Nodes to standard model
  let n = 0;
  let nlen = nodes.length;
  for (n; n < nlen; n++) {
    let hn = new Object();
    hn.id = nodes[n]['id'];
    hn.label = nodes[n]['label'];
    stnd_graph.setNode(hn.id, hn.label);
  }

  let e = 0;
  let elen = edges.length;
  for (e; e < elen; e++) {
    let he = new Object();
    he.id = e;
    he.source = edges[e]['source'];
    he.target = edges[e]['target'];
    stnd_graph.setEdge(he.source, he.target, he);
  }

  return stnd_graph;
};
H.graph_to_dot = function() {

function write(nodes, edges, writer) {

  // we always assume it's directed graph for now.
  writer('digraph G {');
  
  // Get
  nodes.forEach(function(n) {
    storeNode(n)
  })

  edges.forEach(function(e) {
    storeLink(e)
  })
  // graph.forEachLink(storeLink);
  // graph.forEachNode(storeNode);

  writer('}');

  function storeLink(link) {
    var fromId = dotEscape(link['source']);
    var toId = dotEscape(link['target']);
    writer(fromId + ' -> ' + toId);
  }

  function storeNode(node) {
    writer(dotEscape(node['id']));
  }
}

function todot(nodes, edges, indent) {
  indent = typeof indent === 'number' ? indent : 0;
  if (indent < 0) indent = 0;

  var prefix = new Array(indent + 1).join(' ');
  var buf = [];

  write(nodes, edges, bufferWriter);

  return buf.join('\n');

  function bufferWriter(str) {
    buf.push(prefix + str);
  }

}

function dotEscape(id) {
  if (typeof id === 'number') {
    return id;
  }
  id = id.replace(/\n/gm, '\\\n');
  return '"' + id + '"';
}

return {
  todot : todot,
  write : write
}

}()/** 
 *  @fileOverview 
 *
 * 
 * @param {*} nodesep sets the minimum separation between nodes.
 * @param {*} ranksep sets the minimum separation between ranks.
 * @param {*} rankdir LR|RL|BT requests a left-to-right, right-to-left, or bottom-to-top, drawing.
 * @param {*} rank same (or min or max) in a subgraph constrains the rank assignment of its nodes. If a subgraph’s
 * name has the prefix cluster, its nodes are drawn in a distinct rectangle of the layout. Clusters may be
 * nested.
 * 
 * 
 *  @requires     none
 * 
 */

"use strict";
H.Namespace.set(H, 'Graphs.GraphViz');
H.Graphs.GraphViz = function() 
{
    // RUN LAYOUT TO GENERATE COORDINATES
    /**
     * Private function to
     * RUN LAYOUT TO GENERATE COORDINATES
     *
     * @param {*} nodes - structured as id, label and symbol, color, size fields
     * @param {*} layout_opts - default or user set; unique to each layout
     * 
     * @returns
     */
    var positions = function( nodes, edges, layout_opts ) {

        let gdot;
        let pNodes = []
        let pEdges = []
        let pGraph = {
            nodes: pNodes,
            edges: pEdges
        }
        
        // Create a temporary store to hold all attributes
        // and serve as look up to merge positions
        let sNodes
        if ( H.Store.JSDS.get('nodes') ) {
            console.log('deleting previous store')
            const sid = H.Store.JSDS.get('nodes')
            sid.remove()
        }
        sNodes = H.Store.JSDS.create('nodes');
        
        nodes.forEach(function (row) {

            sNodes.set(
                row['id'],
                row,
                { update: true })
        })
        
        // graphlib-dot requires standard_graph form
        let sgraph = H.standard_graph( nodes, edges )

        try {

            // convert to dot notation
            gdot = H.graph_to_dot.todot(nodes, edges);
            //console.log(gdot)
        }
        catch(err) {
            console.log("Error: " + err + ".");
        }
        finally {

            // Run Graphvis layout
            var viz = new Viz();
            let gopts = layout_opts;
            viz.renderJSONObject(gdot, gopts)
                .then(function(nodes) {
                    renderNodes(nodes);
                }).then(function(n) {
                    renderEdges(n)
                });
            
        }	// end finally

        // Assign position values to node data source
        // merges position to node based on id
        function renderNodes(nodes) {

                    let i = 0;
                    let ilen = nodes.objects.length;
                    for ( i; i < ilen; i++ ) {

                        // Need id to get from store
                        let id = nodes.objects[i].name;
                        
                        // Position result
                        let pos = nodes.objects[i].pos.split(',');
                        let nx = Number(pos[0]);
                        let ny = Number(pos[1]);
                        
                        if (sNodes.has(id)) {
                            // Merge to store
                            sNodes.set( 
                            id, 
                            { fx: nx, fy: ny }, 
                            { update: true } )
                            
                            // Collect result
                            pNodes.push(sNodes.get(id))
                        }
                    }
            return pNodes
        };

        function renderEdges(n) {
            // When given fx and fy force places as coordinates
            edges.forEach(function(d,i) {
                let s = d['source']
                let s_coords = sNodes.get(s)
                // console.log(s, s_coords)

                let t = d['target']
                let t_coords = sNodes.get(t)
                // console.log(t, t_coords)

                d.id = i;
                d.sx = s_coords.fx;
                d.sy = s_coords.fy;
                d.tx = t_coords.fx;
                d.ty = t_coords.fy;
                pEdges.push(d)
            })

            // Wipe store
            const store = H.Store.JSDS.get('nodes')
            store.remove();
            sNodes.length = 0;
            sNodes = null;
        }
        
        // Use promise to give time for calculations
        return Promise.resolve(pGraph);
    }

    return {
        positions: positions
    };

}();/**
 *
 * @param {*} value - value to test
 * @returns {boolean} boolean indicating whether value is an array
 */
H.Assert.is_undef = function(value) {
  return typeof value === "undefined";
};
/**
 *
 *
 * @param {*} value - value to test
 * @returns {boolean} boolean indicating whether value is an array
 */
H.Assert.is_function = function(value) {
  return typeof value === "function";
};/**
     * get "nested" object property
     */
    H.Obj.get = function (obj, prop){
        var parts = prop.split('.'),
            last = parts.pop();

        while (prop = parts.shift()) {
            obj = obj[prop];
            if (obj == null) return;
        }

        return obj[last];
    }

    /**
     * Check if object has nested property.
     */
    H.Obj.has = function (obj, prop){
        var UNDEF;
        const get = H.Obj.get;
        return get(obj, prop) !== UNDEF;
    }
////////////////////////////////////////////////////////////
//////////////////////// UTILITY ///////////////////////////
////////////////////////////////////////////////////////////

// PARENT NAMESPACES
H.Array = H.Array || {};
H.Assert = H.Assert || {};
H.Cast = H.Cast || {};
H.Coerce = H.Coerce || {};
H.Collection = H.Collection || {};
H.Color = H.Color || {};
H.Comparator = H.Comparator || {};
H.Condition = H.Condition || {};
H.Convert = H.Convert || {};
H.Cube = H.Cube || {};
H.Date = H.Date || {};
H.Dictionary = H.Dictionary || {};
H.Dist = H.Dist || {};
H.Error = H.Error || {};
H.Func = H.Func || {};
H.Generator = H.Generator || {};
H.Geometry = H.Geometry || {};
H.Hash = H.Hash || {};
H.Helpers = H.Helpers || {};
H.Identifier = H.Identifier || {};
H.Interpolation = H.Interpolation || {};
H.Iterator = H.Iterator || {};
H.Kernel = H.Kernel || {};
H.Math = H.Math || {};
H.Matrix = H.Matrix || {};
H.Number = H.Number || {};
H.Obj = H.Obj || {};
H.Optimize = H.Optimize || {};
H.Opts = H.Opts || {};
H.Perf = H.Perf || {};
H.Similarity = H.Similarity || {};
H.Spatial = H.Spatial || {};
H.Stats = H.Stats || {};
H.String = H.String || {};
H.Structure = H.Structure || {};
H.Time = H.Time || {};
H.Validate = H.Validate || {};
H.Vector = H.Vector || {};

// Here's the magic for all subsequent module inserts
H.Namespace = H.Namespace || {};





/**
     * Returns the first argument provided to it.
     */
    H.Func.identity = function (val){
        return val;
    }

"use strict";
H.Structure.graph = function() {

const has = H.Obj.has;
const constant = H.Func.identity;
const keys = H.Obj.keys;
const filter = H.Array.filter;
const isFunction = H.Assert.is_function;
const isEmpty = H.Assert.is_empty;
const each = H.Array.for_each;
const isUndefined = H.Assert.is_undef;
const values = H.Obj.values;
const reduce = H.Collection.reduce;
const union = H.Array.union;

var DEFAULT_EDGE_NAME = "\x00";
var GRAPH_NODE = "\x00";
var EDGE_KEY_DELIM = "\x01";

// Implementation notes:
//
//  * Node id query functions should return string ids for the nodes
//  * Edge id query functions should return an "edgeObj", edge object, that is
//    composed of enough information to uniquely identify an edge: {v, w, name}.
//  * Internally we use an "edgeId", a stringified form of the edgeObj, to
//    reference edges. This is because we need a performant way to look these
//    edges up and, object properties, which have string keys, are the closest
//    we're going to get to a performant hashtable in JavaScript.

function Graph(opts) {
  this._isDirected = has(opts, "directed") ? opts.directed : true;
  this._isMultigraph = has(opts, "multigraph") ? opts.multigraph : false;
  this._isCompound = has(opts, "compound") ? opts.compound : false;

  // Label for the graph itself
  this._label = undefined;

  // Defaults to be set when creating a new node
  this._defaultNodeLabelFn = constant(undefined);

  // Defaults to be set when creating a new edge
  this._defaultEdgeLabelFn = constant(undefined);

  // v -> label
  this._nodes = {};

  if (this._isCompound) {
    // v -> parent
    this._parent = {};

    // v -> children
    this._children = {};
    this._children[GRAPH_NODE] = {};
  }

  // v -> edgeObj
  this._in = {};

  // u -> v -> Number
  this._preds = {};

  // v -> edgeObj
  this._out = {};

  // v -> w -> Number
  this._sucs = {};

  // e -> edgeObj
  this._edgeObjs = {};

  // e -> label
  this._edgeLabels = {};
}

/* Number of nodes in the graph. Should only be changed by the implementation. */
Graph.prototype._nodeCount = 0;

/* Number of edges in the graph. Should only be changed by the implementation. */
Graph.prototype._edgeCount = 0;


/* === Graph functions ========= */

Graph.prototype.isDirected = function() {
  return this._isDirected;
};

Graph.prototype.isMultigraph = function() {
  return this._isMultigraph;
};

Graph.prototype.isCompound = function() {
  return this._isCompound;
};

Graph.prototype.setGraph = function(label) {
  this._label = label;
  return this;
};

Graph.prototype.graph = function() {
  return this._label;
};


/* === Node functions ========== */

Graph.prototype.setDefaultNodeLabel = function(newDefault) {
  if (!isFunction(newDefault)) {
    newDefault = constant(newDefault);
  }
  this._defaultNodeLabelFn = newDefault;
  return this;
};

Graph.prototype.nodeCount = function() {
  return this._nodeCount;
};

Graph.prototype.nodes = function() {
  return keys(this._nodes);
};

Graph.prototype.sources = function() {
  var self = this;
  return filter(this.nodes(), function(v) {
    return isEmpty(self._in[v]);
  });
};

Graph.prototype.sinks = function() {
  var self = this;
  return filter(this.nodes(), function(v) {
    return isEmpty(self._out[v]);
  });
};

Graph.prototype.setNodes = function(vs, value) {
  var args = arguments;
  var self = this;
  each(vs, function(v) {
    if (args.length > 1) {
      self.setNode(v, value);
    } else {
      self.setNode(v);
    }
  });
  return this;
};

Graph.prototype.setNode = function(v, value) {
  if (has(this._nodes, v)) {
    if (arguments.length > 1) {
      this._nodes[v] = value;
    }
    return this;
  }

  this._nodes[v] = arguments.length > 1 ? value : this._defaultNodeLabelFn(v);
  if (this._isCompound) {
    this._parent[v] = GRAPH_NODE;
    this._children[v] = {};
    this._children[GRAPH_NODE][v] = true;
  }
  this._in[v] = {};
  this._preds[v] = {};
  this._out[v] = {};
  this._sucs[v] = {};
  ++this._nodeCount;
  return this;
};

Graph.prototype.node = function(v) {
  return this._nodes[v];
};

Graph.prototype.hasNode = function(v) {
  return has(this._nodes, v);
};

Graph.prototype.removeNode =  function(v) {
  var self = this;
  if (has(this._nodes, v)) {
    var removeEdge = function(e) { self.removeEdge(self._edgeObjs[e]); };
    delete this._nodes[v];
    if (this._isCompound) {
      this._removeFromParentsChildList(v);
      delete this._parent[v];
      each(this.children(v), function(child) {
        self.setParent(child);
      });
      delete this._children[v];
    }
    each(keys(this._in[v]), removeEdge);
    delete this._in[v];
    delete this._preds[v];
    each(keys(this._out[v]), removeEdge);
    delete this._out[v];
    delete this._sucs[v];
    --this._nodeCount;
  }
  return this;
};

Graph.prototype.setParent = function(v, parent) {
  if (!this._isCompound) {
    throw new Error("Cannot set parent in a non-compound graph");
  }

  if (isUndefined(parent)) {
    parent = GRAPH_NODE;
  } else {
    // Coerce parent to string
    parent += "";
    for (var ancestor = parent;
      !isUndefined(ancestor);
      ancestor = this.parent(ancestor)) {
      if (ancestor === v) {
        throw new Error("Setting " + parent+ " as parent of " + v +
                        " would create a cycle");
      }
    }

    this.setNode(parent);
  }

  this.setNode(v);
  this._removeFromParentsChildList(v);
  this._parent[v] = parent;
  this._children[parent][v] = true;
  return this;
};

Graph.prototype._removeFromParentsChildList = function(v) {
  delete this._children[this._parent[v]][v];
};

Graph.prototype.parent = function(v) {
  if (this._isCompound) {
    var parent = this._parent[v];
    if (parent !== GRAPH_NODE) {
      return parent;
    }
  }
};

Graph.prototype.children = function(v) {
  if (isUndefined(v)) {
    v = GRAPH_NODE;
  }

  if (this._isCompound) {
    var children = this._children[v];
    if (children) {
      return keys(children);
    }
  } else if (v === GRAPH_NODE) {
    return this.nodes();
  } else if (this.hasNode(v)) {
    return [];
  }
};

Graph.prototype.predecessors = function(v) {
  var predsV = this._preds[v];
  if (predsV) {
    return keys(predsV);
  }
};

Graph.prototype.successors = function(v) {
  var sucsV = this._sucs[v];
  if (sucsV) {
    return keys(sucsV);
  }
};

Graph.prototype.neighbors = function(v) {
  var preds = this.predecessors(v);
  if (preds) {
    return union(preds, this.successors(v));
  }
};

Graph.prototype.isLeaf = function (v) {
  var neighbors;
  if (this.isDirected()) {
    neighbors = this.successors(v);
  } else {
    neighbors = this.neighbors(v);
  }
  return neighbors.length === 0;
};

Graph.prototype.filterNodes = function(filter) {
  var copy = new this.constructor({
    directed: this._isDirected,
    multigraph: this._isMultigraph,
    compound: this._isCompound
  });

  copy.setGraph(this.graph());

  var self = this;
  each(this._nodes, function(value, v) {
    if (filter(v)) {
      copy.setNode(v, value);
    }
  });

  each(this._edgeObjs, function(e) {
    if (copy.hasNode(e.v) && copy.hasNode(e.w)) {
      copy.setEdge(e, self.edge(e));
    }
  });

  var parents = {};
  function findParent(v) {
    var parent = self.parent(v);
    if (parent === undefined || copy.hasNode(parent)) {
      parents[v] = parent;
      return parent;
    } else if (parent in parents) {
      return parents[parent];
    } else {
      return findParent(parent);
    }
  }

  if (this._isCompound) {
    each(copy.nodes(), function(v) {
      copy.setParent(v, findParent(v));
    });
  }

  return copy;
};

/* === Edge functions ========== */

Graph.prototype.setDefaultEdgeLabel = function(newDefault) {
  if (!isFunction(newDefault)) {
    newDefault = constant(newDefault);
  }
  this._defaultEdgeLabelFn = newDefault;
  return this;
};

Graph.prototype.edgeCount = function() {
  return this._edgeCount;
};

Graph.prototype.edges = function() {
  return values(this._edgeObjs);
};

Graph.prototype.setPath = function(vs, value) {
  var self = this;
  var args = arguments;
  reduce(vs, function(v, w) {
    if (args.length > 1) {
      self.setEdge(v, w, value);
    } else {
      self.setEdge(v, w);
    }
    return w;
  });
  return this;
};

/*
 * setEdge(v, w, [value, [name]])
 * setEdge({ v, w, [name] }, [value])
 */
Graph.prototype.setEdge = function() {
  var v, w, name, value;
  var valueSpecified = false;
  var arg0 = arguments[0];

  if (typeof arg0 === "object" && arg0 !== null && "v" in arg0) {
    v = arg0.v;
    w = arg0.w;
    name = arg0.name;
    if (arguments.length === 2) {
      value = arguments[1];
      valueSpecified = true;
    }
  } else {
    v = arg0;
    w = arguments[1];
    name = arguments[3];
    if (arguments.length > 2) {
      value = arguments[2];
      valueSpecified = true;
    }
  }

  v = "" + v;
  w = "" + w;
  if (!isUndefined(name)) {
    name = "" + name;
  }

  var e = edgeArgsToId(this._isDirected, v, w, name);
  if (has(this._edgeLabels, e)) {
    if (valueSpecified) {
      this._edgeLabels[e] = value;
    }
    return this;
  }

  if (!isUndefined(name) && !this._isMultigraph) {
    throw new Error("Cannot set a named edge when isMultigraph = false");
  }

  // It didn't exist, so we need to create it.
  // First ensure the nodes exist.
  this.setNode(v);
  this.setNode(w);

  this._edgeLabels[e] = valueSpecified ? value : this._defaultEdgeLabelFn(v, w, name);

  var edgeObj = edgeArgsToObj(this._isDirected, v, w, name);
  // Ensure we add undirected edges in a consistent way.
  v = edgeObj.v;
  w = edgeObj.w;

  Object.freeze(edgeObj);
  this._edgeObjs[e] = edgeObj;
  incrementOrInitEntry(this._preds[w], v);
  incrementOrInitEntry(this._sucs[v], w);
  this._in[w][e] = edgeObj;
  this._out[v][e] = edgeObj;
  this._edgeCount++;
  return this;
};

Graph.prototype.edge = function(v, w, name) {
  var e = (arguments.length === 1
    ? edgeObjToId(this._isDirected, arguments[0])
    : edgeArgsToId(this._isDirected, v, w, name));
  return this._edgeLabels[e];
};

Graph.prototype.hasEdge = function(v, w, name) {
  var e = (arguments.length === 1
    ? edgeObjToId(this._isDirected, arguments[0])
    : edgeArgsToId(this._isDirected, v, w, name));
  return has(this._edgeLabels, e);
};

Graph.prototype.removeEdge = function(v, w, name) {
  var e = (arguments.length === 1
    ? edgeObjToId(this._isDirected, arguments[0])
    : edgeArgsToId(this._isDirected, v, w, name));
  var edge = this._edgeObjs[e];
  if (edge) {
    v = edge.v;
    w = edge.w;
    delete this._edgeLabels[e];
    delete this._edgeObjs[e];
    decrementOrRemoveEntry(this._preds[w], v);
    decrementOrRemoveEntry(this._sucs[v], w);
    delete this._in[w][e];
    delete this._out[v][e];
    this._edgeCount--;
  }
  return this;
};

Graph.prototype.inEdges = function(v, u) {
  var inV = this._in[v];
  if (inV) {
    var edges = values(inV);
    if (!u) {
      return edges;
    }
    return filter(edges, function(edge) { return edge.v === u; });
  }
};

Graph.prototype.outEdges = function(v, w) {
  var outV = this._out[v];
  if (outV) {
    var edges = values(outV);
    if (!w) {
      return edges;
    }
    return filter(edges, function(edge) { return edge.w === w; });
  }
};

Graph.prototype.nodeEdges = function(v, w) {
  var inEdges = this.inEdges(v, w);
  if (inEdges) {
    return inEdges.concat(this.outEdges(v, w));
  }
};

function incrementOrInitEntry(map, k) {
  if (map[k]) {
    map[k]++;
  } else {
    map[k] = 1;
  }
}

function decrementOrRemoveEntry(map, k) {
  if (!--map[k]) { delete map[k]; }
}

function edgeArgsToId(isDirected, v_, w_, name) {
  var v = "" + v_;
  var w = "" + w_;
  if (!isDirected && v > w) {
    var tmp = v;
    v = w;
    w = tmp;
  }
  return v + EDGE_KEY_DELIM + w + EDGE_KEY_DELIM +
             (isUndefined(name) ? DEFAULT_EDGE_NAME : name);
}

function edgeArgsToObj(isDirected, v_, w_, name) {
  var v = "" + v_;
  var w = "" + w_;
  if (!isDirected && v > w) {
    var tmp = v;
    v = w;
    w = tmp;
  }
  var edgeObj =  { v: v, w: w };
  if (name) {
    edgeObj.name = name;
  }
  return edgeObj;
}

function edgeObjToId(isDirected, edgeObj) {
  return edgeArgsToId(isDirected, edgeObj.v, edgeObj.w, edgeObj.name);
}

return {
  Graph : Graph
}

}()
