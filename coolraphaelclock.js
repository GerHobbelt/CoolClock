/**
 * Based on
 * CoolClock 2.1.4
 * Copyright 2010, Simon Baird
 * Released under the BSD License.
 *
 * Display an analog clock using canvas.
 * http://randomibis.com/coolclock/
 *
 * Revised to use the Raphael svg library instead of canvas.
 * Inspired by http://www.emanueleferonato.com/2010/12/11/javascript-analog-clock-with-no-images-and-no-css/
 * 2011, Jonathan Block
 * Relies on original CoolClock configurations, and should coexist peacefully.
 * Targets <div> elements rather than <canvas>.
 * Recognizes an additional skin parameter (autoFill: true) to automatically
 *   fill the background with white during the day and black at night, fading
 *   through gray from 5:30 to 6:30.
 * Prerequisites:
 *   jquery.min.js (1.6.2)
 *   raphael.min.js (1.5.2)
 *   coolclock.js(2.1.4)
 */

// Constructor for CoolRaphaelClock objects
window.CoolRaphaelClock = function(options) {
	return this.init(options);
}

// Define the CoolRaphaelClock object's methods
CoolRaphaelClock.prototype = {

	// Initialise using the parameters parsed from the colon delimited class
	init: function(options) {
		// Parse and store the options
		this.canvasId       = options.canvasId;
		this.skinId         = options.skinId || CoolClock.config.defaultSkin;
		this.displayRadius  = options.displayRadius || CoolClock.config.defaultRadius;
		this.showSecondHand = typeof options.showSecondHand == "boolean" ? options.showSecondHand : true;
		this.gmtOffset      = (options.gmtOffset != null && options.gmtOffset != '') ? parseFloat(options.gmtOffset) : null;
		this.showDigital    = typeof options.showDigital == "boolean" ? options.showDigital : false;
		this.logClock       = typeof options.logClock == "boolean" ? options.logClock : false;
		this.logClockRev    = typeof options.logClock == "boolean" ? options.logClockRev : false;

		this.tickDelay      = CoolClock.config[ this.showSecondHand ? "tickDelay" : "longTickDelay" ];

		// Get the canvas element
		this.canvas = Raphael(this.canvasId, 2*this.displayRadius, 2*this.displayRadius);

		// Determine the rendering scale
		this.renderRadius = CoolClock.config.renderRadius;
		this.scale = this.displayRadius / this.renderRadius;

		// Get the skin
		var skin = CoolClock.config.skins[this.skinId];
		if (!skin) skin = CoolClock.config.skins[CoolClock.config.defaultSkin];

    // Draw the outer edge of the clock
		if (skin.outerBorder)
			this.outerBorder = this.fullCircleAt(this.renderRadius, this.renderRadius, skin.outerBorder);

		// Prepare for background autofill (not in the original CoolClock)
		if (skin.outerBorder && skin.outerBorder.autoFill)
		  this.autoFill = true;

		// Draw the tick marks. Every 5th one is a big one
		this.ticks = [];
		for (var i=0;i<60;i++) {
		  if(i%5) {
		    if(skin.smallIndicator) {
		      var tick = this.radialElement(skin.smallIndicator);
		      tick.rotate(i*6, this.displayRadius, this.displayRadius);
		      this.ticks.push(tick);
		    }
		  } else {
		    if(skin.largeIndicator) {
		      var tick = this.radialElement(skin.largeIndicator);
		      tick.rotate(i*6, this.displayRadius, this.displayRadius);
		      this.ticks.push(tick);
		    }
		  }
		}

		// Write the time
		if (this.showDigital) {
			this.digitalText = this.drawTextAt(
				this.timeText(hour, min, sec),
				this.renderRadius,
				this.renderRadius+this.renderRadius/2
			);
		}

		// Draw the hands
		if (skin.hourHand)
			this.hourHand = this.radialElement(skin.hourHand);

		if (skin.minuteHand)
			this.minuteHand = this.radialElement(skin.minuteHand);

		if (this.showSecondHand && skin.secondHand)
			this.secondHand = this.radialElement(skin.secondHand);

		if (this.showSecondHand && skin.secondDecoration)
			this.secondDecoration = this.radialElement(skin.secondDecoration);

    // Scale (almost) everything
    if(this.outerBorder)
      this.outerBorder.scale(this.scale, this.scale, 0, 0);
    for(i=0; i<this.ticks.length; i++) {
      this.ticks[i].scale(this.scale, this.scale, 0, 0);
    }
    if(this.hourHand)
      this.hourHand.scale(this.scale, this.scale, 0, 0);
    if(this.minuteHand)
      this.minuteHand.scale(this.scale, this.scale, 0, 0);
    if(this.secondHand)
      this.secondHand.scale(this.scale, this.scale, 0, 0);
    if(this.secondDecoration)
      this.secondDecoration.scale(this.scale, this.scale, 0, 0);

		// should we be running the clock?
		this.active = true;
		this.tickTimeout = null;

		// Keep track of this object
		CoolClock.config.clockTracker[this.canvasId] = this;

		// Start the clock going
		this.tick();

		return this;
	},

	// Draw a circle at point x,y with params as defined in skin
	fullCircleAt: function(x,y,skin) {
	  var circle = this.canvas.circle(x, y, skin.radius);
	  if(skin.fillColor) {
  	  circle.attr({opacity: skin.alpha, fill: skin.fillColor, "stroke-width": skin.lineWidth * this.scale});
	  } else {
	    circle.attr({opacity: skin.alpha, stroke: skin.color, "stroke-width": skin.lineWidth * this.scale});
	  }
		return circle;
	},

	// Draw some text centered vertically and horizontally
	drawTextAt: function(theText,x,y) {
	  var text = this.canvas.text(x, y, theText);
	  text.attr({"font-size": 15, "font-family": "Arial, Helvetica, sans-serif"});
	  return text;
	},

	lpad2: function(num) {
		return (num < 10 ? '0' : '') + num;
	},

  // Input is 0-60, representing the position around a clock face to be represented
  // Return is 0-1
	tickAngle: function(second) {
		var baseAngle = -0.25; // compensate for 0deg on +x axis
		// Log algorithm by David Bradshaw
		var tweak = 3; // If it's lower the one second mark looks wrong (?)
		if (this.logClock) {
			return baseAngle + (second == 0 ? 0 : (Math.log(second*tweak) / Math.log(60*tweak)));
		}
		else if (this.logClockRev) {
			// Flip the seconds then flip the angle (trickiness)
			second = (60 - second) % 60;
			return baseAngle + (1.0 - (second == 0 ? 0 : (Math.log(second*tweak) / Math.log(60*tweak))));
		}
		else {
			return baseAngle + second/60.0;
		}
	},

	timeText: function(hour,min,sec) {
		var c = CoolClock.config;
		return '' +
			(c.showAmPm ? ((hour%12)==0 ? 12 : (hour%12)) : hour) + ':' +
			this.lpad2(min) +
			(c.showSecs ? ':' + this.lpad2(sec) : '') +
			(c.showAmPm ? (hour < 12 ? ' am' : ' pm') : '')
		;
	},

  radialElement: function(skin) {
    var element;
    if(skin.radius) {
      element = this.fullCircleAt(this.renderRadius + skin.startAt, this.renderRadius, skin);
    } else {
      element = this.canvas.path("M" + (this.renderRadius+skin.startAt) + " " + (this.renderRadius+0) +
                              "L" + (this.renderRadius+skin.endAt) + " " + (this.renderRadius+0));
    }
	  element.attr({opacity: skin.alpha, stroke: skin.color, "stroke-width": skin.lineWidth * this.scale});
	  return element;
  },

	render: function(hour,min,sec) {
		// Get the skin
		//var skin = CoolClock.config.skins[this.skinId];
		//if (!skin) skin = CoolClock.config.skins[CoolClock.config.defaultSkin];

    // AutoFill the background to distinguish day from night (not in the original CoolClock)
    if (this.autoFill) {
      minuteOfDay = hour*60 + min;
      if(minuteOfDay < 5*60+30) { fillColor = "#000000"; }
      else if(minuteOfDay < 6*60+30) {
        ratio = (minuteOfDay - (5*60+30)) / 60;
        colorPart = ratio * 255;
        fillColor = (colorPart | colorPart << 8 | colorPart << 16).toString(16);
        if(fillColor.length < 6) { for(i=fillColor.length; i<6; i++) {fillColor = "0" + fillColor;}}
        fillColor = "#" + fillColor;
      }
      else if(minuteOfDay < 17*60+30) { fillColor = "#ffffff"; }
      else if(minuteOfDay < 18*60+30) {
        ratio = 1 - ((minuteOfDay - (17*60+30)) / 60);
        colorPart = ratio * 255;
        fillColor = (colorPart | colorPart << 8 | colorPart << 16).toString(16);
        if(fillColor.length < 6) { for(i=fillColor.length; i<6; i++) {fillColor = "0" + fillColor;}}
        fillColor = "#" + fillColor;
      }
      else { fillColor = "#000000"; }
      this.outerBorder.attr({fill: fillColor});
    }

		// Write the time
		if (this.showDigital) {
		  this.digitalText.remove();
			this.digitalText = this.drawTextAt(
				this.timeText(hour, min, sec),
				this.renderRadius,
				this.renderRadius+this.renderRadius/2
			);
		}

		// Position the hands
		if (this.hourHand)
		  this.hourHand.rotate(this.tickAngle((hour%12)*5 + min/12.0) * 360, this.displayRadius, this.displayRadius);

		if (this.minuteHand)
  	  this.minuteHand.rotate(this.tickAngle(min + sec/60.0) * 360, this.displayRadius, this.displayRadius);

		if (this.secondHand)
  	  this.secondHand.rotate(this.tickAngle(sec) * 360, this.displayRadius, this.displayRadius);

		if (this.secondDecoration)
  	  this.secondDecoration.rotate(this.tickAngle(sec) * 360, this.displayRadius, this.displayRadius);
	},

	// Check the time and display the clock
	refreshDisplay: function() {
		var now = new Date();
		if (this.gmtOffset != null) {
			// Use GMT + gmtOffset
			var offsetNow = new Date(now.valueOf() + (this.gmtOffset * 1000 * 60 * 60));
			this.render(offsetNow.getUTCHours(),offsetNow.getUTCMinutes(),offsetNow.getUTCSeconds());
		}
		else {
			// Use local time
			this.render(now.getHours(),now.getMinutes(),now.getSeconds());
		}
	},

	// Set timeout to trigger a tick in the future
	nextTick: function() {
		this.tickTimeout = setTimeout("CoolClock.config.clockTracker['"+this.canvasId+"'].tick()",this.tickDelay);
	},

	// Check the canvas element hasn't been removed
	stillHere: function() {
		return document.getElementById(this.canvasId) != null;
	},

	// Stop this clock
	stop: function() {
		this.active = false;
		clearTimeout(this.tickTimeout);
	},

	// Start this clock
	start: function() {
		if (!this.active) {
			this.active = true;
			this.tick();
		}
	},

	// Main tick handler. Refresh the clock then setup the next tick
	tick: function() {
		if (this.stillHere() && this.active) {
			this.refreshDisplay()
			this.nextTick();
		}
	}
};

