
define( ["require", "qlik", "jquery", "./ol", "css!./ol.css", "css!./Kartta.css"], function ( require, qlik, $, ol, olcss, kmcss) {
	'use strict';

	var debugTimestamp, debugTimestampSecondary, debugEngineWaitTime;

	//variables related to the drawn instance of the map, put here as "gobal" in order to make these reusable between renderings
	//This should be moved or changed to allow multiple instances of the extension on one single sheet

		var map; //the map instance

		var sourceData; // source data layer for points to plot
		var clusteringLayer; // clustering layer for the sourceData collection of points

		var selectionSource; // the layer for drawing the user made selection areas

		var additionalRenderData; // datalayer for showing bounding box and point for "own" address

		var drawInteraction; // interaction for drawing the selection polygons

		var selectionIsDirty; // true if the extension has detected that outside selections have changed (i.e. user has made a selection in the default state). 
		// if this is set to true, we should after the rendering of datapoints apply the drawed selection.

	//global configurations for all extensions

		var pageWidth = 5;
		var pageHeight = Math.floor(10000 / pageWidth); //must result in a page size that is maximum 10000 cells (qWidth x qHeight <= 10000)
		var maxPlottedPoints = 25000; //an error message will be displayed (instead of rendering the map) if there are more data rows than this
		var clusteringDistance = 30;

		var maxZoom = 11;

		//The default zoom that fits Finland entirely
		var defaultExtent = ol.extent.boundingExtent([ol.proj.fromLonLat([24.6603626,60.2241869]),ol.proj.fromLonLat([24.6603626,60.2241869])]);
		//var defaultExtent = ol.extent.getCenter(ol.proj.fromLonLat([24.6603626,60.2241869]));

	/* Section for dynamically coloring the points */

		// a javascript object literal can be used to cache
		// previously created styles. Its very important for
		// performance to cache styles.
		var styleCache = {};

		

		/* END: Section for dynamically coloring the points */

	/**
	 * Creates the three buttons that allow for drawing, applying and clearing selections
	 * //TODO, works only with one map instance
	 * @param layout - the layout object from Qlik Sense that is related to the map that should get the buttons
	 * @param backendApi - the backendApi object from Qlik Sense that is related to the map that should get the buttons
	 */
	

	/**
	 * Applies the selection, i.e. uses the drawn filtering areas to select the datapoints that are inside
	 * @param selectionSource - the vector layer containing the drawn selection polygons
	 * @param sourceData - an array containing the vector layers containing the Qlik Sense generated data points
	 * @param banckendApi - the backend api of the extension where from which the first two parameters are originating
	 */
	

	/**
	 * Checks if a feature is inside the drawed selection bounds
	 * @param feature - the feature to check
	 * @param selectionSource - The ol.source.Vector containing the drawn selection areas
	 */
	

	/**
	 * Adds popup functionality for the map with the given objectId
	 * @param objectId - The objectId (in Qlik Sense) of the map that should have the popup functionality added
	 */
	

	/**
	 * Event listener that shows a popup on the map location that was clicked.
	 * The popup contains information on the features that were clicked on
	 * @param event - the mouse click event
	 */
	


	/**
	 * Zooms the map to its default zoom state. If there are drawn selections, these drawings are zoomed to 
	 * fit. Otherwise it will zoom to the bounding box. If no bounding box is present it will zoom to default
	 * global zoom (Finland).
	 * @param map - the map to zoom
	 */
	function applyDefaultZoom(map){

		var extent = defaultExtent;

		// if(selectionSource.getFeatures().length > 0){
		// 	extent = selectionSource.getExtent();
		// }
		// else if (additionalRenderData.getFeatures().length > 0){
		// 	extent = additionalRenderData.getExtent();
		// }

		map.getView().fit(extent, map.getSize(), {maxZoom: maxZoom});

	}

	/**
	 * The extension definition itself
	 */
	return {
		initialProperties: {
			qHyperCubeDef: {
				qDimensions: [],
				qMeasures: [],
				qInitialDataFetch: [{
					qWidth: pageWidth,
					qHeight: pageHeight
				}]
			}
			
		},
		definition: {
			type: "items",
			component: "accordion",
			items: {
				dimensions: {
					uses: "dimensions",
					min: 1,
					max: 1
				},
				measures: {
					uses: "measures", // rename these expressions to be 1 = Latitude, 2 = Longitude, 3 = Value, 4 = The name printed in the popup box
					min: 4,
					max: 4
				},
				additional: {
					component: "expandable-items",
					label: "Additional rendering",
					items: {
						ownCoordinate: {
							type: "items",
							label: "Own coordinate",
							items: {
								OwnLatitude: {
									ref: "ownLatitude",
									label: "Own latitude",
									type: "number",
									expression: "optional"
								},
								OwnLongitude: {
									ref: "ownLongitude",
									label: "Own longitude",
									type: "number",
									expression: "optional"
								}
							}
						},
						boudingBox: {
							type: "items",
							label: "Bounding box",
							items: {
								BoundingBoxSouth: {
									ref: "bbSouth",
									label: "Bounding box south",
									type: "number",
									expression: "optional"
								},
								BoundingBoxNorth: {
									ref: "bbNorth",
									label: "Bounding box north",
									type: "number",
									expression: "optional"
								},
								BoundingBoxWest: {
									ref: "bbWest",
									label: "Bounding box west",
									type: "number",
									expression: "optional"
								},
								BoundingBoxEast: {
									ref: "bbEast",
									label: "Bounding box east",
									type: "number",
									expression: "optional"
								}
							}
						}
					}
				},
				settings: {
					uses: "settings"
				}
			}
		},
		snapshot: {
			canTakeSnapshot: true
		},
		paint: paint
	};

	function paint( $element, layout ) {
		var objectId = layout.qInfo.qId;
		var divId = "map_" + objectId;

		if(!map || $('#' + divId).length == 0) {

			$element.empty();
			$($element).append("<div id=" + divId + " style='height: 100%;position: relative;'>");

			/** contains the polygons the user draws when making selections*/
			selectionSource = new ol.source.Vector({wrapX: false});

			/**
			 * Contains the additional rendering guidelines comming from Qlik Sense
			 * like the bounding box and "my position"
			 */
			additionalRenderData = new ol.source.Vector({wrapX: false});

			/** create the source vectors for holding the QlikSense data  */
			sourceData = {};
			sourceData['Myyty'] =  new ol.source.Vector();
			sourceData['Myynnissä'] =  new ol.source.Vector();
			sourceData['default'] =  new ol.source.Vector();

			clusteringLayer = [];
			clusteringLayer['Myyty'] = new ol.source.Cluster({
				source: sourceData['Myyty'],
				distance: clusteringDistance
			});
			clusteringLayer['Myynnissä'] = new ol.source.Cluster({
				source: sourceData['Myynnissä'],
				distance: clusteringDistance
			});
			clusteringLayer['default'] = new ol.source.Cluster({
				source: sourceData['default'],
				distance: clusteringDistance
			});
			var aluePisteet = new ol.Feature({
            	geometry: new ol.geom.Polygon([
	                [
		                [24.6603626 ,60.2341869],
	                    [24.2603626 ,60.1341869],
	                    [24.3603626 ,60.3341869],
	                    [24.4603626 ,60.4341869],
	                    [24.6603626 ,60.2341869]
	                ]

            	])
        	});
        	aluePisteet.getGeometry().transform('EPSG:4326', 'EPSG:3857');
        	var myStyle = new ol.style.Style ({
          		fill: new ol.style.Fill({
             		color: 'rgba(0,255,0,0.3)'
           		})                                
        	});

			/** create the map itself */
			map = new ol.Map({
				target: divId,
				controls: ol.control.defaults(
					{
						rotate: false,
						attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
							collapsible: false
						})
					}),
					
					
				layers:
					[
						new ol.layer.Tile({ // layer for the background images
							source: new ol.source.OSM(),
							wrapX: false
						}),
						new ol.layer.Vector({
            				source: new ol.source.Vector({
                				features: [
                					aluePisteet
                				]

            				}),//here you miss the comma
            				style: myStyle
        				})
					
					// ,
					// 	new ol.layer.Vector({
					// 		source: additionalRenderData,
					// 		//source: selectionSource,
					// 		style: new ol.style.Style({
					// 			stroke: new ol.style.Stroke({
					// 				color: '#ff0000', // the border color of the bounding area
					// 				width: 1.5,
					// 				fill: new ol.style.Fill({
					// 					color: '#333333' //the fill color of the drawn polygon
					// 				})
					// 			}),
					// 			image: new ol.style.Icon({ // the icon for the home address
					// 				anchor: [0.5, 1],
					// 				scale: 0.33,
					// 				src: "/extensions/KMKartta/marker.png"
					// 			})
					// 		})
					// 	})
					// ,
					// 	new ol.layer.Vector({ // layer for drawn selection polygons
					// 		source: selectionSource,
					// 		style: new ol.style.Style({
					// 			fill: new ol.style.Fill({
					// 				color: 'rgba(255, 255, 255, 0.5)' //the fill color of the drawn polygon
					// 			}),
					// 			stroke: new ol.style.Stroke({
					// 				color: '#6A14CC', // the border color of the drawn polygon
					// 				width: 1.5
					// 			})
					// 		})
					// 	})
					],
				
				
		  	});
			

			

		  	map.getView().fit(defaultExtent, map.getSize(), {maxZoom: maxZoom})
		  	console.log(defaultExtent);
	  	}

	  	map.updateSize();

		var boundingBox = new ol.geom.Polygon(null);
		var swCoord = ol.proj.fromLonLat([parseFloat(layout.bbWest), parseFloat(layout.bbSouth)]);
		var neCoord = ol.proj.fromLonLat([parseFloat(layout.bbEast), parseFloat(layout.bbNorth)]);
		boundingBox.setCoordinates([
				[swCoord, [neCoord[0],swCoord[1]] ,neCoord,[swCoord[0], neCoord[1]],swCoord]
			]);

		var ownPoint = new ol.geom.Point(ol.proj.fromLonLat([parseFloat(layout.ownLongitude), parseFloat(layout.ownLatitude)]));

		additionalRenderData.clear(true);
		additionalRenderData.addFeature(
			new ol.Feature({
				geometry: boundingBox
			})
		);
		additionalRenderData.addFeature(
			new ol.Feature({
				geometry: ownPoint
			})
		);

	  	loadAllData(layout, this.backendApi);

		return qlik.Promise.resolve();
	}

	function loadAllData(layout, backendApi){

		debugTimestamp = Date.now();
		debugEngineWaitTime = 0;
		console.debug('[0ms] LoadAllData method started at ' + debugTimestamp);

		sourceData['Myyty'].clear(true);
		sourceData['Myynnissä'].clear(true);
		sourceData['default'].clear(true);
		console.debug('[' + (Date.now()-debugTimestamp) + 'ms] source data cleared');

		if(backendApi.getRowCount() < maxPlottedPoints) {
			plotDataPages(layout, backendApi, layout.qHyperCube.qDataPages, loadNextPage);
		}
		else{
			applyDefaultZoom(map);
			console.debug('Cannot draw ' + backendApi.getRowCount() + ' points. Filter to maximum ' + maxPlottedPoints + ' points');
		}


		//console.debug('End of loadAllData');
	}

	function plotDataPages (layout, backendApi, dataPages, callBack) {
		//console.debug('[' + (Date.now()-debugTimestamp) + 'ms] Plot pages started with ' + dataPages[0].qMatrix.length + ' rows, total loaded count ' + layout.qHyperCube.qDataPages.length);
		//debugTimestampSecondary = Date.now();

		//console.debug('plot ' + dataPages.length + ' pages');
		var minValue = layout.qHyperCube.qMeasureInfo[2].qMin;
		var maxValue = layout.qHyperCube.qMeasureInfo[2].qMax;
		var minMaxRange = maxValue - minValue;

		//buffer the features here and add them all at once
		var soldFeatures = [];
		var onSaleFeatures = [];
		var defaultFeatures = []

		for (var pageIdx = 0; pageIdx < dataPages.length; pageIdx++) {
			var dataPage = dataPages[pageIdx];
			//console.debug('plot page with ' + dataPage.qMatrix.length + ' rows');
			for (var rowIdx = 0; rowIdx < dataPage.qMatrix.length; rowIdx++) {
				var row = dataPage.qMatrix[rowIdx];
				if ( !(row[1].qIsNull || row[1].qNum == 'NaN'  || row[2].qIsNull|| row[2].qNum == 'NaN')) {
					//Create the feature point only if it has coordinates

					var lat = row[1].qNum;
					var long = row[2].qNum;
					var type = row[3].qText;
					var name = row[4].qText;

					var coordinate = ol.proj.fromLonLat([long, lat]); // lat is y and long is x, the projection needs them in x,y order (not the natural lat,long order)

					var feature = new ol.Feature({
						geometry: new ol.geom.Point(coordinate),
						qElemNumber: row[0].qElemNumber,
						name: name,
						type: type
					});
					switch (type) {
						case 'Myyty':
							soldFeatures.push(feature);
							break
						case 'Myynnissä':
							onSaleFeatures.push(feature);
							break
						default:
							defaultFeatures.push(feature);
							break
					}


					/**
					 * This checks that the Qlik selections are correct according to the drawed selection polygons.
					 * Relevant when the user makes a selection change outside of the map and the source data is 
					 * updated so that new entries appear on the map. Some of the newly appeard entries might be
					 * inside of the selection borders but are marked as outside by Qlik. Then we need to reapply
					 * the drawn selection to make sure that all points inside of the drawn borders are in the 
					 * selection.
					 */

					//only relevant if there are drawn selection borders. If the selection is dirty already, we don't need to check any more
					if(!selectionIsDirty && selectionSource.getFeatures().length > 0) 
						
						switch(type) {
							case 'Myyty':
							case 'Myynnissä':
								// the points selection state in QS is inside of the selection
								// dirty if the coordinates are outside the drawn selection area
								if(!isFeatureInSelection(feature, selectionSource)) {
									selectionIsDirty = true;
								}
								break;
							default: 
								// the points selection state in QS is outside of the selection
								// dirty if the coordinates are inside the drawn selection area
								if(isFeatureInSelection(feature, selectionSource)) {
									selectionIsDirty = true; 
								}
								break;
						}

				}
				else {
					//Skip the data point since it has no coordinates
				}
			}
		}

		sourceData['Myyty'].addFeatures(soldFeatures);
		sourceData['Myynnissä'].addFeatures(onSaleFeatures);
		sourceData['default'].addFeatures(defaultFeatures);

		applyDefaultZoom(map, sourceData);

		//console.debug('[' + (Date.now()-debugTimestampSecondary) + 'ms] ' + dataPages[0].qMatrix.length + ' rows added');
		if(callBack)
			callBack(layout, backendApi);
	}

	function loadNextPage (layout, backendApi) {
		var fetchedRows = 0;
		$.each(layout.qHyperCube.qDataPages, function( index, dataPage) {
			//console.debug('Rows in data page ' + index + ': ' + dataPage.qMatrix.length);
			fetchedRows = fetchedRows + dataPage.qMatrix.length;
		});
		//console.debug('fetchedRows: ' + fetchedRows);
		var rowsToFetch = Math.min( pageHeight, backendApi.getRowCount() - fetchedRows );
		//console.debug('Rows to fetch: ' + rowsToFetch);
		var requestPage = [{
			qTop: fetchedRows, //the index is 0-based
			qLeft: 0,
			qWidth: pageWidth, //should be # of columns
			qHeight: rowsToFetch
		}];

		if(rowsToFetch > 0) {
			debugTimestampSecondary = Date.now();
			backendApi.getData( requestPage ).then( function ( dataPages ) {
				//console.debug('[' + (Date.now()-debugTimestampSecondary) + 'ms] time used to fetch one page from engine');
				debugEngineWaitTime = debugEngineWaitTime + (Date.now()-debugTimestampSecondary);
				plotDataPages(layout, backendApi, dataPages, loadNextPage);
			});
		}
		else{
			console.debug('TOTAL plotting time: ' + (Date.now()-debugTimestamp) + 'ms');
			console.debug('TOTAL engine waiting time: ' + debugEngineWaitTime + 'ms');

			if(selectionIsDirty) {
				selectionIsDirty = false;
				//check if some points are inside the selection area but are not selected
				console.debug('selection is dirty, applying the filter again.');
				applySelection(selectionSource, sourceData, backendApi);		
			}
		}
	}

} );
