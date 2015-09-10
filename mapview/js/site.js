//debugger;

var wathabService = 'https://services1.arcgis.com/HCIJ2DmtdLnNlsE1/arcgis/rest/services/wathab_sample/FeatureServer/0';

// Implement bookmarking chart filters status
// Serializing filters values in URL
function getPermalink(year) { // from https://github.com/Edouard-Legoupil/3W-Dashboard/blob/gh-pages/index.html
    var filters = [
        { name: 'year', value: year},
        { name: 'country', value: country_chart.filters()},
		{ name: 'type', value: projectType_chart.filters()},
		{ name: 'domain', value: projectDomain_chart.filters()},
        { name: 'mapBounds', value: currentBounds},
        { name: 'mapBase', value: [activeBasemap]},
		{ name: 'search', value: [tableSearch]}
    ];
    var recursiveEncoded = $.param( filters );
    location.hash = recursiveEncoded;
	updatePermalink();
}

var defaultYear = "";
var wpaYear = "";
var tableSearch = "";

var filterFromCode = false;

var country_chart = dc.rowChart("#div_country_chart");
var projectType_chart = dc.rowChart("#div_projectType_chart");
var projectDomain_chart = dc.rowChart("#div_projectDomain_chart");

var wpa_datatable = $("#div_table");

var cf;
var projectsForType = [];
var projectsForDomain = [];
var projectsForCountry = [];
var tableFilter = [];

var wpaIcon = L.icon({
    iconUrl: 'images/icons/wpa_icon.png',
    iconSize:     [18, 18], // size of the icon
    iconAnchor:   [9, 9], // point of the icon which will correspond to marker's location
});

var basemap_ICRC_Satellite = L.tileLayer('https://{s}.tiles.mapbox.com/v3/icrc.kog47201/{z}/{x}/{y}.png');//.addTo(map);	
var basemap_ICRC_LightGrey = L.tileLayer('https://{s}.tiles.mapbox.com/v3/icrc.kog3k65g/{z}/{x}/{y}.png');//.addTo(map);	
var basemap_ICRC_DarkGrey = L.tileLayer('https://{s}.tiles.mapbox.com/v3/icrc.l2pfifpp/{z}/{x}/{y}.png');//.addTo(map);	
var basemap_ICRC_Terrain = L.tileLayer('https://{s}.tiles.mapbox.com/v3/icrc.l0jcnplj/{z}/{x}/{y}.png');//.addTo(map);	

var map = L.map('map',{
	center:[10, 10], // y,x
	zoom: 2,
	maxZoom:16,
	minZoom:1,
	layers: [basemap_ICRC_LightGrey],
    attributionControl: true
});

map.attributionControl.addAttribution("© <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap contributors</a>, <a href='http://www.icrc.org'>ICRC</a>. Boundaries, names and designations used on this map do not imply official endorsement or acceptance by the ICRC.");

var activeBasemap = 'ICRC LightGrey';
var defaultBasemap = 'ICRC LightGrey';
var initialBounds = map.getBounds();
var currentBounds;

var baseLayers = {
	"ICRC DarkGrey"	: basemap_ICRC_DarkGrey,
	"ICRC LightGrey": basemap_ICRC_LightGrey,
	"ICRC Terrain"	: basemap_ICRC_Terrain,
	"ICRC Satellite": basemap_ICRC_Satellite
};

var wpaCluster = L.markerClusterGroup({
	showCoverageOnHover		: false,
	maxClusterRadius		: 75,
	//disableClusteringAtZoom	: 8,
	spiderfyOnMaxZoom		: true
});
var overlays = {
	"Wathab projects": wpaCluster,
};
map.addLayer(wpaCluster);
var layerControl = L.control.layers(baseLayers).addTo(map);

//search by name - nominatim gazetteer
var geocoder = L.Control.geocoder({
	position		: "topleft",
	showResultIcons	: false,
	placeholder		: "Search location..."
	}).addTo(map);
