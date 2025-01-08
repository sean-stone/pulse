// Symbol module
define([], function () {
  const defaultSymbols = {
    point: {
      type: "picture-marker",
      url: "images/PointIconImages/2.png",
      width: 20,
      height: 20,
    },
    line: {
      type: "simple-line",
      width: 3,
      color: "rgb(55, 55, 255)",
      opacity: 1,
    },
    polygon: {
      type: "simple-fill",
      color: "rgb(55, 55, 255)",
      outline: {
        type: "simple-line",
        width: 0.1,
        color: "rgb(55, 55, 255)",
        opacity: 0.2,
      },
    },
  };

  return {
    getSymbolByGeometry: function (geometryType) {
      if (geometryType === "esriGeometryPoint") {
        return defaultSymbols.point;
      }

      if (geometryType === "esriGeometryPolyline") {
        return defaultSymbols.line;
      }

      if (geometryType === "esriGeometryPolygon") {
        return defaultSymbols.polygon;
      }
    },

    updateSymbolByGeometry: function (symbol) {
      defaultSymbols.point = symbol;
    },

    getRenderer: function (newSymbol, fieldToAnimate, value, stepNumber, animationType) {
      let firstStep = 0;
      let secondStep = 0.3;

      if (!document.getElementById("should-fade-out").checked) {
        firstStep = 1
        secondStep = 1
      }

      if (animationType === "opacity") {
        return {
          type: "simple",
          symbol: newSymbol,
          visualVariables: [
            {
              type: "opacity",
              field: fieldToAnimate,
              //stops control the fade out
              stops: [
                {
                  value: value - stepNumber * 40,
                  opacity: firstStep,
                  //Change this to 0.1 if you always want it on screen during animation
                },
                {
                  value: value - stepNumber * 20,
                  opacity: secondStep,
                },
                {
                  value: value,
                  opacity: 1,
                },
                {
                  value: value + stepNumber * 2,
                  opacity: 0,
                },
              ],
            },
          ],
        };
      }

      return {
        type: "simple",
        symbol: newSymbol,
        visualVariables: [
          {
            type: animationType,
            field: fieldToAnimate,
            //stops control the fade out
            stops: [
              {
                value: value - stepNumber * 40,
                size: firstStep,
                //Change this to 0.1 if you always want it on screen during animation
              },
              {
                value: value - stepNumber * 20,
                size: secondStep,
              },
              {
                value: value,
                size: newSymbol.size ? newSymbol.size : newSymbol.width,
              },
              {
                value: value + stepNumber * 2,
                size: 0,
              },
            ],
          },
        ],
      };
    },
  };
});
