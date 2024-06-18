require([
    'esri/Map',
    'esri/views/MapView',
    'esri/layers/FeatureLayer',
    'esri/core/reactiveUtils',
    'esri/request'
], function (Map, MapView, FeatureLayer, reactiveUtils, esriRequest) {
    const sampleURL = 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NOAA_METAR_current_wind_speed_direction_v1/FeatureServer/0';

    // Globals
    let xyz = [0, 0, 1];
    let endNo; //highest number in the attribute
    let startNo; //lowest number in attribute
    let fieldToAnimate; //attribute selected 
    let stepNumber; //increment value
    let setIntervalSpeed = 16.6; //refresh speed in ms
    let restarting = false; //flag to control removing animation 
    let updateField = false; //check for attribute change
    let intervalFunc; //animation interval name
    let overRidingField; //casts url field as no.1 selection in attribute selector
    let geometryType;
    let newSymbol;
    let newType;
    let animatedFeatureLayer;

    // DOM Elements
    const urlElement = document.getElementById('fs-url');
    const animationTimeElement = document.getElementById('animation-time');

    // Create map
    let map = new Map({
        basemap: 'dark-gray-vector'
    });

    let view = new MapView({
        container: 'viewDiv',
        map: map,
        zoom: 3,
        center: [0, 0]
    });

    // Event listeners
    document.getElementById('play').addEventListener('click', play);
    urlElement.addEventListener('blur', addFeatureLayer);
    urlElement.addEventListener('change', addFeatureLayer);

    // Check URL for paramaters, if there's some. Add it in.
    let browserURL = window.location.search
    if (browserURL != '') {
        updateField = true;
        browserURL = browserURL.replace('?', '');
        let partsOfStr = browserURL.split(',');
        urlElement.value = partsOfStr[0];
        overRidingField = partsOfStr[1];
        animationTimeElement.value = partsOfStr[2];
        xyz = [parseInt(partsOfStr[3]), parseInt(partsOfStr[4]), parseInt(partsOfStr[5])];
    } else {
        defaultService();
    }

    view.when(function () {
        reactiveUtils.when(() => view.stationary === true, () => updateMapCoords());

        const point = {
            type: "point",
            longitude: xyz[0],
            latitude: xyz[1]
        };

        view.goTo({
            target: point,
            zoom: xyz[2]
        })
    })

    //once feature layer url has been set, now add it to the map.
    addFeatureLayer();

    //if there's no paramaters, then add these in as a default.
    function defaultService() {
        urlElement.value = sampleURL;
        animationTimeElement.value = 10
    }

    //this generates a new, sharable url link.
    function updateBrowserURL() {
        history.pushState({
            id: 'homepage'
        }, 'Home', '?' + urlElement.value + ',' + document.getElementById('selection').value + ',' + animationTimeElement.value + ',' + xyz);
    }

    //when map moves, update url.
    function updateMapCoords() {
        xyz = [view.center.longitude, view.center.latitude, view.zoom];
        updateBrowserURL();
    }

    //adds the feature layer to the map.
    function addFeatureLayer() {
        let flURL = urlElement.value;

        if (flURL != '') {
            animatedFeatureLayer = new FeatureLayer({
                url: flURL
            });

            map.removeAll();
            map.add(animatedFeatureLayer);

            //overides ANY scale threshold added to feature layer.
            animatedFeatureLayer.maxScale = 0;
            animatedFeatureLayer.minScale = 100000000000;

            //rest call to get attribute minimum and maximum values.
            getFields(flURL);

            urlElement.style.borderBottomColor = 'green';
        } else {
            map.remove(animatedFeatureLayer);
            urlElement.style.borderBottomColor = 'red';
        }

    }

    //populating selection drop down based on featurelayer.
    function getFields(flURL) {
        esriRequest(flURL + '?f=json', {
            responseType: 'json'
        }).then((response) => {
            const fieldsObj = response.data;
            document.getElementById('feature-layer-name').innerHTML = fieldsObj.name;
            updateExtent(fieldsObj.extent);
            select = document.getElementById('selection');
            select.innerHTML = '';

            geometryType = fieldsObj.geometryType;
            symbolSwitcher(geometryType);

            for (let i = 0; i < fieldsObj.fields.length; i++) {
                if (fieldsObj.fields[i].sqlType != 'sqlTypeNletchar') {

                    let opt = document.createElement('option');
                    opt.value = fieldsObj.fields[i].name;
                    opt.innerHTML = fieldsObj.fields[i].name;

                    if (i === 0 && updateField === true) {
                        opt.value = overRidingField;
                        opt.innerHTML = overRidingField;
                    }

                    if (updateField === true && fieldsObj.fields[i].name === overRidingField) {
                        opt.value = fieldsObj.fields[0].name;
                        opt.innerHTML = fieldsObj.fields[0].name;
                        updateField = false;
                    }

                    select.appendChild(opt);
                }

            }
            updateBrowserURL();
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
                ymin: -5558767.721795811
            };
        }
    }

    function play() {
        //Stops any previously added animations in the frame
        stopAnimation();

        //There's an unknown issue caused by 'ObjectID'
        //This is currently a workaround for it.
        if (document.getElementById('selection').value === 'OBJECTID') {
            if (urlElement.value != '') {
                animatedFeatureLayer = new FeatureLayer({
                    url: urlElement.value
                });

                map.removeAll();
                map.add(animatedFeatureLayer);
            }
        }

        //update with changed values.
        updateBrowserURL();

        //queries the current feature layer url and field to work out start and end frame.
        getMaxMin();
    }

    function getMaxMin() {
        const field = document.getElementById('selection').value;

        // query for the sum of the population in all features
        const minQuery = {
            onStatisticField: field,  // service field for 2015 population
            outStatisticFieldName: 'MinID',
            statisticType: 'min'
        };

        // query for the average population in all features
        const maxQuery = {
            onStatisticField: field,  // service field for 2015 population
            outStatisticFieldName: 'MaxID',
            statisticType: 'max'
        };

        const query = animatedFeatureLayer.createQuery();
        query.outStatistics = [minQuery, maxQuery];
        animatedFeatureLayer.queryFeatures(query)
            .then(function (dataJSONObj) {
                fieldToAnimate = field;
                startNumber(dataJSONObj.features[0].attributes.MinID);
                endNo = dataJSONObj.features[0].attributes.MaxID;

                //generate step number here too
                const difference = Math.abs(dataJSONObj.features[0].attributes.MinID - dataJSONObj.features[
                    0].attributes.MaxID);
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
        stepNumber = null;
        fieldToAnimate = null;
        startNo = null;
        endNo = null;
        restarting = true;
    }

    function startNumber(value) {
        animatedFeatureLayer.renderer = createRenderer(value);
    }

    function animate(startValue) {
        let currentFrame = startValue;

        let frame = function () {
            if (restarting) {
                clearTimeout(intervalFunc);
                restarting = false;
            };

            currentFrame += stepNumber

            if (currentFrame > endNo) {
                currentFrame = startNo;
            }

            startNumber(currentFrame);

            //animation loop.
            intervalFunc = setTimeout(function () {
                //stops it from overloading.
                requestAnimationFrame(frame);
            }, setIntervalSpeed);
        }

        //recusrive function, starting the animation.
        frame()

        return {
            remove: function () {
                animating = false
            }
        };
    }

    //CHANGE SYMBOLOGY TYPE HERE. (Point, Line or Polygon style)
    function symbolSwitcher(geometryType) {
        //Depending on the feature layer currently added, the symbology will change here.
        //Supporting points, lines and polygons.
        if (geometryType === 'esriGeometryPoint') {
            newSymbol = {
                type: 'picture-marker',
                url: 'images/PointIconImages/2.png',
                width: 20,
                height: 20
            };
        }

        if (geometryType === 'esriGeometryPolyline') {
            newSymbol = {
                type: 'simple-line',
                width: 3,
                color: 'rgb(55, 55, 255)',
                opacity: 1
            };
        }

        if (geometryType === 'esriGeometryPolygon') {
            newSymbol = {
                type: 'simple-fill',
                color: 'rgb(55, 55, 255)'
            };
        }

        newType = 'simple';
    }

    function createRenderer(now) {
        return {
            type: newType,
            symbol: newSymbol,
            visualVariables: [{
                type: 'opacity',
                field: fieldToAnimate,
                //stops control the fade out
                stops: [{
                    value: now - stepNumber * 40,
                    opacity: 0.0
                    //Change this to 0.1 if you always want it on screen during animation
                },
                {
                    value: now - stepNumber * 20,
                    opacity: 0.3
                },
                {
                    value: now - stepNumber * 1,
                    opacity: 1
                },
                {
                    value: now,
                    opacity: 1
                },
                {
                    value: now + stepNumber * 2,
                    opacity: 0
                }

                ]
            }]
        };
    }
})