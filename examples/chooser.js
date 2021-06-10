import * as THREE from '../libs/three.js/build/three.module.js'

globalThis.chooserInit = chooserInit;

function chooserInit(cfg) {
  let rendererCfg = {
    svg:{},
    paperjs:{renderer:{name:'paperjs'}},
    three:{
        renderer:{
          name:'three',
          object:{
            'position.x':-70,
            'position.y':50,
          },
          scene:{
            background:new THREE.Color(0xf0f0f0)
          },
          camera:{
            'position.z':150, // zoom depth
          },
          renderer:{
            setQuality:'low',
            sortObjects:false // preserves draw order of the graph
          },
          controls:{
            screenSpacePanning:true
          },
          target:{
            width:600,
            height:400
          }
        }
      }
  }

  // For THREE
  function render(cfg, state, vis) {
    // Add to scene here & give control to THREE
    if (state == 'PARSE_CFG_END') {
      let r =  vis.getRenderer();
      r.scene.add( new THREE.AxesHelper( 10 ) );
      r.animate();
    }
  }

  // set up cfg
  let params = (new URL(document.location)).searchParams;
  let r = params.get('renderer')||'svg';
  cfg.element = rendererCfg[r];

  if (r == 'three') {
    let prevHandler = cfg.onStateChange;
    cfg.onStateChange = function(d) {
      if (prevHandler) prevHandler(...arguments);
      render(cfg, ...arguments);
    }
  }


  // set up top bar
  let links = ['SVG','PaperJS','THREE'].map(d => {
                    let lc = d.toLowerCase();
                    return `<a  id='${lc}' href='?renderer=${lc}' style="">${d}<a>`;
                  }).join(' ');

  d3.selectAll('#chooser').remove();
  d3.select('body').insert("div",":first-child")
    .attr('id','chooser')
    .style('width','100%')
    .style('height','40px')
    .style('font-family','Sans')
    .style('font-variant','all-small-caps')
    .style('font-size','20')
    .html(`<b>Current Renderer</b>: ${links}`)
    .selectAll('a')
    .style('color','#00A0C6')
    .style('text-decoration','none')
    .style('cursor','pointer');

  d3.select('#'+r)
    .attr('href', null)
    .style('cursor', 'default')
    .style('color','red')

  // inject general styles
  d3.select('head').append("style").html('.tippy-tooltip{opacity:.85}');
  return cfg;
}
