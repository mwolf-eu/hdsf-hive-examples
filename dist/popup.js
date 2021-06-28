"use strict";

Hive.popup = class {

  /**
  * Sets up the popup infrastructure
  *
  * @param object The render object
  * @param string The containing element selector
  * @param object The events list
  * @param object The cfg object
  * @return none
  */
  constructor(handlers, selector, events, cfg) {
    this.h = handlers;
    let sel = document.querySelector(selector);
    this.events = events;
    // To set tippy popup coords
    //if (oldPD) oldPD.remove();
    this.PopupElement = document.createElement('div');
    this.PopupElement.style.width = '0px';
    this.PopupElement.style.height = '0px';
    // this.PopupElement.style['background-color'] = 'blue'
    // this.PopupElement.style['z-index'] = '5'
    let oldPD = document.querySelector(selector + ' #popupDiv'); // remove old div
    if(oldPD) {
      if (oldPD._tippy) oldPD._tippy.destroy();
      oldPD.remove();
    }

    this.PopupElement.setAttribute('id', 'popupDiv');

    this.PopupElement.style.position = 'absolute';
    sel.appendChild(this.PopupElement);

    let props = cfg.props?cfg.props:{};
    if (tippy) {
      this.popup = {obj:tippy(this.PopupElement, {
        trigger:'manual',
        hideOnClick: true,
        allowHTML: true,
        ...props
      })}  // , contentHandler:this.popupContentHandler
    } else {
      console.warn('Can not init Tippy popup libs.')
    }
  }


  /**
  * Sets up a specific popup data
  *
  * @param object Cfg event attributes
  * @return popup data
  */
  register(cfg) {
    let attr = cfg.attr || {fill:undefined};
    return {attr, idx:cfg.idx, title:cfg.title, data:cfg.data};
  }

  /**
  * Sets up a popup color swatch
  *
  * @param string color
  * @return div element string
  */
  // bug: CSS border-opacity does not exist so just hope the user does not want both fill & stroke opacity
  static getColorDiv(attr) {
    let rv = '';
    let props = '';

    if (attr.fill) {
      props += `background-color:${attr.fill}; `;
      if (attr.opacity) props += `opacity:${attr.opacity}; `;
    }

    if ((!attr.fill || attr.fill=='none') && attr.stroke) {
      props += `background-color:${attr.stroke}; `;
      if (attr['stroke-opacity']) props += `opacity:${attr['stroke-opacity']}; `;
    }

    if ((!attr.fill || attr.fill=='none') && !attr.stroke)
      props += 'background-color:black; opacity:.8; ';

    if (attr)
      rv = `
        <div class='popupColor' style="background-color:white; height:15; width:15; display:inline-block; margin-right:5px; border-radius:20%; vertical-align:middle;">
          <div class='popupColor' style="${props} height:15; width:15; border-radius:20%;"></div>
        </div>`;

    return rv;
  }

  /**
  * Sets popup content for all keys in d with color for each
  *
  * @param object data
  * @return popup content
  */
  static formatLong(d) {
    let rv = ''
    let keys = Object.keys(d.data);
    let title = d.title.length>0?d.title+'<br>':'';
    let cDiv = Hive.popup.getColorDiv(d.attr);
    keys.forEach((item, i) => {
      rv += cDiv + `${item}: ${d.data[item]}${i==keys.length-1?'':'<br>'}`
    });
    return title + rv;
  }

  /**
  * Sets popup content for all keys in d with color in title
  *
  * @param object data
  * @return popup content
  */
  static formatLongTitleColor(d) {
    let rv = ''
    let keys = Object.keys(d.data);
    let title = d.title.length>0?d.title+'<br>':'';
    let cDiv = Hive.popup.getColorDiv(d.attr);
    keys.forEach((item, i) => {
      rv += `${item}: ${d.data[item]}${i==keys.length-1?'':'<br>'}`
    });
    return cDiv + title + rv;
  }

  /**
  * Sets popup content for all keys in d of a specific title with color for each
  *
  * @param object data
  * @return popup content
  */
  static formatWide(d) {
    let rv = ''
    let dNest = d3.nest().key(k => k.title).object(d);
    let keys = Object.keys(dNest);
    keys.forEach((item, i) => {
      rv += item.length>0?item+'<br>':'';
      dNest[item].forEach((item, i) => {
        let cDiv = Hive.popup.getColorDiv(item.attr);
        let line = Object.keys(item.data).map((d, i) => `${d}: ${item.data[d]}`).join(', ');
        rv += cDiv + line + ((i==d.length-1)?'':'<br>');
      });
    });

    return rv;
  }

  /**
  * Deals with messages from pubsub (usually mouse events which show a popup)
  *
  * @param object Element which triggered the message
  * @param object Event data
  * @return none
  */
  pubsubHandler(e, d) {
    let evData = d;
    let evNest = d3.nest().key(k=>k.ev.group).key(k=>k.idx).object(this.events);
    let popupData = [];
    let content = '';

    if (! evNest[e][d.e.idx]) return; // nothing to do

    evNest[e][d.e.idx].forEach((item, i) => {
      let vals = {};
      if (item.ev[evData.type] && item.ev[evData.type].popup && item.ev[evData.type].popup.vals){
        item.ev[evData.type].popup.vals.forEach(d => {vals[d] = item.data[item.idx][d]});
      } else
        vals = item.data[item.idx];
      popupData.push({title:item.title, attr:item.attr, data:vals});
    });

    let eCfg = d.e.ev[d.type]; // event config
    if (popupData.length == 1) {
      this.popup.obj.setProps({arrow: true});
      if (eCfg && eCfg.popup && eCfg.popup.handler)
        content = eCfg.popup.handler(popupData[0]);
      else
        content = Hive.popup.formatLong(popupData[0]);
    } else {
      this.popup.obj.setProps({arrow: false, placement:'right'});
      if (eCfg && eCfg.popup && eCfg.popup.handler)
        content = eCfg.popup.handler(popupData);
      else
        content = Hive.popup.formatWide(popupData);
    }

    if (d.type != 'onMouseLeave') {

      let selected = evNest[e][d.e.idx];
      let objPos = this.h.getElementPosition(selected[0].groupId, selected[0].elId, true);

      // if multiple observations, set y to be avg
      let yArr = selected.map(d => this.h.getElementPosition(d.groupId, d.elId, true).top);
      let yAvg = d3.mean(d3.extent(yArr));

      this.PopupElement.style.top = yAvg;
      this.PopupElement.style.left = objPos.left;

      this.popup.obj.setContent(content);
      this.popup.obj.show();
    } else
      this.popup.obj.hide();

  }

}
