This will be redone when the algs move to a webworker.

htk-graph-shim.js is prefaced by

H = {
  Array:{},
  Assert:{},
  Obj:{},
  Opts:{},
  Coerce:{},
}

Followed by a cat of: (fixing the last "use strict")

h_tk/core/array/for-each.js h_tk/core/assert/is-array.js h_tk/core/object/has-own.js h_tk/core/object/for-in.js h_tk/core/object/for-own.js h_tk/core/object/deep-match.js h_tk/core/namespace.js h_tk/layouts/common/defaults/general.js h_tk/layouts/common/defaults/layouts.js h_tk/core/assert/is-not-undef.js h_tk/layouts/graph/defs/common/transforms/std-to-elk-graph.js h_tk/core/store/jsds.js h_tk/layouts/graph/defs/2d/positioners/elk-positions-2d.js h_tk/layouts/graph/defs/2d/positioners/ccnet-positions-2d.js h_tk/collections/structures-complex.js h_tk/collections/defs/structures/complex/standard-graph.js h_tk/layouts/graph/defs/common/transforms/graph-to-dot.js h_tk/layouts/graph/defs/2d/positioners/graphviz-positions-2d.js h_tk/core/assert/is-undef.js  h_tk/core/assert/is-function.js  h_tk/core/object/get.js  h_tk/core/object/has.js  h_tk/core/index.js  h_tk/core/function/identity.js  h_tk/core/structure/graph.js 