// Find all canvas elements that have the CoolRaphaelClock class and turns them into clocks
CoolRaphaelClock.findAndCreateClocks = function() {
	// (Let's not use a jQuery selector here so it's easier to use frameworks other than jQuery)
	var canvases = document.getElementsByTagName("div");
	for (var i=0;i<canvases.length;i++) {
		// Pull out the fields from the class. Example "CoolRaphaelClock:chunkySwissOnBlack:1000"
		var fields = canvases[i].className.split(" ")[0].split(":");
		if (fields[0] == "CoolRaphaelClock") {
			if (!canvases[i].id) {
				// If there's no id on this canvas element then give it one
				canvases[i].id = '_coolraphaelclock_auto_id_' + CoolClock.config.noIdCount++;
			}
			if(!isNaN(fields[2])) {
  			// Create a clock object for this element
  			new CoolRaphaelClock({
  				canvasId:       canvases[i].id,
  				skinId:         fields[1],
  				displayRadius:  fields[2],
  				showSecondHand: fields[3]!='noSeconds',
  				gmtOffset:      fields[4],
  				showDigital:    fields[5]=='showDigital',
  				logClock:       fields[6]=='logClock',
  				logClockRev:    fields[6]=='logClockRev'
  			});
  		}
		}
	}
};

// If you don't have jQuery then you need a body onload like this: <body onload="CoolRaphaelClock.findAndCreateClocks()">
// If you do have jQuery and it's loaded already then we can do it right now
if (window.jQuery) jQuery(document).ready(CoolRaphaelClock.findAndCreateClocks);
