
function getTypeShortening(type){
	switch (type) {
        case 'Rural': return 'Rur.';
        case 'Detention': return 'Det.';
        case 'Urban': return 'Urb.';
        case 'Health facilities': return 'Health';
		case 'ICRC premises': return 'Prem.';
    }
}

function getDomainShortening(domain){
	switch (domain) {
        case 'Safe drinking water supply': return 'A';
        case 'Building rehabilitation & construction': return 'B';
        case 'Sanitation & environmental health': return 'C';
        case 'Transitional human settlements': return 'D';
		case 'Energy supply': return 'E';
    }
}

function getMarkerBounds(marker) {
	var pointCoords = marker.getLatLng();
	var sw = L.latLng(pointCoords.lat-0.01,pointCoords.lng-0.01);
	var ne = L.latLng(pointCoords.lat+0.01,pointCoords.lng+0.01);
	return L.latLngBounds([sw,ne]);
}

function getBoundsFromMarkerList(markerList) {
    if (markerList.length != 0) {
		var bounds = getMarkerBounds(markerList[0]);
		for ( var i = 1, il = markerList.length; i < il; i++ ) {
			var nextBounds = getMarkerBounds(markerList[i]);
			bounds.extend(nextBounds);
		}
		return bounds;
	} else { return initialBounds; }
}
function getPointBounds(lat,lng,buffer) {
	return L.latLngBounds([[lat-buffer,lng-buffer],[lat+buffer,lng+buffer]]);
}

function delayexec() {
    var timer;
    function exec(call, delay) {
        clearTimeout(timer);
        timer = setTimeout(call, delay);
    }
    return exec;
};
var redrawdelay = delayexec();

//Disable-Enable
jQuery.fn.extend({
    disable: function(state) {
        return this.each(function() {
            this.disabled = state;
        });
    }
});

function formatDate(date) {
    var month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var d = new Date(date);
    var date = d.getDate();
    var month = d.getMonth();
    var year = d.getFullYear();
    return month_names[month] + " " +  date + ", " + year;
}

var permalinkVisible = false;
$('#togglePermalink').on('click',function(){
	updatePermalink();
	$('#permalink').slideToggle(300);
	if (permalinkVisible == true) { permalinkVisible = false; $('#togglePermalink').text('Share view');	}
	else { permalinkVisible = true;	$('#togglePermalink').text('Hide sharing link'); }
});

function updatePermalink(){
	
    $('#permalink').text(location.href);
	
	$('#permalink').append('<a>  <i class="fa fa-files-o" id="copyUrl" title="Copy link to clipboard"></i></a>');
	$('#copyUrl').on('click',function(){
		copyToClipboard(location.href)
	});
}

function updateCurrentBounds(){
    currentBounds = [[Math.round(map.getBounds()._southWest.lat,2),
                                      Math.round(map.getBounds()._southWest.lng,2)],
                                     [Math.round(map.getBounds()._northEast.lat,2),
                                      Math.round(map.getBounds()._northEast.lng,2)]];
}

// 'improve' Math.round() to support a second argument
var _round = Math.round;
Math.round = function(number, decimals /* optional, default 0 */)
{
  if (arguments.length == 1)
    return _round(number);

  var multiplier = Math.pow(10, decimals);
  return _round(number * multiplier) / multiplier;
}
// examples
//Math.round('123.4567', 2); // => 123.46
//Math.round('123.4567');    // => 123

function copyToClipboard(text) {
	window.prompt("Copy to clipboard: Ctrl+C ( Cmd-C for Mac), Enter", text);
}
function addCommas(nStr) {
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + "," + '$2');
    }
    //return x1 + x2; pour les chiffre après la virgule
    return x1 ;
};

function addEventHandlers() {
	$('#reset').on('click',function(){

		filterFromCode = true;
		wpa_datatable.fnFilter('');
		
		cf.Project_Type.filter(null);
		cf.Project_Domain.filter(null);
		cf.Execution_Country_Code.filter(null);
		cf.OBJECTID.filter(null);

		
		dc.filterAll();
		
		map.fitBounds(initialBounds);

		timeOut=setTimeout("dc.redrawAll()",1000);

		filterFromCode = false;
	});

	window.onresize = function(event) {
		dc.renderAll(); 
	};

	$("input").on("keyup", function() { 
			var value = $( this ).val();
			tableSearch = value;
			getPermalink(wpaYear);
		})
		.keyup();
	$('#btnCountry').on('click',function() {
		window.open('https://GISupportICRC.github.io/wathab/projectview/#year=' + wpaYear + '&country=');
	});
}	