"use strict";

Hive.Renderer.paperjs = class {

  /**
  * Sets up the container & renderer
  *
  * @param object The container element
  * @param object The element config
  * @return a complete draw cfg
  */
  constructor(e, cfg) {
    this.element = e;
    this.drawableElement = document.createElement('canvas');
    // drawableElement['data-paper-resize'] = 'true';

    // this.drawableElement.setAttribute('hidpi', 'off')
    // This is exceedingly dumb.  Canvas HIDPI is forced.  I.E. You get a resource
    // you never asked for and turning it off does not totally clear up the canvas.

    this.drawableElement.style['image-rendering'] = 'pixelated';
    if (! cfg.renderer.hidpi) {
      this.drawableElement.setAttribute('data-paper-hidpi', 'off');
    }

    e.prepend(this.drawableElement);
    this.drawableObject = new paper.PaperScope();
    this.drawableObject.setup(this.drawableElement);
    this.lastVB = [0,0,1,1]; // viewbox vars

    // this.redraw(cfg); // set up sizes
  }

  /**
  * set relative position of object by group and element id
  *
  * @param string The group id
  * @param string The element id
  * @param boolean Whether or not to find the alternative positions
  * @return the element location
  */
  getPosition(gid, eid, findAlt) {
    let group = this.drawableObject.project.getLayers()[0].children[0];
    let b = group.children[gid].children[eid].getBounds();
    let e = group.children[gid].children[eid].getPosition();
    if (findAlt){
      let eAlt = group.children[gid].children[eid+'-alt']
      if (eAlt) eAlt = eAlt.getPosition();
      if (eAlt) e = eAlt;
    }
    return {top:e.y,  left:e.x} // +(b.width/2)+(b.height/2)
  }

  /**
  * set viewbox for panning/zooming
  *
  * @param array Viewbox settings
  * @param object The element
  * @param boolean Whether or not to find the alternative positions
  * @return none
  */
  setViewBox(vb) {
    let group = this.drawableObject.project.getLayers()[0].children[0];
    let vsize = this.drawableObject.view.getViewSize();

    group.scale(1/this.lastVB[2], 1/this.lastVB[3]); // undo last scale
    this.lastVB[2] = vsize._width/vb[2];
    this.lastVB[3] = vsize._height/vb[3];
    group.scale(vsize._width/vb[2], vsize._height/vb[3]); // do scale

    group.translate(this.vb0, this.vb1); // undo last xlate
    this.vb0 = vb[0] * this.lastVB[2];
    this.vb1 = vb[1] * this.lastVB[3];
    group.translate(-vb[0] * this.lastVB[2], -vb[1] * this.lastVB[3]); // do xlate
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
    let ctx = this.drawableObject.getView().getContext();
    ctx.font = `${size}px ${font}`;
    return ctx.measureText(text).width;
  }

  /**
  * Gets current of drawable
  *
  * @return Drawable width / height
  */
  getSize(){
    return {w:this.w, h:this.h}
  }

  /**
  * Render a given svg with associated events
  *
  * @param object SVG to render
  * @param object Events list
  * @return The groups to subscribe to
  */
  render(svg, events) {
    this.drawableObject.activate();
    this.drawableObject.project.clear();
    let s = this.drawableObject.project.importSVG(svg, {expandShapes:true, applyMatrix:true});
    s.setClipped(false); // handle clipping manually
    return this.attachEvents(s, events);
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
      let item = group.children[e.groupId].children[e.elId];

      evTypes.forEach((evt, i) => {
        if (!(e.ev[evt])) return; // if the element event cfg does not include eventtype
        if (e.ev.group)
          eventSubscriptions.push(e.ev.group);

        item[evt] = () => {         // init handler
          if (e.ev.group)
            this.messagePub(e.ev.group, {type:evt, e:e});
          if (e.ev[evt].element)
            this.on(item, evt, e.ev[evt].element); // paperjs .getFillColor does not work, so provide it.
          if (e.ev[evt].handler)
            e.ev[evt].handler(item, evt);
        }
      });

      if (item['onMouseEnter'] && !(item['onMouseLeave'])){  // if enter was set, do leave
        item['onMouseLeave'] = () => {
          this.on(item, 'onMouseLeave', {})
          this.messagePub(e.ev.group, {type:'onMouseLeave', e:e});
        };
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
      el.data.clicked = !el.data.clicked;

      if (evData.color){
        el.data['prevColor'] = el.data['prevColor'] || el.getFillColor();
        if (el.data.clicked == true) {
          el.setFillColor(evData.color);  // paper can't handle rgb(x,y,z)
        } else {
          el.setFillColor(el.data['prevColor']);
        }
      }

      if (evData.opacity){
        el.data['prevOpacity'] = el.data['prevOpacity'] || el.getOpacity();
        if (el.data.clicked == true) {
          el.setOpacity(evData.opacity);  // paper can't handle %
        } else {
          el.setOpacity(el.data['prevOpacity']);
        }
      }

      if (evData.scale){
        el.data['prevScaling'] = el.data['prevScaling'] || 1/evData.scale;
        if (el.data.clicked == true) {
          el.setScaling(evData.scale);
        } else {
          el.setScaling(el.data['prevScaling']);
        }
      }
    }

    if (ev == 'onMouseLeave' || el.data.mouseEnter){
      if (el.data.mouseEnter)  {
        el.data.mouseEnter = false;
        if (el.data['prevColor'])
          el.setFillColor(el.data['prevColor']);  // paper can't handle rgb(x,y,z)
        if (el.data['prevOpacity'])
          el.setOpacity(el.data['prevOpacity']);  // paper can't handle %
        if (el.data['prevScaling'])
          el.setScaling(el.data['prevScaling']);
      }
    }

    if (ev == 'onMouseEnter'){
      el.data.mouseEnter = true;
      if (evData.color){
        el.data['prevColor'] = el.data['prevColor'] || el.getFillColor();
        el.setFillColor(evData.color);  // paper can't handle rgb(x,y,z)
      }
      if (evData.opacity){
        el.data['prevOpacity'] = el.data['prevOpacity'] || el.getOpacity();
        el.setOpacity(evData.opacity);  // paper can't handle %
      }
      if (evData.scale){
        el.data['prevScaling'] = el.data['prevScaling'] || 1/evData.scale;
        el.setScaling(evData.scale);
      }
    }
  }

  getTargetSize() {
    return {w:this.element.clientWidth, h:this.element.clientHeight};
  }

  // set renderer related sizes
  setRendererSize(w, h) {
    this.drawableObject.activate()
    this.drawableObject.view.setViewSize(w,h);

    var ctx = this.drawableElement.getContext('2d');
    ctx.canvas.style.width = '';
    ctx.canvas.style.height = '';
  }

  /**
  * Re-rendering function
  *
  * @param object The element cfg
  * @param object The Visualization object
  * @return none
  */
  // redraw(cfg, vis) {
  //
  //   // if (!cfg) return; // merge ?
  //   let w = cfg.sizing.width;
  //   let h = cfg.sizing.height;
  //
  //   if (cfg.sizing.keepAspect) {
  //     let parentBBox = this.drawableElement.parentElement.getBoundingClientRect();
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
  //   if (!vis || (vis && cfg.sizing.keepAspect) || (vis && cfg.zoom) || (vis && cfg.drag))  { // first (manual) call | resize w keepAspect
  //     this.drawableObject.activate()
  //     this.drawableObject.view.setViewSize(w,h);
  //     // this.drawableObject.view.size.width = w;
  //     // this.drawableObject.view.size.height = h;
  //     // this.drawableObject.view._viewSize._width = w;
  //     // this.drawableObject.view._viewSize._height = h;
  //
  //     var ctx = this.drawableElement.getContext('2d');
  //     // ctx.clearRect(0, 0, w, h);
  //     // ctx.canvas.width  = w;
  //     // ctx.canvas.height = h;
  //     ctx.canvas.style.width = '';
  //     ctx.canvas.style.height = '';
  //
  //     // if ((vis && cfg.sizing.keepAspect) || (vis && cfg.zoom) || (vis && cfg.drag))  {
  //     //   // this.drawableObject.project.clear();
  //     //   vis.frames(vis.v.frames); // recalc frame sizes
  //     //   vis.draw(vis.v.draw);  // redraw
  //     // }
  //   }
  // }
}