var geocoderResult;
geocoder.markGeocode = function(result) {
	//add a marker at the result of the search
	geocoderResult = new L.Marker(result.center, {draggable:true});
    map.addLayer(geocoderResult);
	map.fitBounds( result.bbox );
    geocoderResult.bindPopup(result.name).openPopup();
};
	
map.on('click', function(e) {         
		//if geocoderResult exists... remove the marker
		if (typeof geocoderResult != 'undefined') { map.removeLayer(geocoderResult); }
    });

// control that shows Project title on hover
var info = L.control({ position: 'bottomleft'});
info.onAdd = function (map) {
	this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
	this.update();
	return this._div;
};
info.update = function (wpaTitle) {
	this._div.innerHTML = (wpaTitle ?
		'<b>' + wpaTitle + '</b>'
		: 'Hover over a Wathab Project');

};
	

// AJAX to get the existing years (Budget_Year) on the service sorted smaller to bigger
$.getJSON( wathabService + "/query?where=1%3D1&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=Budget_Year&returnGeometry=false&maxAllowableOffset=&geometryPrecision=&outSR=&returnIdsOnly=false&returnCountOnly=false&orderByFields=Budget_Year&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&returnDistinctValues=true&f=pjson", function( wpa_years ) {

	//try {
	//Block of code to try

	// Sets as default year the biggest one (last item on the list)
	defaultYear = wpa_years.features[wpa_years.features.length - 1].attributes.Budget_Year;

	// function to read the selected year from the hash of the href --> wpaYear
	// if it is not defined, it sets the default year as the selected one
	function setWpaYear() {
		filterFromCode = true;
		
		// Get hash values
		// 2 options: 1) only year or 2) year + filters
		var parseHashYear = /^#year=([0-9]*)$/;
		var parseHash = /^#year=([0-9]*)&country=([A-Za-z0-9,_\-\/\s]*)&type=([A-Za-z0-9,_\-\/\+\s]*)&domain=([A-Za-z0-9,_\-\/\+\s]*)&mapBounds=([A-Za-z0-9,_\-\/\.\s]*)&mapBase=([A-Za-z0-9,_\-\/\+\s]*)&search=([A-Za-z0-9,_\-\/\+\s]*)$/;
		
		var parsedYear = parseHashYear.exec(decodeURIComponent(location.hash));
		if (parsedYear) {
			if (parsedYear[1] == "") {
				wpaYear = defaultYear;
			}
			else {
				wpaYear = parsedYear[1];
			}
		}
		else {
			var parsed = parseHash.exec(decodeURIComponent(location.hash));
			function getYear(rank){
				if (parsed[rank] == "") {
					wpaYear = defaultYear;
				}
				else {
					wpaYear = parsed[rank];
				}
			}
			if (parsed) {
				getYear(1);
			}
			else { 
				wpaYear = defaultYear;  
			}
		}
		filterFromCode = false;
	}

	setWpaYear();

	// Fill the dropdown menu with the obtained years
	$('#btnYear').text(wpaYear);
	function getYearHref(y) {
		var href = location.href;
		var root = location.href.split('#')[0];
		var yearHash = '#year=' + y;
		var newHref = root + yearHash;
		return newHref;
	}
	for (var i = wpa_years.features.length - 1; i >= 0; i--) {
		if (wpa_years.features[i].attributes.Budget_Year != null && wpa_years.features[i].attributes.Budget_Year != wpaYear) {
			var year = wpa_years.features[i].attributes.Budget_Year;
			$('#drpdwnYear').append('<li><a href="' + getYearHref(year) + '">' + year + '</a></li>');
		}
	}

	$('#drpdwnYear li a').on('click',function(){
		window.location.href = this.href;
		window.location.reload();
	});

	var nextWpaYear = Number(wpaYear) + 1;

	// AJAX Request to get the projects of the selected year (wpaYear)
	// date query in arcgis online: 
	var online = {
		dateQuery: "/query?where=Actual_End_Date+<+%27" + nextWpaYear + "-01-01+00%3A00%3A00%27+AND+Actual_End_Date+>+%27" + wpaYear + "-01-01+00%3A00%3A00%27",
		parameters: "&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&distance=&units=esriSRUnit_Meter&outFields=*&returnGeometry=false&maxAllowableOffset=&geometryPrecision=&outSR=&returnIdsOnly=false&returnCountOnly=false&returnExtentOnly=false&returnDistinctValues=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&resultOffset=&resultRecordCount=&returnZ=false&returnM=false&quantizationParameters=&f=pjson&token="
	}
	// date query in arcgis server (not used in this example):
	var server = {
		dateQuery: "/query?where=Actual_End_Date+%3C+date+%27" + nextWpaYear + "-01-01+00%3A00%3A00%27+AND+Actual_End_Date+%3E+date+%27" + wpaYear + "-01-01+00%3A00%3A00%27",
		parameters: "&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=*&returnGeometry=false&maxAllowableOffset=&geometryPrecision=&outSR=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&returnDistinctValues=false&f=pjson"
	}
	$.getJSON( wathabService + online.dateQuery + online.parameters, function( wpa ) {
		
		if (wpa.features.length == 0) {
			alert("There are not data available for the selected year. Please choose another one." );
		}
		else {
			// **** Crossfilter set up ****
			cf = crossfilter(wpa.features);
			console.log(wpa.features);

			// reduce functions to get Total cost by PROJECT having duplicated entries in crossfilter (different entry, same project number)
			function findIndexByValue(keyInd, keyVal, array) {
				for (var i = 0; i < array.length; i++) {
					if (array[i][keyInd] == keyVal) {
						return i;
					}
				}
				return null;
			}

			// projectList = ['identifier', repetition#];
			function reduceAddSumNoDup(attr1,attr2,projectList) {
				return function(p,v) {
					//debugger;
					var vAttrs = v.attributes;
					var index = findIndexByValue(0, vAttrs[attr1], projectList);
					if (index != null) {
						if (projectList[index][1] == 0) {
							++p.count;
							p.sum += vAttrs[attr2];
						}
						++projectList[index][1];
					}
					else {
						projectList.push([vAttrs[attr1],1]);
						++p.count;
						p.sum += vAttrs[attr2];
					}
					return p;
				};
			}
			function reduceRemoveSumNoDup(attr1,attr2,projectList) {
				return function(p,v) {
					var vAttrs = v.attributes;
					var index = findIndexByValue(0, vAttrs[attr1], projectList);
					--projectList[index][1];
					if (projectList[index][1] == 0) {
						--p.count;
						p.sum -= vAttrs[attr2];
					}
					return p;
				};
			}
			function reduceInitSumNoDup() {
			  return {count:0, sum:0};
			}
			function orderValue(p) {
			  return p.sum;
			}

			cf.Project_Type = cf.dimension(function(d){ return d.attributes.Project_Type; });
			cf.Project_Domain = cf.dimension(function(d){ return d.attributes.Project_Domain; });
			cf.Execution_Country_Code = cf.dimension(function(d){ return d.attributes.Execution_Country_Code; });
			cf.Lat = cf.dimension(function(d){ return +d.attributes.Location_Coordinate_Y; });
			cf.Lng = cf.dimension(function(d){ return +d.attributes.Location_Coordinate_X; });
			cf.OBJECTID = cf.dimension(function(p) { return p.attributes.OBJECTID; });
			cf.Project_Number = cf.dimension(function(p) { return p.attributes.Project_Number; });

			var Project_Type_TotalCost = cf.Project_Type.group().reduce(reduceAddSumNoDup('Project_Number','Total_Cost',projectsForType), reduceRemoveSumNoDup('Project_Number','Total_Cost',projectsForType), reduceInitSumNoDup).order(orderValue);
			var Project_Domain_TotalCost = cf.Project_Domain.group().reduce(reduceAddSumNoDup('Project_Number','Total_Cost',projectsForDomain), reduceRemoveSumNoDup('Project_Number','Total_Cost',projectsForDomain), reduceInitSumNoDup).order(orderValue);
			var Execution_Country_Code = cf.Execution_Country_Code.group().reduceCount();
			var Execution_Country_Code_TotalCost = cf.Execution_Country_Code.group().reduce(reduceAddSumNoDup('Project_Number','Total_Cost',projectsForCountry), reduceRemoveSumNoDup('Project_Number','Total_Cost',projectsForCountry), reduceInitSumNoDup).order(orderValue);

			var Lat = cf.Lat.group().reduceCount();
			var Lng = cf.Lng.group().reduceCount();
			var OBJECTID = cf.OBJECTID.group().reduceCount();
			var Project_Number = cf.Project_Number.group().reduceCount();

			var all = cf.groupAll();

			projectType_chart.width(300).height(180)
					.dimension(cf.Project_Type)
					.group(Project_Type_TotalCost) //Project_Type//Project_Type_TotalCost
					.valueAccessor(function(p) { return p.value.sum; })
					//.label(function(d) { return getDomainShortening(d.key); })
					.title(function(d) { return d.key + ": " + addCommas(d.value.sum) + " CHF"; })
					.elasticX(true)
					.data(function(group) {
						return group.top(5);
					})
					.colors(['#6DDC7A'])
					.colorAccessor(function(d, i){ return 0;})
					.xAxis().ticks(4).tickFormat(d3.format("s"));
			
			projectDomain_chart.width(300).height(180)
					.dimension(cf.Project_Domain)
					.group(Project_Domain_TotalCost)//Project_Domain//Project_Domain_TotalCost
					.valueAccessor(function(p) { return p.value.sum; })
					//.label(function(d) { return getDomainShortening(d.key); })
					.title(function(d) { return d.key + ": " + addCommas(d.value.sum) + " CHF"; })
					.elasticX(true)
					.data(function(group) {
						return group.top(5);
					})
					.colors(['#F69BA0'])
					.colorAccessor(function(d, i){ return 0;})
					.xAxis().ticks(4).tickFormat(d3.format("s"));

			function tooLongString(string,max) {
				if (string.length > max) { return true; }
				else { return false; }
			}

			country_chart.width(250).height(280)
					.dimension(cf.Execution_Country_Code)
					.group(Execution_Country_Code_TotalCost)//Execution_Country_Code)
					.valueAccessor(function(p) { return p.value.sum; })
					.label(function(d) { return tooLongString(countries[d.key],20) ? d.key : countries[d.key]; }) //variable = (condition) ? true-value : false-value;
					.title(function(d) { return countries[d.key] + ": " + addCommas(d.value.sum) + " CHF"; })
					.elasticX(true)
					.data(function(group) {
						return group.top(10);
					})
					.colors(['#9fbed6'])
					.colorAccessor(function(d, i){ return 0;})
					.xAxis().ticks(4).tickFormat(d3.format("s"));

			dc.dataCount("#RecipientNumber")
				.dimension(cf)
				.group(all);

			// **** Table ****		
			wpa_datatable.dataTable({
				"bPaginate": true,
				"bLengthChange": false,
				"bFilter": true,
				"bSort": true,
				"bInfo": false,
				"bAutoWidth": false,
				"bDeferRender": true,
				"aaData": cf.Execution_Country_Code.top(Infinity),
				"bDestroy": true,
				"sDom": 'T<"clear">lfrtip',
				"oTableTools": {
						"sSwfPath": "swf/copy_csv_xls_pdf.swf",
						"aButtons": [
							{
								"sExtends": "copy",
								"sButtonText": "Copy to clipboard"
							},
							"print",
							{
								"sExtends":    "collection",
								"sButtonText": "Save",
								"aButtons":    [ "csv", "xls", "pdf" ]
							}
						]
					},
				"aoColumns": [
					{ "mData": "attributes.Location_Name", "sDefaultContent": ""},
					{ "mData": "attributes.Project_Number", "sDefaultContent": ""},
					{ "mData": "attributes.Title", "sDefaultContent": ""},
					{ "mData": "attributes.Execution_Country_Code", "sDefaultContent": ""},
					{ "mData": "attributes.Admin_Entity_Code", "sDefaultContent": ""}
					]
			});
				
			$("#div_table").on('click', 'tr', function(event){
				var position = wpa_datatable.fnGetPosition(this); // getting the clicked row position
				var attrs = wpa_datatable.fnGetData(position).attributes;
				map.fitBounds(getPointBounds(attrs.Location_Coordinate_Y,attrs.Location_Coordinate_X,0.01)); //zoom to project
				showProjectDetails(attrs); //showModal
				
			});
				
			function refreshTable() {
				alldata = cf.Execution_Country_Code.top(Infinity);
				wpa_datatable.fnClearTable();
				wpa_datatable.fnAddData(alldata);
				wpa_datatable.fnDraw();
			}	
			function chartFiltered() {
				filterFromCode = true;
				
				cf.OBJECTID.filter(null);
				dc.events.trigger(function () {
					if (country_chart.filters().length == 1) {
						$('#btnGotoCountry').prop('disabled', false);
						$('#btnGotoCountry a').attr('href', 'https://GISupportICRC.github.io/wathab/projectview/#year=' + wpaYear + '&country=' + country_chart.filters()[0]);
					}
					else { 
						$('#btnGotoCountry').prop('disabled', true);
					}
					refreshTable();
					if (tableFilter.length != 0) {
						cf.OBJECTID.filter(function(d){
							return tableFilter.indexOf(d) > -1;
						});
					}
					geofilter();
					updateMapPoints(); // refresh map
				});

				getPermalink(wpaYear);
				filterFromCode = false;
			}

			for (var i = 0; i < dc.chartRegistry.list().length; i++) {
				var chartI = dc.chartRegistry.list()[i];
				chartI.on("filtered", function(chart, filter){ if (filterFromCode === false) { chartFiltered(chart); }});
			}		

			wpa_datatable.on( 'draw.dt', function () {
				if (filterFromCode === false) {
					filterFromCode = true;
					
					var oTT = TableTools.fnGetInstance( 'div_table' );
					oTT.fnSelectNone();
					oTT.fnSelectAll(true);
					var aData = oTT.fnGetSelectedData();

					cf.OBJECTID.filter(null);

					// filtering a crossfilter object dimension on multiple values --> was not implemented on crossfilter library
					// Solution --> create array of things you want to filter (tableFilter)
					tableFilter = [];
					if (aData.length != 0){
						//debugger;
						if (typeof(aData[0] != 'undefined')) {
							if (typeof(aData[0].attributes) != 'undefined') {
								if (typeof(aData[0].attributes.OBJECTID) != 'undefined' ) {
									for (var i = 0; i < aData.length; ++i)
									{
										tableFilter.push(aData[i].attributes.OBJECTID);
									}
								}
							}
						}
					}
					// filter function to check if the value lies in that array and filter accordingly
					cf.OBJECTID.filter(function(d){
						return tableFilter.indexOf(d) > -1;
					});
					
					updateMapPoints(); // refresh map
					dc.redrawAll();
					
					oTT.fnSelectNone();
					getPermalink(wpaYear);
					filterFromCode = false;
				}
			});

			//the datapoints on the map
			function updateMapPoints() {
				filterFromCode = true;
				//debugger;
				//remove all markers from the map in order to be able to do a refresh
				wpaCluster.clearLayers();
				
				
				if (!map.hasLayer(wpaCluster)) return;
				map.removeLayer(wpaCluster);
				
				var markerList = [];
				
				cf.Execution_Country_Code.top(Infinity).forEach(function(p, i) {

					if (!p.attributes["Location_Coordinate_Y"] || !p.attributes["Location_Coordinate_X"] ) {
						return;
					}

					var wpaMarker = L.marker([p.attributes.Location_Coordinate_Y,p.attributes.Location_Coordinate_X], {icon: wpaIcon}); // in lat-long
					wpaMarker.on('mouseover',function (e) {
						info.addTo(map);
						info.update(p.attributes.Title);
					});
					wpaMarker.on('mouseout',function (e) {
						info.update();
						info.removeFrom(map);
					});
					//on click, show the specific project
					wpaMarker.on('click',function () {
						var attr = p.attributes;
						return function() {
							showProjectDetails(attr); //showModal
						}
					}());
					
					markerList.push(wpaMarker);
					
					//add the marker to the map
					wpaCluster.addLayer(wpaMarker);
				});
				
				map.addLayer(wpaCluster);
				filterFromCode = false;
			}
			
			function geofilter() {
				filterFromCode = true;

				cf.Lat.filter(null);
				cf.Lng.filter(null);
				cf.OBJECTID.filter(null);
				
				if (map.hasLayer(wpaCluster)) {
					var bounds = map.getBounds();
					var lat = [bounds.getNorthEast()["lat"], bounds.getSouthWest()["lat"]];
					var lng = [bounds.getNorthEast()["lng"], bounds.getSouthWest()["lng"]];
					lat = lat[0] < lat[1] ? lat : [lat[1], lat[0]];
					lng = lng[0] < lng[1] ? lng : [lng[1], lng[0]];
					cf.Lat.filter(lat);
					cf.Lng.filter(lng);
				}
				filterFromCode = false;
			};
			
			
			map.on('baselayerchange', function (eventLayer) {
				activeBasemap = eventLayer.name;
				getPermalink(wpaYear);
			});
			map.on("moveend", function() {
				filterFromCode = true;
				if (map.hasLayer(wpaCluster)) {
					geofilter();
					refreshTable();
					dc.redrawAll();
				}
				updateCurrentBounds();
				getPermalink(wpaYear);
				filterFromCode = false;
			});

			//turn red the cluster marker on the map
			wpaCluster.on('clustermouseover', function (a) {
				//add style hovered to the cluster icon, meaning it turns red
				$(a.layer._icon).addClass('hovered');				
			});
			//when the cursor moves out, we remove the red color and remove location name
			wpaCluster.on('clustermouseout',function (a) {
				$(a.layer._icon).removeClass('hovered');
			});

			function initDashboard() {
				//debugger;
				filterFromCode = true;
				// Get hash values
				var parseHash = /^#year=([0-9]*)&country=([A-Za-z0-9,_\-\/\s]*)&type=([A-Za-z0-9,_\-\/\+\s]*)&domain=([A-Za-z0-9,_\-\/\+\s]*)&mapBounds=([A-Za-z0-9,_\-\/\.\s]*)&mapBase=([A-Za-z0-9,_\-\/\+\s]*)&search=([A-Za-z0-9,_\-\/\+\s]*)$/;
			
				var parsed = parseHash.exec(decodeURIComponent(location.hash));
				function filter(chart, rank) {  // for instance chart = sector_chart and rank in URL hash = 1
					// sector chart
					if (parsed[rank] == "") {
						chart.filter(null);
					}
					else {
						var filterValues = parsed[rank].split(",");
						for (var i = 0; i < filterValues.length; i++ ) {
							var filt = filterValues[i].replace(/\+/gi, ' ');
							chart.filter(filt);
						}
					}
				}
				function setBounds(map, rank){
					if (parsed[rank] == "") { map.fitBounds(initialBounds); }
					else {
						 var coords = parsed[rank].split(",");
						 map.fitBounds([
							[Number(coords[0]),Number(coords[1])],
							[Number(coords[2]),Number(coords[3])]
						])
					}
				}
				function setBasemap(map, rank){
					var baseLayer = parsed[rank].replace(/\+/gi, ' ');
					if (parsed[rank] != "" && baseLayer != defaultBasemap) {
						map.removeLayer(baseLayers[defaultBasemap]);
						map.addLayer(baseLayers[baseLayer]);
					}
				}
				function setSearch(input, rank){
					var textSearch = parsed[rank].replace(/\+/gi, ' ');
					if (textSearch != "") {
						$(input).val(textSearch);
					}
				
				}
				if (parsed) {
					filter(country_chart, 2);
					filter(projectType_chart, 3);
					filter(projectDomain_chart, 4);
					setBounds(map, 5);
					setBasemap(map,6);
					setSearch('input',7);
					if (country_chart.filters().length == 1) {
						$('#btnGotoCountry').prop('disabled', false);
						$('#btnGotoCountry a').attr('href', 'https://GISupportICRC.github.io/wathab/projectview/#year=' + wpaYear + '&country=' + country_chart.filters()[0]);
					}
				}
				else { 
					map.fitBounds(initialBounds);  
				}
				
				updateMapPoints();
				geofilter();
				dc.renderAll();
				getPermalink(wpaYear);
				filterFromCode = false;
			}

			$('#loading').slideToggle(300);
			initDashboard();
			addEventHandlers();


			function getByValue(arr, value) {
			  for (var i=0, iLen=arr.length; i<iLen; i++) {
				if (arr[i].attributes.OBJECTID == value) return arr[i].attributes;
			  }
			}

			function avoidNull(value) {
				if (value == null) { return 'Not available'; }
				return value;
			}

			window.showProjectDetails = function (attributes) {
				
				$("#projectTitle").text(avoidNull(attributes.Title));
				$("#recipientPlace").text(avoidNull(attributes.Location_Name));
				$("#projectNumber").text(avoidNull(attributes.Project_Number));
				$("#targetBeneficiaries").text(avoidNull(attributes.Targeted_Pop_Number));
				$("#startDate").text(avoidNull(formatDate(attributes.Actual_Start_Date)));
				$("#endDate").text(avoidNull(formatDate(attributes.Actual_End_Date)));
				
				$('#btnSeePDF').unbind("click").click(function(){
					window.open('https://GISupportICRC.github.io/wathab/projectpdf/' + attributes.Project_Number + '.pdf');
				});
				$('#btnGotoProject a').attr('href', 'https://GISupportICRC.github.io/wathab/projectview/#year=' + wpaYear + '&country=' + attributes.Execution_Country_Code + '&go=' + attributes.Oc_Code + '&so=' + attributes.So_Code + '&project=' + attributes.Project_Number);
				
				$('#myModal').modal('show');
			
			}

		} // end of if (wpa.features.length != 0)

	}).fail( function(jqxhr, textStatus, error) {onAjaxError(jqxhr, textStatus, error)} ); //end of ajax callback - projects
	
	/*catch(err) {
		//Block of code to handle errors
		//var err = textStatus + ", " + error;
		console.log("error!!!!!!");
		if (err == "Cannot read property 'select' of undefined") {
			window.prompt("Sorry, there is a problem with the requested filter. Please open the following url to continue to WatHab Dashboard - Mapview", location.protocol+'//'+location.hostname+location.pathname);
		}
		else {
			$("#mainContainer").html('');
			$("#mainContainer").html('</p>Sorry, we have a problem at this moment. Please report it to <a href="mailto:gisupport@icrc.org">gisupport@icrc.org</a>. ' + err + '</p>')
			//alert( "Sorry, we have a problem at this moment. Request Failed: " + err );
			//return;
		}
	}*/
	
}).fail( function(jqxhr, textStatus, error) {onAjaxError(jqxhr, textStatus, error)} ); //end of ajax callback - years

function onAjaxError(jqxhr, textStatus, error){
    var err = textStatus + ", " + error;
    $("#mainContainer").html('');
    $("#mainContainer").html('</p>Sorry, we have a problem at this moment. Please report it to <a href="mailto:gisupport@icrc.org">gisupport@icrc.org</a>. Request Failed: ' + err + '</p>')
}