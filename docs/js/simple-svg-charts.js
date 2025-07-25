/* 
 * simple-svg-charts.js v1.0.0
 *  
 * based on https://github.com/pierresh/morris.js/
 * based on https://github.com/morrisjs/morris.js/
 * 
 * Copyright 2025 Olly Smith All rights reserved.
 * Licensed under the BSD-2-Clause License.
 */

(function() {
  var Morris, compStyle, minutesSpecHelper, secondsSpecHelper,
    slice = [].slice,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Morris = window.Morris = {};

  compStyle = function(el) {
    if (getComputedStyle) {
      return getComputedStyle(el, null);
    } else if (el.currentStyle) {
      return el.currentStyle;
    } else {
      return el.style;
    }
  };

  Morris.EventEmitter = (function() {
    function EventEmitter() {}

    EventEmitter.prototype.on = function(name, handler) {
      if (this.handlers == null) {
        this.handlers = {};
      }
      if (this.handlers[name] == null) {
        this.handlers[name] = [];
      }
      this.handlers[name].push(handler);
      return this;
    };

    EventEmitter.prototype.fire = function() {
      var args, handler, k, len, name, ref, results;
      name = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if ((this.handlers != null) && (this.handlers[name] != null)) {
        ref = this.handlers[name];
        results = [];
        for (k = 0, len = ref.length; k < len; k++) {
          handler = ref[k];
          results.push(handler.apply(null, args));
        }
        return results;
      }
    };

    return EventEmitter;

  })();

  Morris.commas = function(num) {
    var absnum, intnum, ret, strabsnum;
    if (num != null) {
      ret = num < 0 ? "-" : "";
      absnum = Math.abs(num);
      intnum = Math.floor(absnum).toFixed(0);
      ret += intnum.replace(/(?=(?:\d{3})+$)(?!^)/g, ',');
      strabsnum = absnum.toString();
      if (strabsnum.length > intnum.length) {
        ret += strabsnum.slice(intnum.length);
      }
      return ret;
    } else {
      return '-';
    }
  };

  Morris.pad2 = function(number) {
    return (number < 10 ? '0' : '') + number;
  };

  Morris.extend = function() {
    var k, key, len, object, objects, properties, val;
    object = arguments[0], objects = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    if (object == null) {
      object = {};
    }
    for (k = 0, len = objects.length; k < len; k++) {
      properties = objects[k];
      if (properties != null) {
        for (key in properties) {
          val = properties[key];
          if (properties.hasOwnProperty(key)) {
            object[key] = val;
          }
        }
      }
    }
    return object;
  };

  Morris.offset = function(el) {
    var rect;
    rect = el.getBoundingClientRect();
    return {
      top: rect.top + document.body.scrollTop,
      left: rect.left + document.body.scrollLeft
    };
  };

  Morris.css = function(el, prop) {
    return compStyle(el)[prop];
  };

  Morris.on = function(el, eventName, fn) {
    if (el.addEventListener) {
      return el.addEventListener(eventName, fn);
    } else {
      return el.attachEvent('on' + eventName, fn);
    }
  };

  Morris.off = function(el, eventName, fn) {
    if (el.removeEventListener) {
      return el.removeEventListener(eventName, fn);
    } else {
      return el.detachEvent('on' + eventName, fn);
    }
  };

  Morris.dimensions = function(el) {
    var style;
    style = compStyle(el);
    return {
      width: parseInt(style.width),
      height: parseInt(style.height)
    };
  };

  Morris.innerDimensions = function(el) {
    var style;
    style = compStyle(el);
    return {
      width: parseInt(style.width) + parseInt(style.paddingLeft) + parseInt(style.paddingRight),
      height: parseInt(style.height) + parseInt(style.paddingTop) + parseInt(style.paddingBottom)
    };
  };

  Morris.Grid = (function(superClass) {
    extend(Grid, superClass);

    function Grid(options) {
      this.setLabels = bind(this.setLabels, this);
      this.hasToShow = bind(this.hasToShow, this);
      this.debouncedResizeHandler = bind(this.debouncedResizeHandler, this);
      this.resizeHandler = bind(this.resizeHandler, this);
      this.mouseupHandler = bind(this.mouseupHandler, this);
      this.mousedownHandler = bind(this.mousedownHandler, this);
      this.clickHandler = bind(this.clickHandler, this);
      this.touchHandler = bind(this.touchHandler, this);
      this.mouseleaveHandler = bind(this.mouseleaveHandler, this);
      this.mousemoveHandler = bind(this.mousemoveHandler, this);
      if (typeof options.element === 'string') {
        this.el = document.getElementById(options.element);
      } else {
        this.el = options.element[0] || options.element;
      }
      if (this.el == null) {
        throw new Error("Graph container element not found");
      }
      if (Morris.css(this.el, 'position') === 'static') {
        this.el.style.position = 'relative';
      }
      this.options = Morris.extend({}, this.gridDefaults, this.defaults || {}, options);
      if (typeof this.options.units === 'string') {
        this.options.postUnits = options.units;
      }
      this.raphael = new Raphael(this.el);
      this.elementWidth = null;
      this.elementHeight = null;
      this.dirty = false;
      this.selectFrom = null;
      if (this.init) {
        this.init();
      }
      this.setData(this.options.data);
      Morris.on(this.el, 'mousemove', this.mousemoveHandler);
      Morris.on(this.el, 'mouseleave', this.mouseleaveHandler);
      Morris.on(this.el, 'touchstart touchmove touchend', this.touchHandler);
      Morris.on(this.el, 'click', this.clickHandler);
      if (this.options.rangeSelect) {
        this.selectionRect = this.raphael.rect(0, 0, 0, Morris.innerDimensions(this.el).height).attr({
          fill: this.options.rangeSelectColor,
          stroke: false
        }).toBack().hide();
        Morris.on(this.el, 'mousedown', this.mousedownHandler);
        Morris.on(this.el, 'mouseup', this.mouseupHandler);
      }
      if (this.options.resize) {
        Morris.on(window, 'resize', this.resizeHandler);
      }
      this.el.style.webkitTapHighlightColor = 'rgba(0,0,0,0)';
      if (this.postInit) {
        this.postInit();
      }
    }

    Grid.prototype.gridDefaults = {
      dateFormat: null,
      axes: true,
      freePosition: false,
      grid: true,
      gridIntegers: false,
      gridLineColor: '#aaa',
      gridStrokeWidth: 0.5,
      gridTextColor: '#888',
      gridTextSize: 12,
      gridTextFamily: 'sans-serif',
      gridTextWeight: 'normal',
      hideHover: 'auto',
      yLabelFormat: null,
      yLabelAlign: 'right',
      yLabelAlign2: 'left',
      xLabelAngle: 0,
      numLines: 5,
      padding: 25,
      parseTime: true,
      postUnits: '',
      postUnits2: '',
      preUnits: '',
      preUnits2: '',
      ymax: 'auto',
      ymin: 'auto 0',
      ymax2: 'auto',
      ymin2: 'auto 0',
      regions: [],
      regionsColors: ['#fde4e4'],
      goals: [],
      goals2: [],
      goalStrokeWidth: 1.0,
      goalStrokeWidth2: 1.0,
      goalLineColors: ['red'],
      goalLineColors2: ['red'],
      events: [],
      eventStrokeWidth: 1.0,
      eventLineColors: ['#005a04'],
      rangeSelect: null,
      rangeSelectColor: '#eef',
      resize: true,
      dataLabels: true,
      dataLabelsPosition: 'outside',
      dataLabelsFamily: 'sans-serif',
      dataLabelsSize: 12,
      dataLabelsWeight: 'normal',
      dataLabelsColor: 'auto',
      animate: true,
      nbYkeys2: 0,
      smooth: true
    };

    Grid.prototype.destroy = function() {
      Morris.off(this.el, 'mousemove', this.mousemoveHandler);
      Morris.off(this.el, 'mouseleave', this.mouseleaveHandler);
      Morris.off(this.el, 'touchstart touchmove touchend', this.touchHandler);
      Morris.off(this.el, 'click', this.clickHandler);
      if (this.options.rangeSelect) {
        Morris.off(this.el, 'mousedown', this.mousedownHandler);
        Morris.off(this.el, 'mouseup', this.mouseupHandler);
      }
      if (this.options.resize) {
        window.clearTimeout(this.timeoutId);
        return Morris.off(window, 'resize', this.resizeHandler);
      }
    };

    Grid.prototype.setData = function(data, redraw) {
      var e, flatEvents, from, idx, index, k, len, maxGoal, minGoal, ref, ref1, ret, row, step, step2, to, total, y, ykey, ymax, ymax2, ymin, ymin2, yval;
      if (redraw == null) {
        redraw = true;
      }
      this.options.data = data;
      if ((data == null) || data.length === 0) {
        this.data = [];
        this.raphael.clear();
        if (this.hover != null) {
          this.hover.hide();
        }
        return;
      }
      ymax = this.cumulative ? 0 : null;
      ymin = this.cumulative ? 0 : null;
      ymax2 = this.cumulative ? 0 : null;
      ymin2 = this.cumulative ? 0 : null;
      if (this.options.goals.length > 0) {
        minGoal = Math.min.apply(Math, this.options.goals);
        maxGoal = Math.max.apply(Math, this.options.goals);
        ymin = ymin != null ? Math.min(ymin, minGoal) : minGoal;
        ymax = ymax != null ? Math.max(ymax, maxGoal) : maxGoal;
      }
      if (this.options.goals2.length > 0) {
        minGoal = Math.min.apply(Math, this.options.goals2);
        maxGoal = Math.max.apply(Math, this.options.goals2);
        ymin2 = ymin2 != null ? Math.min(ymin2, minGoal) : minGoal;
        ymax2 = ymax2 != null ? Math.max(ymax2, maxGoal) : maxGoal;
      }
      if (this.options.nbYkeys2 > this.options.ykeys.length) {
        this.options.nbYkeys2 = this.options.ykeys.length;
      }
      this.data = (function() {
        var k, len, results;
        results = [];
        for (index = k = 0, len = data.length; k < len; index = ++k) {
          row = data[index];
          ret = {
            src: row
          };
          ret.label = row[this.options.xkey];
          if (this.options.parseTime) {
            ret.x = Morris.parseDate(ret.label);
            if (this.options.dateFormat) {
              ret.label = this.options.dateFormat(ret.x);
            } else if (typeof ret.label === 'number') {
              ret.label = new Date(ret.label).toString();
            }
          } else if (this.options.freePosition) {
            ret.x = parseFloat(row[this.options.xkey]);
            if (this.options.xLabelFormat) {
              ret.label = this.options.xLabelFormat(ret);
            }
          } else {
            ret.x = index;
            if (this.options.xLabelFormat) {
              ret.label = this.options.xLabelFormat(ret);
            }
          }
          total = 0;
          ret.y = (function() {
            var len1, ref, results1, u;
            ref = this.options.ykeys;
            results1 = [];
            for (idx = u = 0, len1 = ref.length; u < len1; idx = ++u) {
              ykey = ref[idx];
              yval = row[ykey];
              if (typeof yval === 'string') {
                yval = parseFloat(yval);
              }
              if ((yval != null) && typeof yval !== 'number') {
                yval = null;
              }
              if (idx < this.options.ykeys.length - this.options.nbYkeys2) {
                if ((yval != null) && this.hasToShow(idx)) {
                  if (this.cumulative) {
                    if (total < 0 && yval > 0) {
                      total = yval;
                    } else {
                      total += yval;
                    }
                  } else {
                    if (ymax != null) {
                      ymax = Math.max(yval, ymax);
                      ymin = Math.min(yval, ymin);
                    } else {
                      ymax = ymin = yval;
                    }
                  }
                }
                if (this.cumulative && (total != null)) {
                  ymax = Math.max(total, ymax);
                  ymin = Math.min(total, ymin);
                }
              } else {
                if ((yval != null) && this.hasToShow(idx)) {
                  if (this.cumulative) {
                    total = yval;
                  } else {
                    if (ymax2 != null) {
                      ymax2 = Math.max(yval, ymax2);
                      ymin2 = Math.min(yval, ymin2);
                    } else {
                      ymax2 = ymin2 = yval;
                    }
                  }
                }
                if (this.cumulative && (total != null)) {
                  ymax2 = Math.max(total, ymax2);
                  ymin2 = Math.min(total, ymin2);
                }
              }
              results1.push(yval);
            }
            return results1;
          }).call(this);
          results.push(ret);
        }
        return results;
      }).call(this);
      if (this.options.parseTime || this.options.freePosition) {
        this.data = this.data.sort(function(a, b) {
          return (a.x > b.x) - (b.x > a.x);
        });
      }
      this.xmin = this.data[0].x;
      this.xmax = this.data[this.data.length - 1].x;
      this.events = [];
      if (this.options.events.length > 0) {
        if (this.options.parseTime) {
          ref = this.options.events;
          for (k = 0, len = ref.length; k < len; k++) {
            e = ref[k];
            if (e instanceof Array) {
              from = e[0], to = e[1];
              this.events.push([Morris.parseDate(from), Morris.parseDate(to)]);
            } else {
              this.events.push(Morris.parseDate(e));
            }
          }
        } else {
          this.events = this.options.events;
        }
        flatEvents = this.events.map(function(e) {
          return e;
        });
        this.xmax = Math.max(this.xmax, Math.max.apply(Math, flatEvents));
        this.xmin = Math.min(this.xmin, Math.min.apply(Math, flatEvents));
      }
      if (this.xmin === this.xmax) {
        this.xmin -= 1;
        this.xmax += 1;
      }
      this.ymin = this.yboundary('min', ymin);
      this.ymax = this.yboundary('max', ymax);
      this.ymin2 = this.yboundary('min2', ymin2);
      this.ymax2 = this.yboundary('max2', ymax2);
      if (this.ymin === this.ymax) {
        if (ymin) {
          this.ymin -= 1;
        }
        this.ymax += 1;
      }
      if (this.ymin2 === this.ymax2) {
        if (ymin2) {
          this.ymin2 -= 1;
        }
        this.ymax2 += 1;
      }
      if (((ref1 = this.options.axes) === true || ref1 === 'both' || ref1 === 'y') || this.options.grid === true) {
        if (this.options.ymax === this.gridDefaults.ymax && this.options.ymin === this.gridDefaults.ymin) {
          this.grid = this.autoGridLines(this.ymin, this.ymax, this.options.numLines);
          this.ymin = Math.min(this.ymin, this.grid[0]);
          this.ymax = Math.max(this.ymax, this.grid[this.grid.length - 1]);
        } else {
          step = (this.ymax - this.ymin) / (this.options.numLines - 1);
          if (this.options.gridIntegers) {
            step = Math.max(1, Math.round(step));
          }
          this.grid = (function() {
            var ref2, ref3, ref4, results, u;
            results = [];
            for (y = u = ref2 = this.ymin, ref3 = this.ymax, ref4 = step; ref4 > 0 ? u <= ref3 : u >= ref3; y = u += ref4) {
              results.push(parseFloat(y.toFixed(2)));
            }
            return results;
          }).call(this);
        }
        if (this.options.ymax2 === this.gridDefaults.ymax2 && this.options.ymin2 === this.gridDefaults.ymin2 && this.options.nbYkeys2 > 0) {
          this.grid2 = this.autoGridLines(this.ymin2, this.ymax2, this.options.numLines);
          this.ymin2 = Math.min(this.ymin2, this.grid2[0]);
          this.ymax2 = Math.max(this.ymax2, this.grid2[this.grid2.length - 1]);
        } else {
          step2 = (this.ymax2 - this.ymin2) / (this.options.numLines - 1);
          this.grid2 = (function() {
            var ref2, ref3, ref4, results, u;
            results = [];
            for (y = u = ref2 = this.ymin2, ref3 = this.ymax2, ref4 = step2; ref4 > 0 ? u <= ref3 : u >= ref3; y = u += ref4) {
              results.push(parseFloat(y.toFixed(2)));
            }
            return results;
          }).call(this);
        }
      }
      this.dirty = true;
      if (redraw) {
        return this.redraw();
      }
    };

    Grid.prototype.yboundary = function(boundaryType, currentValue) {
      var boundaryOption, suggestedValue;
      boundaryOption = this.options["y" + boundaryType];
      if (typeof boundaryOption === 'string') {
        if (boundaryOption.slice(0, 4) === 'auto') {
          if (boundaryOption.length > 5) {
            suggestedValue = parseInt(boundaryOption.slice(5), 10);
            if (currentValue == null) {
              return suggestedValue;
            }
            return Math[boundaryType.substring(0, 3)](currentValue, suggestedValue);
          } else {
            if (currentValue != null) {
              return currentValue;
            } else {
              return 0;
            }
          }
        } else {
          return parseInt(boundaryOption, 10);
        }
      } else {
        return boundaryOption;
      }
    };

    Grid.prototype.autoGridLines = function(ymin, ymax, nlines) {
      var gmax, gmin, grid, smag, span, step, unit, y, ymag;
      span = ymax - ymin;
      ymag = Math.floor(Math.log(span) / Math.log(10));
      unit = Math.pow(10, ymag);
      gmin = Math.floor(ymin / unit) * unit;
      gmax = Math.ceil(ymax / unit) * unit;
      step = (gmax - gmin) / (nlines - 1);
      if (unit === 1 && step > 1 && Math.ceil(step) !== step) {
        step = Math.ceil(step);
        gmax = gmin + step * (nlines - 1);
      }
      if (gmin < 0 && gmax > 0) {
        gmin = Math.floor(ymin / step) * step;
        gmax = Math.ceil(ymax / step) * step;
      }
      if (step < 1) {
        smag = Math.floor(Math.log(step) / Math.log(10));
        grid = (function() {
          var k, ref, ref1, ref2, results;
          results = [];
          for (y = k = ref = gmin, ref1 = gmax, ref2 = step; ref2 > 0 ? k <= ref1 : k >= ref1; y = k += ref2) {
            results.push(parseFloat(y.toFixed(1 - smag)));
          }
          return results;
        })();
      } else {
        grid = (function() {
          var k, ref, ref1, ref2, results;
          results = [];
          for (y = k = ref = gmin, ref1 = gmax, ref2 = step; ref2 > 0 ? k <= ref1 : k >= ref1; y = k += ref2) {
            results.push(y);
          }
          return results;
        })();
      }
      return grid;
    };

    Grid.prototype._calc = function() {
      var angle, bottomOffsets, gridLine, h, i, ref, ref1, ref2, w, yLabelWidths, yLabelWidths2;
      ref = Morris.dimensions(this.el), w = ref.width, h = ref.height;
      if (this.elementWidth !== w || this.elementHeight !== h || this.dirty) {
        this.elementWidth = w;
        this.elementHeight = h;
        this.dirty = false;
        this.left = this.options.padding;
        this.right = this.elementWidth - this.options.padding;
        this.top = this.options.padding;
        this.bottom = this.elementHeight - this.options.padding;
        if ((ref1 = this.options.axes) === true || ref1 === 'both' || ref1 === 'y') {
          if (this.grid != null) {
            yLabelWidths = (function() {
              var k, len, ref2, results;
              ref2 = this.grid;
              results = [];
              for (k = 0, len = ref2.length; k < len; k++) {
                gridLine = ref2[k];
                results.push(this.measureText(this.yAxisFormat(gridLine)).width);
              }
              return results;
            }).call(this);
          }
          if (this.options.nbYkeys2 > 0) {
            yLabelWidths2 = (function() {
              var k, len, ref2, results;
              ref2 = this.grid2;
              results = [];
              for (k = 0, len = ref2.length; k < len; k++) {
                gridLine = ref2[k];
                results.push(this.measureText(this.yAxisFormat2(gridLine)).width);
              }
              return results;
            }).call(this);
          }
          if (!this.options.horizontal) {
            this.left += Math.max.apply(Math, yLabelWidths);
            if (this.options.nbYkeys2 > 0) {
              this.right -= Math.max.apply(Math, yLabelWidths2);
            }
          } else {
            this.bottom -= this.options.padding / 2;
          }
        }
        if ((ref2 = this.options.axes) === true || ref2 === 'both' || ref2 === 'x') {
          if (!this.options.horizontal) {
            angle = -this.options.xLabelAngle;
          } else {
            angle = -90;
          }
          bottomOffsets = (function() {
            var k, ref3, results;
            results = [];
            for (i = k = 0, ref3 = this.data.length; 0 <= ref3 ? k < ref3 : k > ref3; i = 0 <= ref3 ? ++k : --k) {
              results.push(this.measureText(this.data[i].label, angle).height);
            }
            return results;
          }).call(this);
          if (!this.options.horizontal) {
            this.bottom -= Math.max.apply(Math, bottomOffsets);
          } else {
            this.left += Math.max.apply(Math, bottomOffsets);
          }
        }
        this.width = Math.max(1, this.right - this.left);
        this.height = Math.max(1, this.bottom - this.top);
        if (!this.options.horizontal) {
          this.dx = this.width / (this.xmax - this.xmin);
          this.dy = this.height / (this.ymax - this.ymin);
          this.dy2 = this.height / (this.ymax2 - this.ymin2);
          this.yStart = this.bottom;
          this.yEnd = this.top;
          this.xStart = this.left;
          this.xEnd = this.right;
          this.xSize = this.width;
          this.ySize = this.height;
        } else {
          this.dx = this.height / (this.xmax - this.xmin);
          this.dy = this.width / (this.ymax - this.ymin);
          this.dy2 = this.width / (this.ymax2 - this.ymin2);
          this.yStart = this.left;
          this.yEnd = this.right;
          this.xStart = this.top;
          this.xEnd = this.bottom;
          this.xSize = this.height;
          this.ySize = this.width;
        }
        if (this.calc) {
          return this.calc();
        }
      }
    };

    Grid.prototype.transY = function(y) {
      if (!this.options.horizontal) {
        return this.bottom - (y - this.ymin) * this.dy;
      } else {
        return this.left + (y - this.ymin) * this.dy;
      }
    };

    Grid.prototype.transY2 = function(y) {
      if (!this.options.horizontal) {
        return this.bottom - (y - this.ymin2) * this.dy2;
      } else {
        return this.left + (y - this.ymin2) * this.dy2;
      }
    };

    Grid.prototype.transX = function(x) {
      if (this.data.length === 1) {
        return (this.xStart + this.xEnd) / 2;
      } else {
        return this.xStart + (x - this.xmin) * this.dx;
      }
    };

    Grid.prototype.redraw = function() {
      this.raphael.clear();
      this._calc();
      this.drawGrid();
      this.drawRegions();
      this.drawEvents();
      if (this.draw) {
        this.draw();
      }
      this.drawGoals();
      return this.setLabels();
    };

    Grid.prototype.measureText = function(text, angle) {
      var ret, tt;
      if (angle == null) {
        angle = 0;
      }
      tt = this.raphael.text(100, 100, text).attr('font-size', this.options.gridTextSize).attr('font-family', this.options.gridTextFamily).attr('font-weight', this.options.gridTextWeight).rotate(angle);
      ret = tt.getBBox();
      tt.remove();
      return ret;
    };

    Grid.prototype.yAxisFormat = function(label) {
      return this.yLabelFormat(label, 0);
    };

    Grid.prototype.yAxisFormat2 = function(label) {
      return this.yLabelFormat(label, 1000);
    };

    Grid.prototype.yLabelFormat = function(label, i) {
      if (typeof this.options.yLabelFormat === 'function') {
        return this.options.yLabelFormat(label, i);
      } else {
        if (this.options.nbYkeys2 === 0 || (i <= this.options.ykeys.length - this.options.nbYkeys2 - 1)) {
          return "" + this.options.preUnits + (Morris.commas(label)) + this.options.postUnits;
        } else {
          return "" + this.options.preUnits2 + (Morris.commas(label)) + this.options.postUnits2;
        }
      }
    };

    Grid.prototype.yLabelFormat_noUnit = function(label, i) {
      if (typeof this.options.yLabelFormat === 'function') {
        return this.options.yLabelFormat(label, i);
      } else {
        return "" + (Morris.commas(label));
      }
    };

    Grid.prototype.getYAxisLabelX = function() {
      if (this.options.yLabelAlign === 'right') {
        return this.left - this.options.padding / 2;
      } else {
        return this.options.padding / 2;
      }
    };

    Grid.prototype.drawGrid = function() {
      var basePos, basePos2, k, len, len1, lineY, pos, ref, ref1, ref2, ref3, ref4, results, u;
      if (this.options.grid === false && ((ref = this.options.axes) !== true && ref !== 'both' && ref !== 'y')) {
        return;
      }
      if (!this.options.horizontal) {
        basePos = this.getYAxisLabelX();
        basePos2 = this.right + this.options.padding / 2;
      } else {
        basePos = this.getXAxisLabelY();
        basePos2 = this.top - (this.options.xAxisLabelTopPadding || this.options.padding / 2);
      }
      if (this.grid != null) {
        ref1 = this.grid;
        for (k = 0, len = ref1.length; k < len; k++) {
          lineY = ref1[k];
          pos = this.transY(lineY);
          if ((ref2 = this.options.axes) === true || ref2 === 'both' || ref2 === 'y') {
            if (!this.options.horizontal) {
              this.drawYAxisLabel(basePos, pos, this.yAxisFormat(lineY), 1);
            } else {
              this.drawXAxisLabel(pos, basePos, this.yAxisFormat(lineY));
            }
          }
          if (this.options.grid) {
            pos = Math.floor(pos) + 0.5;
            if (!this.options.horizontal) {
              if (isNaN(this.xEnd)) {
                this.xEnd = 20;
              }
              this.drawGridLine("M" + this.xStart + "," + pos + "H" + this.xEnd);
            } else {
              this.drawGridLine("M" + pos + "," + this.xStart + "V" + this.xEnd);
            }
          }
        }
      }
      if (this.options.nbYkeys2 > 0) {
        ref3 = this.grid2;
        results = [];
        for (u = 0, len1 = ref3.length; u < len1; u++) {
          lineY = ref3[u];
          pos = this.transY2(lineY);
          if ((ref4 = this.options.axes) === true || ref4 === 'both' || ref4 === 'y') {
            if (!this.options.horizontal) {
              results.push(this.drawYAxisLabel(basePos2, pos, this.yAxisFormat2(lineY), 2));
            } else {
              results.push(this.drawXAxisLabel(pos, basePos2, this.yAxisFormat2(lineY)));
            }
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    };

    Grid.prototype.drawRegions = function() {
      var color, i, k, len, ref, region, results;
      ref = this.options.regions;
      results = [];
      for (i = k = 0, len = ref.length; k < len; i = ++k) {
        region = ref[i];
        color = this.options.regionsColors[i % this.options.regionsColors.length];
        results.push(this.drawRegion(region, color));
      }
      return results;
    };

    Grid.prototype.drawGoals = function() {
      var color, goal, i, k, len, len1, ref, ref1, results, u;
      ref = this.options.goals;
      for (i = k = 0, len = ref.length; k < len; i = ++k) {
        goal = ref[i];
        color = this.options.goalLineColors[i % this.options.goalLineColors.length];
        this.drawGoal(goal, color);
      }
      ref1 = this.options.goals2;
      results = [];
      for (i = u = 0, len1 = ref1.length; u < len1; i = ++u) {
        goal = ref1[i];
        color = this.options.goalLineColors2[i % this.options.goalLineColors2.length];
        results.push(this.drawGoal2(goal, color));
      }
      return results;
    };

    Grid.prototype.drawEvents = function() {
      var color, event, i, k, len, ref, results;
      if (this.events != null) {
        ref = this.events;
        results = [];
        for (i = k = 0, len = ref.length; k < len; i = ++k) {
          event = ref[i];
          color = this.options.eventLineColors[i % this.options.eventLineColors.length];
          results.push(this.drawEvent(event, color));
        }
        return results;
      }
    };

    Grid.prototype.drawGoal = function(goal, color) {
      var path, y;
      y = Math.floor(this.transY(goal)) + 0.5;
      if (!this.options.horizontal) {
        path = "M" + this.xStart + "," + y + "H" + this.xEnd;
      } else {
        path = "M" + y + "," + this.xStart + "V" + this.xEnd;
      }
      return this.raphael.path(path).attr('stroke', color).attr('stroke-width', this.options.goalStrokeWidth);
    };

    Grid.prototype.drawGoal2 = function(goal, color) {
      var path, y;
      y = Math.floor(this.transY2(goal)) + 0.5;
      if (!this.options.horizontal) {
        path = "M" + this.xStart + "," + y + "H" + this.xEnd;
      } else {
        path = "M" + y + "," + this.xStart + "V" + this.xEnd;
      }
      return this.raphael.path(path).attr('stroke', color).attr('stroke-width', this.options.goalStrokeWidth2);
    };

    Grid.prototype.drawRegion = function(region, color) {
      var from, path, to, y;
      if (region instanceof Array) {
        from = Math.min(Math.max.apply(Math, region), this.ymax);
        to = Math.max(Math.min.apply(Math, region), this.ymin);
        if (!this.options.horizontal) {
          from = Math.floor(this.transY(from));
          to = Math.floor(this.transY(to)) - from;
          return this.raphael.rect(this.xStart, from, this.xEnd - this.xStart, to).attr({
            fill: color,
            stroke: false
          }).toBack();
        } else {
          to = Math.floor(this.transY(to));
          from = Math.floor(this.transY(from)) - to;
          return this.raphael.rect(to, this.xStart, from, this.xEnd - this.xStart).attr({
            fill: color,
            stroke: false
          }).toBack();
        }
      } else {
        if (!this.options.horizontal) {
          y = Math.floor(this.transY(area)) + 1;
          path = "M" + this.xStart + "," + y + "H" + this.xEnd;
          return this.raphael.path(path).attr('stroke', color).attr('stroke-width', 2);
        } else {
          y = Math.floor(this.transY(area)) + 1;
          path = "M" + y + "," + this.xStart + "V" + this.xEnd;
          return this.raphael.path(path).attr('stroke', color).attr('stroke-width', 2);
        }
      }
    };

    Grid.prototype.drawEvent = function(event, color) {
      var from, path, to, x;
      if (event instanceof Array) {
        from = event[0], to = event[1];
        from = Math.floor(this.transX(from)) + 0.5;
        to = Math.floor(this.transX(to)) + 0.5;
        if (!this.options.horizontal) {
          return this.raphael.rect(from, this.yEnd, to - from, this.yStart - this.yEnd).attr({
            fill: color,
            stroke: false
          }).toBack();
        } else {
          return this.raphael.rect(this.yStart, from, this.yEnd - this.yStart, to - from).attr({
            fill: color,
            stroke: false
          }).toBack();
        }
      } else {
        x = Math.floor(this.transX(event)) + 0.5;
        if (!this.options.horizontal) {
          path = "M" + x + "," + this.yStart + "V" + this.yEnd;
        } else {
          path = "M" + this.yStart + "," + x + "H" + this.yEnd;
        }
        return this.raphael.path(path).attr('stroke', color).attr('stroke-width', this.options.eventStrokeWidth);
      }
    };

    Grid.prototype.drawYAxisLabel = function(xPos, yPos, text, yaxis) {
      var label;
      label = this.raphael.text(xPos, yPos, text).attr('font-size', this.options.gridTextSize).attr('font-family', this.options.gridTextFamily).attr('font-weight', this.options.gridTextWeight).attr('fill', this.options.gridTextColor);
      if (yaxis === 1) {
        if (this.options.yLabelAlign === 'right') {
          return label.attr('text-anchor', 'end');
        } else {
          return label.attr('text-anchor', 'start');
        }
      } else {
        if (this.options.yLabelAlign2 === 'left') {
          return label.attr('text-anchor', 'start');
        } else {
          return label.attr('text-anchor', 'end');
        }
      }
    };

    Grid.prototype.drawXAxisLabel = function(xPos, yPos, text) {
      return this.raphael.text(xPos, yPos, text).attr('font-size', this.options.gridTextSize).attr('font-family', this.options.gridTextFamily).attr('font-weight', this.options.gridTextWeight).attr('fill', this.options.gridTextColor);
    };

    Grid.prototype.drawGridLine = function(path) {
      return this.raphael.path(path).attr('stroke', this.options.gridLineColor).attr('stroke-width', this.options.gridStrokeWidth);
    };

    Grid.prototype.startRange = function(x) {
      this.hover.hide();
      this.selectFrom = x;
      return this.selectionRect.attr({
        x: x,
        width: 0
      }).show();
    };

    Grid.prototype.endRange = function(x) {
      var end, start;
      if (this.selectFrom) {
        start = Math.min(this.selectFrom, x);
        end = Math.max(this.selectFrom, x);
        this.options.rangeSelect.call(this.el, {
          start: this.data[this.hitTest(start)].x,
          end: this.data[this.hitTest(end)].x
        });
        return this.selectFrom = null;
      }
    };

    Grid.prototype.mousemoveHandler = function(evt) {
      var left, offset, right, width, x;
      offset = Morris.offset(this.el);
      x = evt.pageX - offset.left;
      if (this.selectFrom) {
        left = this.data[this.hitTest(Math.min(x, this.selectFrom))]._x;
        right = this.data[this.hitTest(Math.max(x, this.selectFrom))]._x;
        width = right - left;
        return this.selectionRect.attr({
          x: left,
          width: width
        });
      } else {
        return this.fire('hovermove', x, evt.pageY - offset.top);
      }
    };

    Grid.prototype.mouseleaveHandler = function(evt) {
      if (this.selectFrom) {
        this.selectionRect.hide();
        this.selectFrom = null;
      }
      return this.fire('hoverout');
    };

    Grid.prototype.touchHandler = function(evt) {
      var offset, touch;
      touch = evt.originalEvent.touches[0] || evt.originalEvent.changedTouches[0];
      offset = Morris.offset(this.el);
      return this.fire('hovermove', touch.pageX - offset.left, touch.pageY - offset.top);
    };

    Grid.prototype.clickHandler = function(evt) {
      var offset;
      offset = Morris.offset(this.el);
      return this.fire('gridclick', evt.pageX - offset.left, evt.pageY - offset.top);
    };

    Grid.prototype.mousedownHandler = function(evt) {
      var offset;
      offset = Morris.offset(this.el);
      return this.startRange(evt.pageX - offset.left);
    };

    Grid.prototype.mouseupHandler = function(evt) {
      var offset;
      offset = Morris.offset(this.el);
      this.endRange(evt.pageX - offset.left);
      return this.fire('hovermove', evt.pageX - offset.left, evt.pageY - offset.top);
    };

    Grid.prototype.resizeHandler = function() {
      if (this.timeoutId != null) {
        window.clearTimeout(this.timeoutId);
      }
      return this.timeoutId = window.setTimeout(this.debouncedResizeHandler, 100);
    };

    Grid.prototype.debouncedResizeHandler = function() {
      var height, ref, width;
      this.timeoutId = null;
      ref = Morris.dimensions(this.el), width = ref.width, height = ref.height;
      this.raphael.setSize(width, height);
      this.options.animate = false;
      return this.redraw();
    };

    Grid.prototype.hasToShow = function(i) {
      return this.options.shown === true || this.options.shown[i] === true;
    };

    Grid.prototype.isColorDark = function(hex) {
      var b, g, luma, r, rgb;
      if (hex != null) {
        hex = hex.substring(1);
        rgb = parseInt(hex, 16);
        r = (rgb >> 16) & 0xff;
        g = (rgb >> 8) & 0xff;
        b = (rgb >> 0) & 0xff;
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma >= 128) {
          return false;
        } else {
          return true;
        }
      } else {
        return false;
      }
    };

    Grid.prototype.drawDataLabel = function(xPos, yPos, text, color) {
      var label;
      return label = this.raphael.text(xPos, yPos, text).attr('text-anchor', 'middle').attr('font-size', this.options.dataLabelsSize).attr('font-family', this.options.dataLabelsFamily).attr('font-weight', this.options.dataLabelsWeight).attr('fill', color);
    };

    Grid.prototype.drawDataLabelExt = function(xPos, yPos, text, anchor, color) {
      var label;
      return label = this.raphael.text(xPos, yPos, text).attr('text-anchor', anchor).attr('font-size', this.options.dataLabelsSize).attr('font-family', this.options.dataLabelsFamily).attr('font-weight', this.options.dataLabelsWeight).attr('fill', color);
    };

    Grid.prototype.setLabels = function() {
      var color, index, k, len, ref, results, row, ykey;
      if (this.options.dataLabels) {
        ref = this.data;
        results = [];
        for (k = 0, len = ref.length; k < len; k++) {
          row = ref[k];
          results.push((function() {
            var len1, ref1, results1, u;
            ref1 = this.options.ykeys;
            results1 = [];
            for (index = u = 0, len1 = ref1.length; u < len1; index = ++u) {
              ykey = ref1[index];
              if (this.options.dataLabelsColor !== 'auto') {
                color = this.options.dataLabelsColor;
              } else if (this.options.stacked === true && this.isColorDark(this.options.barColors[index % this.options.barColors.length]) === true) {
                color = '#fff';
              } else {
                color = '#000';
              }
              if ((this.options.lineColors != null) && (this.options.lineType != null)) {
                if (row.label_y[index] != null) {
                  this.drawDataLabel(row._x, row.label_y[index], this.yLabelFormat_noUnit(row.y[index], 0), color);
                }
                if (row._y2 != null) {
                  if (row._y2[index] != null) {
                    results1.push(this.drawDataLabel(row._x, row._y2[index] - 10, this.yLabelFormat_noUnit(row.y[index], 1000), color));
                  } else {
                    results1.push(void 0);
                  }
                } else {
                  results1.push(void 0);
                }
              } else {
                if (row.label_y[index] != null) {
                  if (this.options.horizontal === !true) {
                    results1.push(this.drawDataLabel(row.label_x[index], row.label_y[index], this.yLabelFormat_noUnit(row.y[index], index), color));
                  } else {
                    results1.push(this.drawDataLabelExt(row.label_x[index], row.label_y[index], this.yLabelFormat_noUnit(row.y[index]), 'start', color));
                  }
                } else if (row._y2[index] != null) {
                  if (this.options.horizontal === !true) {
                    results1.push(this.drawDataLabel(row._x, row._y2[index] - 10, this.yLabelFormat_noUnit(row.y[index], index), color));
                  } else {
                    results1.push(this.drawDataLabelExt(row._y2[index], row._x - 10, this.yLabelFormat_noUnit(row.y[index]), 'middle', color));
                  }
                } else {
                  results1.push(void 0);
                }
              }
            }
            return results1;
          }).call(this));
        }
        return results;
      }
    };

    return Grid;

  })(Morris.EventEmitter);

  Morris.parseDate = function(date) {
    var isecs, m, msecs, n, o, offsetmins, p, q, r, ret, secs;
    if (typeof date === 'number') {
      return date;
    }
    m = date.match(/^(\d+) Q(\d)$/);
    n = date.match(/^(\d+)-(\d+)$/);
    o = date.match(/^(\d+)-(\d+)-(\d+)$/);
    p = date.match(/^(\d+) W(\d+)$/);
    q = date.match(/^(\d+)-(\d+)-(\d+)[ T](\d+):(\d+)(Z|([+-])(\d\d):?(\d\d))?$/);
    r = date.match(/^(\d+)-(\d+)-(\d+)[ T](\d+):(\d+):(\d+(\.\d+)?)(Z|([+-])(\d\d):?(\d\d))?$/);
    if (m) {
      return new Date(parseInt(m[1], 10), parseInt(m[2], 10) * 3 - 1, 1).getTime();
    } else if (n) {
      return new Date(parseInt(n[1], 10), parseInt(n[2], 10) - 1, 1).getTime();
    } else if (o) {
      return new Date(parseInt(o[1], 10), parseInt(o[2], 10) - 1, parseInt(o[3], 10)).getTime();
    } else if (p) {
      ret = new Date(parseInt(p[1], 10), 0, 1);
      if (ret.getDay() !== 4) {
        ret.setMonth(0, 1 + ((4 - ret.getDay()) + 7) % 7);
      }
      return ret.getTime() + parseInt(p[2], 10) * 604800000;
    } else if (q) {
      if (!q[6]) {
        return new Date(parseInt(q[1], 10), parseInt(q[2], 10) - 1, parseInt(q[3], 10), parseInt(q[4], 10), parseInt(q[5], 10)).getTime();
      } else {
        offsetmins = 0;
        if (q[6] !== 'Z') {
          offsetmins = parseInt(q[8], 10) * 60 + parseInt(q[9], 10);
          if (q[7] === '+') {
            offsetmins = 0 - offsetmins;
          }
        }
        return Date.UTC(parseInt(q[1], 10), parseInt(q[2], 10) - 1, parseInt(q[3], 10), parseInt(q[4], 10), parseInt(q[5], 10) + offsetmins);
      }
    } else if (r) {
      secs = parseFloat(r[6]);
      isecs = Math.floor(secs);
      msecs = Math.round((secs - isecs) * 1000);
      if (!r[8]) {
        return new Date(parseInt(r[1], 10), parseInt(r[2], 10) - 1, parseInt(r[3], 10), parseInt(r[4], 10), parseInt(r[5], 10), isecs, msecs).getTime();
      } else {
        offsetmins = 0;
        if (r[8] !== 'Z') {
          offsetmins = parseInt(r[10], 10) * 60 + parseInt(r[11], 10);
          if (r[9] === '+') {
            offsetmins = 0 - offsetmins;
          }
        }
        return Date.UTC(parseInt(r[1], 10), parseInt(r[2], 10) - 1, parseInt(r[3], 10), parseInt(r[4], 10), parseInt(r[5], 10) + offsetmins, isecs, msecs);
      }
    } else {
      return new Date(parseInt(date, 10), 0, 1).getTime();
    }
  };

  Morris.Hover = (function() {
    Hover.defaults = {
      "class": 'morris-hover morris-default-style'
    };

    function Hover(options) {
      if (options == null) {
        options = {};
      }
      this.options = Morris.extend({}, Morris.Hover.defaults, options);
      this.el = document.createElement('div');
      this.el.className = this.options["class"];
      this.el.style.display = 'none';
      (this.options.parent = this.options.parent[0] || this.options.parent).appendChild(this.el);
    }

    Hover.prototype.update = function(html, x, y, centre_y) {
      if (!html) {
        return this.hide();
      } else {
        this.html(html);
        this.show();
        return this.moveTo(x, y, centre_y);
      }
    };

    Hover.prototype.html = function(content) {
      return this.el.innerHTML = content;
    };

    Hover.prototype.moveTo = function(x, y, centre_y) {
      var hoverHeight, hoverWidth, left, parentHeight, parentWidth, ref, top;
      ref = Morris.innerDimensions(this.options.parent), parentWidth = ref.width, parentHeight = ref.height;
      hoverWidth = this.el.offsetWidth;
      hoverHeight = this.el.offsetHeight;
      left = Math.min(Math.max(0, x - hoverWidth / 2), parentWidth - hoverWidth);
      if (y != null) {
        if (centre_y === true) {
          top = y - hoverHeight / 2;
          if (top < 0) {
            top = 0;
          }
        } else {
          top = y - hoverHeight - 10;
          if (top < 0) {
            top = y + 10;
            if (top + hoverHeight > parentHeight) {
              top = parentHeight / 2 - hoverHeight / 2;
            }
          }
        }
      } else {
        top = parentHeight / 2 - hoverHeight / 2;
      }
      this.el.style.left = parseInt(left) + "px";
      return this.el.style.top = parseInt(top) + "px";
    };

    Hover.prototype.show = function() {
      return this.el.style.display = '';
    };

    Hover.prototype.hide = function() {
      return this.el.style.display = 'none';
    };

    return Hover;

  })();

  Morris.Line = (function(superClass) {
    extend(Line, superClass);

    function Line(options) {
      this.hilight = bind(this.hilight, this);
      this.escapeHTML = bind(this.escapeHTML, this);
      this.onHoverOut = bind(this.onHoverOut, this);
      this.onHoverMove = bind(this.onHoverMove, this);
      this.onGridClick = bind(this.onGridClick, this);
      if (!(this instanceof Morris.Line)) {
        return new Morris.Line(options);
      }
      Line.__super__.constructor.call(this, options);
    }

    Line.prototype.init = function() {
      if (this.options.hideHover !== 'always') {
        this.hover = new Morris.Hover({
          parent: this.el
        });
        this.on('hovermove', this.onHoverMove);
        this.on('hoverout', this.onHoverOut);
        return this.on('gridclick', this.onGridClick);
      }
    };

    Line.prototype.defaults = {
      lineWidth: 3,
      pointSize: 4,
      pointSizeGrow: 3,
      lineColors: ['#2f7df6', '#53a351', '#f6c244', '#cb444a', '#4aa0b5', '#222529'],
      extraClassLine: '',
      extraClassCircle: '',
      pointStrokeWidths: [1],
      pointStrokeColors: ['#ffffff'],
      pointFillColors: [],
      pointSuperimposed: true,
      hoverOrdered: false,
      hoverReversed: false,
      smooth: true,
      lineType: {},
      shown: true,
      xLabels: 'auto',
      xLabelFormat: null,
      xLabelMargin: 0,
      verticalGrid: false,
      verticalGridHeight: 'full',
      verticalGridStartOffset: 0,
      verticalGridType: '',
      trendLine: false,
      trendLineType: 'linear',
      trendLineWidth: 2,
      trendLineWeight: false,
      trendLineColors: ['#689bc3', '#a2b3bf', '#64b764']
    };

    Line.prototype.calc = function() {
      this.calcPoints();
      return this.generatePaths();
    };

    Line.prototype.calcPoints = function() {
      var aa, count, i, idx, ii, index, k, len, len1, len2, point, ref, ref1, ref2, ref3, results, row, u, v, y, z;
      ref = this.data;
      for (k = 0, len = ref.length; k < len; k++) {
        row = ref[k];
        row._x = this.transX(row.x);
        row._y = (function() {
          var len1, ref1, results, u;
          ref1 = row.y;
          results = [];
          for (ii = u = 0, len1 = ref1.length; u < len1; ii = ++u) {
            y = ref1[ii];
            if (ii < this.options.ykeys.length - this.options.nbYkeys2) {
              if (y != null) {
                results.push(this.transY(y));
              } else {
                results.push(y);
              }
            } else {
              results.push(void 0);
            }
          }
          return results;
        }).call(this);
        row._y2 = (function() {
          var len1, ref1, results, u;
          ref1 = row.y;
          results = [];
          for (ii = u = 0, len1 = ref1.length; u < len1; ii = ++u) {
            y = ref1[ii];
            if (ii >= this.options.ykeys.length - this.options.nbYkeys2) {
              if (y != null) {
                results.push(this.transY2(y));
              } else {
                results.push(y);
              }
            } else {
              results.push(void 0);
            }
          }
          return results;
        }).call(this);
        row._ymax = Math.min.apply(Math, [this.bottom].concat((function() {
          var len1, ref1, results, u;
          ref1 = row._y;
          results = [];
          for (i = u = 0, len1 = ref1.length; u < len1; i = ++u) {
            y = ref1[i];
            if ((y != null) && this.hasToShow(i)) {
              results.push(y);
            }
          }
          return results;
        }).call(this)));
        row._ymax2 = Math.min.apply(Math, [this.bottom].concat((function() {
          var len1, ref1, results, u;
          ref1 = row._y2;
          results = [];
          for (i = u = 0, len1 = ref1.length; u < len1; i = ++u) {
            y = ref1[i];
            if ((y != null) && this.hasToShow(i)) {
              results.push(y);
            }
          }
          return results;
        }).call(this)));
      }
      ref1 = this.data;
      for (idx = u = 0, len1 = ref1.length; u < len1; idx = ++u) {
        row = ref1[idx];
        this.data[idx].label_x = [];
        this.data[idx].label_y = [];
        for (index = z = ref2 = this.options.ykeys.length - 1; ref2 <= 0 ? z <= 0 : z >= 0; index = ref2 <= 0 ? ++z : --z) {
          if (row._y[index] != null) {
            this.data[idx].label_x[index] = row._x;
            this.data[idx].label_y[index] = row._y[index] - 10;
          }
          if (row._y2 != null) {
            if (row._y2[index] != null) {
              this.data[idx].label_x[index] = row._x;
              this.data[idx].label_y[index] = row._y2[index] - 10;
            }
          }
        }
      }
      if (this.options.pointSuperimposed === !true) {
        ref3 = this.data;
        results = [];
        for (aa = 0, len2 = ref3.length; aa < len2; aa++) {
          row = ref3[aa];
          results.push((function() {
            var ab, ac, len3, len4, ref4, ref5, results1;
            ref4 = row._y;
            results1 = [];
            for (idx = ab = 0, len3 = ref4.length; ab < len3; idx = ++ab) {
              point = ref4[idx];
              count = 0;
              ref5 = row._y;
              for (i = ac = 0, len4 = ref5.length; ac < len4; i = ++ac) {
                v = ref5[i];
                if (point === v && typeof point === 'number') {
                  count++;
                }
              }
              if (count > 1) {
                row._y[idx] = row._y[idx] + count * (this.lineWidthForSeries(idx));
                if (this.lineWidthForSeries(idx) > 1) {
                  results1.push(row._y[idx] = row._y[idx] - 1);
                } else {
                  results1.push(void 0);
                }
              } else {
                results1.push(void 0);
              }
            }
            return results1;
          }).call(this));
        }
        return results;
      }
    };

    Line.prototype.hitTest = function(x) {
      var index, k, len, r, ref;
      if (this.data.length === 0) {
        return null;
      }
      ref = this.data.slice(1);
      for (index = k = 0, len = ref.length; k < len; index = ++k) {
        r = ref[index];
        if (x < (r._x + this.data[index]._x) / 2) {
          break;
        }
      }
      return index;
    };

    Line.prototype.onGridClick = function(x, y) {
      var index;
      index = this.hitTest(x);
      return this.fire('click', index, this.data[index].src, x, y);
    };

    Line.prototype.onHoverMove = function(x, y) {
      var index;
      index = this.hitTest(x);
      return this.displayHoverForRow(index);
    };

    Line.prototype.onHoverOut = function() {
      if (this.options.hideHover !== false) {
        return this.displayHoverForRow(null);
      }
    };

    Line.prototype.displayHoverForRow = function(index) {
      var ref;
      if (index != null) {
        (ref = this.hover).update.apply(ref, this.hoverContentForRow(index));
        return this.hilight(index);
      } else {
        this.hover.hide();
        return this.hilight();
      }
    };

    Line.prototype.escapeHTML = function(string) {
      var map, reg;
      map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;'
      };
      reg = /[&<>"'\/]/ig;
      return string.replace(reg, (function(_this) {
        return function(match) {
          return map[match];
        };
      })(this));
    };

    Line.prototype.hoverContentForRow = function(index) {
      var aa, axis, content, j, jj, k, len, len1, max, max_pos, order, ref, ref1, ref2, row, u, y, yy, z;
      row = this.data[index];
      content = "";
      order = [];
      if (this.options.hoverOrdered === true) {
        ref = row.y;
        for (jj = k = 0, len = ref.length; k < len; jj = ++k) {
          yy = ref[jj];
          max = null;
          max_pos = -1;
          ref1 = row.y;
          for (j = u = 0, len1 = ref1.length; u < len1; j = ++u) {
            y = ref1[j];
            if (indexOf.call(order, j) < 0) {
              if (max <= y || max === null) {
                max = y;
                max_pos = j;
              }
            }
          }
          order.push(max_pos);
        }
      } else {
        ref2 = row.y;
        for (jj = z = ref2.length - 1; z >= 0; jj = z += -1) {
          yy = ref2[jj];
          order.push(jj);
        }
      }
      if (this.options.hoverReversed === true) {
        order = order.reverse();
      }
      axis = -1;
      for (aa = order.length - 1; aa >= 0; aa += -1) {
        j = order[aa];
        if (this.options.labels[j] === false) {
          continue;
        }
        if (row.y[j] !== void 0 && axis === -1) {
          axis = j;
        }
        content = ("<div class='morris-hover-point' style='color: " + (this.colorFor(row, j, 'label')) + "'>\n  " + this.options.labels[j] + ":\n  " + (this.yLabelFormat(row.y[j], j)) + "\n</div>") + content;
      }
      content = "<div class='morris-hover-row-label'>" + this.escapeHTML(row.label) + "</div>" + content;
      if (typeof this.options.hoverCallback === 'function') {
        content = this.options.hoverCallback(index, this.options, content, row.src);
      }
      if (axis > this.options.nbYkeys2) {
        return [content, row._x, row._ymax2];
      } else {
        return [content, row._x, row._ymax];
      }
    };

    Line.prototype.generatePaths = function() {
      var coords, i, lineType, nb, r, smooth;
      return this.paths = (function() {
        var k, ref, ref1, results;
        results = [];
        for (i = k = 0, ref = this.options.ykeys.length; 0 <= ref ? k < ref : k > ref; i = 0 <= ref ? ++k : --k) {
          smooth = typeof this.options.smooth === "boolean" ? this.options.smooth : (ref1 = this.options.ykeys[i], indexOf.call(this.options.smooth, ref1) >= 0);
          lineType = smooth ? 'smooth' : 'jagged';
          if (typeof this.options.lineType === "string") {
            lineType = this.options.lineType;
          } else {

          }
          if (this.options.lineType[this.options.ykeys[i]] !== void 0) {
            lineType = this.options.lineType[this.options.ykeys[i]];
          }
          nb = this.options.ykeys.length - this.options.nbYkeys2;
          if (i < nb) {
            coords = (function() {
              var len, ref2, results1, u;
              ref2 = this.data;
              results1 = [];
              for (u = 0, len = ref2.length; u < len; u++) {
                r = ref2[u];
                if (r._y[i] !== void 0) {
                  results1.push({
                    x: r._x,
                    y: r._y[i]
                  });
                }
              }
              return results1;
            }).call(this);
          } else {
            coords = (function() {
              var len, ref2, results1, u;
              ref2 = this.data;
              results1 = [];
              for (u = 0, len = ref2.length; u < len; u++) {
                r = ref2[u];
                if (r._y2[i] !== void 0) {
                  results1.push({
                    x: r._x,
                    y: r._y2[i]
                  });
                }
              }
              return results1;
            }).call(this);
          }
          if (coords.length > 1) {
            results.push(Morris.Line.createPath(coords, lineType, this.bottom, i, this.options.ykeys.length, this.options.lineWidth));
          } else {
            results.push(null);
          }
        }
        return results;
      }).call(this);
    };

    Line.prototype.draw = function() {
      var ref;
      if ((ref = this.options.axes) === true || ref === 'both' || ref === 'x') {
        this.drawXAxis();
      }
      this.drawSeries();
      if (this.options.hideHover === false) {
        return this.displayHoverForRow(this.data.length - 1);
      }
    };

    Line.prototype.drawXAxis = function() {
      var drawLabel, k, l, labels, len, len1, lines, prevAngleMargin, prevLabelMargin, results, row, u, ypos;
      ypos = this.bottom + this.options.padding / 2;
      prevLabelMargin = null;
      prevAngleMargin = null;
      drawLabel = (function(_this) {
        return function(labelText, xpos) {
          var label, labelBox, margin, offset, textBox;
          label = _this.drawXAxisLabel(_this.transX(xpos), ypos, labelText);
          textBox = label.getBBox();
          label.transform("r" + (-_this.options.xLabelAngle));
          labelBox = label.getBBox();
          label.transform("t0," + (labelBox.height / 2) + "...");
          if (_this.options.xLabelAngle !== 0) {
            offset = -0.5 * textBox.width * Math.cos(_this.options.xLabelAngle * Math.PI / 180.0);
            label.transform("t" + offset + ",0...");
          }
          labelBox = label.getBBox();
          if (((prevLabelMargin == null) || prevLabelMargin >= labelBox.x + labelBox.width || (prevAngleMargin != null) && prevAngleMargin >= labelBox.x) && labelBox.x >= 0 && (labelBox.x + labelBox.width) < Morris.dimensions(_this.el).width) {
            if (_this.options.xLabelAngle !== 0) {
              margin = 1.25 * _this.options.gridTextSize / Math.sin(_this.options.xLabelAngle * Math.PI / 180.0);
              prevAngleMargin = labelBox.x - margin;
            }
            prevLabelMargin = labelBox.x - _this.options.xLabelMargin;
            if (_this.options.verticalGrid === true) {
              return _this.drawVerticalGridLine(xpos);
            }
          } else {
            return label.remove();
          }
        };
      })(this);
      if (this.options.parseTime) {
        if (this.data.length === 1 && this.options.xLabels === 'auto') {
          labels = [[this.data[0].label, this.data[0].x]];
        } else {
          labels = Morris.labelSeries(this.xmin, this.xmax, this.width, this.options.xLabels, this.options.xLabelFormat);
        }
      } else if (this.options.customLabels) {
        labels = (function() {
          var k, len, ref, results;
          ref = this.options.customLabels;
          results = [];
          for (k = 0, len = ref.length; k < len; k++) {
            row = ref[k];
            results.push([row.label, row.x]);
          }
          return results;
        }).call(this);
      } else {
        labels = (function() {
          var k, len, ref, results;
          ref = this.data;
          results = [];
          for (k = 0, len = ref.length; k < len; k++) {
            row = ref[k];
            results.push([row.label, row.x]);
          }
          return results;
        }).call(this);
      }
      labels.reverse();
      for (k = 0, len = labels.length; k < len; k++) {
        l = labels[k];
        drawLabel(l[0], l[1]);
      }
      if (typeof this.options.verticalGrid === 'string') {
        lines = Morris.labelSeries(this.xmin, this.xmax, this.width, this.options.verticalGrid);
        results = [];
        for (u = 0, len1 = lines.length; u < len1; u++) {
          l = lines[u];
          results.push(this.drawVerticalGridLine(l[1]));
        }
        return results;
      }
    };

    Line.prototype.drawVerticalGridLine = function(xpos) {
      var yEnd, yStart;
      xpos = Math.floor(this.transX(xpos)) + 0.5;
      yStart = this.yStart + this.options.verticalGridStartOffset;
      if (this.options.verticalGridHeight === 'full') {
        yEnd = this.yEnd;
      } else {
        yEnd = this.yStart - this.options.verticalGridHeight;
      }
      return this.drawGridLineVert("M" + xpos + "," + yStart + "V" + yEnd);
    };

    Line.prototype.drawGridLineVert = function(path) {
      return this.raphael.path(path).attr('stroke', this.options.gridLineColor).attr('stroke-width', this.options.gridStrokeWidth).attr('stroke-dasharray', this.options.verticalGridType);
    };

    Line.prototype.drawSeries = function() {
      var i, k, ref, ref1, results, u;
      this.seriesPoints = [];
      for (i = k = ref = this.options.ykeys.length - 1; ref <= 0 ? k <= 0 : k >= 0; i = ref <= 0 ? ++k : --k) {
        if (this.hasToShow(i)) {
          if (this.options.trendLine !== false && this.options.trendLine === true || this.options.trendLine[i] === true) {
            if (this.data.length > 0) {
              this._drawTrendLine(i);
            }
          }
          this._drawLineFor(i);
        }
      }
      results = [];
      for (i = u = ref1 = this.options.ykeys.length - 1; ref1 <= 0 ? u <= 0 : u >= 0; i = ref1 <= 0 ? ++u : --u) {
        if (this.hasToShow(i)) {
          results.push(this._drawPointFor(i));
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Line.prototype._drawPointFor = function(index) {
      var circle, idx, k, len, ref, results, row;
      this.seriesPoints[index] = [];
      ref = this.data;
      results = [];
      for (idx = k = 0, len = ref.length; k < len; idx = ++k) {
        row = ref[idx];
        circle = null;
        if (row._y[index] != null) {
          circle = this.drawLinePoint(row._x, row._y[index], this.colorFor(row, index, 'point'), index);
        }
        if (row._y2 != null) {
          if (row._y2[index] != null) {
            circle = this.drawLinePoint(row._x, row._y2[index], this.colorFor(row, index, 'point'), index);
          }
        }
        results.push(this.seriesPoints[index].push(circle));
      }
      return results;
    };

    Line.prototype._drawLineFor = function(index) {
      var path;
      path = this.paths[index];
      if (path !== null) {
        return this.drawLinePath(path, this.colorFor(null, index, 'line'), index);
      }
    };

    Line.prototype._drawTrendLine = function(index) {
      var a, aa, b, data, datapoints, i, k, len, path, plots, ref, reg, sum_x, sum_xx, sum_xy, sum_y, t_off_x, t_x, t_y, u, val, weight, x, y, z;
      sum_x = 0;
      sum_y = 0;
      sum_xx = 0;
      sum_xy = 0;
      datapoints = 0;
      plots = [];
      ref = this.data;
      for (i = k = 0, len = ref.length; k < len; i = ++k) {
        val = ref[i];
        x = val.x;
        y = val.y[index];
        if (y != null) {
          plots.push([x, y]);
          if (this.options.trendLineWeight === false) {
            weight = 1;
          } else {
            weight = this.options.data[i][this.options.trendLineWeight];
          }
          datapoints += weight;
          sum_x += x * weight;
          sum_y += y * weight;
          sum_xx += x * x * weight;
          sum_xy += x * y * weight;
        }
      }
      a = (datapoints * sum_xy - sum_x * sum_y) / (datapoints * sum_xx - sum_x * sum_x);
      b = (sum_y / datapoints) - ((a * sum_x) / datapoints);
      data = [{}, {}];
      data[0].x = this.transX(this.data[0].x);
      data[0].y = this.transY(this.data[0].x * a + b);
      data[1].x = this.transX(this.data[this.data.length - 1].x);
      data[1].y = this.transY(this.data[this.data.length - 1].x * a + b);
      if (this.options.trendLineType !== 'linear') {
        if (typeof regression === 'function') {
          t_off_x = (this.xmax - this.xmin) / 30;
          data = [];
          if (this.options.trendLineType === 'polynomial') {
            reg = regression('polynomial', plots, 2);
            for (i = u = 0; u <= 30; i = ++u) {
              t_x = this.xmin + i * t_off_x;
              t_y = reg.equation[2] * t_x * t_x + reg.equation[1] * t_x + reg.equation[0];
              data.push({
                x: this.transX(t_x),
                y: this.transY(t_y)
              });
            }
          } else if (this.options.trendLineType === 'logarithmic') {
            reg = regression('logarithmic', plots);
            for (i = z = 0; z <= 30; i = ++z) {
              t_x = this.xmin + i * t_off_x;
              t_y = reg.equation[0] + reg.equation[1] * Math.log(t_x);
              data.push({
                x: this.transX(t_x),
                y: this.transY(t_y)
              });
            }
          } else if (this.options.trendLineType === 'exponential') {
            reg = regression('exponential', plots);
            for (i = aa = 0; aa <= 30; i = ++aa) {
              t_x = this.xmin + i * t_off_x;
              t_y = reg.equation[0] + Math.exp(reg.equation[1] * t_x);
              data.push({
                x: this.transX(t_x),
                y: this.transY(t_y)
              });
            }
          }
          console.log('Regression formula is: ' + reg.string + ', r2:' + reg.r2);
        } else {
          console.log('Warning: regression() is undefined, please ensure that regression.js is loaded');
        }
      }
      if (!isNaN(a)) {
        path = Morris.Line.createPath(data, 'jagged', this.bottom);
        return path = this.raphael.path(path).attr('stroke', this.colorFor(null, index, 'trendLine')).attr('stroke-width', this.options.trendLineWidth);
      }
    };

    Line.createPath = function(coords, lineType, bottom, index, nb, lineWidth) {
      var coord, g, grads, i, ix, k, len, lg, path, prevCoord, x1, x2, y1, y2;
      path = "";
      if (lineType === 'smooth') {
        grads = Morris.Line.gradients(coords);
      }
      prevCoord = {
        y: null
      };
      for (i = k = 0, len = coords.length; k < len; i = ++k) {
        coord = coords[i];
        if (coord.y != null) {
          if (prevCoord.y != null) {
            if (lineType === 'smooth') {
              g = grads[i];
              lg = grads[i - 1];
              ix = (coord.x - prevCoord.x) / 4;
              x1 = prevCoord.x + ix;
              y1 = Math.min(bottom, prevCoord.y + ix * lg);
              x2 = coord.x - ix;
              y2 = Math.min(bottom, coord.y - ix * g);
              path += "C" + x1 + "," + y1 + "," + x2 + "," + y2 + "," + coord.x + "," + coord.y;
            } else if (lineType === 'jagged') {
              path += "L" + coord.x + "," + coord.y;
            } else if (lineType === 'step') {
              path += "L" + coord.x + "," + prevCoord.y;
              path += "L" + coord.x + "," + coord.y;
            } else if (lineType === 'stepNoRiser') {
              path += "L" + coord.x + "," + prevCoord.y;
              path += "M" + coord.x + "," + coord.y;
            } else if (lineType === 'vertical') {
              path += "L" + (prevCoord.x - (nb - 1) * (lineWidth / nb) + index * lineWidth) + "," + prevCoord.y;
              path += "L" + (prevCoord.x - (nb - 1) * (lineWidth / nb) + index * lineWidth) + "," + bottom;
              path += "M" + (coord.x - (nb - 1) * (lineWidth / nb) + index * lineWidth) + "," + bottom;
              if (coords.length === (i + 1)) {
                path += "L" + (coord.x - (nb - 1) * (lineWidth / nb) + index * lineWidth) + "," + coord.y;
                path += "L" + (coord.x - (nb - 1) * (lineWidth / nb) + index * lineWidth) + "," + bottom;
              }
            }
          } else {
            if (lineType !== 'smooth' || (grads[i] != null)) {
              path += "M" + coord.x + "," + coord.y;
            }
          }
        }
        prevCoord = coord;
      }
      return path;
    };

    Line.gradients = function(coords) {
      var coord, grad, i, k, len, nextCoord, prevCoord, results;
      grad = function(a, b) {
        return (a.y - b.y) / (a.x - b.x);
      };
      results = [];
      for (i = k = 0, len = coords.length; k < len; i = ++k) {
        coord = coords[i];
        if (coord.y != null) {
          nextCoord = coords[i + 1] || {
            y: null
          };
          prevCoord = coords[i - 1] || {
            y: null
          };
          if ((prevCoord.y != null) && (nextCoord.y != null)) {
            results.push(grad(prevCoord, nextCoord));
          } else if (prevCoord.y != null) {
            results.push(grad(prevCoord, coord));
          } else if (nextCoord.y != null) {
            results.push(grad(coord, nextCoord));
          } else {
            results.push(null);
          }
        } else {
          results.push(null);
        }
      }
      return results;
    };

    Line.prototype.hilight = function(index) {
      var i, k, ref, ref1, u;
      if (this.prevHilight !== null && this.prevHilight !== index) {
        for (i = k = 0, ref = this.seriesPoints.length - 1; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
          if (this.hasToShow(i) && this.seriesPoints[i][this.prevHilight]) {
            this.seriesPoints[i][this.prevHilight].animate(this.pointShrinkSeries(i));
          }
        }
      }
      if (index !== null && this.prevHilight !== index) {
        for (i = u = 0, ref1 = this.seriesPoints.length - 1; 0 <= ref1 ? u <= ref1 : u >= ref1; i = 0 <= ref1 ? ++u : --u) {
          if (this.hasToShow(i) && this.seriesPoints[i][index]) {
            this.seriesPoints[i][index].animate(this.pointGrowSeries(i));
          }
        }
      }
      return this.prevHilight = index;
    };

    Line.prototype.colorFor = function(row, sidx, type) {
      if (typeof this.options.lineColors === 'function') {
        return this.options.lineColors.call(this, row, sidx, type);
      } else if (type === 'point') {
        return this.options.pointFillColors[sidx % this.options.pointFillColors.length] || this.options.lineColors[sidx % this.options.lineColors.length];
      } else if (type === 'trendLine') {
        return this.options.trendLineColors[sidx % this.options.trendLineColors.length];
      } else {
        return this.options.lineColors[sidx % this.options.lineColors.length];
      }
    };

    Line.prototype.drawLinePath = function(path, lineColor, lineIndex) {
      var ii, k, len, rPath, ref, row, row_x, straightPath;
      if (this.options.animate) {
        straightPath = '';
        ref = this.data;
        for (ii = k = 0, len = ref.length; k < len; ii = ++k) {
          row = ref[ii];
          if (straightPath === '') {
            if (lineIndex >= this.options.ykeys.length - this.options.nbYkeys2) {
              if (row._y2[lineIndex] != null) {
                straightPath = 'M' + row._x + ',' + this.transY2(this.ymin2);
              }
            } else if (row._y[lineIndex] != null) {
              if (this.options.lineType !== 'vertical') {
                straightPath = 'M' + row._x + ',' + this.transY(this.ymin);
              } else {
                straightPath = 'M' + row._x + ',' + this.transY(0) + 'L' + row._x + ',' + this.transY(0) + 'L' + row._x + ',' + this.transY(0);
              }
            }
          } else {
            if (lineIndex >= this.options.ykeys.length - this.options.nbYkeys2) {
              if (row._y2[lineIndex] != null) {
                straightPath += ',' + row._x + ',' + this.transY2(this.ymin2);
                if (this.options.lineType === 'step') {
                  straightPath += ',' + row._x + ',' + this.transY2(this.ymin2);
                }
              }
            } else if (row._y[lineIndex] != null) {
              if (this.options.lineType !== 'vertical') {
                straightPath += ',' + row._x + ',' + this.transY(this.ymin);
              } else {
                row_x = row._x - (this.options.ykeys.length - 1) * (this.options.lineWidth / this.options.ykeys.length) + lineIndex * this.options.lineWidth;
                straightPath += 'M' + row_x + ',' + this.transY(0) + 'L' + row_x + ',' + this.transY(0) + 'L' + row_x + ',' + this.transY(0);
              }
              if (this.options.lineType === 'step') {
                straightPath += ',' + row._x + ',' + this.transY(this.ymin);
              }
            }
          }
        }
        rPath = this.raphael.path(straightPath).attr('stroke', lineColor).attr('stroke-width', this.lineWidthForSeries(lineIndex)).attr('class', this.options.extraClassLine).attr('class', 'line_' + lineIndex);
        if (this.options.cumulative) {
          return (function(_this) {
            return function(rPath, path) {
              return rPath.animate({
                path: path
              }, 600, '<>');
            };
          })(this)(rPath, path);
        } else {
          return (function(_this) {
            return function(rPath, path) {
              return rPath.animate({
                path: path
              }, 500, '<>');
            };
          })(this)(rPath, path);
        }
      } else {
        return this.raphael.path(path).attr('stroke', lineColor).attr('stroke-width', this.lineWidthForSeries(lineIndex)).attr('class', this.options.extraClassLine).attr('class', 'line_' + lineIndex);
      }
    };

    Line.prototype.drawLinePoint = function(xPos, yPos, pointColor, lineIndex) {
      return this.raphael.circle(xPos, yPos, this.pointSizeForSeries(lineIndex)).attr('fill', pointColor).attr('stroke-width', this.pointStrokeWidthForSeries(lineIndex)).attr('stroke', this.pointStrokeColorForSeries(lineIndex)).attr('class', this.options.extraClassCircle).attr('class', 'circle_line_' + lineIndex);
    };

    Line.prototype.pointStrokeWidthForSeries = function(index) {
      return this.options.pointStrokeWidths[index % this.options.pointStrokeWidths.length];
    };

    Line.prototype.pointStrokeColorForSeries = function(index) {
      return this.options.pointStrokeColors[index % this.options.pointStrokeColors.length];
    };

    Line.prototype.lineWidthForSeries = function(index) {
      if (this.options.lineWidth instanceof Array) {
        return this.options.lineWidth[index % this.options.lineWidth.length];
      } else {
        return this.options.lineWidth;
      }
    };

    Line.prototype.pointSizeForSeries = function(index) {
      if (this.options.pointSize instanceof Array) {
        return this.options.pointSize[index % this.options.pointSize.length];
      } else {
        return this.options.pointSize;
      }
    };

    Line.prototype.pointGrowSeries = function(index) {
      if (this.pointSizeForSeries(index) === 0) {
        return;
      }
      return Raphael.animation({
        r: this.pointSizeForSeries(index) + this.options.pointSizeGrow
      }, 25, 'linear');
    };

    Line.prototype.pointShrinkSeries = function(index) {
      return Raphael.animation({
        r: this.pointSizeForSeries(index)
      }, 25, 'linear');
    };

    return Line;

  })(Morris.Grid);

  Morris.labelSeries = function(dmin, dmax, pxwidth, specName, xLabelFormat) {
    var d, d0, ddensity, k, len, name, ref, ret, s, spec, t;
    ddensity = 200 * (dmax - dmin) / pxwidth;
    d0 = new Date(dmin);
    spec = Morris.LABEL_SPECS[specName];
    if (spec === void 0) {
      ref = Morris.AUTO_LABEL_ORDER;
      for (k = 0, len = ref.length; k < len; k++) {
        name = ref[k];
        s = Morris.LABEL_SPECS[name];
        if (ddensity >= s.span) {
          spec = s;
          break;
        }
      }
    }
    if (spec === void 0) {
      spec = Morris.LABEL_SPECS["second"];
    }
    if (xLabelFormat) {
      spec = Morris.extend({}, spec, {
        fmt: xLabelFormat
      });
    }
    d = spec.start(d0);
    ret = [];
    while ((t = d.getTime()) <= dmax) {
      if (t >= dmin) {
        ret.push([spec.fmt(d), t]);
      }
      spec.incr(d);
    }
    return ret;
  };

  minutesSpecHelper = function(interval) {
    return {
      span: interval * 60 * 1000,
      start: function(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours());
      },
      fmt: function(d) {
        return (Morris.pad2(d.getHours())) + ":" + (Morris.pad2(d.getMinutes()));
      },
      incr: function(d) {
        return d.setUTCMinutes(d.getUTCMinutes() + interval);
      }
    };
  };

  secondsSpecHelper = function(interval) {
    return {
      span: interval * 1000,
      start: function(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
      },
      fmt: function(d) {
        return (Morris.pad2(d.getHours())) + ":" + (Morris.pad2(d.getMinutes())) + ":" + (Morris.pad2(d.getSeconds()));
      },
      incr: function(d) {
        return d.setUTCSeconds(d.getUTCSeconds() + interval);
      }
    };
  };

  Morris.LABEL_SPECS = {
    "decade": {
      span: 172800000000,
      start: function(d) {
        return new Date(d.getFullYear() - d.getFullYear() % 10, 0, 1);
      },
      fmt: function(d) {
        return "" + (d.getFullYear());
      },
      incr: function(d) {
        return d.setFullYear(d.getFullYear() + 10);
      }
    },
    "year": {
      span: 17280000000,
      start: function(d) {
        return new Date(d.getFullYear(), 0, 1);
      },
      fmt: function(d) {
        return "" + (d.getFullYear());
      },
      incr: function(d) {
        return d.setFullYear(d.getFullYear() + 1);
      }
    },
    "month": {
      span: 2419200000,
      start: function(d) {
        return new Date(d.getFullYear(), d.getMonth(), 1);
      },
      fmt: function(d) {
        return (d.getFullYear()) + "-" + (Morris.pad2(d.getMonth() + 1));
      },
      incr: function(d) {
        return d.setMonth(d.getMonth() + 1);
      }
    },
    "week": {
      span: 604800000,
      start: function(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      },
      fmt: function(d) {
        return (d.getFullYear()) + "-" + (Morris.pad2(d.getMonth() + 1)) + "-" + (Morris.pad2(d.getDate()));
      },
      incr: function(d) {
        return d.setDate(d.getDate() + 7);
      }
    },
    "day": {
      span: 86400000,
      start: function(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      },
      fmt: function(d) {
        return (d.getFullYear()) + "-" + (Morris.pad2(d.getMonth() + 1)) + "-" + (Morris.pad2(d.getDate()));
      },
      incr: function(d) {
        return d.setDate(d.getDate() + 1);
      }
    },
    "hour": minutesSpecHelper(60),
    "30min": minutesSpecHelper(30),
    "15min": minutesSpecHelper(15),
    "10min": minutesSpecHelper(10),
    "5min": minutesSpecHelper(5),
    "minute": minutesSpecHelper(1),
    "30sec": secondsSpecHelper(30),
    "15sec": secondsSpecHelper(15),
    "10sec": secondsSpecHelper(10),
    "5sec": secondsSpecHelper(5),
    "second": secondsSpecHelper(1)
  };

  Morris.AUTO_LABEL_ORDER = ["decade", "year", "month", "week", "day", "hour", "30min", "15min", "10min", "5min", "minute", "30sec", "15sec", "10sec", "5sec", "second"];

  Morris.Area = (function(superClass) {
    var areaDefaults;

    extend(Area, superClass);

    areaDefaults = {
      fillOpacity: 'auto',
      behaveLikeLine: false,
      belowArea: true,
      areaColors: []
    };

    function Area(options) {
      var areaOptions;
      areaOptions = Morris.extend({}, areaDefaults, options);
      Area.__super__.constructor.call(this, areaOptions);
      if (!(this instanceof Morris.Area)) {
        return new Morris.Area(options);
      }
      this.cumulative = !areaOptions.behaveLikeLine;
      if (areaOptions.fillOpacity === 'auto') {
        areaOptions.fillOpacity = areaOptions.behaveLikeLine ? .8 : 1;
      }
    }

    Area.prototype.calcPoints = function() {
      var i, idx, index, k, len, len1, ref, ref1, results, row, total, u, y;
      ref = this.data;
      for (k = 0, len = ref.length; k < len; k++) {
        row = ref[k];
        row._x = this.transX(row.x);
        total = 0;
        row._y = (function() {
          var len1, ref1, results, u;
          ref1 = row.y;
          results = [];
          for (u = 0, len1 = ref1.length; u < len1; u++) {
            y = ref1[u];
            if (this.options.behaveLikeLine) {
              if (y != null) {
                results.push(this.transY(y));
              } else {
                results.push(y);
              }
            } else {
              if (y != null) {
                total += y || 0;
                results.push(this.transY(total));
              } else {
                results.push(void 0);
              }
            }
          }
          return results;
        }).call(this);
        row._ymax = Math.max.apply(Math, [].concat((function() {
          var len1, ref1, results, u;
          ref1 = row._y;
          results = [];
          for (i = u = 0, len1 = ref1.length; u < len1; i = ++u) {
            y = ref1[i];
            if (y != null) {
              results.push(y);
            }
          }
          return results;
        })()));
      }
      ref1 = this.data;
      results = [];
      for (idx = u = 0, len1 = ref1.length; u < len1; idx = ++u) {
        row = ref1[idx];
        this.data[idx].label_x = [];
        this.data[idx].label_y = [];
        results.push((function() {
          var ref2, results1, z;
          results1 = [];
          for (index = z = ref2 = this.options.ykeys.length - 1; ref2 <= 0 ? z <= 0 : z >= 0; index = ref2 <= 0 ? ++z : --z) {
            if (row._y[index] != null) {
              this.data[idx].label_x[index] = row._x;
              this.data[idx].label_y[index] = row._y[index] - 10;
            }
            if (row._y2 != null) {
              if (row._y2[index] != null) {
                this.data[idx].label_x[index] = row._x;
                results1.push(this.data[idx].label_y[index] = row._y2[index] - 10);
              } else {
                results1.push(void 0);
              }
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    Area.prototype.drawSeries = function() {
      var aa, i, k, len, len1, range, ref, ref1, results, results1, results2, u, z;
      this.seriesPoints = [];
      if (this.options.behaveLikeLine) {
        range = (function() {
          results = [];
          for (var k = 0, ref = this.options.ykeys.length - 1; 0 <= ref ? k <= ref : k >= ref; 0 <= ref ? k++ : k--){ results.push(k); }
          return results;
        }).apply(this);
      } else {
        range = (function() {
          results1 = [];
          for (var u = ref1 = this.options.ykeys.length - 1; ref1 <= 0 ? u <= 0 : u >= 0; ref1 <= 0 ? u++ : u--){ results1.push(u); }
          return results1;
        }).apply(this);
      }
      for (z = 0, len = range.length; z < len; z++) {
        i = range[z];
        this._drawFillFor(i);
      }
      results2 = [];
      for (aa = 0, len1 = range.length; aa < len1; aa++) {
        i = range[aa];
        this._drawLineFor(i);
        results2.push(this._drawPointFor(i));
      }
      return results2;
    };

    Area.prototype._drawFillFor = function(index) {
      var coords, path, pathBelow, r;
      path = this.paths[index];
      if (path !== null) {
        if (this.options.belowArea === true) {
          path = path + ("L" + (this.transX(this.xmax)) + "," + this.bottom + "L" + (this.transX(this.xmin)) + "," + this.bottom + "Z");
          return this.drawFilledPath(path, this.fillForSeries(index), index);
        } else {
          coords = (function() {
            var k, ref, results;
            ref = this.data;
            results = [];
            for (k = ref.length - 1; k >= 0; k += -1) {
              r = ref[k];
              if (r._y[0] !== void 0) {
                results.push({
                  x: r._x,
                  y: r._y[0]
                });
              }
            }
            return results;
          }).call(this);
          pathBelow = Morris.Line.createPath(coords, 'smooth', this.bottom);
          path = path + "L" + pathBelow.slice(1);
          return this.drawFilledPath(path, this.fillForSeries(index), index);
        }
      }
    };

    Area.prototype.fillForSeries = function(i) {
      var color;
      if (this.options.areaColors.length === 0) {
        this.options.areaColors = this.options.lineColors;
      }
      color = Raphael.rgb2hsl(this.options.areaColors[i % this.options.areaColors.length]);
      return Raphael.hsl(color.h, this.options.behaveLikeLine ? color.s * 0.9 : color.s * 0.75, Math.min(0.98, this.options.behaveLikeLine ? color.l * 1.2 : color.l * 1.25));
    };

    Area.prototype.drawFilledPath = function(path, fill, areaIndex) {
      var coords, pathBelow, r, rPath, straightPath;
      if (this.options.animate) {
        coords = (function() {
          var k, len, ref, results;
          ref = this.data;
          results = [];
          for (k = 0, len = ref.length; k < len; k++) {
            r = ref[k];
            if (r._y[areaIndex] !== void 0) {
              results.push({
                x: r._x,
                y: this.transY(0)
              });
            }
          }
          return results;
        }).call(this);
        straightPath = Morris.Line.createPath(coords, 'smooth', this.bottom);
        if (this.options.belowArea === true) {
          straightPath = straightPath + ("L" + (this.transX(this.xmax)) + "," + this.bottom + "L" + (this.transX(this.xmin)) + "," + this.bottom + "Z");
        } else {
          coords = (function() {
            var k, ref, results;
            ref = this.data;
            results = [];
            for (k = ref.length - 1; k >= 0; k += -1) {
              r = ref[k];
              if (r._y[areaIndex] !== void 0) {
                results.push({
                  x: r._x,
                  y: this.transY(0)
                });
              }
            }
            return results;
          }).call(this);
          pathBelow = Morris.Line.createPath(coords, 'smooth', this.bottom);
          straightPath = straightPath + "L" + pathBelow.slice(1);
        }
        straightPath += 'Z';
        rPath = this.raphael.path(straightPath).attr('fill', fill).attr('fill-opacity', this.options.fillOpacity).attr('stroke', 'none');
        return (function(_this) {
          return function(rPath, path) {
            return rPath.animate({
              path: path
            }, 500, '<>');
          };
        })(this)(rPath, path);
      } else {
        return this.raphael.path(path).attr('fill', fill).attr('fill-opacity', this.options.fillOpacity).attr('stroke', 'none');
      }
    };

    return Area;

  })(Morris.Line);

  Morris.Bar = (function(superClass) {
    extend(Bar, superClass);

    function Bar(options) {
      this.escapeHTML = bind(this.escapeHTML, this);
      this.onHoverOut = bind(this.onHoverOut, this);
      this.onHoverMove = bind(this.onHoverMove, this);
      this.onGridClick = bind(this.onGridClick, this);
      if (!(this instanceof Morris.Bar)) {
        return new Morris.Bar(options);
      }
      Bar.__super__.constructor.call(this, Morris.extend({}, options, {
        parseTime: false
      }));
    }

    Bar.prototype.init = function() {
      this.cumulative = this.options.stacked;
      if (this.options.hideHover !== 'always') {
        this.hover = new Morris.Hover({
          parent: this.el
        });
        this.on('hovermove', this.onHoverMove);
        this.on('hoverout', this.onHoverOut);
        return this.on('gridclick', this.onGridClick);
      }
    };

    Bar.prototype.defaults = {
      barSizeRatio: 0.75,
      pointSize: 4,
      lineWidth: 3,
      barGap: 3,
      barColors: ['#2f7df6', '#53a351', '#f6c244', '#cb444a', '#4aa0b5', '#222529'],
      barOpacity: 1.0,
      barHighlightOpacity: 1.0,
      highlightSpeed: 150,
      barRadius: [0, 0, 0, 0],
      xLabelMargin: 0,
      horizontal: false,
      stacked: false,
      shown: true,
      showZero: true,
      inBarValue: false,
      inBarValueTextColor: 'white',
      inBarValueMinTopMargin: 1,
      inBarValueRightMargin: 4,
      rightAxisBar: false
    };

    Bar.prototype.calc = function() {
      var ref;
      this.calcBars();
      if (this.options.hideHover === false) {
        return (ref = this.hover).update.apply(ref, this.hoverContentForRow(this.data.length - 1));
      }
    };

    Bar.prototype.calcBars = function() {
      var idx, ii, k, len, ref, results, row, y;
      ref = this.data;
      results = [];
      for (idx = k = 0, len = ref.length; k < len; idx = ++k) {
        row = ref[idx];
        row._x = this.xStart + this.xSize * (idx + 0.5) / this.data.length;
        row._y = (function() {
          var len1, ref1, results1, u;
          ref1 = row.y;
          results1 = [];
          for (ii = u = 0, len1 = ref1.length; u < len1; ii = ++u) {
            y = ref1[ii];
            if (ii < this.options.ykeys.length - this.options.nbYkeys2) {
              if (y != null) {
                results1.push(this.transY(y));
              } else {
                results1.push(null);
              }
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        }).call(this);
        results.push(row._y2 = (function() {
          var len1, ref1, results1, u;
          ref1 = row.y;
          results1 = [];
          for (ii = u = 0, len1 = ref1.length; u < len1; ii = ++u) {
            y = ref1[ii];
            if (ii >= this.options.ykeys.length - this.options.nbYkeys2) {
              if (y != null) {
                results1.push(this.transY2(y));
              } else {
                results1.push(null);
              }
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    Bar.prototype.draw = function() {
      var ref;
      if ((ref = this.options.axes) === true || ref === 'both' || ref === 'x') {
        this.drawXAxis();
      }
      this.drawSeries();
      if (this.options.rightAxisBar === !true) {
        this.drawBarLine();
        return this.drawBarPoints();
      }
    };

    Bar.prototype.drawBarLine = function() {
      var coord, coords, dim, g, grads, i, ii, ix, k, len, len1, lg, nb, path, prevCoord, r, rPath, ref, results, straightPath, u, x1, x2, y1, y2;
      nb = this.options.ykeys.length - this.options.nbYkeys2;
      ref = this.options.ykeys.slice(nb, this.options.ykeys.length);
      results = [];
      for (ii = k = 0, len = ref.length; k < len; ii = k += 1) {
        dim = ref[ii];
        path = "";
        straightPath = "";
        if (this.options.horizontal === !true) {
          coords = (function() {
            var len1, ref1, results1, u;
            ref1 = this.data;
            results1 = [];
            for (u = 0, len1 = ref1.length; u < len1; u++) {
              r = ref1[u];
              if (r._y2[nb + ii] !== void 0) {
                results1.push({
                  x: r._x,
                  y: r._y2[nb + ii]
                });
              }
            }
            return results1;
          }).call(this);
        } else {
          coords = (function() {
            var len1, ref1, results1, u;
            ref1 = this.data;
            results1 = [];
            for (u = 0, len1 = ref1.length; u < len1; u++) {
              r = ref1[u];
              if (r._y2[nb + ii] !== void 0) {
                results1.push({
                  x: r._y2[nb + ii],
                  y: r._x
                });
              }
            }
            return results1;
          }).call(this);
        }
        if (this.options.smooth) {
          grads = Morris.Line.gradients(coords);
        }
        prevCoord = {
          y: null
        };
        for (i = u = 0, len1 = coords.length; u < len1; i = ++u) {
          coord = coords[i];
          if (coord.y != null) {
            if (prevCoord.y != null) {
              if (this.options.smooth && this.options.horizontal === !true) {
                g = grads[i];
                lg = grads[i - 1];
                ix = (coord.x - prevCoord.x) / 4;
                x1 = prevCoord.x + ix;
                y1 = Math.min(this.bottom, prevCoord.y + ix * lg);
                x2 = coord.x - ix;
                y2 = Math.min(this.bottom, coord.y - ix * g);
                path += "C" + x1 + "," + y1 + "," + x2 + "," + y2 + "," + coord.x + "," + coord.y;
              } else {
                path += "L" + coord.x + "," + coord.y;
              }
              if (this.options.horizontal === true) {
                straightPath += 'L' + this.transY(0) + ',' + coord.y;
              } else {
                straightPath += 'L' + coord.x + ',' + this.transY(0);
              }
            } else {
              if (!this.options.smooth || (grads[i] != null)) {
                path += "M" + coord.x + "," + coord.y;
                if (this.options.horizontal === true) {
                  straightPath += 'M' + this.transY(0) + ',' + coord.y;
                } else {
                  straightPath += 'M' + coord.x + ',' + this.transY(0);
                }
              }
            }
          }
          prevCoord = coord;
        }
        if (path !== "") {
          if (this.options.animate) {
            rPath = this.raphael.path(straightPath).attr('stroke', this.colorFor(coord, nb + ii, 'bar')).attr('stroke-width', this.lineWidthForSeries(ii));
            results.push((function(_this) {
              return function(rPath, path) {
                return rPath.animate({
                  path: path
                }, 500, '<>');
              };
            })(this)(rPath, path));
          } else {
            results.push(rPath = this.raphael.path(path).attr('stroke', this.colorFor(coord, nb + ii, 'bar')).attr('stroke-width', this.lineWidthForSeries(ii)));
          }
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Bar.prototype.drawBarPoints = function() {
      var circle, dim, idx, ii, k, len, nb, ref, results, row;
      nb = this.options.ykeys.length - this.options.nbYkeys2;
      this.seriesPoints = [];
      ref = this.options.ykeys.slice(nb, this.options.ykeys.length);
      results = [];
      for (ii = k = 0, len = ref.length; k < len; ii = k += 1) {
        dim = ref[ii];
        this.seriesPoints[ii] = [];
        results.push((function() {
          var len1, ref1, results1, u;
          ref1 = this.data;
          results1 = [];
          for (idx = u = 0, len1 = ref1.length; u < len1; idx = ++u) {
            row = ref1[idx];
            circle = null;
            if (row._y2[nb + ii] != null) {
              if (this.options.horizontal === !true) {
                circle = this.raphael.circle(row._x, row._y2[nb + ii], this.pointSizeForSeries(ii)).attr('fill', this.colorFor(row, nb + ii, 'bar')).attr('stroke-width', 1).attr('stroke', '#ffffff');
                results1.push(this.seriesPoints[ii].push(circle));
              } else {
                circle = this.raphael.circle(row._y2[nb + ii], row._x, this.pointSizeForSeries(ii)).attr('fill', this.colorFor(row, nb + ii, 'bar')).attr('stroke-width', 1).attr('stroke', '#ffffff');
                results1.push(this.seriesPoints[ii].push(circle));
              }
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    Bar.prototype.lineWidthForSeries = function(index) {
      if (this.options.lineWidth instanceof Array) {
        return this.options.lineWidth[index % this.options.lineWidth.length];
      } else {
        return this.options.lineWidth;
      }
    };

    Bar.prototype.pointSizeForSeries = function(index) {
      if (this.options.pointSize instanceof Array) {
        return this.options.pointSize[index % this.options.pointSize.length];
      } else {
        return this.options.pointSize;
      }
    };

    Bar.prototype.drawXAxis = function() {
      var angle, basePos, height, i, k, label, labelBox, margin, maxSize, offset, prevAngleMargin, prevLabelMargin, ref, ref1, results, row, size, startPos, textBox, width;
      if (!this.options.horizontal) {
        basePos = this.getXAxisLabelY();
      } else {
        basePos = this.getYAxisLabelX();
      }
      prevLabelMargin = null;
      prevAngleMargin = null;
      results = [];
      for (i = k = 0, ref = this.data.length; 0 <= ref ? k < ref : k > ref; i = 0 <= ref ? ++k : --k) {
        row = this.data[this.data.length - 1 - i];
        if (!this.options.horizontal) {
          label = this.drawXAxisLabel(row._x, basePos, row.label);
        } else {
          label = this.drawYAxisLabel(basePos, row._x - 0.5 * this.options.gridTextSize, row.label, 1);
        }
        if (!this.options.horizontal) {
          angle = this.options.xLabelAngle;
        } else {
          angle = 0;
        }
        textBox = label.getBBox();
        label.transform("r" + (-angle));
        labelBox = label.getBBox();
        label.transform("t0," + (labelBox.height / 2) + "...");
        if (angle !== 0) {
          offset = -0.5 * textBox.width * Math.cos(angle * Math.PI / 180.0);
          label.transform("t" + offset + ",0...");
        }
        ref1 = Morris.dimensions(this.el), width = ref1.width, height = ref1.height;
        if (!this.options.horizontal) {
          startPos = labelBox.x;
          size = labelBox.width;
          maxSize = width;
        } else {
          startPos = labelBox.y;
          size = labelBox.height;
          maxSize = height;
        }
        if (((prevLabelMargin == null) || prevLabelMargin >= startPos + size || (prevAngleMargin != null) && prevAngleMargin >= startPos) && startPos >= 0 && (startPos + size) < maxSize) {
          if (angle !== 0) {
            margin = 1.25 * this.options.gridTextSize / Math.sin(angle * Math.PI / 180.0);
            prevAngleMargin = startPos - margin;
          }
          if (!this.options.horizontal) {
            results.push(prevLabelMargin = startPos - this.options.xLabelMargin);
          } else {
            results.push(prevLabelMargin = startPos);
          }
        } else {
          results.push(label.remove());
        }
      }
      return results;
    };

    Bar.prototype.getXAxisLabelY = function() {
      return this.bottom + (this.options.xAxisLabelTopPadding || this.options.padding / 2);
    };

    Bar.prototype.drawSeries = function() {
      var barMiddle, barWidth, bottom, depth, groupWidth, i, idx, k, lastBottom, lastTop, left, leftPadding, nb, numBars, ref, row, sidx, size, spaceLeft, top, ypos, zeroPos;
      this.seriesBars = [];
      groupWidth = this.xSize / this.options.data.length;
      if (this.options.stacked) {
        numBars = 1;
      } else {
        numBars = 0;
        for (i = k = 0, ref = this.options.ykeys.length - 1; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
          if (this.hasToShow(i)) {
            numBars += 1;
          }
        }
      }
      if (this.options.stacked === !true && this.options.rightAxisBar === false) {
        numBars = numBars - this.options.nbYkeys2;
      }
      barWidth = (groupWidth * this.options.barSizeRatio - this.options.barGap * (numBars - 1)) / numBars;
      if (this.options.barSize) {
        barWidth = Math.min(barWidth, this.options.barSize);
      }
      spaceLeft = groupWidth - barWidth * numBars - this.options.barGap * (numBars - 1);
      leftPadding = spaceLeft / 2;
      zeroPos = this.ymin <= 0 && this.ymax >= 0 ? this.transY(0) : null;
      return this.bars = (function() {
        var len, ref1, results, u;
        ref1 = this.data;
        results = [];
        for (idx = u = 0, len = ref1.length; u < len; idx = ++u) {
          row = ref1[idx];
          this.data[idx].label_x = [];
          this.data[idx].label_y = [];
          this.seriesBars[idx] = [];
          lastTop = null;
          lastBottom = null;
          if (this.options.rightAxisBar === true) {
            nb = row._y.length;
          } else {
            nb = row._y.length - this.options.nbYkeys2;
          }
          results.push((function() {
            var len1, ref2, results1, z;
            ref2 = row._y.slice(0, nb);
            results1 = [];
            for (sidx = z = 0, len1 = ref2.length; z < len1; sidx = ++z) {
              ypos = ref2[sidx];
              if (row._y[sidx] != null) {
                ypos = row._y[sidx];
              } else if (row._y2[sidx] != null) {
                ypos = row._y2[sidx];
              }
              if (!this.hasToShow(sidx)) {
                continue;
              }
              if (ypos !== null) {
                if (zeroPos) {
                  top = Math.min(ypos, zeroPos);
                  bottom = Math.max(ypos, zeroPos);
                } else {
                  top = ypos;
                  bottom = this.bottom;
                }
                left = this.xStart + idx * groupWidth + leftPadding;
                if (!this.options.stacked) {
                  left += sidx * (barWidth + this.options.barGap);
                }
                size = bottom - top;
                if (this.options.verticalGridCondition && this.options.verticalGridCondition(row.x)) {
                  if (!this.options.horizontal) {
                    this.drawBar(this.xStart + idx * groupWidth, this.yEnd, groupWidth, this.ySize, this.options.verticalGridColor, this.options.verticalGridOpacity, this.options.barRadius);
                  } else {
                    this.drawBar(this.yStart, this.xStart + idx * groupWidth, this.ySize, groupWidth, this.options.verticalGridColor, this.options.verticalGridOpacity, this.options.barRadius);
                  }
                }
                if (!this.options.horizontal) {
                  if (this.options.stacked && (lastTop != null)) {
                    top += lastTop - bottom;
                  }
                  lastTop = top;
                  if (size === 0 && this.options.showZero) {
                    size = 1;
                  }
                  this.seriesBars[idx][sidx] = this.drawBar(left, top, barWidth, size, this.colorFor(row, sidx, 'bar'), this.options.barOpacity, this.options.barRadius);
                  if (this.options.dataLabels) {
                    if (this.options.dataLabelsPosition === 'inside' || (this.options.stacked && this.options.dataLabelsPosition !== 'force_outside')) {
                      depth = size / 2;
                    } else {
                      depth = -7;
                    }
                    if (size > this.options.dataLabelsSize || !this.options.stacked || this.options.dataLabelsPosition === 'force_outside') {
                      this.data[idx].label_x[sidx] = left + barWidth / 2;
                      results1.push(this.data[idx].label_y[sidx] = top + depth);
                    } else {
                      results1.push(void 0);
                    }
                  } else {
                    results1.push(void 0);
                  }
                } else {
                  lastBottom = bottom;
                  if (this.options.stacked && (lastTop != null)) {
                    top = lastTop;
                  }
                  lastTop = top + size;
                  if (size === 0) {
                    size = 1;
                  }
                  this.seriesBars[idx][sidx] = this.drawBar(top, left, size, barWidth, this.colorFor(row, sidx, 'bar'), this.options.barOpacity, this.options.barRadius);
                  if (this.options.dataLabels) {
                    if (this.options.stacked || this.options.dataLabelsPosition === 'inside') {
                      this.data[idx].label_x[sidx] = top + size / 2;
                      this.data[idx].label_y[sidx] = left + barWidth / 2;
                    } else {
                      this.data[idx].label_x[sidx] = top + size + 5;
                      this.data[idx].label_y[sidx] = left + barWidth / 2;
                    }
                  }
                  if (this.options.inBarValue && barWidth > this.options.gridTextSize + 2 * this.options.inBarValueMinTopMargin) {
                    barMiddle = left + 0.5 * barWidth;
                    results1.push(this.raphael.text(bottom - this.options.inBarValueRightMargin, barMiddle, this.yLabelFormat(row.y[sidx], sidx)).attr('font-size', this.options.gridTextSize).attr('font-family', this.options.gridTextFamily).attr('font-weight', this.options.gridTextWeight).attr('fill', this.options.inBarValueTextColor).attr('text-anchor', 'end'));
                  } else {
                    results1.push(void 0);
                  }
                }
              } else {
                results1.push(null);
              }
            }
            return results1;
          }).call(this));
        }
        return results;
      }).call(this);
    };

    Bar.prototype.hilight = function(index) {
      var i, k, len, len1, ref, ref1, u, y;
      if (this.seriesBars && this.seriesBars[this.prevHilight] && this.prevHilight !== null && this.prevHilight !== index) {
        ref = this.seriesBars[this.prevHilight];
        for (i = k = 0, len = ref.length; k < len; i = ++k) {
          y = ref[i];
          if (y) {
            y.animate({
              'fill-opacity': this.options.barOpacity
            }, this.options.highlightSpeed);
          }
        }
      }
      if (this.seriesBars && this.seriesBars[index] && index !== null && this.prevHilight !== index) {
        ref1 = this.seriesBars[index];
        for (i = u = 0, len1 = ref1.length; u < len1; i = ++u) {
          y = ref1[i];
          if (y) {
            y.animate({
              'fill-opacity': this.options.barHighlightOpacity
            }, this.options.highlightSpeed);
          }
        }
      }
      return this.prevHilight = index;
    };

    Bar.prototype.colorFor = function(row, sidx, type) {
      var r, s;
      if (typeof this.options.barColors === 'function') {
        r = {
          x: row.x,
          y: row.y[sidx],
          label: row.label,
          src: row.src
        };
        s = {
          index: sidx,
          key: this.options.ykeys[sidx],
          label: this.options.labels[sidx]
        };
        return this.options.barColors.call(this, r, s, type);
      } else {
        return this.options.barColors[sidx % this.options.barColors.length];
      }
    };

    Bar.prototype.hitTest = function(x, y) {
      var bodyRect, pos;
      if (this.data.length === 0) {
        return null;
      }
      if (!this.options.horizontal) {
        pos = x;
      } else {
        bodyRect = document.body.getBoundingClientRect();
        pos = y + bodyRect.top;
      }
      pos = Math.max(Math.min(pos, this.xEnd), this.xStart);
      return Math.min(this.data.length - 1, Math.floor((pos - this.xStart) / (this.xSize / this.data.length)));
    };

    Bar.prototype.onGridClick = function(x, y) {
      var index;
      index = this.hitTest(x, y);
      return this.fire('click', index, this.data[index].src, x, y);
    };

    Bar.prototype.onHoverMove = function(x, y) {
      var index, ref;
      index = this.hitTest(x, y);
      this.hilight(index);
      if (index != null) {
        return (ref = this.hover).update.apply(ref, this.hoverContentForRow(index));
      } else {
        return this.hover.hide();
      }
    };

    Bar.prototype.onHoverOut = function() {
      this.hilight(-1);
      if (this.options.hideHover !== false) {
        return this.hover.hide();
      }
    };

    Bar.prototype.escapeHTML = function(string) {
      var map, reg;
      map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;'
      };
      reg = /[&<>"'\/]/ig;
      return string.replace(reg, (function(_this) {
        return function(match) {
          return map[match];
        };
      })(this));
    };

    Bar.prototype.hoverContentForRow = function(index) {
      var content, inv, j, jj, k, len, len1, ref, row, u, x, y;
      row = this.data[index];
      content = "<div class='morris-hover-row-label'>" + this.escapeHTML(row.label) + "</div>";
      inv = [];
      ref = row.y;
      for (jj = k = 0, len = ref.length; k < len; jj = ++k) {
        y = ref[jj];
        inv.unshift(y);
      }
      for (jj = u = 0, len1 = inv.length; u < len1; jj = ++u) {
        y = inv[jj];
        j = row.y.length - 1 - jj;
        if (this.options.labels[j] === false) {
          continue;
        }
        content += "<div class='morris-hover-point' style='color: " + (this.colorFor(row, j, 'label')) + "'>\n  " + this.options.labels[j] + ":\n  " + (this.yLabelFormat(y, j)) + "\n</div>";
      }
      if (typeof this.options.hoverCallback === 'function') {
        content = this.options.hoverCallback(index, this.options, content, row.src);
      }
      if (!this.options.horizontal) {
        x = this.left + (index + 0.5) * this.width / this.data.length;
        return [content, x];
      } else {
        x = this.left + 0.5 * this.width;
        y = this.top + (index + 0.5) * this.height / this.data.length;
        return [content, x, y, true];
      }
    };

    Bar.prototype.drawBar = function(xPos, yPos, width, height, barColor, opacity, radiusArray) {
      var maxRadius, path;
      maxRadius = Math.max.apply(Math, radiusArray);
      if (this.options.animate) {
        if (this.options.horizontal) {
          if (maxRadius === 0 || maxRadius > height) {
            path = this.raphael.rect(this.transY(0), yPos, 0, height).animate({
              x: xPos,
              width: width
            }, 500);
          } else {
            path = this.raphael.path(this.roundedRect(this.transY(0), yPos + height, width, 0, radiusArray).animate({
              y: yPos,
              height: height
            }, 500));
          }
        } else {
          if (maxRadius === 0 || maxRadius > height) {
            path = this.raphael.rect(xPos, this.transY(0), width, 0).animate({
              y: yPos,
              height: height
            }, 500);
          } else {
            path = this.raphael.path(this.roundedRect(xPos, this.transY(0), width, 0, radiusArray).animate({
              y: yPos,
              height: height
            }, 500));
          }
        }
      } else {
        if (maxRadius === 0 || maxRadius > height) {
          path = this.raphael.rect(xPos, yPos, width, height);
        } else {
          path = this.raphael.path(this.roundedRect(xPos, yPos, width, height, radiusArray));
        }
      }
      return path.attr('fill', barColor).attr('fill-opacity', opacity).attr('stroke', 'none');
    };

    Bar.prototype.roundedRect = function(x, y, w, h, r) {
      if (r == null) {
        r = [0, 0, 0, 0];
      }
      return ["M", x, r[0] + y, "Q", x, y, x + r[0], y, "L", x + w - r[1], y, "Q", x + w, y, x + w, y + r[1], "L", x + w, y + h - r[2], "Q", x + w, y + h, x + w - r[2], y + h, "L", x + r[3], y + h, "Q", x, y + h, x, y + h - r[3], "Z"];
    };

    return Bar;

  })(Morris.Grid);

  Morris.Donut = (function(superClass) {
    extend(Donut, superClass);

    Donut.prototype.defaults = {
      colors: ['#2f7df6', '#53a351', '#f6c244', '#cb444a', '#4aa0b5', '#222529', '#44a1f8', '#81d453', '#f0bb40', '#eb3f25', '#b45184', '#5f5f5f'],
      backgroundColor: '#FFFFFF',
      labelColor: '#000000',
      padding: 0,
      formatter: Morris.commas,
      resize: true,
      dataLabels: false,
      dataLabelsPosition: 'inside',
      dataLabelsFamily: 'sans-serif',
      dataLabelsSize: 12,
      dataLabelsWeight: 'normal',
      dataLabelsColor: 'auto',
      noDataLabel: 'No data for this chart',
      noDataLabelSize: 21,
      noDataLabelWeight: 'bold',
      donutType: 'donut',
      animate: true,
      showPercentage: false,
      postUnits: '',
      preUnits: ''
    };

    function Donut(options) {
      this.debouncedResizeHandler = bind(this.debouncedResizeHandler, this);
      this.resizeHandler = bind(this.resizeHandler, this);
      this.deselect = bind(this.deselect, this);
      this.select = bind(this.select, this);
      this.click = bind(this.click, this);
      var cx, cy, height, ref, width;
      if (!(this instanceof Morris.Donut)) {
        return new Morris.Donut(options);
      }
      this.options = Morris.extend({}, this.defaults, options);
      if (typeof options.element === 'string') {
        this.el = document.getElementById(options.element);
      } else {
        this.el = options.element[0] || options.element;
      }
      if (this.el === null) {
        throw new Error("Graph placeholder not found.");
      }
      this.raphael = new Raphael(this.el);
      if (options.data === void 0 || options.data.length === 0) {
        ref = Morris.dimensions(this.el), width = ref.width, height = ref.height;
        cx = width / 2;
        cy = height / 2;
        this.raphael.text(cx, cy, this.options.noDataLabel).attr('text-anchor', 'middle').attr('font-size', this.options.noDataLabelSize).attr('font-family', this.options.dataLabelsFamily).attr('font-weight', this.options.noDataLabelWeight).attr('fill', this.options.dataLabelsColor);
        return;
      }
      if (this.options.resize) {
        Morris.on(window, 'resize', this.resizeHandler);
      }
      this.setData(options.data);
    }

    Donut.prototype.destroy = function() {
      if (this.options.resize) {
        window.clearTimeout(this.timeoutId);
        return Morris.off(window, 'resize', this.resizeHandler);
      }
    };

    Donut.prototype.redraw = function() {
      var C, color, cx, cy, dist, finalValue, height, i, idx, k, label_x, label_y, last, len, len1, len2, max_value, min, next, p_cos_p0, p_sin_p0, ref, ref1, ref2, ref3, results, seg, total, u, value, w, width, z;
      this.raphael.clear();
      ref = Morris.dimensions(this.el), width = ref.width, height = ref.height;
      cx = width / 2;
      cy = height / 2;
      w = (Math.min(cx, cy) - 10) / 3 - this.options.padding;
      total = 0;
      ref1 = this.values;
      for (k = 0, len = ref1.length; k < len; k++) {
        value = ref1[k];
        total += value;
      }
      this.options.total = total;
      min = 5 / (2 * w);
      C = 1.9999 * Math.PI - min * this.data.length;
      last = 0;
      idx = 0;
      this.segments = [];
      if (total === 0) {
        total = 1;
      }
      ref2 = this.values;
      for (i = u = 0, len1 = ref2.length; u < len1; i = ++u) {
        value = ref2[i];
        next = last + min + C * (value / total);
        seg = new Morris.DonutSegment(cx, cy, w * 2, w, last, next, this.data[i].color || this.options.colors[idx % this.options.colors.length], this.options.backgroundColor, idx, this.raphael, this.options);
        seg.render();
        this.segments.push(seg);
        seg.on('hover', this.select);
        seg.on('click', this.click);
        seg.on('mouseout', this.deselect);
        if (parseFloat(seg.raphael.height) > parseFloat(height)) {
          dist = height * 2 - this.options.padding * 7;
        } else {
          dist = seg.raphael.height - this.options.padding * 7;
        }
        if (this.options.data[i].ratio === void 0) {
          this.options.data[i].ratio = 1;
        }
        dist = dist * this.options.data[i].ratio;
        if (this.options.dataLabels && this.values.length >= 1) {
          p_sin_p0 = Math.sin((last + next) / 2);
          p_cos_p0 = Math.cos((last + next) / 2);
          if (this.options.dataLabelsPosition === 'inside') {
            if (this.options.donutType === 'pie') {
              label_x = parseFloat(cx) + parseFloat(dist * 0.30 * p_sin_p0);
              label_y = parseFloat(cy) + parseFloat(dist * 0.30 * p_cos_p0);
            } else {
              label_x = parseFloat(cx) + parseFloat(dist * 0.39 * p_sin_p0);
              label_y = parseFloat(cy) + parseFloat(dist * 0.39 * p_cos_p0);
            }
          } else {
            label_x = parseFloat(cx) + parseFloat((dist - 9) * 0.5 * p_sin_p0);
            label_y = parseFloat(cy) + parseFloat((dist - 9) * 0.5 * p_cos_p0);
          }
          if (this.options.dataLabelsColor !== 'auto') {
            color = this.options.dataLabelsColor;
          } else if (this.options.dataLabelsPosition === 'inside' && this.isColorDark(this.options.colors[i]) === true) {
            color = '#fff';
          } else {
            color = '#000';
          }
          if (this.options.showPercentage) {
            finalValue = Math.round(parseFloat(value) / parseFloat(total) * 100) + '%';
            this.drawDataLabelExt(label_x, label_y, finalValue, color);
          } else {
            this.drawDataLabelExt(label_x, label_y, this.options.preUnits + value + this.options.postUnits, color);
          }
        }
        last = next;
        idx += 1;
      }
      this.text1 = this.drawEmptyDonutLabel(cx, cy - 10, this.options.labelColor, 15, 800);
      this.text2 = this.drawEmptyDonutLabel(cx, cy + 10, this.options.labelColor, 14);
      max_value = Math.max.apply(Math, this.values);
      idx = 0;
      if (this.options.donutType === 'donut') {
        ref3 = this.values;
        results = [];
        for (z = 0, len2 = ref3.length; z < len2; z++) {
          value = ref3[z];
          if (value === max_value) {
            this.select(idx);
            break;
          }
          results.push(idx += 1);
        }
        return results;
      }
    };

    Donut.prototype.setData = function(data) {
      var row;
      this.data = data;
      this.values = (function() {
        var k, len, ref, results;
        ref = this.data;
        results = [];
        for (k = 0, len = ref.length; k < len; k++) {
          row = ref[k];
          results.push(parseFloat(row.value));
        }
        return results;
      }).call(this);
      return this.redraw();
    };

    Donut.prototype.drawDataLabel = function(xPos, yPos, text, color) {
      var label;
      return label = this.raphael.text(xPos, yPos, text).attr('text-anchor', 'middle').attr('font-size', this.options.dataLabelsSize).attr('font-family', this.options.dataLabelsFamily).attr('font-weight', this.options.dataLabelsWeight).attr('fill', this.options.dataLabelsColor);
    };

    Donut.prototype.drawDataLabelExt = function(xPos, yPos, text, color) {
      var label, labelAnchor;
      if (this.values.length >= 1) {
        labelAnchor = 'middle';
      } else if (this.options.dataLabelsPosition === 'inside') {
        labelAnchor = 'middle';
      } else if (xPos > this.raphael.width / 2) {
        labelAnchor = 'start';
      } else if (xPos > this.raphael.width * 0.55 && xPos < this.raphael.width * 0.45) {
        labelAnchor = 'middle';
      } else {
        labelAnchor = 'end';
      }
      return label = this.raphael.text(xPos, yPos, text, color).attr('text-anchor', labelAnchor).attr('font-size', this.options.dataLabelsSize).attr('font-family', this.options.dataLabelsFamily).attr('font-weight', this.options.dataLabelsWeight).attr('fill', color);
    };

    Donut.prototype.click = function(idx) {
      return this.fire('click', idx, this.data[idx]);
    };

    Donut.prototype.select = function(idx) {
      var finalValue, k, len, ref, row, s, segment;
      ref = this.segments;
      for (k = 0, len = ref.length; k < len; k++) {
        s = ref[k];
        s.deselect();
      }
      segment = this.segments[idx];
      segment.select();
      row = this.data[idx];
      if (this.options.donutType === 'donut') {
        if (this.options.showPercentage && !this.options.dataLabels) {
          finalValue = Math.round(parseFloat(row.value) / parseFloat(this.options.total) * 100) + '%';
          return this.setLabels(row.label, finalValue);
        } else {
          return this.setLabels(row.label, this.options.formatter(row.value, row));
        }
      }
    };

    Donut.prototype.deselect = function(idx) {
      var k, len, ref, results, s;
      ref = this.segments;
      results = [];
      for (k = 0, len = ref.length; k < len; k++) {
        s = ref[k];
        results.push(s.deselect());
      }
      return results;
    };

    Donut.prototype.isColorDark = function(hex) {
      var b, g, luma, r, rgb;
      if (hex != null) {
        hex = hex.substring(1);
        rgb = parseInt(hex, 16);
        r = (rgb >> 16) & 0xff;
        g = (rgb >> 8) & 0xff;
        b = (rgb >> 0) & 0xff;
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma >= 128) {
          return false;
        } else {
          return true;
        }
      } else {
        return false;
      }
    };

    Donut.prototype.setLabels = function(label1, label2) {
      var height, inner, maxHeightBottom, maxHeightTop, maxWidth, ref, text1bbox, text1scale, text2bbox, text2scale, width;
      ref = Morris.dimensions(this.el), width = ref.width, height = ref.height;
      inner = (Math.min(width / 2, height / 2) - 10) * 2 / 3;
      maxWidth = 1.8 * inner;
      maxHeightTop = inner / 2;
      maxHeightBottom = inner / 3;
      this.text1.attr({
        text: label1,
        transform: ''
      });
      text1bbox = this.text1.getBBox();
      text1scale = Math.min(maxWidth / text1bbox.width, maxHeightTop / text1bbox.height);
      this.text1.attr({
        transform: "S" + text1scale + "," + text1scale + "," + (text1bbox.x + text1bbox.width / 2) + "," + (text1bbox.y + text1bbox.height)
      });
      this.text2.attr({
        text: label2,
        transform: ''
      });
      text2bbox = this.text2.getBBox();
      text2scale = Math.min(maxWidth / text2bbox.width, maxHeightBottom / text2bbox.height);
      return this.text2.attr({
        transform: "S" + text2scale + "," + text2scale + "," + (text2bbox.x + text2bbox.width / 2) + "," + text2bbox.y
      });
    };

    Donut.prototype.drawEmptyDonutLabel = function(xPos, yPos, color, fontSize, fontWeight) {
      var text;
      text = this.raphael.text(xPos, yPos, '').attr('font-size', fontSize).attr('fill', color);
      if (fontWeight != null) {
        text.attr('font-weight', fontWeight);
      }
      return text;
    };

    Donut.prototype.resizeHandler = function() {
      if (this.timeoutId != null) {
        window.clearTimeout(this.timeoutId);
      }
      return this.timeoutId = window.setTimeout(this.debouncedResizeHandler, 100);
    };

    Donut.prototype.debouncedResizeHandler = function() {
      var height, ref, width;
      this.timeoutId = null;
      ref = Morris.dimensions(this.el), width = ref.width, height = ref.height;
      this.raphael.setSize(width, height);
      this.options.animate = false;
      return this.redraw();
    };

    return Donut;

  })(Morris.EventEmitter);

  Morris.DonutSegment = (function(superClass) {
    extend(DonutSegment, superClass);

    function DonutSegment(cx1, cy1, inner1, outer, p0, p1, color1, backgroundColor, index1, raphael, options1) {
      var inner;
      this.cx = cx1;
      this.cy = cy1;
      this.inner = inner1;
      this.outer = outer;
      this.color = color1;
      this.backgroundColor = backgroundColor;
      this.index = index1;
      this.raphael = raphael;
      this.options = options1;
      this.deselect = bind(this.deselect, this);
      this.select = bind(this.select, this);
      this.sin_p0 = Math.sin(p0);
      this.cos_p0 = Math.cos(p0);
      this.sin_p1 = Math.sin(p1);
      this.cos_p1 = Math.cos(p1);
      this.is_long = (p1 - p0) > Math.PI ? 1 : 0;
      if (this.options.data[this.index].ratio === void 0) {
        this.options.data[this.index].ratio = 1;
      }
      inner = this.inner * this.options.data[this.index].ratio;
      this.path = this.calcSegment(inner + 3, inner + this.outer - 5);
      this.selectedPath = this.calcSegment(inner + 3, inner + this.outer);
      this.hilight = this.calcArc(inner);
    }

    DonutSegment.prototype.calcArcPoints = function(r) {
      return [this.cx + r * this.sin_p0, this.cy + r * this.cos_p0, this.cx + r * this.sin_p1, this.cy + r * this.cos_p1];
    };

    DonutSegment.prototype.calcSegment = function(r1, r2) {
      var ix0, ix1, iy0, iy1, ox0, ox1, oy0, oy1, ref, ref1;
      ref = this.calcArcPoints(r1), ix0 = ref[0], iy0 = ref[1], ix1 = ref[2], iy1 = ref[3];
      ref1 = this.calcArcPoints(r2), ox0 = ref1[0], oy0 = ref1[1], ox1 = ref1[2], oy1 = ref1[3];
      if (this.options.donutType === 'pie') {
        return ("M" + ox0 + "," + oy0) + ("A" + r2 + "," + r2 + ",0," + this.is_long + ",0," + ox1 + "," + oy1) + ("L" + this.cx + "," + this.cy) + "Z";
      } else {
        return ("M" + ix0 + "," + iy0) + ("A" + r1 + "," + r1 + ",0," + this.is_long + ",0," + ix1 + "," + iy1) + ("L" + ox1 + "," + oy1) + ("A" + r2 + "," + r2 + ",0," + this.is_long + ",1," + ox0 + "," + oy0) + "Z";
      }
    };

    DonutSegment.prototype.calcArc = function(r) {
      var ix0, ix1, iy0, iy1, ref;
      ref = this.calcArcPoints(r), ix0 = ref[0], iy0 = ref[1], ix1 = ref[2], iy1 = ref[3];
      return ("M" + ix0 + "," + iy0) + ("A" + r + "," + r + ",0," + this.is_long + ",0," + ix1 + "," + iy1);
    };

    DonutSegment.prototype.render = function() {
      if (!/NaN/.test(this.hilight)) {
        this.arc = this.drawDonutArc(this.hilight, this.color);
      }
      if (!/NaN/.test(this.path)) {
        return this.seg = this.drawDonutSegment(this.path, this.color, this.backgroundColor, (function(_this) {
          return function() {
            return _this.fire('hover', _this.index);
          };
        })(this), (function(_this) {
          return function() {
            return _this.fire('click', _this.index);
          };
        })(this), (function(_this) {
          return function() {
            return _this.fire('mouseout', _this.index);
          };
        })(this));
      }
    };

    DonutSegment.prototype.drawDonutArc = function(path, color) {
      var rPath;
      if (this.options.animate) {
        rPath = this.raphael.path("M" + this.cx + "," + this.cy + "Z").attr({
          stroke: color,
          'stroke-width': 2,
          opacity: 0
        });
        return (function(_this) {
          return function(rPath, path) {
            return rPath.animate({
              path: path
            }, 500, '<>');
          };
        })(this)(rPath, path);
      } else {
        return this.raphael.path(path).attr({
          stroke: color,
          'stroke-width': 2,
          opacity: 0
        });
      }
    };

    DonutSegment.prototype.drawDonutSegment = function(path, fillColor, strokeColor, hoverFunction, clickFunction, leaveFunction) {
      var rPath, straightDots, straightPath;
      if (this.options.animate && this.options.donutType === 'pie') {
        straightPath = path;
        straightPath = path.replace('A', ',');
        straightPath = straightPath.replace('M', '');
        straightPath = straightPath.replace('C', ',');
        straightPath = straightPath.replace('Z', '');
        straightDots = straightPath.split(',');
        if (this.options.donutType === 'pie') {
          straightPath = 'M' + straightDots[0] + ',' + straightDots[1] + ',' + straightDots[straightDots.length - 2] + ',' + straightDots[straightDots.length - 1] + ',' + straightDots[straightDots.length - 2] + ',' + straightDots[straightDots.length - 1] + 'Z';
        } else {
          straightPath = 'M' + straightDots[0] + ',' + straightDots[1] + ',' + straightDots[straightDots.length - 2] + ',' + straightDots[straightDots.length - 1] + 'Z';
        }
        rPath = this.raphael.path(straightPath).attr({
          fill: fillColor,
          stroke: strokeColor,
          'stroke-width': 3
        }).hover(hoverFunction).click(clickFunction).mouseout(leaveFunction);
        return (function(_this) {
          return function(rPath, path) {
            return rPath.animate({
              path: path
            }, 500, '<>');
          };
        })(this)(rPath, path);
      } else {
        if (this.options.donutType === 'pie') {
          return this.raphael.path(path).attr({
            fill: fillColor,
            stroke: strokeColor,
            'stroke-width': 3
          }).hover(hoverFunction).click(clickFunction).mouseout(leaveFunction);
        } else {
          return this.raphael.path(path).attr({
            fill: fillColor,
            stroke: strokeColor,
            'stroke-width': 3
          }).hover(hoverFunction).click(clickFunction);
        }
      }
    };

    DonutSegment.prototype.select = function() {
      if (!this.selected) {
        if (this.seg != null) {
          this.seg.animate({
            path: this.selectedPath
          }, 150, '<>');
          this.arc.animate({
            opacity: 1
          }, 150, '<>');
          return this.selected = true;
        }
      }
    };

    DonutSegment.prototype.deselect = function() {
      if (this.selected) {
        this.seg.animate({
          path: this.path
        }, 150, '<>');
        this.arc.animate({
          opacity: 0
        }, 150, '<>');
        return this.selected = false;
      }
    };

    return DonutSegment;

  })(Morris.EventEmitter);

}).call(this);
