// Make this a getLoadProfile();
// have a default set of values if url not defined.
define(["./js/defaultOptions.js"], function (defaultOptions) {
  class MapConfiguration {
    constructor(
      featureLayerUrl,
      animationField,
      animationTime,
      xmin,
      xmax,
      ymin,
      ymax,
      basemap,
      symbol,
      blendMode
    ) {
      this.featureLayerUrl = featureLayerUrl; // URL of the feature layer
      this.animationField = animationField; // Field used for animation
      this.animationTime = animationTime; // Duration of animation
      this.xmin = xmin; // Minimum x-coordinate (bounding box)
      this.xmax = xmax; // Maximum x-coordinate (bounding box)
      this.ymin = ymin; // Minimum y-coordinate (bounding box)
      this.ymax = ymax; // Maximum y-coordinate (bounding box)
      this.basemap = basemap; // Type of basemap (e.g., "streets", "satellite")
      this.symbol = symbol; // Symbol information (e.g., marker style)
      this.blendMode = blendMode; // Blend mode (e.g., "multiply", "overlay")
    }

    // Method to update the bounding box
    changeFL(flUYRL) {
      this.featureLayerUrl = flUYRL;
    }

    // Method to update the bounding box
    updateField(animationField) {
      this.animationField = animationField;
    }

    // Method to update the bounding box
    updateDuration(animationTime) {
      this.animationTime = animationTime;
    }

    // Method to update the bounding box
    updateBoundingBox(xmin, xmax, ymin, ymax) {
      this.xmin = xmin;
      this.xmax = xmax;
      this.ymin = ymin;
      this.ymax = ymax;
    }

    // Method to change the basemap
    changeBasemap(newBasemap) {
      this.basemap = newBasemap;
    }

    // Method to change the symbol mode
    changeSymbol(symbol) {
      console.log("xx")
      this.symbol = symbol;
    }

    // Method to change the blend mode
    changeBlendMode(newBlendMode) {
      this.blendMode = newBlendMode;
    }
  }

  // Default config:
  let mapConfig = new MapConfiguration(
    defaultOptions["featurelayer-url"],
    defaultOptions.field,
    defaultOptions.duration,
    defaultOptions.map.extent.xmin,
    defaultOptions.map.extent.xmax,
    defaultOptions.map.extent.ymin,
    defaultOptions.map.extent.ymax,
    defaultOptions.basemap,
    defaultOptions.symbol,
    defaultOptions.blendMode
  );

  function setUrlParams() {
    let url = new URL(window.location.href);
    let params = new URLSearchParams(url.search);

    const mapConfigKeys = Object.keys(mapConfig);

    for (let mapConfigKeyIndex = 0; mapConfigKeyIndex < mapConfigKeys.length; mapConfigKeyIndex++) {
      params.set(mapConfigKeys[mapConfigKeyIndex], mapConfig[mapConfigKeys[mapConfigKeyIndex]]);
    }

    url.search = params;

    // Update the browser's URL without reloading the page
    history.replaceState(null, "", url);
  }

  return {
    loadingUrlParams: function (urlObj) {
      if (
        urlObj?.featureLayerUrl == undefined ||
        urlObj?.featureLayerUrl == null
      ) {
        // urlElement.value = sampleURL;
      } else {
        mapConfig.changeFL(urlObj?.featureLayerUrl);
      }

      // Field check
      if (
        urlObj?.animationField != undefined ||
        urlObj?.animationField != null
      ) {
        mapConfig.updateField(urlObj?.animationField);
      }

      if (urlObj?.animationTime == undefined || urlObj?.animationTime == null) {
        // animationTimeElement.value = 10;
        mapConfig.updateDuration(defaultOptions.duration)
      } else {
        mapConfig.updateDuration(urlObj?.animationTime);
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
        mapConfig.updateBoundingBox(
          urlObj?.xmin,
          urlObj?.xmax,
          urlObj?.ymin,
          urlObj?.ymax
        );
      }

      if (urlObj?.basemap == undefined || urlObj?.basemap == null) {
        mapConfig.changeBasemap(defaultOptions.basemap)
      } else {
        mapConfig.changeBasemap(urlObj?.basemap);
      }

      if (urlObj?.symbol == undefined || urlObj?.symbol == null) {
        mapConfig.changeSymbol(defaultOptions?.symbol)
      } else {
        mapConfig.changeSymbol(urlObj?.symbol)
      }

      if (urlObj?.blendMode == undefined || urlObj?.blendMode == null) {
        mapConfig.changeBlendMode(defaultOptions.blendMode)
      } else {
        mapConfig.changeBlendMode(urlObj?.blendMode);
      }
    },
    changeFL: function (url) {
      mapConfig.changeFL(url);
      setUrlParams();
    },
    updateField: function (fieldString) {
      mapConfig.updateField(fieldString);
      setUrlParams();
    },
    updateDuration: function (durationTime) {
      mapConfig.updateDuration(durationTime);
      setUrlParams();
    },
    updateBoundingBox: function (xmin, xmax, ymin, ymax) {
      mapConfig.updateBoundingBox(xmin, xmax, ymin, ymax);
      setUrlParams();
    },
    changeBasemap: function (basemapString) {
      mapConfig.changeBasemap(basemapString);
      setUrlParams();
    },
    changeSymbol: function (symbol) {
      mapConfig.changeSymbol(symbol);
      setUrlParams();
    },
    changeBlendMode: function (blendModeString) {
      mapConfig.changeBlendMode(blendModeString);
      setUrlParams();
    },
    getMapConfig: function () {
      return mapConfig;
    },
  };
});
