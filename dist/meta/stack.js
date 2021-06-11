"use strict";

/**
* Convert long data to wide data
*
* @param Object cfg.data Data object array
* @param Object cfg.splitField
* @param Object cfg.sumField
* @param Object cfg.wideField
* @return
*/
Hive.Util = {Data:{}};
Hive.Util.Data.longToWide = function (cfg) {
  let splitField = cfg.splitField;
  let sumField = cfg.sumField;
  let wideField = cfg.wideField;
  let data = cfg.data;
  let min = 0, max = 0;

  let uniqSF = [...new Set(data.map(d=>d[splitField]))];

  let outData =  d3.nest().key(k => k[wideField]).rollup(d=>{
    let rv = {[wideField]:d[0][wideField]};

    let localMax = 0;
    let localMin = 0;
    uniqSF.forEach(e=> {
        let sum = d3.sum(d.filter(f=>f[splitField]==e), d=>d[sumField])
        rv[e] = sum || 0
        if (rv[e]>0) localMax += rv[e];
        if (rv[e]<0) localMin += rv[e];
    })

    if (localMax > max) max = localMax;
    if (localMin < min) min = localMin;

    // adds missing groups
    rv.data = uniqSF.map(e => {
      let fRv = d.filter(f => f[splitField]==e);
      return fRv.length==0?{}:fRv[0];
    })

    return rv
    }).entries(data).map(d=>d.value);

  return {data:outData, uniqSplitVals:uniqSF, extent:[min, max]};
}

Hive.Type.stack = function (cfg) {
  let def = {
    generator:d3.stack(),
    prefix:'stack',
    keys:[],
    data:[],
  }
  cfg = Hive.Object.mergeDeep(def, cfg);

  function posOnly(d, key) {
    let val = d[key]
    return val>=0?val:0;
  }

  function negOnly(d, key) {
    let val = d[key]
    return val<0?val*-1:0;
  }

  let stackP = d3.stack().keys(cfg.keys).value(posOnly)(cfg.data);
  let stackN = d3.stack().keys(cfg.keys).value(negOnly)(cfg.data);
  stackN.forEach(row => {
    row.forEach(d => {
      d[0] *= -1;
      d[1] *= -1;
    });
  })

  let min = d3.min([d3.min(stackN[stackN.length-1], d => d[1])]);
  let max = d3.max([d3.max(stackP[stackP.length-1], d => d[1])]);

  let rv = {data:[], extent:[min, max], posLen:stackP.length};

  let stack = stackP.concat(stackN);
  stack.forEach((item, i) => {
    let sign = i<(stack.length/2)?'Pos':'Neg'
    let key = item.key;
    item = item.map(d => {return{...d, key, value:d[0]==d[1]?'':d.data[item.key]}});
    rv.data.push({name:`${cfg.prefix}-data-${key+sign}`, content:item }); // push data
    });

  return rv;
}
