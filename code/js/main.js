require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/core/reactiveUtils",
  "esri/request",
  "esri/core/urlUtils",
  "esri/geometry/Extent",

  //   Custom modules
  "./js/symbols.js",
], function (
  Map,
  MapView,
  FeatureLayer,
  reactiveUtils,
  esriRequest,
  urlUtils,
  Extent,

  symbols
) {
  const setIntervalSpeed = 16.6; //refresh speed in ms
  const sampleURL =
    "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NOAA_METAR_current_wind_speed_direction_v1/FeatureServer/0";

  // Globals
  let endNo; //highest number in the attribute
  let startNo; //lowest number in attribute
  let fieldToAnimate; //attribute selected
  let stepNumber; //increment value
  let restarting = false; //flag to control removing animation
  let overRidingField; //casts url field as no.1 selection in attribute selector
  let geometryType;
  let newSymbol;
  let animatedFeatureLayer;

  // DOM Elementsf
  const urlElement = document.getElementById("fs-url");
  const animationTimeElement = document.getElementById("animation-time");
  const selectionElement = document.getElementById("selection");

  // Create map
  let map = new Map({
    basemap: "dark-gray-vector",
  });

  let view = new MapView({
    container: "viewDiv",
    map: map,
    zoom: 3,
    center: [0, 0],
  });

  // Event listeners
  urlElement.addEventListener("blur", addFeatureLayer);
  urlElement.addEventListener("change", addFeatureLayer);
  selectionElement.addEventListener("change", updateDropdown);

  animationTimeElement.addEventListener("blur", updateDropdown);

  view.when(function () {
    // Check URL for paramaters, if there's some. Add it in.
    let browserURL = window.location.search;

    const urlObj = urlUtils.urlToObject(browserURL)?.query;

    if (
      urlObj?.featurelayerURL == undefined ||
      urlObj?.featurelayerURL == null
    ) {
      urlElement.value = sampleURL;
    } else {
      urlElement.value = urlObj?.featurelayerURL;
    }

    //once feature layer url has been set, now add it to the map.
    addFeatureLayer();

    // Field check
    if (urlObj?.field != undefined || urlObj?.field != null) {
      overRidingField = urlObj?.field;
    }

    if (urlObj?.length == undefined || urlObj?.length == null) {
      animationTimeElement.value = 10;
    } else {
      animationTimeElement.value = urlObj?.length;
    }

    let extentValid = true;

    if (urlObj?.xmax == undefined || urlObj?.xmax == null) {
      definedExtent = false;
    }

    if (urlObj?.xmin == undefined || urlObj?.xmin == null) {
      definedExtent = false;
    }

    if (urlObj?.ymax == undefined || urlObj?.ymax == null) {
      definedExtent = false;
    }

    if (urlObj?.ymin == undefined || urlObj?.ymin == null) {
      definedExtent = false;
    }

    if (extentValid) {
      const definedExtent = new Extent({
        spatialReference: {
          wkid: 102100,
        },
        xmax: Number(urlObj?.xmax),
        xmin: Number(urlObj?.xmin),
        ymax: Number(urlObj?.ymax),
        ymin: Number(urlObj?.ymin),
      });

      updateExtent(definedExtent);
    }

    reactiveUtils.when(
      () => view.stationary === true,
      () => updateMapCoords()
    );
  });

  //this generates a new, sharable url link.
  function updateBrowserURL(extent) {
    let url = new URL(window.location.href);

    // featurelayer url
    let params = new URLSearchParams(url.search);

    params.set("featurelayerURL", urlElement.value);
    params.set("field", selectionElement.value);
    params.set("length", animationTimeElement.value);
    params.set("xmin", [extent.xmin]);
    params.set("xmax", [extent.xmax]);
    params.set("ymin", [extent.ymin]);
    params.set("ymax", [extent.ymax]);

    url.search = params;

    // Update the browser's URL without reloading the page
    history.replaceState(null, "", url);
  }

  //when map moves, update url.
  function updateMapCoords() {
    updateBrowserURL(view.extent);
  }

  //adds the feature layer to the map.
  function addFeatureLayer() {
    let flURL = urlElement.value;

    if (flURL != "") {
      animatedFeatureLayer = new FeatureLayer({
        url: flURL,
      });

      map.removeAll();
      map.add(animatedFeatureLayer);

      //overides ANY scale threshold added to feature layer.
      animatedFeatureLayer.maxScale = 0;
      animatedFeatureLayer.minScale = 100000000000;

      //rest call to get attribute minimum and maximum values.
      getFields(flURL);

      urlElement.style.borderBottomColor = "green";

      animatedFeatureLayer.when(() => {
        play();
        updateBrowserURL(view.extent);
      });
    } else {
      map.remove(animatedFeatureLayer);
      urlElement.style.borderBottomColor = "red";
    }
  }

  //populating selection drop down based on featurelayer.
  function getFields(flURL) {
    esriRequest(flURL + "?f=json", {
      responseType: "json",
    }).then((response) => {
      const fieldsObj = response.data;
      document.getElementById("feature-layer-name").innerHTML = fieldsObj.name;
      selectionElement.innerHTML = "";

      geometryType = fieldsObj.geometryType;
      newSymbol = symbols.getSymbolByGeometry(geometryType);
      for (let i = 0; i < fieldsObj.fields.length; i++) {
        if (
          fieldsObj.fields[i].type == "esriFieldTypeSingle" ||
          fieldsObj.fields[i].type == "esriFieldTypeSmallInteger" ||
          fieldsObj.fields[i].type == "esriFieldTypeInteger" ||
          fieldsObj.fields[i].type == "esriFieldTypeOID" ||
          fieldsObj.fields[i].type == "esriFieldTypeDouble"
        ) {
          let opt = document.createElement("option");
          opt.value = fieldsObj.fields[i].name;
          opt.innerHTML = fieldsObj.fields[i].name;

          selectionElement.appendChild(opt);
        }
      }

      selectionElement.value = overRidingField;
    });
  }

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

  function play() {
    //Stops any previously added animations in the frame
    stopAnimation();

    //There's an unknown issue caused by 'ObjectID'
    //This is currently a workaround for it.
    if (selectionElement.value === "OBJECTID") {
      if (urlElement.value != "") {
        animatedFeatureLayer = new FeatureLayer({
          url: urlElement.value,
        });

        map.removeAll();
        map.add(animatedFeatureLayer);
      }
    }

    //queries the current feature layer url and field to work out start and end frame.
    getMaxMin();
    restarting = false;
  }

  function getMaxMin() {
    const field = selectionElement.value;

    // query for the sum of the population in all features
    const minQuery = {
      onStatisticField: field, // service field for 2015 population
      outStatisticFieldName: "MinID",
      statisticType: "min",
    };

    // query for the average population in all features
    const maxQuery = {
      onStatisticField: field, // service field for 2015 population
      outStatisticFieldName: "MaxID",
      statisticType: "max",
    };

    const query = animatedFeatureLayer.createQuery();
    query.outStatistics = [minQuery, maxQuery];
    animatedFeatureLayer.queryFeatures(query).then(function (dataJSONObj) {
      fieldToAnimate = field;
      startNumber(dataJSONObj.features[0].attributes.MinID);
      endNo = dataJSONObj.features[0].attributes.MaxID;

      //generate step number here too
      const difference = Math.abs(
        dataJSONObj.features[0].attributes.MinID -
          dataJSONObj.features[0].attributes.MaxID
      );
      let differencePerSecond = difference / animationTimeElement.value;
      stepNumber = differencePerSecond / setIntervalSpeed;
      startNo = dataJSONObj.features[0].attributes.MinID;
      animate(dataJSONObj.features[0].attributes.MinID);

      //adding empty frames at the start and end for fade in/out
      endNo += stepNumber * 40;
      startNo -= stepNumber * 2;
    });
  }

  function stopAnimation() {
    startNumber(null);
    stepNumber = 0;
    startNo = 0;
    endNo = 0;
    restarting = true;
  }

  function startNumber(value) {
    animatedFeatureLayer.renderer = symbols.getRenderer(
      newSymbol,
      fieldToAnimate,
      value,
      stepNumber
    );
  }

  function animate(startValue) {
    let intervalFunc; //animation interval name
    let currentFrame = startValue;

    function frame() {
      if (restarting) {
        clearTimeout(intervalFunc);
        restarting = false;
        return;
      }

      currentFrame += stepNumber;

      if (currentFrame > endNo) {
        currentFrame = startNo;
      }

      startNumber(currentFrame);

      //animation loop.
      intervalFunc = setTimeout(function () {
        //stops it from overloading.
        requestAnimationFrame(function () {
          frame();
        });
      }, setIntervalSpeed);
    }

    //recusrive function, starting the animation.
    frame();
  }

  function updateDropdown() {
    updateBrowserURL(view.extent);
    stopAnimation();

    // Adding delay
    setTimeout(() => {
      play();
    }, 100);
  }
});
