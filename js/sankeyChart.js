// Animated Depot -> (Country) -> Outcome flow chart with monthly playback.
// Port of materialDashboard/js/sankeyChart.js (based on the animated Sankey in
// Fullstack D3 by Amelia Wattenberger) to D3 v7, keeping its look.
// Changes from the original: depots and names come from the data, dots are released
// month by month on a clock that can be paused and moved, an optional country stage,
// own tooltip instead of d3-tip, expired-at-depot shown under each depot instead of as a flow.

var sankeyChart = {
  KITS_PER_DOT: 10,
  MONTH_DURATION: 1500,  // ms of animation per month of data
  OUTCOMES: ["Dispensed", "Returned", "Expired at Site", "Damaged"],
  DEPOT_EXPIRY: "Expired at Depot",
  MIN_WIDTH: 700,

  // Playback clock (ms). Kept across redraws, so filtering, switching view or
  // resizing carries on from the same point.
  time: 0,
  playing: true,
  endTime: 0,
  monthCount: 0,
  timer: null,
  drawFrame: null,
  onProgress: null,
  lastProgressKey: null,

  play: function () {
    if (this.time >= this.endTime) this.time = 0; // finished: play again from the start
    this.playing = true;
    this.startTimer();
    this.notify();
  },

  pause: function () {
    this.playing = false;
    this.stopTimer();
    this.notify();
  },

  seek: function (monthIndex) {
    this.time = Math.min(monthIndex * this.MONTH_DURATION, this.endTime);
    if (this.playing) this.startTimer();
    else if (this.drawFrame) this.drawFrame(this.time);
    this.notify();
  },

  startTimer: function () {
    var self = this;
    self.stopTimer();
    var startTime = self.time;
    self.timer = d3.timer(function (elapsed) {
      self.time = Math.min(startTime + elapsed, self.endTime);
      self.drawFrame(self.time);
      if (self.time >= self.endTime) {
        self.playing = false;
        self.stopTimer();
      }
      self.notify();
    });
  },

  stopTimer: function () {
    if (this.timer) {
      this.timer.stop();
      this.timer = null;
    }
  },

  currentMonthIndex: function () {
    return Math.max(0, Math.min(this.monthCount - 1, Math.floor(this.time / this.MONTH_DURATION)));
  },

  // Tell the page about the month / play state, only when it changes (not every frame)
  notify: function () {
    var state = {
      monthIndex: this.currentMonthIndex(),
      playing: this.playing,
      finished: this.time >= this.endTime,
    };
    var key = [state.monthIndex, state.playing, state.finished].join("|");
    if (this.onProgress && key !== this.lastProgressKey) {
      this.lastProgressKey = key;
      this.onProgress(state);
    }
  },

  // options: { rows, depots, months, showCountries, color(depot), onProgress(state) }
  render: function (container, options) {
    var self = this;
    self.stopTimer();

    var depots = options.depots;
    var months = options.months;
    var showCountries = options.showCountries;
    var color = options.color;
    var outcomes = self.OUTCOMES;
    var fmt = d3.format(",");
    var tooltip = d3.select("#tooltip");

    self.monthCount = months.length;
    self.onProgress = options.onProgress;

    var root = d3.select(container);
    root.selectAll("*").remove();

    // 1. Access data

    // Rows with an outcome not in OUTCOMES (e.g. a spelling mistake in the CSV) are skipped
    var flowRows = options.rows.filter(d => outcomes.includes(d.Outcome));
    var expiryRows = options.rows.filter(d => d.Outcome === self.DEPOT_EXPIRY);

    var countryQty = d3.rollup(flowRows, v => d3.sum(v, d => d.Qty), d => d.Country);
    var depotCountryQty = d3.rollup(flowRows, v => d3.sum(v, d => d.Qty), d => d.Depot, d => d.Country);
    var countryOutcomeQty = d3.rollup(flowRows, v => d3.sum(v, d => d.Qty), d => d.Country, d => d.Outcome);
    var shippedByDepot = d3.rollup(flowRows, v => d3.sum(v, d => d.Qty), d => d.Depot);

    // Countries ordered by the depots that supply them, so shared countries sit between their depots
    var countries = Array.from(countryQty.keys()).sort(function (a, b) {
      return countryOrderKey(a) - countryOrderKey(b) || countryQty.get(b) - countryQty.get(a);
    });

    function countryOrderKey(country) {
      return d3.mean(depots
        .filter(dp => depotCountryQty.get(dp) && depotCountryQty.get(dp).has(country))
        .map(dp => depots.indexOf(dp)));
    }

    // Expired at depot, cumulative by month: expiredByMonth[depotId][monthIndex]
    var expiredByMonth = depots.map(function (depot) {
      var running = 0;
      return months.map(function (month) {
        running += d3.sum(expiryRows.filter(d => d.Depot === depot && d.Month === month), d => d.Qty);
        return running;
      });
    });

    // 2. Create chart dimensions

    var width = Math.max(container.clientWidth * 0.9, self.MIN_WIDTH);

    var dimensions = {
      width: width,
      height: showCountries ? 600 : 500,
      margin: {
        top: 10,
        right: Math.max(140, 60 + depots.length * 38),   // outcome names, and one value per depot
        bottom: 10,
        left: 210,
      },
      endsBarWidth: 15,
    };

    dimensions.boundedWidth = dimensions.width
      - dimensions.margin.left
      - dimensions.margin.right;

    dimensions.boundedHeight = dimensions.height
      - dimensions.margin.top
      - dimensions.margin.bottom;

    // Bands are 50px as in the original; narrower in the country view so 11 countries fit
    dimensions.pathHeight = showCountries
      ? Math.min(50, dimensions.boundedHeight / (countries.length + 1) * 0.8)
      : 50;

    var travelDuration = showCountries ? 7000 : 5000;
    var xCountry = dimensions.boundedWidth / 2;

    // 3. Draw canvas

    var wrapper = root.append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    var bounds = wrapper.append("g")
      .style("transform", `translate(${dimensions.margin.left}px, ${dimensions.margin.top}px)`);

    // 4. Create scales (first depot / country / outcome at the top)

    var startYScale = d3.scaleLinear()
      .domain([-1, depots.length])
      .range([0, dimensions.boundedHeight]);

    var countryYScale = d3.scaleLinear()
      .domain([-1, countries.length])
      .range([0, dimensions.boundedHeight]);

    var endYScale = d3.scaleLinear()
      .domain([-1, outcomes.length])
      .range([0, dimensions.boundedHeight]);

    // Dots change lanes between 40% and 60% of a stage, eased so they follow
    // the curve of the bands instead of turning sharp corners
    var laneSwitchScale = d3.scaleLinear()
      .domain([0.4, 0.6]) // x progress through a stage
      .range([0, 1])      // y progress
      .clamp(true);
    var yTransitionProgress = p => d3.easeCubicInOut(laneSwitchScale(p));

    var depotColor = id => color(depots[id]);

    // 5. Dots: one per KITS_PER_DOT kits plus one for the remainder, per month,
    // so the ending values add up exactly to the data once every dot has arrived

    var groupKey = d => [d.Month, d.Depot, showCountries ? d.Country : "", d.Outcome].join("|");
    var grouped = d3.rollup(flowRows, v => d3.sum(v, d => d.Qty), groupKey);

    var dots = [];
    grouped.forEach(function (qty, key) {
      var parts = key.split("|");
      var monthIndex = months.indexOf(parts[0]);
      var values = d3.range(Math.floor(qty / self.KITS_PER_DOT)).map(() => self.KITS_PER_DOT);
      if (qty % self.KITS_PER_DOT > 0) values.push(qty % self.KITS_PER_DOT);
      values.forEach(function (value) {
        dots.push({
          id: dots.length,
          depotId: depots.indexOf(parts[1]),
          countryId: showCountries ? countries.indexOf(parts[2]) : -1,
          outcomeId: outcomes.indexOf(parts[3]),
          value: value,
          startTime: (monthIndex + Math.random()) * self.MONTH_DURATION,
          yJitter: getRandomNumberInRange(-0.3, 0.3) * dimensions.pathHeight,
        });
      });
    });

    // Dot timings are re-randomised on every redraw, so a finished animation stays finished
    var wasFinished = self.endTime > 0 && self.time >= self.endTime;
    self.endTime = (d3.max(dots, d => d.startTime) || 0) + travelDuration;
    self.time = wasFinished ? self.endTime : Math.min(self.time, self.endTime);

    // 6. Draw bands
    // Same shape as the original: flat, then a smooth step in the middle of each stage

    function bandPath(x0, x1, y0, y1) {
      return d3.line().curve(d3.curveMonotoneX)(
        d3.range(6).map(i => [x0 + i * (x1 - x0) / 5, i <= 2 ? y0 : y1])
      );
    }

    var bands = [];
    if (showCountries) {
      depotCountryQty.forEach(function (byCountry, depot) {
        byCountry.forEach(function (qty, country) {
          bands.push(bandPath(0, xCountry,
            startYScale(depots.indexOf(depot)), countryYScale(countries.indexOf(country))));
        });
      });
      countryOutcomeQty.forEach(function (byOutcome, country) {
        byOutcome.forEach(function (qty, outcome) {
          bands.push(bandPath(xCountry, dimensions.boundedWidth,
            countryYScale(countries.indexOf(country)), endYScale(outcomes.indexOf(outcome))));
        });
      });
    } else {
      depots.forEach(function (depot, depotId) {
        outcomes.forEach(function (outcome, outcomeId) {
          bands.push(bandPath(0, dimensions.boundedWidth, startYScale(depotId), endYScale(outcomeId)));
        });
      });
    }

    bounds.append("g").selectAll(".category-path")
      .data(bands)
      .join("path")
      .attr("class", "category-path")
      .attr("d", d => d)
      .attr("stroke-width", dimensions.pathHeight);

    // 7. Draw peripherals

    // Depots
    var startingLabelsGroup = bounds.append("g")
      .style("transform", "translateX(-20px)");

    var startingGroups = startingLabelsGroup.selectAll(".start-group")
      .data(d3.range(depots.length))
      .join("g")
      .attr("class", "start-group")
      .on("mousemove", (event, id) => showTooltip(event,
        `<strong>${depots[id]}</strong><br>${fmt(shippedByDepot.get(depots[id]) || 0)} kits shipped (all months)`))
      .on("mouseleave", hideTooltip);

    startingGroups.append("text")
      .attr("class", "label start-label")
      .attr("y", id => startYScale(id) - 7)
      .text(id => depots[id]);

    var expiredLabels = startingGroups.append("text")
      .attr("class", "start-sublabel")
      .attr("y", id => startYScale(id) + 10);

    startingGroups.append("rect")
      .attr("x", 20)
      .attr("y", id => startYScale(id) - (dimensions.pathHeight / 2))
      .attr("width", dimensions.endsBarWidth)
      .attr("height", dimensions.pathHeight)
      .attr("fill", depotColor);

    startingLabelsGroup.append("text")
      .attr("class", "start-title")
      .attr("y", startYScale(0) - dimensions.pathHeight / 2 - 12)
      .text("Depots");

    // Countries (country view only)
    if (showCountries) {
      var countryGroups = bounds.append("g").selectAll(".country-group")
        .data(countries)
        .join("g")
        .attr("class", "country-group")
        .attr("transform", (d, i) => `translate(${xCountry}, ${countryYScale(i)})`)
        .on("mousemove", function (event, country) {
          var lines = depots
            .filter(dp => depotCountryQty.get(dp) && depotCountryQty.get(dp).has(country))
            .map(dp => `${dp}: ${fmt(depotCountryQty.get(dp).get(country))}`);
          showTooltip(event, `<strong>${country}</strong><br>${fmt(countryQty.get(country))} kits received (all months)` +
            `<br>${lines.join("<br>")}`);
        })
        .on("mouseleave", hideTooltip);

      countryGroups.append("rect")
        .attr("class", "country-node")
        .attr("x", -4)
        .attr("y", -dimensions.pathHeight / 2)
        .attr("width", 8)
        .attr("height", dimensions.pathHeight);

      countryGroups.append("text")
        .attr("class", "label country-label")
        .attr("y", -dimensions.pathHeight / 2 - 8)
        .text(d => d);
    }

    // Outcomes
    var endingLabelsGroup = bounds.append("g")
      .style("transform", `translateX(${dimensions.boundedWidth + 20}px)`);

    endingLabelsGroup.selectAll(".end-label")
      .data(outcomes)
      .join("text")
      .attr("class", "label end-label")
      .attr("y", (d, i) => endYScale(i) - 15)
      .text(d => d);

    var markersGroup = bounds.append("g")
      .attr("class", "markers-group");

    var endingBarGroup = bounds.append("g")
      .attr("transform", `translate(${dimensions.boundedWidth}, 0)`);

    // 8. Draw one frame of the animation at clock time t

    function dotPosition(d, progress) {
      var x = progress * dimensions.boundedWidth;
      var y;
      if (!showCountries) {
        var yStart = startYScale(d.depotId);
        y = yStart + (endYScale(d.outcomeId) - yStart) * yTransitionProgress(progress);
      } else if (progress < 0.5) {
        var yDepot = startYScale(d.depotId);
        y = yDepot + (countryYScale(d.countryId) - yDepot) * yTransitionProgress(progress / 0.5);
      } else {
        var yCountry = countryYScale(d.countryId);
        y = yCountry + (endYScale(d.outcomeId) - yCountry) * yTransitionProgress((progress - 0.5) / 0.5);
      }
      return `translate(${x}, ${y + d.yJitter})`;
    }

    var lastArrivedCount = -1;
    var lastMonthIndex = -1;

    function drawFrame(t) {
      var progressOf = d => (t - d.startTime) / travelDuration;

      markersGroup.selectAll(".marker-circle")
        .data(dots.filter(d => t >= d.startTime && progressOf(d) < 1), d => d.id)
        .join(enter => enter.append("circle")
          .attr("class", "marker marker-circle")
          .attr("r", 5.5)
          .attr("fill", d => depotColor(d.depotId))
          .style("opacity", 0))
        .attr("transform", d => dotPosition(d, progressOf(d)))
        .style("opacity", d => progressOf(d) * dimensions.boundedWidth < 10 ? 0 : 1);

      var monthIndex = Math.max(0, Math.min(months.length - 1, Math.floor(t / self.MONTH_DURATION)));
      if (monthIndex !== lastMonthIndex) {
        lastMonthIndex = monthIndex;
        expiredLabels.text(id => `Expired at depot: ${fmt(expiredByMonth[id][monthIndex])}`);
      }

      // Sum of arrived dots per outcome and depot. Bars and values are only
      // redrawn when another dot has arrived.
      var arrived = outcomes.map(() => depots.map(() => 0));
      var arrivedCount = 0;
      dots.forEach(function (d) {
        if (progressOf(d) >= 1) {
          arrived[d.outcomeId][d.depotId] += d.value;
          arrivedCount++;
        }
      });
      if (arrivedCount === lastArrivedCount) return;
      lastArrivedCount = arrivedCount;

      var endingPercentages = d3.merge(arrived.map(function (byDepot, endingId) {
        var countInBar = d3.sum(byDepot);
        return byDepot.map(function (count, depotId) {
          var countAbove = d3.sum(byDepot.slice(0, depotId));
          return {
            endingId,
            depotId,
            count,
            countInBar,
            percentAbove: countAbove / (countInBar || 1),
            percent: count / (countInBar || 1),
          };
        });
      }));

      endingBarGroup.selectAll(".ending-bar")
        .data(endingPercentages)
        .join("rect")
        .attr("class", "ending-bar")
        .attr("x", -dimensions.endsBarWidth)
        .attr("width", dimensions.endsBarWidth)
        .attr("y", d => endYScale(d.endingId)
          - dimensions.pathHeight / 2
          + dimensions.pathHeight * d.percentAbove
        )
        .attr("height", d => d.countInBar
          ? dimensions.pathHeight * d.percent
          : dimensions.pathHeight
        )
        .attr("fill", d => d.countInBar ? depotColor(d.depotId) : "#dadadd");

      endingLabelsGroup.selectAll(".ending-value")
        .data(endingPercentages)
        .join("text")
        .attr("class", "ending-value")
        .attr("x", d => d.depotId * 38 + 20)
        .attr("y", d => endYScale(d.endingId) - dimensions.pathHeight / 2 + 35)
        .attr("fill", d => d.countInBar ? depotColor(d.depotId) : "#dadadd")
        .text(d => fmt(d.count))
        .on("mousemove", (event, d) => showTooltip(event,
          `<strong>${depots[d.depotId]}</strong><br>${outcomes[d.endingId]}: ${fmt(d.count)} kits so far`))
        .on("mouseleave", hideTooltip);
    }

    self.drawFrame = drawFrame;
    self.lastProgressKey = null;
    drawFrame(self.time);
    if (self.playing) self.startTimer();
    self.notify();

    // Helpers

    function showTooltip(event, html) {
      tooltip.html(html)
        .classed("hidden", false)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 10) + "px");
    }

    function hideTooltip() {
      tooltip.classed("hidden", true);
    }

    function getRandomNumberInRange(min, max) {
      return Math.random() * (max - min) + min;
    }
  },
};
