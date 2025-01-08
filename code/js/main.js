require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/core/reactiveUtils",
  "esri/request",
  "esri/core/urlUtils",
  "esri/geometry/Extent",
  "esri/widgets/Expand",
  "esri/widgets/BasemapGallery",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/widgets/Slider",

  // Custom modules
  "./js/defaultOptions.js",
  "./js/urlHandler.js",
  "./js/symbols.js",
  "./js/canvasRecorder.js",
], function (
  Map,
  MapView,
  FeatureLayer,
  reactiveUtils,
  esriRequest,
  urlUtils,
  Extent,
  Expand,
  BasemapGallery,
  SimpleMarkerSymbol,
  SimpleFillSymbol,
  SimpleLineSymbol,
  Slider,

  defaultOptions,
  urlHandler,
  symbols,
  canvasRecorder
) {
  const setIntervalSpeed = defaultOptions["refresh-speed-ms"]; //refresh speed in ms

  // Globals
  let endNo; //highest number in the attribute
  let startNo; //lowest number in attribute
  let fieldToAnimate; //attribute selected
  let stepNumber; //increment value
  let overRidingField; //casts url field as no.1 selection in attribute selector
  let newSymbol;
  let animatedFeatureLayer = new FeatureLayer();

  // Create map
  let map = new Map({
    basemap: defaultOptions["basemap"],
  });

  let view = new MapView({
    container: "viewDiv",
    map: map,
    zoom: defaultOptions["map"]["zoom"],
    center: defaultOptions["map"]["center"],
  });

  const bgExpand = new Expand({
    view: view,
    content: document.getElementById("pulse-widget-container"),
    expanded: true,
  });

  reactiveUtils.watch(() => {
    const mobileSize =
      view.heightBreakpoint === "xsmall" || view.widthBreakpoint === "xsmall";

    if (mobileSize) {
      bgExpand.collapse();
    }
  });

  view.ui.add(bgExpand, "top-right");

  new BasemapGallery({
    view: view,
    container: document.getElementById("basemap-gallery"),
  }).watch("activeBasemap", function (newBasemap) {
    const basemapObj = {
      "Streets": "streets",
      "Imagery": "satellite",
      "Imagery Hybrid": "hybrid",
      "Topographic": "topo-vector",
      "Navigation": "streets-navigation-vector",
      "Streets (Night)": "streets-night-vector",
      "Terrain": "terrain",
      "Gray": "gray-vector",
      "Dark Gray": "dark-gray-vector",
      "National Geographic": "national-geographic",
      "Oceans": "oceans",
      "Physical": "physical",
      "OpenStreetMap": "osm",
      "Imagery (Clarity)": "satellite-clarity",
      "Community": "community",
      "Charted Territory": "charted-territory",
      "Colored Pencil": "colored-pencil",
      "Newspaper": "newspaper",
      "Blueprint": "blueprint",
      "Firefly": "firefly",
      "Human Geography": "human-geography",
      "Human Geography Dark": "human-geography-dark",
      "Terrain with Labels": "terrain",
      "Imagery Firefly": "imagery-firefly",
      "Charted Territory Dark": "charted-territory-dark",
      "Nova": "nova",
      "Mid-Century": "midcentury",
    };
    const basemapTitle = basemapObj?.[newBasemap.title];
    if (basemapTitle) urlHandler.changeBasemap(basemapTitle);
  });

  let animation = null;

  const slider = new Slider({
    container: "slider",
    min: 0,
    max: 1,
    values: [1],
    step: 1,
    visibleElements: {
      rangeLabels: true
    }
  });

  const playButton = document.getElementById("playButton");

  // When user drags the slider:
  //  - stops the animation
  //  - set the visualized year to the slider one.
  function inputHandler(event) {
    stopAnimation();
    sliderValue.innerHTML = Math.floor(event.value);
    slider.viewModel.setValue(0, event.value);
    updateRenderer(Math.floor(event.value));
  }

  slider.on("thumb-drag", inputHandler);

  playButton.addEventListener("click", () => {
    if (playButton.classList.contains("toggled")) {
      stopAnimation();
    } else {
      playButton.classList.add("toggled");
      animation = animate(slider.values[0]);
    }
  });

  function createSlider(min, max, step) {
    slider.min = min
    slider.max = max
    slider.step = step
    slider.viewModel.setValue(0, min)
  }

  // When the view is ready
  view.when(function () {
    // Add recording controls
    document.getElementById("stop-record").disabled = true;

    document.getElementById("start-record").addEventListener("click", function () {
      canvasRecorder.startRecording(view.surface.children[0]);
    });

    document.getElementById("stop-record").addEventListener("click", function () {
      canvasRecorder.stopRecording()
    });

    const copyButton = document.getElementById("copy-button");

    copyButton.addEventListener("click", () => {
      const copyText = document.getElementById("quote-text").innerText;
      navigator.clipboard.writeText(copyText);
    });

    setupListeners();

    // Check URL for paramaters, if there's some. Add it in.
    let browserURL = window.location.search;

    const urlObj = urlUtils.urlToObject(browserURL)?.query;
    urlHandler.loadingUrlParams(urlObj);

    const mapConfigObj = urlHandler.getMapConfig();
    document.getElementById("fs-url").value = mapConfigObj.featureLayerUrl;

    if (mapConfigObj.animateBy) {
      document.getElementById("animate-option").value = mapConfigObj.animateBy;
    }

    map.basemap = mapConfigObj.basemap;

    if (mapConfigObj.symbol != undefined && mapConfigObj.symbol != "undefined" && newSymbol) {
      newSymbol = SimpleFillSymbol.fromJSON(JSON.parse(mapConfigObj.symbol));
      document.getElementById("polygon-style-select").value = newSymbol.style;
      document.getElementById("polygon-color-input").value = Object.values(newSymbol.color);
      document.getElementById("polygon-sls-style-select").value = newSymbol.outline.type;
      document.getElementById("polygon-sls-width-input").value = newSymbol.outline.width;
      document.getElementById("polygon-sls-color-input").value = Object.values(newSymbol.outline.color);
    }

    // Once feature layer url has been set, now add it to the map.
    addFeatureLayer();

    document.getElementById("animation-time").value = mapConfigObj.animationTime;
    overRidingField = mapConfigObj.animationField;
    document.getElementById("blend-mode-selection").value = mapConfigObj.blendMode;
    animatedFeatureLayer.blendMode = mapConfigObj.blendMode;

    const definedExtent = new Extent({
      spatialReference: {
        wkid: 102100,
      },
      xmax: Number(mapConfigObj?.xmax),
      xmin: Number(mapConfigObj?.xmin),
      ymax: Number(mapConfigObj?.ymax),
      ymin: Number(mapConfigObj?.ymin),
    });

    updateExtent(definedExtent);

    reactiveUtils.when(
      () => view.stationary === true,
      () => updateMapCoords()
    );
  });

  // Open modal
  function openModal(id) {
    document.getElementById(id).open = true;
  }
  // When map moves, update url.
  function updateMapCoords() {
    const viewExtent = view.extent;

    urlHandler.updateBoundingBox(
      viewExtent.xmin,
      viewExtent.xmax,
      viewExtent.ymin,
      viewExtent.ymax
    );
  }

  function showErrorLoadingFeatureLayer(errorMessage) {
    document.getElementById("fl-error").innerHTML = errorMessage;
    document.getElementById("title").innerHTML = ""
    document.getElementById("description").innerHTML = ""
    document.getElementById("fl-error").style.display = "block";
  }

  function successLoadingFeatureLayer() {
    document.getElementById("fl-error").innerHTML = "";
    document.getElementById("fl-error").style.display = "none";
  }

  // Function to check if the URL is a valid Feature Layer URL
  async function isValidFeatureLayerURL(url) {
    try {
      // Init clientside query first
      // Starts with http or https, ends in FeatureServer/{number}
      const urlPattern = /^https?:\/\/.*\/FeatureServer\/\d+$/;
      if (urlPattern.test(url) == false) {
        showErrorLoadingFeatureLayer("This FeatureLayerURL doesnt seem to be valid. Check you've added a layer id (e.g. /0)")
        return false;
      }

      const response = await fetch(url + "?f=json");

      // Check if the response is OK (status 200)
      if (response.ok) {
        const data = await response.json();

        // Check if the response has the necessary attributes for a Feature Layer
        if (data && data.type === "Feature Layer") {
          successLoadingFeatureLayer();
          return true;
        } else {
          showErrorLoadingFeatureLayer("The URL is reachable but does not appear to be a Feature Layer.")
          return false;
        }
      } else {
        showErrorLoadingFeatureLayer("The URL is not reachable. Response status: " + response.status)
        return false;
      }
    } catch (error) {
      showErrorLoadingFeatureLayer("There was an error connecting to the URL: " + error)
      return false;
    }
  }

  // Adds the feature layer to the map.
  function addFeatureLayer() {
    const flURLElement = document.getElementById("fs-url");

    isValidFeatureLayerURL(flURLElement.value).then(
      function (isValid) {
        if (isValid == true) {
          urlHandler.changeFL(flURLElement.value);

          animatedFeatureLayer = new FeatureLayer({
            url: flURLElement.value,
          });

          map.removeAll();
          map.add(animatedFeatureLayer);

          //overides ANY scale threshold added to feature layer.
          animatedFeatureLayer.maxScale = 0;
          animatedFeatureLayer.minScale = 100000000000;

          // rest call to get attribute minimum and maximum values.
          getFields(flURLElement.value);

          animatedFeatureLayer.when(() => {
            stopAnimation();
            getMaxMin();
          });
        } else {
          map.remove(animatedFeatureLayer);
        }
      }
    );
  }

  // Populating selection drop down based on featurelayer.
  function getFields(flURL) {
    esriRequest(flURL + "?f=json", {
      responseType: "json",
    }).then((response) => {
      const getFeatureLayerResponse = response.data;

      document.getElementById("title").innerHTML = getFeatureLayerResponse.name;
      document.getElementById("description").innerHTML = getFeatureLayerResponse.description;
      document.getElementById("selection").innerHTML = "";

      const geometryType = getFeatureLayerResponse.geometryType;
      showSymbolsBasedOnGeometryType(geometryType);

      if (newSymbol == undefined || newSymbol == "undefined") {
        newSymbol = symbols.getSymbolByGeometry(geometryType);
      }

      for (let i = 0; i < getFeatureLayerResponse.fields.length; i++) {
        if (
          getFeatureLayerResponse.fields[i].type == "esriFieldTypeSingle" ||
          getFeatureLayerResponse.fields[i].type == "esriFieldTypeSmallInteger" ||
          getFeatureLayerResponse.fields[i].type == "esriFieldTypeInteger" ||
          getFeatureLayerResponse.fields[i].type == "esriFieldTypeDouble"
        ) {
          let opt = document.createElement("calcite-option");
          opt.value = getFeatureLayerResponse.fields[i].name;
          opt.textContent = getFeatureLayerResponse.fields[i].alias;
          document.getElementById("selection").appendChild(opt);
        }
      }

      document.getElementById("selection").value = overRidingField;
    });
  }

  // Hide/Show symbols based on geometry type
  function showSymbolsBasedOnGeometryType(geometryType) {
    // Default: hide all sections
    document.getElementById("polygon-section").style.display = "none";
    document.getElementById("polyline-section").style.display = "none";
    document.getElementById("point-section").style.display = "none";

    switch (geometryType) {
      case "esriGeometryPoint":
        document.getElementById("point-section").style.display = "block";
        updatePointSymbol(
          document.getElementById("point-style-select").value,
          document.getElementById("point-color-input").value,
          document.getElementById("point-size-input").value,
          document.getElementById("point-sls-width-input").value,
          document.getElementById("point-sls-color-input").value,
          document.getElementById("point-angle-input").value,
          document.getElementById("point-xoffset-input").value,
          document.getElementById("point-yoffset-input").value
        );
        break;
      case "esriGeometryPolyline":
        document.getElementById("polyline-section").style.display = "block";
        updatePolylineSymbol(
          document.getElementById("line-style-select").value,
          document.getElementById("line-width-input").value,
          document.getElementById("line-color-input").value
        );
        break;
      case "esriGeometryPolygon":
        document.getElementById("polygon-section").style.display = "block";
        updatePolygonSymbol(
          document.getElementById("polygon-style-select").value,
          document.getElementById("polygon-color-input").value,
          document.getElementById("polygon-sls-style-select").value,
          document.getElementById("polygon-sls-width-input").value,
          document.getElementById("polygon-sls-color-input").value
        );
        break;

      default:
        console.warn("Geometry type not supported: " + geometryType);
        break;
    }
  }

  // Go to extent
  function updateExtent(newExtent) {
    if (newExtent.spatialReference.wkid === 102100) {
      view.extent = newExtent;
    }

    if (newExtent.spatialReference.wkid != 102100) {
      view.extent = {
        xmax: 20026375.71466102,
        xmin: -20026375.71466102,
        ymax: 9349764.174146919,
        ymin: -5558767.721795811,
      };
    }
  }

  // Play animation
  function play() {
    //Stops any previously added animations in the frame
    stopAnimation();

    //queries the current feature layer url and field to work out start and end frame.
    getMaxMin();
  }

  // Get min and max values based on field selected
  function getMaxMin() {
    const field = document.getElementById("selection").value;

    // Query for the sum of the population in all features
    const minQuery = {
      onStatisticField: field,
      outStatisticFieldName: "MinID",
      statisticType: "min",
    };

    // Query for the average population in all features
    const maxQuery = {
      onStatisticField: field,
      outStatisticFieldName: "MaxID",
      statisticType: "max",
    };

    const query = animatedFeatureLayer.createQuery();
    query.outStatistics = [minQuery, maxQuery];
    animatedFeatureLayer.queryFeatures(query).then(function (dataJSONObj) {
      fieldToAnimate = field;
      updateRenderer(dataJSONObj.features[0].attributes.MinID);
      endNo = dataJSONObj.features[0].attributes.MaxID;

      // Generate step number here too
      const difference = Math.abs(
        dataJSONObj.features[0].attributes.MinID -
        dataJSONObj.features[0].attributes.MaxID
      );

      let differencePerSecond =
        difference / document.getElementById("animation-time").value;
      stepNumber = differencePerSecond / setIntervalSpeed;
      startNo = dataJSONObj.features[0].attributes.MinID;
      playButton.classList.add("toggled");
      animation = animate(dataJSONObj.features[0].attributes.MinID);

      // Adding empty frames at the start and end for fade in/out
      endNo += stepNumber * 40;
      startNo -= stepNumber * 2;

      createSlider(startNo, endNo, stepNumber);
    });
  }

  // Stop animation
  function stopAnimation() {
    if (!animation) {
      return;
    }

    animation.remove();
    animation = null;
    playButton.classList.remove("toggled");
  }

  // Set renderer based on start value
  function updateRenderer(value) {
    animatedFeatureLayer.renderer = symbols.getRenderer(
      newSymbol,
      fieldToAnimate,
      value,
      stepNumber,
      document.getElementById("animate-option").value
    );
  }

  // Anim func
  function animate(startValue) {
    let animating = true;
    let value = startValue;

    const frame = (timestamp) => {
      if (!animating) {
        return;
      }

      value += stepNumber;
      if (value > endNo) {
        value = startNo;
      }

      document.getElementById("sliderValue").innerHTML = Math.floor(value);
      slider.viewModel.setValue(0, value);
      updateRenderer(value);

      setTimeout(() => {
        requestAnimationFrame(frame);
      }, 1000 / 30);
    };

    frame();

    return {
      remove: () => {
        animating = false;
      }
    };
  }

  // Update dropdown options based on FeatureLayer URL updated
  function updateDropdown() {
    stopAnimation();

    //queries the current feature layer url and field to work out start and end frame.
    getMaxMin();
  }

  // Listen for dom element changes
  function setupListeners() {
    document.getElementById("fs-url").addEventListener("blur", addFeatureLayer);

    document.getElementById("point-outline-btn").onclick = () => {
      openModal("point-outline-modal");
    };
    document.getElementById("polygon-outline-btn").onclick = () => {
      openModal("polygon-outline-modal");
    };

    document.getElementById("animate-option").addEventListener("calciteSelectChange", function (e) {
      urlHandler.updateAnimateBy(e.target.value);
    });

    document.getElementById("selection").addEventListener("calciteSelectChange", function (e) {
      urlHandler.updateField(e.target.value);
      updateDropdown();
    });

    document.getElementById("animation-time").addEventListener("calciteInputInput", function (e) {
      urlHandler.updateDuration(e.target.value);
      updateDropdown();
    });

    document.getElementById("blend-mode-selection").addEventListener("calciteSelectChange", function () {
      if (document.getElementById("blend-mode-selection").value != "") {
        animatedFeatureLayer.blendMode = document.getElementById("blend-mode-selection").value;
        urlHandler.changeBlendMode(document.getElementById("blend-mode-selection").value);
      } else {
        animatedFeatureLayer.blendMode = "normal";
        urlHandler.changeBlendMode("normal");
      }
    });

    [document.getElementById("point-style-select")].forEach((input) => {
      input.addEventListener("calciteSelectChange", function () {
        updatePointSymbol(
          document.getElementById("point-style-select").value,
          document.getElementById("point-color-input").value,
          document.getElementById("point-size-input").value,
          document.getElementById("point-sls-width-input").value,
          document.getElementById("point-sls-color-input").value,
          document.getElementById("point-angle-input").value,
          document.getElementById("point-xoffset-input").value,
          document.getElementById("point-yoffset-input").value
        );
      });
    });

    [
      document.getElementById("point-size-input"),
      document.getElementById("point-xoffset-input"),
      document.getElementById("point-yoffset-input"),
      document.getElementById("point-angle-input"),
      document.getElementById("point-color-input"),
      document.getElementById("point-sls-width-input"),
      document.getElementById("point-sls-color-input"),
    ].forEach((input) => {
      input.addEventListener("calciteInputInput", function () {
        updatePointSymbol(
          document.getElementById("point-style-select").value,
          document.getElementById("point-color-input").value,
          document.getElementById("point-size-input").value,
          document.getElementById("point-sls-width-input").value,
          document.getElementById("point-sls-color-input").value,
          document.getElementById("point-angle-input").value,
          document.getElementById("point-xoffset-input").value,
          document.getElementById("point-yoffset-input").value
        );
      });
    });

    // Polygon Inpputs
    [
      document.getElementById("polygon-style-select"),
      document.getElementById("polygon-sls-style-select"),
    ].forEach((input) => {
      input.addEventListener("calciteSelectChange", function () {
        updatePolygonSymbol(
          document.getElementById("polygon-style-select").value,
          document.getElementById("polygon-color-input").value,
          document.getElementById("polygon-sls-style-select").value,
          document.getElementById("polygon-sls-width-input").value,
          document.getElementById("polygon-sls-color-input").value
        );
      });
    });

    [
      document.getElementById("polygon-color-input"),
      document.getElementById("polygon-sls-color-input"),
      document.getElementById("polygon-sls-width-input"),
    ].forEach((input) => {
      input.addEventListener("calciteInputInput", function () {
        updatePolygonSymbol(
          document.getElementById("polygon-style-select").value,
          document.getElementById("polygon-color-input").value,
          document.getElementById("polygon-sls-style-select").value,
          document.getElementById("polygon-sls-width-input").value,
          document.getElementById("polygon-sls-color-input").value
        );
      });
    });

    // Polyline Inpputs
    [
      document.getElementById("line-style-select")
    ].forEach((input) => {
      input.addEventListener("calciteSelectChange", function () {
        updatePolylineSymbol(
          document.getElementById("line-style-select").value,
          document.getElementById("line-width-input").value,
          document.getElementById("line-color-input").value
        );
      });
    });

    [
      document.getElementById("line-color-input"),
      document.getElementById("line-width-input")
    ].forEach((input) => {
      input.addEventListener("calciteInputInput", function () {
        updatePolylineSymbol(
          document.getElementById("line-style-select").value,
          document.getElementById("line-width-input").value,
          document.getElementById("line-color-input").value
        );
      });
    });
  }

  const sliders = [
    { id: 'brightness-slider', name: 'brightness', unit: '' },
    { id: 'contrast-slider', name: 'contrast', unit: '%' },
    { id: 'grayscale-slider', name: 'grayscale', unit: '' },
    { id: 'hue-rotate-slider', name: 'hue-rotate', unit: 'deg' },
    { id: 'invert-slider', name: 'invert', unit: '' },
    { id: 'opacity-slider', name: 'opacity', unit: '' },
    { id: 'saturate-slider', name: 'saturate', unit: '' },
    { id: 'sepia-slider', name: 'sepia', unit: '' },
    { id: 'blur-slider', name: 'blur', unit: 'px' }
  ];

  const dropShadowInputs = {
    offsetX: document.getElementById('drop-shadow-offset-x-slider'),
    offsetY: document.getElementById('drop-shadow-offset-y-slider'),
    blurRadius: document.getElementById('drop-shadow-blur-slider')
  };

  const filterValues = {};

  sliders.forEach(slider => {
    const element = document.getElementById(slider.id);
    filterValues[slider.name] = { value: element.value, unit: slider.unit };

    element.addEventListener('calciteSliderInput', (event) => {
      filterValues[slider.name].value = event.target.value;
      updateFilters();
    });
  });

  Object.values(dropShadowInputs).forEach(input => {
    input.addEventListener('calciteSliderInput', updateFilters);
  });

  document.getElementById('drop-shadow-color-input').addEventListener('calciteInputInput', updateFilters);

  function updateFilters() {
    const filterString = Object.entries(filterValues)
      .map(([key, { value, unit }]) => value ? `${key}(${value}${unit})` : '')
      .join(' ');

    const dropShadow = `drop-shadow(${dropShadowInputs.offsetX.value}px ${dropShadowInputs.offsetY.value}px ${dropShadowInputs.blurRadius.value}px ${document.getElementById('drop-shadow-color-input').value})`;
    const fullFilter = [filterString, dropShadow].filter(Boolean).join(' ');

    animatedFeatureLayer.effect = fullFilter ? fullFilter : '';
  }

  updateFilters();

  // Symbols
  function updatePolygonSymbol(style, color, lineStyle, lineWidth, lineColor) {
    if (style === "choose a style") {
      style = "solid";
    }
    if (lineStyle === "choose a style") {
      lineStyle = "solid";
    }

    const symbol = {
      style: style,
      color: color,
      outline: {
        color: lineColor,
        width: lineWidth,
        style: lineStyle,
      },
    };

    newSymbol = new SimpleFillSymbol(symbol);
    urlHandler.changeSymbol(JSON.stringify(newSymbol.toJSON()));

    updateRenderer(slider.values[0])
  }

  function updatePointSymbol(style, color, size, outlineSize, outlineColor, angle, xOffset, yOffset) {
    const symbol = {
      style: style,
      color: color,
      size: size + "px",
      angle: angle,
      xoffset: xOffset,
      yoffset: yOffset,
      outline: {
        style: "solid",
        color: outlineColor,
        width: outlineSize
      },
    };

    newSymbol = new SimpleMarkerSymbol(symbol);
    urlHandler.changeSymbol(JSON.stringify(newSymbol.toJSON()));
    updateRenderer(slider.values[0])
  }

  function updatePolylineSymbol(lineStyle, lineWidth, lineColor) {
    if (lineStyle === "choose a style") {
      lineStyle = "solid";
    }

    const symbol = {
      color: lineColor,
      width: lineWidth,
      style: lineStyle,
    };

    newSymbol = new SimpleLineSymbol(symbol);
    urlHandler.changeSymbol(JSON.stringify(newSymbol.toJSON()));
    updateRenderer(slider.values[0])
  }
});
