// Drug Supply Optimization: loads the data, holds the filter and view state,
// wires the playback controls and asks sankeyChart to draw.

document.addEventListener("DOMContentLoaded", function () {
  app.onLoad();
});

var app = {
  rows: [],
  depots: [],
  months: [],
  selectedDepot: "All",
  showCountries: false,   // country stage, only offered when a single depot is selected
  depotColorScale: null,
  formatMonth: null,

  onLoad: function () {
    var self = this;
    var parseMonth = d3.timeParse("%Y-%m");
    var formatMonth = d3.timeFormat("%b %Y");
    self.formatMonth = month => formatMonth(parseMonth(month));

    d3.csv("data/kit_flow.csv", function (d) {
      d.Qty = +d.Qty;
      return d;
    }).then(function (rows) {
      self.rows = rows;
      self.depots = Array.from(new Set(rows.map(d => d.Depot))).sort();
      self.months = Array.from(new Set(rows.map(d => d.Month))).sort();

      // Original colours: teal to magenta across all depots. Built over the full depot list,
      // so a depot keeps its colour when the filter is used.
      self.depotColorScale = d3.scaleLinear()
        .domain([0, Math.max(1, self.depots.length - 1)])
        .range(["#12CBC4", "#B53471"])
        .interpolate(d3.interpolateHcl);

      self.buildDepotFilter();
      document.getElementById("monthSlider").max = self.months.length - 1;
      self.update();
      self.addListeners();
    }).catch(function (error) {
      console.error("Error loading data:", error);
      document.getElementById("sankeyChartDivWrapper").textContent =
        "Could not load data/kit_flow.csv. Run the page from a local web server (see README.md).";
    });
  },

  buildDepotFilter: function () {
    d3.select("#depotFilter").selectAll("option.depot-option")
      .data(this.depots)
      .join("option")
      .attr("class", "depot-option")
      .attr("value", d => d)
      .text(d => d);
  },

  addListeners: function () {
    var self = this;

    document.getElementById("depotFilter").addEventListener("change", function (e) {
      self.selectedDepot = e.target.value;
      var singleDepot = self.selectedDepot !== "All";
      document.getElementById("countryToggle").hidden = !singleDepot;
      if (!singleDepot) {
        self.showCountries = false;
        document.getElementById("showCountries").checked = false;
      }
      self.update();
    });

    document.getElementById("showCountries").addEventListener("change", function (e) {
      self.showCountries = e.target.checked;
      self.update();
    });

    // One button: pause while playing, play while paused, replay when finished
    document.getElementById("playBtn").addEventListener("click", function () {
      if (sankeyChart.playing) sankeyChart.pause();
      else sankeyChart.play();
    });

    document.getElementById("monthSlider").addEventListener("input", function (e) {
      sankeyChart.seek(+e.target.value);
    });

    var resizeTimeout;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () { self.update(); }, 200);
    });
  },

  getFilteredRows: function () {
    var depot = this.selectedDepot;
    return depot === "All" ? this.rows : this.rows.filter(d => d.Depot === depot);
  },

  update: function () {
    var self = this;

    sankeyChart.render(document.getElementById("sankeyChartDivWrapper"), {
      rows: self.getFilteredRows(),
      depots: self.selectedDepot === "All" ? self.depots : [self.selectedDepot],
      months: self.months,
      showCountries: self.showCountries,
      color: d => self.depotColorScale(self.depots.indexOf(d)),
      onProgress: state => self.updatePlayback(state),
    });
  },

  // Called by the chart when the month or the play state changes
  updatePlayback: function (state) {
    document.getElementById("monthSlider").value = state.monthIndex;
    document.getElementById("monthLabel").textContent = this.formatMonth(this.months[state.monthIndex]);

    var button = document.getElementById("playBtn");
    var mode = state.playing ? "Pause" : state.finished ? "Replay" : "Play";
    button.innerHTML = { Pause: "&#10074;&#10074;", Play: "&#9654;", Replay: "&#8635;" }[mode];
    button.title = mode;
    button.setAttribute("aria-label", mode);
  },
};
