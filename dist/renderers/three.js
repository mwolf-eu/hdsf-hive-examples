"use strict";

import * as THREE from '../../libs/three.js/build/three.module.js';
import { OrbitControls } from '../../libs/three.js/examples/jsm/controls/OrbitControls.js';
// import { SVGLoader } from '../../libs/three.js/examples/jsm/loaders/SVGLoader.js';
import { SVGLoader } from '../SVGLoader.js';  // a patched version to handle text / clipmaps
import { SVGRenderer, SVGObject } from '../../libs/three.js/examples/jsm/renderers/SVGRenderer.js';
// text nodes
import { TTFLoader } from '../../libs/three.js/examples/jsm/loaders/TTFLoader.js';
import { opentype } from '../../libs/opentype.module.min.js';

import { BufferGeometryUtils } from '../../libs/three.js/examples/jsm/utils/BufferGeometryUtils.js';

Hive.Renderer.three = class {

  /**
  * Sets up the container & renderer
  *
  * @param object The container element
  * @param object The element config
  * @return a complete draw cfg
  */
  constructor(element, cfg, sendStateChange) {
    this.element = element;
    this.eCfg = cfg;
    this.sendStateChange = sendStateChange;
    this.drawableElement = {};
    this.prevIntersects = [];

    // let parentBBox = this.element.getBoundingClientRect();
    // this.w = parentBBox.width;
    // this.h = parentBBox.height;

    // this.w = cfg.sizing.width;
    // this.h = cfg.sizing.height;
    this.initThree();

    this.drawableElement = this.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-2,-2);

    this.onMouseMoveHandler = (this.onMouseMove).bind(this);
    this.onMouseDownHandler = (this.onClick).bind(this);
    element.addEventListener('mousemove', this.onMouseMoveHandler, false);
    element.addEventListener('mousedown',this. onMouseDownHandler, false);
  }

  destroy() {
    this.renderer.dispose();
    this.element.removeEventListener('mousemove', this.onMouseMoveHandler, false);
    this.element.removeEventListener('mousedown', this.onMouseDownHandler, false);
  }

  initThree() {

		this.renderer = new THREE.WebGLRenderer( { antialias: true } );

    let aspect = this.drawableElement.width/this.drawableElement.height;
    this.camera = new THREE.PerspectiveCamera( 50, aspect, 1, 1000 );
    this.setProperties('camera');

		this.renderer.setPixelRatio( window.devicePixelRatio );  // TODO
		// this.renderer.setSize( w, this.h );
		this.element.appendChild( this.renderer.domElement );
    this.setProperties('renderer');

		this.controls = new OrbitControls( this.camera, this.renderer.domElement );
    this.setProperties('controls');

		this.scene = new THREE.Scene();
    this.setProperties('scene');

    this.target = {width:this.element.clientWidth, height:this.element.clientHeight};
    this.setProperties('target');
  }

  setProperties(key){
    if (this.eCfg.renderer[key]) {
      Object.keys(this.eCfg.renderer[key]).forEach((item, i) => {
        let root = this[key];
        let keys = item.split('.');
        let max = keys.length-1;
        keys.forEach((k, i) => {
          if (i != max)
            root = root[k]
        });
        root[keys[max]] = this.eCfg.renderer[key][item];
      });
    }
    if(this[key].update) this[key].update();
  }

  /**
  * Render a given svg with associated events
  *
  * @param object SVG to render
  * @param object Events list
  * @return The groups to subscribe to
  */
  render(svg, events) {
    // let prevSvg = document.querySelector(`${this.eCfg.selector} svg`);
    // if (prevSvg) prevSvg.remove();

    // THREE.color can't handle opacity in a color def eg: rgba(22,33,44,.4).  So convert all of them.
    // ENABLE THIS IF DESIRED
    // Most charts however can be built to specify opacity separately
    // d3.select(svg).selectAll('[fill]').each(function (d) {
    //   let e = d3.select(this);
    //   ['fill', 'stroke'].forEach((attr, i) => {
    //     const val = e.attr(attr);
    //     let color;
    //     let opacity;
    //     let oAttr = attr=='stroke'?'opacity':'stroke-opacity';
    //
    //     // remove a from rgba & del the last arg
    //     if (val) color = val.replace('rgba','rgb')
    //                         .replace(/,[ \d.]+\)$/g, d => {
    //                           opacity = d.slice(1); // take off comma
    //                           return ')';
    //                         });
    //
    //     if (val != color) // if changed
    //       e.attr(attr, color);
    //     if (opacity && !e.attr(oAttr)) // set if attr does not exist
    //       e.attr(oAttr, opacity);
    //   });
    // });

    svg._visualization = this.drawableElement._visualization;
    this.drawableElement = svg;
    d3.select(svg).selectAll('path').attr('vector-effect', 'non-scaling-stroke'); // for zoom

    svg.style.top = '0px';
    svg.style.left = '0px';
    svg.style.position = 'absolute';

    // svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    var svgData = svg.outerHTML;
    var preface = '<?xml version="1.0" standalone="no"?>\r\n';
    var svgBlob = new Blob([preface, svgData], {type:"image/svg+xml;charset=utf-8"});
    var url = URL.createObjectURL(svgBlob);

    var loader = new SVGLoader();
		loader.load( url, (function ( data ) {
      var paths = data.paths;

      let ids = paths.map(d => d.userData.node.id);
      var group = new THREE.Group();
      group.name = svg._visualization.v.name;
      // TODO ANIMATE PREVIOUS TO NEW
      this.scene.remove(this.scene.getObjectByName(group.name)); // remove previous

      group.scale.multiplyScalar( 0.25 );
      group.scale.y *= - 1;
      this.object = group;
      this.setProperties('object');
      let curStrokeColor='black';

      for ( var i = 0; i < paths.length; i ++ ) {

        let path = paths[ i ];
        let opacity = path.userData.style.fillOpacity;
        let fillColor = path.userData.style.fill; // some colors are "none" which is invalid
        let noFill = ['transparent', 'none'].includes(fillColor);

        // if(noFill && ids[i].includes('node'))
        //   console.log(ids[i])

        if (!noFill) {

          var material = new THREE.MeshBasicMaterial( {
            // color: new THREE.Color().setStyle( fillColor ),
            side: THREE.DoubleSide,
            opacity: opacity,
            transparent: true,

            // depthWrite: true,
            //
            // depthWrite:false,
            // depthTest:true,
            //
            polygonOffset: true,
            polygonOffsetUnits: 4,
            polygonOffsetFactor: (i*-2)
          } );

          //  gradients
          if (!(fillColor.startsWith('url(#'))) material.color = new THREE.Color().setStyle( fillColor );

          var shapes = path.toShapes( true );

          for ( var j = 0; j < shapes.length; j ++ ) {

            var shape = shapes[ j ];

            var geometry = new THREE.ShapeBufferGeometry( shape );
            // Extruded geometry looks cheap here.  I'd recommend not doing it.
            // var geometry = new THREE.ExtrudeGeometry(shape, {
            //     depth: -10,
            //     bevelEnabled: true
            //   });

            var mesh = new THREE.Mesh( geometry, material );

            if (fillColor.startsWith('url(#')) {
              material.map = new THREE.CanvasTexture( this.generateTexture(svg, fillColor) )
              this.setUVs(mesh);
            }

            mesh.name = ids[i];

            let ud = paths[i].userData;
            let parentSVGId = ud.node.getAttribute('data-svgid'); // for nested meshes that need to appear as single
            if (parentSVGId){
              mesh.name = parentSVGId;
              let prev = group.children.filter(d => d.name == parentSVGId)
              if (prev.length) { // make sure only the first has the id
                // TEST: efficiency of merging meshes -or- grouping & modifying the intersector
                // https://stackoverflow.com/questions/31942722/how-to-merge-three-js-meshes-into-one-mesh

                // geometry.dispose()
                // material.dispose()
                // mesh.remove();
                mesh.name = '';
              }
            }


            // text placeholder
            if (ud.node.nodeName == 'text') {
              mesh.userData.node = ud.node;
              mesh.userData.style = ud.style;
            }

            // mesh.renderOrder=(i*-2);
            group.add( mesh );
          }
        }

        var strokeColor = path.userData.style.stroke;
        if (strokeColor == 'currentColor') strokeColor = curStrokeColor;
        curStrokeColor = strokeColor?strokeColor:curStrokeColor; // when strokeColor undefined

        var needsGradient = (strokeColor||'').startsWith('url(#');
        var dasharray = path.userData.node.getAttribute('stroke-dasharray');

        // dasharray is orthogonal to gradient textures.  Choose one.  FIX: Vertex colors?
        // WARNING: all line materials are limited to linewidth == 1 (see API manual)
        if (needsGradient || !dasharray){
          var material = new THREE.MeshBasicMaterial( {
            // color: new THREE.Color().setStyle( strokeColor ),
            side: THREE.DoubleSide,
            opacity: path.userData.style.strokeOpacity,
            transparent: path.userData.style.strokeOpacity < 1,

            polygonOffset: true,
            polygonOffsetUnits: 4,
            polygonOffsetFactor:(i*-2)+1
          } );
        } else {
          let da = (dasharray||'1 0').split(' ').map(d => parseFloat(d));
          da = da=='0'?[1,0]:da;
          if (da.length == 1) da.push(da[0]);
          if (da.length > 2) console.warn('THREE parses only the first two elements of dasharray.');

          // dashed or solid
          var material = new THREE.LineDashedMaterial( {
            side: THREE.DoubleSide,
            opacity: path.userData.style.strokeOpacity,
            transparent: path.userData.style.strokeOpacity < 1,

          	linewidth: parseFloat(path.userData.node.getAttribute('stroke-width')) || .1,
          	scale: 1,
          	dashSize: da[0],
          	gapSize: da[1],

            polygonOffset: true,
            polygonOffsetUnits: 4,
            polygonOffsetFactor:(i*-2)+1
          } );
        }

        //  gradients
        if (strokeColor && !(strokeColor.startsWith('url(#'))) material.color = new THREE.Color().setStyle( strokeColor );

        for ( var j = 0, jl = path.subPaths.length; j < jl; j ++ ) {
          var subPath = path.subPaths[ j ];
          if (needsGradient || !dasharray)
            var geometry = SVGLoader.pointsToStroke( subPath.getPoints(), path.userData.style );
          else
            var geometry = new THREE.BufferGeometry().setFromPoints( subPath.getPoints() );

          if ( geometry ) {
            if (needsGradient || !dasharray)
              var mesh = new THREE.Mesh( geometry, material );
            else{
              var mesh = new THREE.Line( geometry, material); // NOT A MESH
  				    mesh.computeLineDistances();
            }

            if (strokeColor && strokeColor.startsWith('url(#')) {
              material.map = new THREE.CanvasTexture( this.generateTexture(svg, strokeColor) )
              this.setUVs(mesh);
            }

            // for events if there is no fill then the stroke gets the primary name
            if (ids[i].length)
              mesh.name = ids[i]+(noFill?'':'-aux');
            // mesh.renderOrder=(i*-2)+1;

            group.add( mesh );
          }
        }
      }

      this.scene.add( group );

      (this.eCfg.renderer.translate||[]).forEach((d, i) => {
        let re = new RegExp(d.regex)
        let g = group.children.filter(d => re.test(d.name));
        g.forEach((e, j) => {
          e.translateX(d.vec.x);
          e.translateY(d.vec.y);
          e.translateZ(d.vec.z);
        });
      });

      this.attachEvents(group, events);
      this.swapMesh()
      this.sendStateChange('PARSE_THREE_SVG_END', group)

    }).bind(this));

    return this.getSubs(events);
  }

  // set UVs when applying a texture
  setUVs(mesh) {
    // https://jsfiddle.net/prisoner849/yn2z0e1w/
    var box = new THREE.Box3().setFromObject(mesh);
    var size = new THREE.Vector3();
    box.getSize(size);
    var vec3 = new THREE.Vector3(); // temp vector
    var attPos = mesh.geometry.attributes.position;
    var attUv = mesh.geometry.attributes.uv;
    for (let i = 0; i < attPos.count; i++){
    	vec3.fromBufferAttribute(attPos, i);
    	attUv.setXY(i,
      	(vec3.x - box.min.x) / size.x,
        (vec3.y - box.min.y) / size.y
      );
    }
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    this.renderer.domElement.addEventListener('dblclick', null, false);
    this.renderer.domElement.remove();
    this.renderer.dispose();
    this.renderer = null;
    this.scene = null;
    this.projector = null;
    this.camera = null;
    this.controls = null;
    this.raycaster = null;
    // dispose of models too?
  }

  generateTexture(svg, url) {
  	var size = 512;

  	// create canvas
  	let canvas = document.createElement( 'canvas' );
  	canvas.width = size;
  	canvas.height = size;

  	// get context
  	var context = canvas.getContext( '2d' );

  	// draw gradient
  	context.rect( 0, 0, size, size );
  	var gradient = context.createLinearGradient( 0, 0, 0, size );
    d3.select(svg).select(url.substr(4, url.length-5))
      .selectAll('stop').each(function(){
        let color = this.getAttribute('stop-color');
        let offset = this.getAttribute('offset');
        gradient.addColorStop(offset, color);
      });
  	// gradient.addColorStop(0, '#ff0000'); // light blue
  	// gradient.addColorStop(1, '#0000ff'); // dark blue
  	context.fillStyle = gradient;
  	context.fill();

  	return canvas;
  }

  // get subscriptions
  getSubs(events){
    return events.map(d=>d.ev.group);
  }

  // three animate
	animate() {
		this.animationId = requestAnimationFrame( this.animate.bind(this) );
		this.threerender();
	}

  // click handler
  onClick() {
    this.raycaster.setFromCamera( this.mouse, this.camera );
    const intersects = this.raycaster.intersectObjects( this.scene.children, true );
    for ( let i = 0; i < intersects.length; i ++ ) {
      let o = intersects[ i ].object;
      if (o.name.length){
        if (o.userData && o.userData.event && o.userData.event.click) {
          o.userData.event.click();
        }
      }
    }
  }

  // rendering
	threerender() {
    this.raycaster.setFromCamera( this.mouse, this.camera );
    // calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects( this.scene.children, true );
    let curIntersects = [];
    let mouseEnter = [];


    for ( let i = 0; i < intersects.length; i ++ ) {
      // intersects[ i ].object.material.color.set( 0xff0000 );
      let o = intersects[ i ].object;

      if (o.name.length){
        if (o.userData && o.userData.event) {
          curIntersects.push(o.name);
          if (!(this.prevIntersects.includes(o.name)) && o.userData.event.mouseenter)
              mouseEnter.push(o); // o.userData.event.mouseenter();
        }
      }
    }

    let mouseLeft = this.prevIntersects.filter(d => !(curIntersects.includes(d)));
    mouseLeft.forEach((obj, i) => {
      let o = this.scene.getObjectByName(obj);
      if (o.userData.event.mouseleave)
              o.userData.event.mouseleave();
    });

    mouseEnter.forEach(o => o.userData.event.mouseenter());

    this.prevIntersects = curIntersects;
		this.renderer.render( this.scene, this.camera );
	}

  /**
  * Swap mesh geometries
  * SVGLoader can't deal with text.  Circles are substituted, transformed,
  * rendered and their geometries replaced with text in a second pass.
  *
  * @return none
  */
  swapMesh() {
    // text
    let last = this.scene.children.length-1;
    let nodes = this.scene.children[last].children.filter(d=>d.userData.node);
    let byFamily = d3.nest().key(k => k.userData.node.getAttribute('font-family')).object(nodes)
    delete(byFamily.null); // TODO where do the empty strings w no font family come from?
    Object.keys(byFamily).forEach((f, i) => { // call by family
      this.genText(byFamily[f], f);
    });
  }

  /**
  * Rotate around arbitrary origin
  * Ex: rotateAboutPoint(mesh, new THREE.Vector3(0, 0, -355 / 2), new THREE.Vector3(0, 1, 0), THREE.Math.degToRad(30))
  *
  * @param obj your object (THREE.Object3D or derived)
  * @param point the point of rotation (THREE.Vector3)
  * @param axis the axis of rotation (normalized THREE.Vector3)
  * @param theta radian value of rotation
  * @param pointIsWorld boolean indicating the point is in world coordinates (default = false)
  * @return none
  */
  rotateAboutPoint(obj, point, axis, theta, pointIsWorld){
      pointIsWorld = (pointIsWorld === undefined)? false : pointIsWorld;

      if(pointIsWorld){
          obj.parent.localToWorld(obj.position); // compensate for world coordinate
      }

      obj.position.sub(point); // remove the offset
      obj.position.applyAxisAngle(axis, theta); // rotate the POSITION
      obj.position.add(point); // re-add the offset

      if(pointIsWorld){
          obj.parent.worldToLocal(obj.position); // undo world coordinates compensation
      }

      obj.rotateOnAxis(axis, theta); // rotate the OBJECT
  }

  /**
  * Generate text geometry for new meshes
  *
  * @param nodes nodes to create new geometry for
  * @param font font to load
  *
  */
  genText(nodes, font) {

    const loader = new TTFLoader();

    loader.load( `fonts/${font}.ttf`, (function ( json ) {
      let font = new THREE.Font( json );

      nodes.forEach((item, i) => {

        let text = item.userData.node.textContent;
        let fs = parseFloat(item.userData.node.getAttribute('font-size'));
        fs -= 3;  // TODO: FIND out why three fonts are too large
        let textGeo = new THREE.TextBufferGeometry( text, {
          font: font,
          size: fs || 10,
          height: .01, // thickness
        } );

        textGeo.computeBoundingBox();
        textGeo.computeVertexNormals();

        item.geometry.computeBoundingSphere();

        item.position.x += item.geometry.boundingSphere.center.x;
        item.position.y += item.geometry.boundingSphere.center.y;
        item.position.z += item.geometry.boundingSphere.center.z;

        let origin = item.position.clone()

        let ta = item.userData.style['text-anchor'];

        let anchor = 0;
        if (ta == 'start'){
          anchor = textGeo.boundingBox.min.x
          item.position.x += anchor;
          origin.y -= fs;
        }
        if (ta == 'middle'){
          anchor = 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x )
          item.position.x -= anchor
        }
        if (ta == 'end'){
          anchor = textGeo.boundingBox.max.x
          item.position.x -= anchor;
          origin.y -= (fs/2);
        }

        textGeo.rotateX(Math.PI);

        item.geometry.dispose();
        item.geometry = textGeo;
        // get all the rotate values
        let cl = item.userData.node.getAttribute('class');
        // if (cl && cl.includes('plugin-label')) {
        //   item.position.y += (fs/4)
        // } else {
          let rotates = (item.userData.node.getAttribute('transform')||'').split('rotate(').filter((d,i) => i%2);
          rotates.forEach((r, i) => {
            this.rotateAboutPoint(item, origin, new THREE.Vector3(0, 0, 1), THREE.Math.degToRad(parseFloat(r)))
          });
        // }

        // this.rotateAboutPoint(item, new THREE.Vector3(663.5, 0,0), new THREE.Vector3(1,0,0), .5);



      });

      (this.eCfg.renderer.rotateY||[]).forEach((d, i) => {
        let re = new RegExp(d.regex)
        let g = this.object.children.filter(d => re.test(d.name));
        // get center
        let getSz = (type, dim) => d3[type](g, d=>{d.geometry.computeBoundingBox(); return d.position[dim] + d.geometry.boundingBox[type][dim]});
        let minX = getSz('min', 'x');
        let minY = getSz('min', 'y');
        let minZ = getSz('min', 'z');
        let maxX = getSz('max', 'x');
        let maxY = getSz('max', 'y');
        let maxZ = getSz('max', 'z');

        g.forEach((e, j) => {
          this.rotateAboutPoint(e, new THREE.Vector3(minX+((maxX-minX)/2), minY+((maxY-minY)/2), minZ+((maxZ-minZ)/2)), new THREE.Vector3(0,1,0), d.rad);
        });

      });
    }).bind(this));
  }

  onMouseMove( event ) {
  	// calculate mouse position in normalized device coordinates
  	// (-1 to +1) for both components
    let bbox = this.renderer.domElement.getBoundingClientRect()
  	this.mouse.x = ( (event.clientX-bbox.x)/  this.renderer.domElement.width ) * 2 - 1;
  	this.mouse.y = - ( (event.clientY-bbox.y) / this.renderer.domElement.height ) * 2 + 1;
  }

  /**
  * Attach events to various elements
  *
  * @param object Group of Elements
  * @param object Events list
  * @return The groups to subscribe to
  */
  attachEvents(group, events) {
    let evTypes = ['onClick','onMouseLeave','onMouseEnter'];
    let eventSubscriptions = [];

    events.forEach((e, i) => {
      let item = group.getObjectByName(e.elId);
      // if (item.length > 1) console.warn("EVENT WARNING: Multiple objects have the same name.");

      evTypes.forEach((evt, i) => {
        if (!(e.ev[evt])) return; // if the element event cfg does not include eventtype
        if (e.ev.group)
          eventSubscriptions.push(e.ev.group);

        let eventName = evt.substring(2).toLowerCase();
        let uData = item.userData;
        if(!uData.event) uData.event = {};
        uData.event[eventName] = () => {         // init handler
            if (e.ev.group)
              this.messagePub(e.ev.group, {type:evt, e:e});
            if (e.ev[evt].element)
              this.on(item, evt, e.ev[evt].element); // paperjs .getFillColor does not work, so provide it.
            if (e.ev[evt].handler)
              e.ev[evt].handler(item, evt);
          }

        if (uData.event.mouseenter && !(uData.event.mouseleave)){  // if enter was set, do leave
          uData.event.mouseleave = () => {
            this.on(item, 'onMouseLeave', {});
            this.messagePub(e.ev.group, {type:'onMouseLeave', e:e});
          }
        }
      });
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
      // If behavior other than running the handler is needed
      // put it here.
    }

    if (ev == 'onMouseLeave' || el.userData.event['data-mouseEnter']){
      if (el.userData.event['data-mouseEnter'])  {
        el.userData.event['data-mouseEnter'] = false;
        el.material.color.set( el.userData.event.origColor );
        el.material.opacity = el.userData.event.origOpacity;
        if (el.userData.event.origScale){
          let os = el.userData.event.origScale;
          el.geometry.scale(os.x, os.y, os.z);
          let op = el.userData.event.origPos;
          el.position.x = op.x;
          el.position.y = op.y;
          el.position.z = op.z;
        }
      }
    }

    if (ev == 'onMouseEnter'){
      el.userData.event['data-mouseEnter'] = true;

      if (! (el.userData.event.origColor))
        el.userData.event.origColor = el.material.color.clone();

      if (! (el.userData.event.origOpacity))
        el.userData.event.origOpacity = el.material.opacity

      if (! (el.userData.event.origPos))
        el.userData.event.origPos = el.position.clone();

      if (evData.color){
        el.material.color.set( evData.color );
      }
      if (evData.opacity){
        el.material.opacity = evData.opacity;
      }

      if (evData.scale){
        if (! (el.userData.event.origScale))
          el.userData.event.origScale = new THREE.Vector3(1/evData.scale,1/evData.scale,1/evData.scale);

        // Scaling paths translates a mesh.  To keep it centered we need to undo that.
        el.geometry.computeBoundingBox()
        let bbox = el.geometry.boundingBox;

        let origW = bbox.max.x - bbox.min.x;
        let centerX = bbox.max.x - origW;

        el.position.x += ((1 - evData.scale) * centerX) - (((origW*evData.scale)-origW)/2);

        let origH = bbox.max.y - bbox.min.y;
        let centerY = bbox.max.y - origH;

        el.position.y += ((1 - evData.scale) * centerY) - (((origH*evData.scale)-origH)/2);

        let origD = bbox.max.z - bbox.min.z;
        let centerZ = bbox.max.z - origD;

        el.position.z += ((1 - evData.scale) * centerZ) - (((origD*evData.scale)-origD)/2);

        el.geometry.scale(evData.scale, evData.scale, evData.scale);
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
    let el = this.scene.getObjectByName(eid);
    el.geometry.computeBoundingBox();
    let bbox = el.geometry.boundingBox;
    let origW = bbox.max.x - bbox.min.x;
    let origH = bbox.max.y - bbox.min.y;
    let centerX = bbox.min.x + (origW/2);
    let centerY = bbox.min.y + (origH/2);

    function toScreenXY(pos, canvas, cam) {
      var width = canvas.width, height = canvas.height;

      var p = new THREE.Vector3(pos.x, pos.y, pos.z);
      var vector = p.project(cam);

      vector.x = (vector.x + 1) / 2 * width;
      vector.y = -(vector.y - 1) / 2 * height;

      return vector;
    }
    // Projecting from v3 to camera *should* work.
    // Until it functions use mouse coords for popup
    return {left:((this.mouse.x+1)/2)*this.renderer.domElement.width, top:this.renderer.domElement.height-(((this.mouse.y+1)/2)*this.renderer.domElement.height)};
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

    return len * 1.2; // HACK: THREE text is slightly bigger than canvas
  }

  /**
  * Gets current of drawable
  *
  * @return Drawable width / height
  */
  // getSize(){
  //   // return {w:this.w, h:this.h}
  //   return getDomElementSize();
  // }

  getTargetSize() {
    return {w:this.target.width, h:this.target.height};
  }

  setTargetSize(w,h) {
    this.target.width = w;
    this.target.height = h;
    // TODO Resize geometry
    // this.h.frames(); // rerun frames & draw
  }

  // set renderer related sizes
  setRendererSize(w,h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( w, h );
  }

  // resize(w, h) {
  //   // this.w = w;
  //   // this.h = h;
  //   setDomElementSize(w,h);
  // }

  /**
  * Re-rendering function
  *
  * @param object The element cfg
  * @param object The Visualization object
  * @return none
  */
  // redraw(cfg, vis) {
  //   let w = cfg.sizing.width;
  //   let h = cfg.sizing.height;
  //
  //   if (cfg.sizing.keepAspect) {
  //     let parentBBox = this.element.getBoundingClientRect();
  //     // let parentBBox = this.drawableElement.parentElement.getBoundingClientRect();
  //     let calcW = parentBBox.height * (w/h);
  //     let calcH = parentBBox.width * (h/w);
  //
  //     if (calcW > parentBBox.width) {
  //       w = parentBBox.width;
  //       h = calcH;
  //     } else {
  //       w = calcW
  //       h = parentBBox.height;
  //     }
  //   }
  //
  //   this.w = w;
  //   this.h = h;
  //
  //   // if (vis && cfg.sizing.keepAspect) {
  //   //   vis.frames(vis.v.frames); // recalc frame sizes
  //   //   vis.draw(vis.v.draw);  // redraw
  //   // }
  //   this.camera.aspect = w / h;
  //   this.camera.updateProjectionMatrix();
  //
  //   this.renderer.setSize( w, h );
  // }

  exportSVG(filename){
    var rendererSVG = new SVGRenderer();
		rendererSVG.setSize(this.renderer.domElement.width,this.renderer.domElement.height);
		rendererSVG.render( this.scene, this.camera );

		return rendererSVG.domElement;
	}
}
